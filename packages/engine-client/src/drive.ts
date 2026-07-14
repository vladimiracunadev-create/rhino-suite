import { normalizeDocument, type TextDocument } from "./model";
import {
  deleteDocument as deleteLocalDocument,
  listDocuments as listLocalDocuments,
  saveDocument as saveLocalDocument,
} from "./storage";

/**
 * Cliente de la "unidad" de archivos multientorno. Habla con la API Go
 * (`/api/v1/documents`) para persistir los documentos en el servidor, de modo
 * que estén disponibles desde cualquier equipo o navegador, y reconcilia ese
 * catálogo con la copia local en IndexedDB.
 */

const API_BASE = "/api/v1/documents";
const HEALTH_URL = "/health";

/** Dónde vive físicamente un documento del catálogo. */
export type DriveLocation = "cloud" | "local" | "both";

export interface DriveEntry {
  document: TextDocument;
  location: DriveLocation;
  /** Revisión almacenada en la nube, si existe. */
  cloudRevision: number | null;
  /** Revisión almacenada localmente, si existe. */
  localRevision: number | null;
  /** `true` cuando la copia local y la de la nube difieren en revisión. */
  outOfSync: boolean;
}

export interface DriveCatalog {
  entries: DriveEntry[];
  cloudOnline: boolean;
}

interface CloudRecord {
  id: string;
  title: string;
  kind: string;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  content: TextDocument;
}

function toRecordPayload(document: TextDocument): Record<string, unknown> {
  return {
    id: document.metadata.id,
    title: document.metadata.title.trim() || "Documento sin título",
    kind: "document",
    schemaVersion: document.metadata.schemaVersion,
    revision: document.metadata.revision,
    content: normalizeDocument(document),
  };
}

function fromRecord(record: CloudRecord): TextDocument {
  const document = normalizeDocument(record.content);
  // La revisión y el título canónicos viven en el propio documento; el registro
  // de la API es un envoltorio de transporte.
  return document;
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

/** Comprueba si la API de servidor está disponible. */
export async function isCloudOnline(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

/** Lista los documentos almacenados en la nube. */
export async function listCloudDocuments(): Promise<TextDocument[]> {
  const response = await fetch(API_BASE, { method: "GET" });
  if (!response.ok) throw new Error(await readProblemDetail(response));
  const payload = (await response.json()) as { items: CloudRecord[] };
  return payload.items.map(fromRecord);
}

async function getCloudDocument(id: string): Promise<CloudRecord | null> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readProblemDetail(response));
  return (await response.json()) as CloudRecord;
}

/**
 * Guarda (crea o actualiza) un documento en la nube. Respeta el control de
 * concurrencia optimista de la API elevando la revisión por encima de la
 * almacenada cuando hace falta. Devuelve el documento tal como quedó guardado.
 */
export async function saveDocumentToCloud(document: TextDocument): Promise<TextDocument> {
  const id = document.metadata.id;
  const existing = await getCloudDocument(id);

  if (!existing) {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toRecordPayload(document)),
    });
    if (!response.ok) throw new Error(await readProblemDetail(response));
    return document;
  }

  const revision = Math.max(document.metadata.revision, existing.revision + 1);
  const elevated: TextDocument = {
    ...document,
    metadata: { ...document.metadata, revision, updatedAt: Date.now() },
  };
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toRecordPayload(elevated)),
  });
  if (!response.ok) throw new Error(await readProblemDetail(response));
  return elevated;
}

/** Elimina un documento de la nube. Ignora el caso de que ya no exista. */
export async function deleteDocumentFromCloud(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(await readProblemDetail(response));
  }
}

/**
 * Guarda el documento en ambas ubicaciones: la copia local (IndexedDB, siempre
 * disponible y offline) y la nube (multientorno). Nunca falla por la nube: si el
 * servidor no está disponible, deja la copia local y marca que quedó sin
 * sincronizar para reintentar más tarde.
 */
export async function saveDocumentEverywhere(
  document: TextDocument,
): Promise<{ document: TextDocument; syncedToCloud: boolean; cloudError?: string }> {
  await saveLocalDocument(document);
  try {
    const saved = await saveDocumentToCloud(document);
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

/** Elimina un documento de la nube y de la copia local. */
export async function deleteDocumentEverywhere(id: string): Promise<void> {
  await deleteLocalDocument(id);
  try {
    await deleteDocumentFromCloud(id);
  } catch {
    /* si la nube está caída, al menos la copia local se eliminó */
  }
}

/**
 * Construye el catálogo unificado de la unidad de archivos: mezcla los
 * documentos de la nube y los locales por id, y anota dónde vive cada uno y si
 * las copias están sincronizadas.
 */
export async function listDriveCatalog(): Promise<DriveCatalog> {
  const local = await listLocalDocuments();
  let cloud: TextDocument[] = [];
  let cloudOnline = true;
  try {
    cloud = await listCloudDocuments();
  } catch {
    cloudOnline = false;
  }

  const byId = new Map<string, DriveEntry>();

  for (const document of cloud) {
    byId.set(document.metadata.id, {
      document,
      location: "cloud",
      cloudRevision: document.metadata.revision,
      localRevision: null,
      outOfSync: false,
    });
  }

  for (const document of local) {
    const existing = byId.get(document.metadata.id);
    if (!existing) {
      byId.set(document.metadata.id, {
        document,
        location: "local",
        cloudRevision: null,
        localRevision: document.metadata.revision,
        outOfSync: false,
      });
      continue;
    }
    const cloudRevision = existing.cloudRevision ?? 0;
    const localRevision = document.metadata.revision;
    // La copia más reciente (mayor updatedAt) representa al documento.
    const newest =
      document.metadata.updatedAt > existing.document.metadata.updatedAt
        ? document
        : existing.document;
    byId.set(document.metadata.id, {
      document: newest,
      location: "both",
      cloudRevision,
      localRevision,
      outOfSync: cloudRevision !== localRevision,
    });
  }

  const entries = [...byId.values()].sort(
    (left, right) => right.document.metadata.updatedAt - left.document.metadata.updatedAt,
  );
  return { entries, cloudOnline };
}

/** Sube a la nube todos los documentos locales que aún no están sincronizados. */
export async function syncLocalToCloud(): Promise<{ synced: number; failed: number }> {
  const catalog = await listDriveCatalog();
  if (!catalog.cloudOnline) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;
  for (const entry of catalog.entries) {
    if (entry.location === "cloud") continue;
    if (entry.location === "both" && !entry.outOfSync) continue;
    try {
      await saveDocumentToCloud(entry.document);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

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
