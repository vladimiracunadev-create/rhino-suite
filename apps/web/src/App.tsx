import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  createFolder,
  createOfficeEngine,
  deleteDocumentEverywhere,
  deleteFolder,
  exportDocx,
  exportOdt,
  importDocument,
  listDriveCatalog,
  moveDocumentToFolder,
  normalizeDocument,
  restoreDocument,
  restoreOfficeEngine,
  saveDocumentEverywhere,
  saveDocumentToCloud,
  starDocument,
  syncLocalToCloud,
  trashDocument,
  updateFolder,
  type DriveCatalog,
  type DriveFolder,
  type OfficeEngineClient,
  type TextDocument,
} from "@web-office/engine-client";
import { DocumentEditor } from "./editor/DocumentEditor";
import { DriveView, type DownloadFormat } from "./drive/DriveView";
import { RhinoMark } from "./branding/RhinoMark";
import { SettingsControl } from "./settings/SettingsControl";
import { useSettings } from "./settings/SettingsContext";

type View = "drive" | "editor";
type SaveState = "saved" | "saving" | "dirty" | "local-only";

const newId = () => `doc-${crypto.randomUUID()}`;

const MIME: Record<DownloadFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  json: "application/json",
};

function downloadDocument(document: TextDocument, format: DownloadFormat) {
  const payload: BlobPart =
    format === "docx"
      ? (exportDocx(document) as unknown as BlobPart)
      : format === "odt"
        ? (exportOdt(document) as unknown as BlobPart)
        : JSON.stringify(normalizeDocument(document), null, 2);
  const blob = new Blob([payload], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  const safeTitle = (document.metadata.title || "documento").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "documento";
  anchor.href = url;
  anchor.download = format === "json" ? `${safeTitle}.rhino.json` : `${safeTitle}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const { t } = useSettings();
  const engineRef = useRef<OfficeEngineClient | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const [view, setView] = useState<View>("drive");
  const [documentModel, setDocumentModel] = useState<TextDocument | null>(null);
  const [catalog, setCatalog] = useState<DriveCatalog | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [engineKind, setEngineKind] = useState<OfficeEngineClient["kind"]>("typescript-fallback");

  const refreshCatalog = useCallback(async () => {
    setDriveLoading(true);
    try {
      setCatalog(await listDriveCatalog());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer la unidad de archivos.");
    } finally {
      setDriveLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [refreshCatalog]);

  const activateEngine = useCallback((engine: OfficeEngineClient) => {
    engineRef.current = engine;
    setEngineKind(engine.kind);
    setDocumentModel(engine.getDocument());
    setSaveState("saved");
    setView("editor");
    setMessage(
      engine.kind === "rust-wasm"
        ? "Motor documental Rust/WebAssembly activo."
        : "Motor TypeScript compatible activo.",
    );
  }, []);

  const persist = useCallback(async (model: TextDocument | null = documentModel) => {
    if (!model) return;
    setSaveState("saving");
    try {
      const result = await saveDocumentEverywhere(model);
      setSaveState(result.syncedToCloud ? "saved" : "local-only");
      setMessage(
        result.syncedToCloud
          ? `Guardado en la nube · revisión ${result.document.metadata.revision}.`
          : `Guardado en este equipo (nube sin conexión). ${result.cloudError ?? ""}`.trim(),
      );
      void refreshCatalog();
    } catch (error) {
      setSaveState("dirty");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el documento.");
    }
  }, [documentModel, refreshCatalog]);

  const handleDocumentChange = useCallback((next: TextDocument) => {
    setDocumentModel(next);
    setSaveState("dirty");
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => { void persist(next); }, 1400);
  }, [persist]);

  const createNew = useCallback(async (folderId = "") => {
    setMessage("Creando documento…");
    const engine = await createOfficeEngine("Documento sin título");
    activateEngine(engine);
    // Se registra de inmediato en la carpeta elegida; a partir de ahí la API
    // conserva la organización en cada guardado posterior.
    try {
      await saveDocumentToCloud(engine.getDocument(), folderId);
      void refreshCatalog();
    } catch {
      /* sin nube: quedará en la raíz y se subirá al sincronizar */
    }
  }, [activateEngine, refreshCatalog]);

  const openDocument = useCallback(async (saved: TextDocument) => {
    try {
      activateEngine(await restoreOfficeEngine(JSON.stringify(saved)));
      setMessage(`«${saved.metadata.title || "Sin título"}» abierto.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir el documento.");
    }
  }, [activateEngine]);

  const openImported = useCallback(async (imported: TextDocument) => {
    try {
      activateEngine(await restoreOfficeEngine(JSON.stringify(imported)));
      setMessage("Documento importado y normalizado al formato interno schema v5.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir el documento importado.");
    }
  }, [activateEngine]);

  const rename = useCallback((title: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    handleDocumentChange(engine.apply({ type: "setTitle", title }));
  }, [handleDocumentChange]);

  const goToDrive = useCallback(async () => {
    if (documentModel && (saveState === "dirty" || saveState === "saving")) {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
      await persist(documentModel);
    }
    setView("drive");
    void refreshCatalog();
  }, [documentModel, saveState, persist, refreshCatalog]);

  // ── Acciones de la unidad de archivos ──────────────────────────────────────
  const renameFromDrive = useCallback(async (document: TextDocument, title: string) => {
    const renamed: TextDocument = {
      ...document,
      metadata: { ...document.metadata, title, revision: document.metadata.revision + 1, updatedAt: Date.now() },
    };
    await saveDocumentEverywhere(renamed);
    void refreshCatalog();
  }, [refreshCatalog]);

  const duplicateFromDrive = useCallback(async (document: TextDocument) => {
    const now = Date.now();
    const copy: TextDocument = normalizeDocument({
      ...document,
      metadata: {
        ...document.metadata,
        id: newId(),
        title: `${document.metadata.title || "Documento"} (copia)`,
        revision: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
    await saveDocumentEverywhere(copy);
    setMessage(`Copia creada: «${copy.metadata.title}».`);
    void refreshCatalog();
  }, [refreshCatalog]);

  const deleteFromDrive = useCallback(async (document: TextDocument) => {
    await deleteDocumentEverywhere(document.metadata.id);
    setMessage(`«${document.metadata.title || "Documento"}» eliminado definitivamente.`);
    void refreshCatalog();
  }, [refreshCatalog]);

  /** Envuelve una acción de organización: ejecuta, informa y refresca. */
  const runDriveAction = useCallback(async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La acción no se pudo completar.");
    }
    void refreshCatalog();
  }, [refreshCatalog]);

  const starFromDrive = useCallback((document: TextDocument, starred: boolean) => {
    const name = document.metadata.title || "Documento";
    void runDriveAction(
      () => starDocument(document, starred),
      starred ? `«${name}» destacado.` : `«${name}» ya no está destacado.`,
    );
  }, [runDriveAction]);

  const moveFromDrive = useCallback((document: TextDocument, folderId: string) => {
    void runDriveAction(
      () => moveDocumentToFolder(document, folderId),
      `«${document.metadata.title || "Documento"}» movido.`,
    );
  }, [runDriveAction]);

  const trashFromDrive = useCallback((document: TextDocument) => {
    void runDriveAction(
      () => trashDocument(document),
      `«${document.metadata.title || "Documento"}» está en la papelera.`,
    );
  }, [runDriveAction]);

  const restoreFromDrive = useCallback((document: TextDocument) => {
    void runDriveAction(
      () => restoreDocument(document),
      `«${document.metadata.title || "Documento"}» restaurado.`,
    );
  }, [runDriveAction]);

  /**
   * Sube documentos DOCX u ODT a la unidad sin pasar por el editor: se importan
   * al formato interno, se les da identidad propia y se guardan en la carpeta
   * donde está el usuario.
   */
  const uploadToDrive = useCallback(async (files: FileList | File[], folderId: string) => {
    const list = [...files];
    const supported = list.filter((file) => /\.(docx|odt)$/i.test(file.name));
    const rejected = list.length - supported.length;
    if (supported.length === 0) {
      setMessage("Solo se pueden subir archivos DOCX u ODT.");
      return;
    }

    let uploaded = 0;
    const warnings: string[] = [];
    for (const file of supported) {
      try {
        setMessage(`Importando «${file.name}»…`);
        const imported = await importDocument(await file.arrayBuffer(), file.name);
        const now = Date.now();
        const document = normalizeDocument({
          ...imported.document,
          metadata: { ...imported.document.metadata, id: newId(), revision: 0, createdAt: now, updatedAt: now },
        });
        await saveDocumentEverywhere(document, folderId);
        uploaded += 1;
        warnings.push(...imported.warnings);
      } catch (error) {
        setMessage(`No se pudo importar «${file.name}»: ${error instanceof Error ? error.message : "archivo no válido"}.`);
        return;
      }
    }

    const parts = [`${uploaded} documento(s) subido(s).`];
    if (rejected > 0) parts.push(`${rejected} archivo(s) ignorado(s) por no ser DOCX u ODT.`);
    if (warnings.length > 0) parts.push(`Avisos de conversión: ${warnings.length}.`);
    setMessage(parts.join(" "));
    void refreshCatalog();
  }, [refreshCatalog]);

  const createFolderFromDrive = useCallback((name: string, parentId: string) => {
    void runDriveAction(() => createFolder(name, parentId), `Carpeta «${name}» creada.`);
  }, [runDriveAction]);

  const renameFolderFromDrive = useCallback((folder: DriveFolder, name: string) => {
    void runDriveAction(() => updateFolder(folder, { name }), `Carpeta renombrada a «${name}».`);
  }, [runDriveAction]);

  const deleteFolderFromDrive = useCallback((folder: DriveFolder) => {
    void runDriveAction(
      () => deleteFolder(folder.id),
      `Carpeta «${folder.name}» eliminada; sus documentos volvieron a Mis archivos.`,
    );
  }, [runDriveAction]);

  const syncAll = useCallback(async () => {
    setMessage("Sincronizando con la nube…");
    const result = await syncLocalToCloud();
    setMessage(`Sincronización completa · ${result.synced} subidos${result.failed ? `, ${result.failed} con error` : ""}.`);
    void refreshCatalog();
  }, [refreshCatalog]);

  const cloudOnline = catalog?.cloudOnline ?? false;

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="rail-brand">
          <span className="rail-mark"><RhinoMark size={30} /></span>
          <div>
            <strong>Rhino Suite</strong>
            <small>Suite ofimática</small>
          </div>
        </div>

        <button type="button" className="rail-new" onClick={() => void createNew()}>
          ＋ {t("newDocument")}
        </button>

        <nav className="rail-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`rail-link ${view === "drive" ? "active" : ""}`}
            onClick={() => void goToDrive()}
          >
            <span className="rail-ico"><RhinoMark size={17} /></span> {t("myFiles")}
          </button>
          <button
            type="button"
            className={`rail-link ${view === "editor" ? "active" : ""} ${documentModel ? "has-doc" : ""}`}
            onClick={() => setView("editor")}
            disabled={!documentModel}
            title={documentModel ? documentModel.metadata.title || t("untitled") : t("editor")}
          >
            <span className="rail-ico">📝</span>
            {/* Con un documento abierto, el enlace dice cuál es: así se sabe a
                dónde se vuelve, en vez de un "Editor" genérico. */}
            {documentModel ? (
              <span className="rail-link-doc">
                <strong>{documentModel.metadata.title || t("untitled")}</strong>
                <small>{t("continueEditing")}</small>
              </span>
            ) : (
              <span>{t("editor")}</span>
            )}
          </button>
        </nav>

        <div className="rail-modules">
          <p className="rail-label">{t("modules")}</p>
          {[
            ["📄", t("documents"), t("active")],
            ["📊", t("spreadsheet"), t("soon")],
            ["📽", t("presentations"), t("soon")],
            ["📕", t("pdf"), t("soon")],
          ].map(([icon, name, status]) => (
            <div className={`rail-module ${status === t("active") ? "on" : ""}`} key={name}>
              <span className="rail-ico">{icon}</span>
              <span className="rail-module-name">{name}</span>
              <span className="rail-module-status">{status}</span>
            </div>
          ))}
        </div>

        <div className="rail-foot">
          <span className={`status-dot ${cloudOnline ? "online" : "offline"}`} />
          {cloudOnline ? t("cloudConnected") : t("cloudOffline")}
        </div>
      </aside>

      <main className="stage">
        {view === "drive" ? (
          <DriveView
            catalog={catalog}
            loading={driveLoading}
            onOpen={(document) => void openDocument(document)}
            onCreate={(folderId) => void createNew(folderId)}
            onRename={(document, title) => void renameFromDrive(document, title)}
            onDuplicate={(document) => void duplicateFromDrive(document)}
            onDownload={downloadDocument}
            onStar={starFromDrive}
            onMove={moveFromDrive}
            onTrash={trashFromDrive}
            onRestore={restoreFromDrive}
            onDeleteForever={(document) => void deleteFromDrive(document)}
            onCreateFolder={createFolderFromDrive}
            onRenameFolder={renameFolderFromDrive}
            onDeleteFolder={deleteFolderFromDrive}
            onUpload={(files, folderId) => void uploadToDrive(files, folderId)}
            openDocumentId={documentModel?.metadata.id ?? null}
            onRefresh={() => void refreshCatalog()}
            onSyncAll={() => void syncAll()}
          />
        ) : documentModel && engineRef.current ? (
          <div className="editor-shell">
            <header className="editor-bar">
              <div className="editor-bar-left">
                <button type="button" className="back-btn" onClick={() => void goToDrive()}>
                  ← {t("myFiles")}
                </button>
                <span className="editor-crumb">
                  <span className="word-badge">W</span>
                  <input
                    aria-label="Título del documento"
                    value={documentModel.metadata.title ?? ""}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => rename(event.target.value)}
                    placeholder={t("untitled")}
                  />
                </span>
              </div>
              <div className="editor-bar-right">
                <span className={`chip save-${saveState}`}>
                  {saveState === "saving"
                    ? t("savingState")
                    : saveState === "dirty"
                      ? t("pendingChanges")
                      : saveState === "local-only"
                        ? t("localOnlyState")
                        : t("savedCloud")}
                </span>
                <span className="chip subtle">{engineKind === "rust-wasm" ? "Rust/WASM" : "TypeScript"}</span>
                <span className="chip subtle">r{documentModel.metadata.revision}</span>
              </div>
            </header>

            <DocumentEditor
              document={documentModel}
              engine={engineRef.current}
              onDocumentChange={handleDocumentChange}
              onMessage={setMessage}
              onOpenDocument={(imported) => void openImported(imported)}
              onSave={() => void persist()}
            />

            {message ? <div className="stage-message" role="status">{message}</div> : null}
          </div>
        ) : (
          <div className="drive-empty">
            <div className="spinner" />
            <p>Preparando el editor…</p>
          </div>
        )}
      </main>

      <SettingsControl />
    </div>
  );
}
