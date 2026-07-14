import { normalizeDocument, type TextDocument } from "./model";
import {
  deleteDocument as deleteLocalDocument,
  listDocuments as listLocalDocuments,
  saveDocument as saveLocalDocument,
} from "./storage";

/**
 * Cliente de la "unidad" de archivos multientorno. Habla con la API Go
 * (`/api/v1/documents` y `/api/v1/folders`) para persistir documentos y su
 * organización en el servidor —de modo que estén disponibles desde cualquier
 * equipo— y reconcilia ese catálogo con la copia local en IndexedDB.
 *
 * La organización (carpeta, destacado, papelera) vive solo en el servidor: son
 * metadatos del catálogo, no del documento, y la API los conserva cuando se
 * guarda el contenido.
 */

const DOCS_URL = "/api/v1/documents";
const FOLDERS_URL = "/api/v1/folders";
const HEALTH_URL = "/health";

/** Dónde vive físicamente un documento del catálogo. */
export type DriveLocation = "cloud" | "local" | "both";

export interface DriveFolder {
  id: string;
  name: string;
  parentId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ficha de un documento en el catálogo. Deliberadamente NO incluye el
 * documento: la lista se pinta con estos metadatos, y el contenido solo se pide
 * al abrirlo. Así una unidad con cien documentos no transfiere cien documentos.
 */
export interface DriveEntry {
  id: string;
  title: string;
  schemaVersion: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  location: DriveLocation;
  cloudRevision: number | null;
  localRevision: number | null;
  /** `true` cuando la copia local y la de la nube difieren en revisión. */
  outOfSync: boolean;
  /** Carpeta que lo contiene; cadena vacía es la raíz. */
  folderId: string;
  starred: boolean;
  trashed: boolean;
  /** Extracto y conteo, calculados al guardar y guardados junto al registro. */
  preview: string;
  wordCount: number;
  /** Texto en minúsculas para filtrar sin tocar el documento. */
  searchText: string;
}

export interface DriveCatalog {
  entries: DriveEntry[];
  folders: DriveFolder[];
  cloudOnline: boolean;
}

interface CloudSummary {
  id: string;
  title: string;
  kind: string;
  schemaVersion: number;
  revision: number;
  folderId: string;
  starred: boolean;
  trashedAt: string | null;
  preview: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CloudRecord extends CloudSummary {
  content: TextDocument;
}

/** Extracto, conteo y texto de búsqueda: un solo recorrido del documento. */
function derive(document: TextDocument): { preview: string; wordCount: number; searchText: string } {
  const text = documentPlainText(document).replace(/\s+/g, " ").trim();
  return {
    preview: text.length <= 180 ? text : `${text.slice(0, 180).trimEnd()}…`,
    wordCount: text ? text.split(" ").length : 0,
    searchText: `${document.metadata.title} ${text}`.toLowerCase(),
  };
}

// El extracto y el conteo no se envían: los deriva el servidor del contenido,
// que es quien debe garantizar que el catálogo corresponde con el documento.
function toRecordPayload(document: TextDocument, folderId?: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: document.metadata.id,
    title: document.metadata.title.trim() || "Documento sin título",
    kind: "document",
    schemaVersion: document.metadata.schemaVersion,
    revision: document.metadata.revision,
    content: normalizeDocument(document),
  };
  if (folderId !== undefined) payload.folderId = folderId;
  return payload;
}

/**
 * Reconstruye el documento de un registro de la nube. El id del registro es la
 * autoridad: si el contenido no es un documento válido (registro corrupto o
 * escrito por otra herramienta), se descarta en vez de normalizarlo a un
 * documento vacío, que se colaría en el catálogo como un archivo fantasma.
 */
function documentFromRecord(record: CloudRecord): TextDocument | null {
  try {
    const document = normalizeDocument(record.content);
    if (!document?.metadata || !Array.isArray(document.blocks)) return null;
    if (document.metadata.id !== record.id) {
      return { ...document, metadata: { ...document.metadata, id: record.id } };
    }
    return document;
  } catch {
    return null;
  }
}

async function readProblemDetail(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: string };
    if (problem && typeof problem.detail === "string") return problem.detail;
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  return `La API respondió ${response.status}.`;
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(await readProblemDetail(response));
  return response;
}

/** Comprueba si la API de servidor está disponible. */
export async function isCloudOnline(): Promise<boolean> {
  try {
    return (await fetch(HEALTH_URL)).ok;
  } catch {
    return false;
  }
}

/** Listado del catálogo: metadatos, sin contenido. */
async function listCloudSummaries(): Promise<CloudSummary[]> {
  const response = await expectOk(await fetch(DOCS_URL));
  const payload = (await response.json()) as { items: CloudSummary[] };
  return payload.items;
}

/**
 * Descarga los documentos completos de la nube, uno a uno. Es caro por
 * definición: para pintar el catálogo se usa `listDriveCatalog`, que no baja
 * contenido.
 */
export async function listCloudDocuments(): Promise<TextDocument[]> {
  const summaries = await listCloudSummaries();
  const documents = await Promise.all(summaries.map((summary) => findDocumentById(summary.id)));
  return documents.filter((document): document is TextDocument => document !== null);
}

async function getCloudRecord(id: string): Promise<CloudRecord | null> {
  const response = await fetch(`${DOCS_URL}/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  await expectOk(response);
  return (await response.json()) as CloudRecord;
}

/**
 * Guarda (crea o actualiza) un documento en la nube. Respeta el control de
 * concurrencia optimista de la API elevando la revisión por encima de la
 * almacenada cuando hace falta. Devuelve el documento tal como quedó guardado.
 */
export async function saveDocumentToCloud(document: TextDocument, folderId?: string): Promise<TextDocument> {
  const id = document.metadata.id;
  const existing = await getCloudRecord(id);

  if (!existing) {
    await expectOk(
      await fetch(DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toRecordPayload(document, folderId ?? "")),
      }),
    );
    return document;
  }

  const revision = Math.max(document.metadata.revision, existing.revision + 1);
  const elevated: TextDocument = {
    ...document,
    metadata: { ...document.metadata, revision, updatedAt: Date.now() },
  };
  await expectOk(
    await fetch(`${DOCS_URL}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toRecordPayload(elevated)),
    }),
  );
  return elevated;
}

/**
 * Recupera un documento por su id, mire donde mire: primero la nube (la copia
 * de referencia) y, si no está o no hay conexión, la copia local. Es lo que
 * permite abrir un documento directamente desde su URL.
 */
export async function findDocumentById(id: string): Promise<TextDocument | null> {
  try {
    const record = await getCloudRecord(id);
    if (record) {
      const document = documentFromRecord(record);
      if (document) return document;
    }
  } catch {
    /* sin nube: se intenta con la copia local */
  }
  const local = await listLocalDocuments();
  return local.find((document) => document.metadata.id === id) ?? null;
}

/** Elimina un documento de la nube de forma permanente. */
export async function deleteDocumentFromCloud(id: string): Promise<void> {
  const response = await fetch(`${DOCS_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(await readProblemDetail(response));
}

/**
 * Ejecuta una acción de organización. Si el documento aún no estaba en la nube
 * (solo existía en este equipo), lo sube primero y reintenta, de modo que
 * organizar un archivo local funciona sin pasos extra.
 */
async function documentAction(
  id: string,
  action: "move" | "star" | "trash" | "restore",
  body: Record<string, unknown> = {},
): Promise<void> {
  const url = `${DOCS_URL}/${encodeURIComponent(id)}/${action}`;
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let response = await send();
  if (response.status === 404) {
    // Solo existía en este equipo: se sube y se reintenta, para que organizar un
    // archivo local funcione sin pasos extra.
    const local = (await listLocalDocuments()).find((document) => document.metadata.id === id);
    if (!local) return;
    await saveDocumentToCloud(local);
    response = await send();
  }
  await expectOk(response);
}

/** Mueve un documento a una carpeta (cadena vacía para la raíz). */
export async function moveDocumentToFolder(id: string, folderId: string): Promise<void> {
  await documentAction(id, "move", { folderId });
}

/** Marca o desmarca un documento como destacado. */
export async function starDocument(id: string, starred: boolean): Promise<void> {
  await documentAction(id, "star", { starred });
}

/** Envía un documento a la papelera (borrado reversible). */
export async function trashDocument(id: string): Promise<void> {
  await documentAction(id, "trash");
}

/** Restaura un documento desde la papelera. */
export async function restoreDocument(id: string): Promise<void> {
  await documentAction(id, "restore");
}

// ── Carpetas ────────────────────────────────────────────────────────────────

/** Lista las carpetas de la unidad. */
export async function listFolders(): Promise<DriveFolder[]> {
  const response = await expectOk(await fetch(FOLDERS_URL));
  const payload = (await response.json()) as { items: DriveFolder[] };
  return payload.items;
}

/** Crea una carpeta dentro de `parentId` (cadena vacía para la raíz). */
export async function createFolder(name: string, parentId = ""): Promise<DriveFolder> {
  const response = await expectOk(
    await fetch(FOLDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    }),
  );
  return (await response.json()) as DriveFolder;
}

/** Renombra o mueve una carpeta. */
export async function updateFolder(folder: DriveFolder, changes: { name?: string; parentId?: string }): Promise<DriveFolder> {
  const response = await expectOk(
    await fetch(`${FOLDERS_URL}/${encodeURIComponent(folder.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: changes.name ?? folder.name,
        parentId: changes.parentId ?? folder.parentId,
      }),
    }),
  );
  return (await response.json()) as DriveFolder;
}

/**
 * Elimina una carpeta. La API no pierde contenido: los documentos que contenía
 * vuelven a la raíz y sus subcarpetas suben a la carpeta padre.
 */
export async function deleteFolder(id: string): Promise<void> {
  const response = await fetch(`${FOLDERS_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(await readProblemDetail(response));
}

// ── Guardado combinado local + nube ─────────────────────────────────────────

/**
 * Guarda el documento en ambas ubicaciones: la copia local (IndexedDB, siempre
 * disponible y offline) y la nube (multientorno). Nunca falla por la nube: si el
 * servidor no está disponible, deja la copia local y avisa de que quedó sin
 * sincronizar para reintentar más tarde.
 */
export async function saveDocumentEverywhere(
  document: TextDocument,
  folderId?: string,
): Promise<{ document: TextDocument; syncedToCloud: boolean; cloudError?: string }> {
  await saveLocalDocument(document);
  try {
    const saved = await saveDocumentToCloud(document, folderId);
    await saveLocalDocument(saved);
    return { document: saved, syncedToCloud: true };
  } catch (error) {
    return {
      document,
      syncedToCloud: false,
      cloudError: error instanceof Error ? error.message : "No se pudo sincronizar con la nube.",
    };
  }
}

/** Elimina un documento de la nube y de la copia local, de forma permanente. */
export async function deleteDocumentEverywhere(id: string): Promise<void> {
  await deleteLocalDocument(id);
  try {
    await deleteDocumentFromCloud(id);
  } catch {
    /* si la nube está caída, al menos la copia local se eliminó */
  }
}

/**
 * Construye el catálogo unificado: mezcla los documentos de la nube y los
 * locales por id, y anota dónde vive cada uno, si está sincronizado y cómo está
 * organizado. Los documentos que solo existen en este equipo se muestran en la
 * raíz y sin destacar hasta que se suban.
 */
export async function listDriveCatalog(): Promise<DriveCatalog> {
  const local = await listLocalDocuments();
  let summaries: CloudSummary[] = [];
  let folders: DriveFolder[] = [];
  let cloudOnline = true;
  try {
    [summaries, folders] = await Promise.all([listCloudSummaries(), listFolders()]);
  } catch {
    cloudOnline = false;
  }

  const byId = new Map<string, DriveEntry>();

  for (const summary of summaries) {
    byId.set(summary.id, {
      id: summary.id,
      title: summary.title,
      schemaVersion: summary.schemaVersion,
      revision: summary.revision,
      createdAt: Date.parse(summary.createdAt),
      updatedAt: Date.parse(summary.updatedAt),
      location: "cloud",
      cloudRevision: summary.revision,
      localRevision: null,
      outOfSync: false,
      folderId: summary.folderId ?? "",
      starred: Boolean(summary.starred),
      trashed: Boolean(summary.trashedAt),
      preview: summary.preview ?? "",
      wordCount: summary.wordCount ?? 0,
      searchText: `${summary.title} ${summary.preview ?? ""}`.toLowerCase(),
    });
  }

  for (const document of local) {
    const existing = byId.get(document.metadata.id);
    if (!existing) {
      // Solo en este equipo: sus derivados se calculan aquí, sin red de por medio.
      byId.set(document.metadata.id, {
        id: document.metadata.id,
        title: document.metadata.title,
        schemaVersion: document.metadata.schemaVersion,
        revision: document.metadata.revision,
        createdAt: document.metadata.createdAt,
        updatedAt: document.metadata.updatedAt,
        location: "local",
        cloudRevision: null,
        localRevision: document.metadata.revision,
        outOfSync: false,
        folderId: "",
        starred: false,
        trashed: false,
        ...derive(document),
      });
      continue;
    }
    const cloudRevision = existing.cloudRevision ?? 0;
    const localRevision = document.metadata.revision;
    const localIsNewer = document.metadata.updatedAt > existing.updatedAt;
    byId.set(document.metadata.id, {
      ...existing,
      location: "both",
      localRevision,
      outOfSync: cloudRevision !== localRevision,
      // Si la copia local es más reciente, es la que se muestra.
      ...(localIsNewer
        ? {
            title: document.metadata.title,
            revision: document.metadata.revision,
            updatedAt: document.metadata.updatedAt,
            ...derive(document),
          }
        : {}),
    });
  }

  const entries = [...byId.values()].sort((left, right) => right.updatedAt - left.updatedAt);
  return { entries, folders, cloudOnline };
}

/** Sube a la nube todos los documentos locales que aún no están sincronizados. */
export async function syncLocalToCloud(): Promise<{ synced: number; failed: number }> {
  const [catalog, local] = await Promise.all([listDriveCatalog(), listLocalDocuments()]);
  if (!catalog.cloudOnline) return { synced: 0, failed: 0 };
  const byId = new Map(local.map((document) => [document.metadata.id, document]));
  let synced = 0;
  let failed = 0;
  for (const entry of catalog.entries) {
    if (entry.location === "cloud") continue;
    if (entry.location === "both" && !entry.outOfSync) continue;
    // Se sube la copia local, que es la que la nube no tiene al día.
    const document = byId.get(entry.id);
    if (!document) continue;
    try {
      await saveDocumentToCloud(document);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

// ── Utilidades de contenido ─────────────────────────────────────────────────

/** Texto plano del documento (para búsquedas, previsualización y conteo). */
export function documentPlainText(document: TextDocument): string {
  const parts: string[] = [];
  for (const block of document.blocks) {
    if (block.blockType === "text") {
      parts.push(block.runs.map((run) => run.text).join(""));
    } else if (block.blockType === "table") {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          parts.push(cell.runs.map((run) => run.text).join(""));
        }
      }
    }
  }
  return parts.join("\n").replace(/​/g, "");
}

/** Número de palabras del documento. */
export function documentWordCount(document: TextDocument): number {
  const matches = documentPlainText(document).trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/** Extracto corto del cuerpo del documento para las tarjetas del Drive. */
export function documentPreview(document: TextDocument, max = 140): string {
  const text = documentPlainText(document).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
