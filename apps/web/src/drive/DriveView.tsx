import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  documentPreview,
  documentWordCount,
  type DriveCatalog,
  type DriveEntry,
  type TextDocument,
} from "@web-office/engine-client";
import { useSettings, type Translator } from "../settings/SettingsContext";

interface DriveViewProps {
  catalog: DriveCatalog | null;
  loading: boolean;
  onOpen: (document: TextDocument) => void;
  onCreate: () => void;
  onRename: (document: TextDocument, title: string) => void;
  onDuplicate: (document: TextDocument) => void;
  onDownload: (document: TextDocument) => void;
  onDelete: (document: TextDocument) => void;
  onRefresh: () => void;
  onSyncAll: () => void;
}

type ViewMode = "grid" | "list";

const relativeTime = (timestamp: number, t: Translator, locale: string): string => {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return t("justNow");
  if (diff < hour) return t("minAgo", { n: Math.floor(diff / minute) });
  if (diff < day) return t("hoursAgo", { n: Math.floor(diff / hour) });
  if (diff < 2 * day) return t("yesterday");
  if (diff < 7 * day) return t("daysAgo", { n: Math.floor(diff / day) });
  return new Date(timestamp).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
};

const locationBadge = (
  location: DriveEntry["location"],
  t: Translator,
): { text: string; icon: string; tone: string } => {
  if (location === "cloud") return { text: t("locCloud"), icon: "☁", tone: "cloud" };
  if (location === "both") return { text: t("locSynced"), icon: "✓", tone: "synced" };
  return { text: t("locLocal"), icon: "🖥", tone: "local" };
};

export function DriveView({
  catalog,
  loading,
  onOpen,
  onCreate,
  onRename,
  onDuplicate,
  onDownload,
  onDelete,
  onRefresh,
  onSyncAll,
}: DriveViewProps) {
  const { t, lang } = useSettings();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const entries = catalog?.entries ?? [];

  const stats = useMemo(() => {
    let cloud = 0;
    let local = 0;
    let unsynced = 0;
    for (const entry of entries) {
      if (entry.location === "cloud" || entry.location === "both") cloud += 1;
      if (entry.location === "local" || entry.location === "both") local += 1;
      if (entry.location === "local" || entry.outOfSync) unsynced += 1;
    }
    return { total: entries.length, cloud, local, unsynced };
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => {
      const title = (entry.document.metadata.title || "").toLowerCase();
      return title.includes(needle) || documentPreview(entry.document, 400).toLowerCase().includes(needle);
    });
  }, [entries, query]);

  const startRename = (document: TextDocument) => {
    setRenamingId(document.metadata.id);
    setDraftTitle(document.metadata.title || "");
  };

  const commitRename = (document: TextDocument) => {
    const title = draftTitle.trim();
    if (title && title !== document.metadata.title) onRename(document, title);
    setRenamingId(null);
  };

  const handleRenameKey = (event: KeyboardEvent<HTMLInputElement>, document: TextDocument) => {
    if (event.key === "Enter") commitRename(document);
    if (event.key === "Escape") setRenamingId(null);
  };

  const confirmDelete = (document: TextDocument) => {
    const label = document.metadata.title || t("untitled");
    if (window.confirm(`${t("delete")} «${label}»?`)) {
      onDelete(document);
    }
  };

  return (
    <div className="drive">
      <header className="drive-head">
        <div className="drive-head-title">
          <h1>{t("myFiles")}</h1>
          <p>{t("filesSubtitle")}</p>
        </div>
        <div className="drive-head-actions">
          <span className={`cloud-pill ${catalog?.cloudOnline ? "online" : "offline"}`}>
            <span className="cloud-dot" />
            {catalog?.cloudOnline ? t("cloudConnected") : t("cloudOffline")}
          </span>
          {stats.unsynced > 0 && catalog?.cloudOnline ? (
            <button type="button" className="drive-btn ghost" onClick={onSyncAll}>
              ⟳ {t("sync")} {stats.unsynced}
            </button>
          ) : null}
          <button type="button" className="drive-btn ghost" onClick={onRefresh} aria-label={t("refresh")}>
            ⟳ {t("refresh")}
          </button>
          <button type="button" className="drive-btn primary" onClick={onCreate}>
            ＋ {t("newDocument")}
          </button>
        </div>
      </header>

      <div className="drive-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">{t("statDocuments")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.cloud}</span>
          <span className="stat-label">{t("statInCloud")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.local}</span>
          <span className="stat-label">{t("statOnDevice")}</span>
        </div>
        <div className={`stat-card ${stats.unsynced > 0 ? "warn" : ""}`}>
          <span className="stat-value">{stats.unsynced}</span>
          <span className="stat-label">{t("statUnsynced")}</span>
        </div>
      </div>

      <div className="drive-toolbar">
        <div className="drive-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          />
        </div>
        <div className="view-toggle" role="group" aria-label="Modo de vista">
          <button
            type="button"
            className={view === "grid" ? "active" : ""}
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            ▦ {t("gridView")}
          </button>
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            ☰ {t("listView")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="drive-empty">
          <div className="spinner" />
          <p>{t("loadingDrive")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="drive-empty">
          <div className="drive-empty-art">📄</div>
          <h2>{query ? t("noResults") : t("noDocsYet")}</h2>
          <p>{query ? t("tryAnotherSearch") : t("createFirst")}</p>
          {!query ? (
            <button type="button" className="drive-btn primary" onClick={onCreate}>
              ＋ {t("createDocument")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className={view === "grid" ? "drive-grid" : "drive-list"}>
          {filtered.map((entry) => {
            const meta = entry.document.metadata;
            const badge = locationBadge(entry.location, t);
            const words = documentWordCount(entry.document);
            const isRenaming = renamingId === meta.id;
            return (
              <article
                key={meta.id}
                className="file-card"
                onDoubleClick={() => onOpen(entry.document)}
              >
                <div className="file-thumb" onClick={() => onOpen(entry.document)} role="presentation">
                  <div className="file-thumb-page">
                    <span className="file-thumb-lines" />
                    <p className="file-thumb-preview">{documentPreview(entry.document, 180) || t("emptyDoc")}</p>
                  </div>
                  <span className="file-kind">W</span>
                </div>

                <div className="file-body">
                  {isRenaming ? (
                    <input
                      className="file-rename"
                      autoFocus
                      value={draftTitle}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftTitle(event.target.value)}
                      onBlur={() => commitRename(entry.document)}
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleRenameKey(event, entry.document)}
                    />
                  ) : (
                    <h3 className="file-title" title={meta.title}>
                      {meta.title || t("untitled")}
                    </h3>
                  )}
                  <div className="file-meta">
                    <span className={`loc-badge ${badge.tone}`}>
                      {badge.icon} {badge.text}
                    </span>
                    {entry.outOfSync ? <span className="loc-badge warn">⚠ {t("localChanges")}</span> : null}
                  </div>
                  <div className="file-submeta">
                    <span>{relativeTime(meta.updatedAt, t, lang)}</span>
                    <span>·</span>
                    <span>{t("words", { n: words })}</span>
                    <span>·</span>
                    <span>r{meta.revision}</span>
                  </div>
                </div>

                <div className="file-actions">
                  <button type="button" className="file-open" onClick={() => onOpen(entry.document)}>
                    {t("open")}
                  </button>
                  <div className="file-icons">
                    <button type="button" title={t("rename")} onClick={() => startRename(entry.document)}>
                      ✎
                    </button>
                    <button type="button" title={t("duplicate")} onClick={() => onDuplicate(entry.document)}>
                      ⧉
                    </button>
                    <button type="button" title={t("download")} onClick={() => onDownload(entry.document)}>
                      ↓
                    </button>
                    <button type="button" className="danger" title={t("delete")} onClick={() => confirmDelete(entry.document)}>
                      🗑
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
