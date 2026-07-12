import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  createOfficeEngine,
  listDocuments,
  restoreOfficeEngine,
  saveDocument,
  type OfficeEngineClient,
  type TextDocument,
} from "@web-office/engine-client";
import { DocumentEditor } from "./editor/DocumentEditor";

const phases = [
  ["01", "Núcleo común", "Completada"],
  ["02", "Editor de documentos", "Fase 2.4"],
  ["03", "Hoja de cálculo", "Planificada"],
  ["04", "Presentaciones", "Planificada"],
  ["05", "PDF", "Planificada"],
  ["06", "Colaboración", "Planificada"],
  ["07", "Aplicación Windows", "Planificada"],
  ["08", "Compatibilidad Office", "Planificada"],
] as const;

export function App() {
  const engineRef = useRef<OfficeEngineClient | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const [documentModel, setDocumentModel] = useState<TextDocument | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<TextDocument[]>([]);
  const [message, setMessage] = useState("Inicializando el motor documental...");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  const refreshDocuments = useCallback(async () => {
    try {
      setSavedDocuments(await listDocuments());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer IndexedDB.");
    }
  }, []);

  const activateEngine = useCallback((engine: OfficeEngineClient) => {
    engineRef.current = engine;
    setDocumentModel(engine.getDocument());
    setSaveState("saved");
    setMessage(engine.kind === "rust-wasm"
      ? "Motor documental Rust/WebAssembly activo."
      : "Motor TypeScript compatible activo. Compile WASM para ejecutar el núcleo Rust.");
  }, []);

  useEffect(() => {
    let active = true;
    void createOfficeEngine("Documento de Fase 2.4").then((engine) => {
      if (active) activateEngine(engine);
    });
    void refreshDocuments();
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    void fetch(`${apiUrl}/health`)
      .then((response) => setApiStatus(response.ok ? "online" : "offline"))
      .catch(() => setApiStatus("offline"));
    return () => {
      active = false;
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [activateEngine, refreshDocuments]);

  const persist = useCallback(async (model = documentModel) => {
    if (!model) return;
    setSaveState("saving");
    try {
      await saveDocument(model);
      await refreshDocuments();
      setSaveState("saved");
      setMessage(`Guardado local · revisión ${model.metadata.revision}.`);
    } catch (error) {
      setSaveState("dirty");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el documento.");
    }
  }, [documentModel, refreshDocuments]);

  const handleDocumentChange = useCallback((next: TextDocument) => {
    setDocumentModel(next);
    setSaveState("dirty");
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveDocument(next).then(() => {
        setSaveState("saved");
        void refreshDocuments();
      }).catch((error: unknown) => {
        setSaveState("dirty");
        setMessage(error instanceof Error ? error.message : "El guardado automático falló.");
      });
    }, 1200);
  }, [refreshDocuments]);

  const createNew = async () => {
    if (documentModel && saveState === "dirty") await persist(documentModel);
    activateEngine(await createOfficeEngine("Documento sin título"));
  };

  const openSaved = async (saved: TextDocument) => {
    try {
      activateEngine(await restoreOfficeEngine(JSON.stringify(saved)));
      setMessage("Documento restaurado desde IndexedDB.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir el documento.");
    }
  };

  const openImported = async (imported: TextDocument) => {
    try {
      activateEngine(await restoreOfficeEngine(JSON.stringify(imported)));
      setMessage("Documento importado y normalizado al formato interno schema v5.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir el documento importado.");
    }
  };

  const rename = (title: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    handleDocumentChange(engine.apply({ type: "setTitle", title }));
  };

  return (
    <div className="app-shell">
      <aside className="project-sidebar">
        <div className="brand">
          <span className="brand-mark">WO</span>
          <div><strong>Web Office</strong><small>Evolution</small></div>
        </div>
        <button className="new-document" type="button" onClick={() => void createNew()}>＋ Nuevo documento</button>
        <nav aria-label="Fases del proyecto">
          <p className="nav-label">DESARROLLO POR FASES</p>
          {phases.map(([number, name, status], index) => (
            <button className={`phase ${index === 1 ? "active" : index === 0 ? "complete" : ""}`} key={number} type="button">
              <span>{number}</span><div><strong>{name}</strong><small>{status}</small></div>
            </button>
          ))}
        </nav>
        <section className="recent-panel">
          <p className="nav-label">RECIENTES</p>
          {savedDocuments.length === 0 ? <small>No hay documentos guardados.</small> : savedDocuments.slice(0, 5).map((saved) => (
            <button key={saved.metadata.id} type="button" onClick={() => void openSaved(saved)}>
              <span className="file-icon">W</span>
              <span><strong>{saved.metadata.title || "Sin título"}</strong><small>r{saved.metadata.revision}</small></span>
            </button>
          ))}
        </section>
        <div className="sidebar-footer">
          <span className={`status-dot ${apiStatus}`} />
          API Go: {apiStatus === "checking" ? "revisando" : apiStatus === "online" ? "en línea" : "sin conexión"}
        </div>
      </aside>

      <main className="office-main">
        <header className="document-topbar">
          <div className="document-identity">
            <span className="word-badge">W</span>
            <div>
              <input
                aria-label="Título del documento"
                value={documentModel?.metadata.title ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) => rename(event.target.value)}
                placeholder="Documento sin título"
              />
              <small>Fase 2.4 · formato interno v{documentModel?.metadata.schemaVersion ?? 5}</small>
            </div>
          </div>
          <div className="topbar-meta">
            <span className={`save-state ${saveState}`}>{saveState === "saving" ? "Guardando…" : saveState === "dirty" ? "Cambios pendientes" : "Guardado local"}</span>
            <span>{engineRef.current?.kind === "rust-wasm" ? "Rust/WASM" : "TypeScript fallback"}</span>
            <span>r{documentModel?.metadata.revision ?? 0}</span>
          </div>
        </header>

        <section className="phase-banner">
          <div><span>FASE 2</span><strong>Editor documental estructurado</strong></div>
          <p>Revisión, comentarios, control de cambios, hipervínculos, marcadores, búsqueda estructurada, impresión y compatibilidad inicial DOCX/ODT.</p>
        </section>

        {documentModel && engineRef.current ? (
          <DocumentEditor
            document={documentModel}
            engine={engineRef.current}
            onDocumentChange={handleDocumentChange}
            onMessage={setMessage}
            onOpenDocument={(imported) => void openImported(imported)}
            onSave={() => void persist()}
          />
        ) : <div className="loading-card">Preparando el editor…</div>}

        <div className="application-message" role="status">{message}</div>
      </main>
    </div>
  );
}
