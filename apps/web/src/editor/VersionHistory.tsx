import { useCallback, useEffect, useState } from "react";
import { listVersions, restoreVersion, type DocumentVersion, type TextDocument } from "@web-office/engine-client";
import { useSettings } from "../settings/SettingsContext";

interface VersionHistoryProps {
  documentId: string;
  currentRevision: number;
  onClose: () => void;
  onRestored: (document: TextDocument) => void;
  onMessage: (message: string) => void;
}

/** Panel del historial: qué versiones hay y cómo volver a una. */
export function VersionHistory({ documentId, currentRevision, onClose, onRestored, onMessage }: VersionHistoryProps) {
  const { t, lang } = useSettings();
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setVersions(await listVersions(documentId));
    } catch (error) {
      setVersions([]);
      onMessage(error instanceof Error ? error.message : "No se pudo leer el historial.");
    }
  }, [documentId, onMessage]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restore = async (version: DocumentVersion) => {
    if (!window.confirm(t("confirmRestore", { n: version.revision }))) return;
    setBusy(version.revision);
    try {
      const restored = await restoreVersion(documentId, version.revision);
      if (restored) {
        onRestored(restored);
        onMessage(t("restored", { n: version.revision }));
        await load();
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo restaurar la versión.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside className="history-panel" aria-label={t("historyTitle")}>
      <header>
        <strong>{t("historyTitle")}</strong>
        <button type="button" onClick={onClose} aria-label={t("cancel")}>✕</button>
      </header>

      {versions === null ? (
        <div className="history-loading"><div className="spinner" /></div>
      ) : versions.length === 0 ? (
        <div className="history-empty">
          <p>{t("historyEmpty")}</p>
          <small>{t("historyHint")}</small>
        </div>
      ) : (
        <ol className="history-list">
          {versions.map((version) => {
            const isCurrent = version.revision === currentRevision;
            return (
              <li key={version.revision} className={isCurrent ? "current" : ""}>
                <div className="history-row">
                  <span className="history-rev">r{version.revision}</span>
                  {isCurrent ? <span className="history-tag">{t("historyCurrent")}</span> : null}
                </div>
                <strong className="history-title">{version.title || t("untitled")}</strong>
                <small>
                  {new Date(version.savedAt).toLocaleString(lang)} · {t("words", { n: version.wordCount })}
                </small>
                {!isCurrent ? (
                  <button type="button" disabled={busy !== null} onClick={() => void restore(version)}>
                    {busy === version.revision ? "…" : `↺ ${t("restoreVersion")}`}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <footer><small>{t("historyLimit", { n: 40 })}</small></footer>
    </aside>
  );
}
