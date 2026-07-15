import { useState, type ChangeEvent } from "react";
import { shareDocument, unshareDocument, type DriveEntry, type ShareRole } from "@web-office/engine-client";
import { useSettings } from "../settings/SettingsContext";

interface ShareDialogProps {
  entry: DriveEntry;
  onClose: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
}

/** Diálogo de compartir: con quién está y con quién se comparte. */
export function ShareDialog({ entry, onClose, onChanged, onMessage }: ShareDialogProps) {
  const { t } = useSettings();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const target = email.trim();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await shareDocument(entry.id, target, role);
      onMessage(`«${entry.title}» compartido con ${target}.`);
      setEmail("");
      onChanged();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No se pudo compartir.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (userId: string) => {
    setBusy(true);
    try {
      await unshareDocument(entry.id, userId);
      onChanged();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No se pudo quitar el acceso.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={t("shareTitle")} onClick={(event) => event.stopPropagation()}>
        <p className="modal-title">{t("shareTitle")}</p>
        <p className="share-doc">📄 {entry.title || t("untitled")}</p>

        {entry.owned ? (
          <>
            <label className="share-field">
              <span>{t("shareWith")}</span>
              <div className="share-row">
                <input
                  type="email"
                  value={email}
                  placeholder={t("sharePlaceholder")}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
                />
                <select value={role} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRole(event.target.value as ShareRole)}>
                  <option value="viewer">{t("roleViewer")}</option>
                  <option value="editor">{t("roleEditor")}</option>
                </select>
                <button type="button" className="drive-btn primary" disabled={busy} onClick={() => void submit()}>
                  {t("share")}
                </button>
              </div>
            </label>

            {error ? <p className="signin-error" role="alert">{error}</p> : null}

            <p className="share-section">{t("sharedWith")}</p>
            {entry.shares.length === 0 ? (
              <p className="share-empty">{t("notShared")}</p>
            ) : (
              <ul className="share-list">
                {entry.shares.map((share) => (
                  <li key={share.userId}>
                    <span className="share-who">
                      <strong>{share.name || share.email}</strong>
                      <small>{share.email} · {share.role === "editor" ? t("roleEditor") : t("roleViewer")}</small>
                    </span>
                    <button type="button" disabled={busy} onClick={() => void revoke(share.userId)}>
                      {t("removeAccess")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="share-empty">{t("onlyOwnerShares")}</p>
        )}

        <div className="modal-actions">
          <button type="button" className="drive-btn ghost" onClick={onClose}>{t("cancel")}</button>
        </div>
      </div>
    </div>
  );
}
