import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  createOfficeEngine,
  deleteDocumentEverywhere,
  listDriveCatalog,
  normalizeDocument,
  restoreOfficeEngine,
  saveDocumentEverywhere,
  syncLocalToCloud,
  type DriveCatalog,
  type OfficeEngineClient,
  type TextDocument,
} from "@web-office/engine-client";
import { DocumentEditor } from "./editor/DocumentEditor";
import { DriveView } from "./drive/DriveView";

type View = "drive" | "editor";
type SaveState = "saved" | "saving" | "dirty" | "local-only";

const newId = () => `doc-${crypto.randomUUID()}`;

function downloadDocument(document: TextDocument) {
  const blob = new Blob([JSON.stringify(normalizeDocument(document), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  const safeTitle = (document.metadata.title || "documento").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "documento";
  anchor.href = url;
  anchor.download = `${safeTitle}.rhino.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App() {
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

  const createNew = useCallback(async () => {
    setMessage("Creando documento…");
    activateEngine(await createOfficeEngine("Documento sin título"));
  }, [activateEngine]);

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
    setMessage(`«${document.metadata.title || "Documento"}» eliminado.`);
    void refreshCatalog();
  }, [refreshCatalog]);

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
          <span className="rail-mark">R</span>
          <div>
            <strong>Rhino Suite</strong>
            <small>Suite ofimática</small>
          </div>
        </div>

        <button type="button" className="rail-new" onClick={() => void createNew()}>
          ＋ Nuevo documento
        </button>

        <nav className="rail-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`rail-link ${view === "drive" ? "active" : ""}`}
            onClick={() => void goToDrive()}
          >
            <span className="rail-ico">🗂</span> Mis archivos
          </button>
          <button
            type="button"
            className={`rail-link ${view === "editor" ? "active" : ""}`}
            onClick={() => setView("editor")}
            disabled={!documentModel}
          >
            <span className="rail-ico">📝</span> Editor
          </button>
        </nav>

        <div className="rail-modules">
          <p className="rail-label">Módulos</p>
          {[
            ["📄", "Documentos", "Activo"],
            ["📊", "Hoja de cálculo", "Próximo"],
            ["📽", "Presentaciones", "Próximo"],
            ["📕", "PDF", "Próximo"],
          ].map(([icon, name, status]) => (
            <div className={`rail-module ${status === "Activo" ? "on" : ""}`} key={name}>
              <span className="rail-ico">{icon}</span>
              <span className="rail-module-name">{name}</span>
              <span className="rail-module-status">{status}</span>
            </div>
          ))}
        </div>

        <div className="rail-foot">
          <span className={`status-dot ${cloudOnline ? "online" : "offline"}`} />
          {cloudOnline ? "Nube conectada" : "Nube sin conexión"}
        </div>
      </aside>

      <main className="stage">
        {view === "drive" ? (
          <DriveView
            catalog={catalog}
            loading={driveLoading}
            onOpen={(document) => void openDocument(document)}
            onCreate={() => void createNew()}
            onRename={(document, title) => void renameFromDrive(document, title)}
            onDuplicate={(document) => void duplicateFromDrive(document)}
            onDownload={downloadDocument}
            onDelete={(document) => void deleteFromDrive(document)}
            onRefresh={() => void refreshCatalog()}
            onSyncAll={() => void syncAll()}
          />
        ) : documentModel && engineRef.current ? (
          <div className="editor-shell">
            <header className="editor-bar">
              <div className="editor-bar-left">
                <button type="button" className="back-btn" onClick={() => void goToDrive()}>
                  ← Mis archivos
                </button>
                <span className="editor-crumb">
                  <span className="word-badge">W</span>
                  <input
                    aria-label="Título del documento"
                    value={documentModel.metadata.title ?? ""}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => rename(event.target.value)}
                    placeholder="Documento sin título"
                  />
                </span>
              </div>
              <div className="editor-bar-right">
                <span className={`chip save-${saveState}`}>
                  {saveState === "saving"
                    ? "Guardando…"
                    : saveState === "dirty"
                      ? "Cambios pendientes"
                      : saveState === "local-only"
                        ? "Solo en este equipo"
                        : "Guardado en la nube"}
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
    </div>
  );
}
