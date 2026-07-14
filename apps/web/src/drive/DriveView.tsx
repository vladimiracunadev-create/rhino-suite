import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  documentPreview,
  documentWordCount,
  type DriveCatalog,
  type DriveEntry,
  type DriveFolder,
  type TextDocument,
} from "@web-office/engine-client";
import { useSettings, type Translator } from "../settings/SettingsContext";

export type DownloadFormat = "docx" | "odt" | "json";
type Section = "files" | "starred" | "trash";
type ViewMode = "grid" | "list";
type SortMode = "recent" | "name" | "words";

interface DriveViewProps {
  catalog: DriveCatalog | null;
  loading: boolean;
  onOpen: (document: TextDocument) => void;
  onCreate: (folderId: string) => void;
  onRename: (document: TextDocument, title: string) => void;
  onDuplicate: (document: TextDocument) => void;
  onDownload: (document: TextDocument, format: DownloadFormat) => void;
  onStar: (document: TextDocument, starred: boolean) => void;
  onMove: (document: TextDocument, folderId: string) => void;
  onTrash: (document: TextDocument) => void;
  onRestore: (document: TextDocument) => void;
  onDeleteForever: (document: TextDocument) => void;
  onCreateFolder: (name: string, parentId: string) => void;
  onRenameFolder: (folder: DriveFolder, name: string) => void;
  onDeleteFolder: (folder: DriveFolder) => void;
  onRefresh: () => void;
  onSyncAll: () => void;
}

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

export function DriveView(props: DriveViewProps) {
  const { catalog, loading, onOpen, onCreate } = props;
  const { t, lang } = useSettings();

  const [section, setSection] = useState<Section>("files");
  const [folderId, setFolderId] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("recent");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<TextDocument | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const entries = catalog?.entries ?? [];
  const folders = catalog?.folders ?? [];

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuFor(null);
    };
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setMenuFor(null); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  // La carpeta actual solo aplica navegando "Mis archivos".
  const currentFolder = folders.find((folder) => folder.id === folderId) ?? null;

  const breadcrumb = useMemo(() => {
    const chain: DriveFolder[] = [];
    let node = currentFolder;
    const guard = new Set<string>();
    while (node && !guard.has(node.id)) {
      guard.add(node.id);
      chain.unshift(node);
      node = folders.find((folder) => folder.id === node?.parentId) ?? null;
    }
    return chain;
  }, [currentFolder, folders]);

  const stats = useMemo(() => {
    let cloud = 0;
    let unsynced = 0;
    let starred = 0;
    let trashed = 0;
    for (const entry of entries) {
      if (entry.trashed) { trashed += 1; continue; }
      if (entry.location === "cloud" || entry.location === "both") cloud += 1;
      if (entry.location === "local" || entry.outOfSync) unsynced += 1;
      if (entry.starred) starred += 1;
    }
    return { total: entries.length - trashed, cloud, unsynced, starred, trashed };
  }, [entries]);

  const visibleFolders = useMemo(() => {
    if (section !== "files" || query.trim()) return [];
    return folders.filter((folder) => folder.parentId === folderId);
  }, [folders, folderId, section, query]);

  const visibleDocs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = entries.filter((entry) => {
      if (section === "trash") return entry.trashed;
      if (entry.trashed) return false;
      if (section === "starred") return entry.starred;
      // Al buscar, se busca en toda la unidad, no solo en la carpeta actual.
      return needle ? true : entry.folderId === folderId;
    });
    if (needle) {
      list = list.filter((entry) => {
        const title = (entry.document.metadata.title || "").toLowerCase();
        return title.includes(needle) || documentPreview(entry.document, 400).toLowerCase().includes(needle);
      });
    }
    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => (a.document.metadata.title || "").localeCompare(b.document.metadata.title || "", lang));
    } else if (sort === "words") {
      sorted.sort((a, b) => documentWordCount(b.document) - documentWordCount(a.document));
    } else {
      sorted.sort((a, b) => b.document.metadata.updatedAt - a.document.metadata.updatedAt);
    }
    return sorted;
  }, [entries, section, folderId, query, sort, lang]);

  const startRename = (document: TextDocument) => {
    setMenuFor(null);
    setRenamingId(document.metadata.id);
    setDraftTitle(document.metadata.title || "");
  };

  const commitRename = (document: TextDocument) => {
    const title = draftTitle.trim();
    if (title && title !== document.metadata.title) props.onRename(document, title);
    setRenamingId(null);
  };

  const handleRenameKey = (event: KeyboardEvent<HTMLInputElement>, document: TextDocument) => {
    if (event.key === "Enter") commitRename(document);
    if (event.key === "Escape") setRenamingId(null);
  };

  const submitFolder = () => {
    const name = folderDraft.trim();
    if (name) props.onCreateFolder(name, folderId);
    setFolderDraft("");
    setCreatingFolder(false);
  };

  const confirmDeleteForever = (document: TextDocument) => {
    const name = document.metadata.title || t("untitled");
    if (window.confirm(t("confirmDeleteForever", { name }))) props.onDeleteForever(document);
  };

  const emptyTrash = () => {
    const trashed = entries.filter((entry) => entry.trashed);
    if (window.confirm(t("confirmEmptyTrash", { n: trashed.length }))) {
      for (const entry of trashed) props.onDeleteForever(entry.document);
    }
  };

  const sections: { key: Section; label: string; icon: string; count: number }[] = [
    { key: "files", label: t("myFiles"), icon: "🗂", count: stats.total },
    { key: "starred", label: t("starred"), icon: "★", count: stats.starred },
    { key: "trash", label: t("trash"), icon: "🗑", count: stats.trashed },
  ];

  return (
    <div className="drive">
      <header className="drive-head">
        <div className="drive-head-title">
          <h1>{section === "files" ? t("myFiles") : section === "starred" ? t("starred") : t("trash")}</h1>
          <p>{t("filesSubtitle")}</p>
        </div>
        <div className="drive-head-actions">
          <span className={`cloud-pill ${catalog?.cloudOnline ? "online" : "offline"}`}>
            <span className="cloud-dot" />
            {catalog?.cloudOnline ? t("cloudConnected") : t("cloudOffline")}
          </span>
          {stats.unsynced > 0 && catalog?.cloudOnline ? (
            <button type="button" className="drive-btn ghost" onClick={props.onSyncAll}>
              ⟳ {t("sync")} {stats.unsynced}
            </button>
          ) : null}
          <button type="button" className="drive-btn ghost" onClick={props.onRefresh}>⟳ {t("refresh")}</button>
          {section === "files" ? (
            <button type="button" className="drive-btn ghost" onClick={() => setCreatingFolder(true)}>
              📁 {t("newFolder")}
            </button>
          ) : null}
          {section === "trash" && stats.trashed > 0 ? (
            <button type="button" className="drive-btn danger" onClick={emptyTrash}>🗑 {t("emptyTrash")}</button>
          ) : null}
          <button type="button" className="drive-btn primary" onClick={() => onCreate(folderId)}>
            ＋ {t("newDocument")}
          </button>
        </div>
      </header>

      <nav className="drive-sections" aria-label="Secciones">
        {sections.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`section-tab ${section === item.key ? "active" : ""}`}
            aria-pressed={section === item.key}
            onClick={() => { setSection(item.key); setFolderId(""); setQuery(""); }}
          >
            <span className="section-ico">{item.icon}</span>
            {item.label}
            <span className="section-count">{item.count}</span>
          </button>
        ))}
      </nav>

      {section === "files" ? (
        <div className="drive-crumbs">
          <button type="button" className={folderId === "" ? "crumb current" : "crumb"} onClick={() => setFolderId("")}>
            {t("myFiles")}
          </button>
          {breadcrumb.map((folder, index) => (
            <span className="crumb-part" key={folder.id}>
              <span className="crumb-sep">›</span>
              <button
                type="button"
                className={index === breadcrumb.length - 1 ? "crumb current" : "crumb"}
                onClick={() => setFolderId(folder.id)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {creatingFolder ? (
        <div className="new-folder-row">
          <span className="folder-ico">📁</span>
          <input
            autoFocus
            value={folderDraft}
            placeholder={t("folderName")}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setFolderDraft(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") submitFolder();
              if (event.key === "Escape") { setCreatingFolder(false); setFolderDraft(""); }
            }}
          />
          <button type="button" className="drive-btn primary" onClick={submitFolder}>{t("create")}</button>
          <button type="button" className="drive-btn ghost" onClick={() => { setCreatingFolder(false); setFolderDraft(""); }}>
            {t("cancel")}
          </button>
        </div>
      ) : null}

      {section === "files" && !query ? (
        <div className="drive-stats">
          <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">{t("statDocuments")}</span></div>
          <div className="stat-card"><span className="stat-value">{stats.cloud}</span><span className="stat-label">{t("statInCloud")}</span></div>
          <div className="stat-card"><span className="stat-value">{stats.starred}</span><span className="stat-label">{t("starred")}</span></div>
          <div className={`stat-card ${stats.unsynced > 0 ? "warn" : ""}`}>
            <span className="stat-value">{stats.unsynced}</span><span className="stat-label">{t("statUnsynced")}</span>
          </div>
        </div>
      ) : null}

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
        <div className="toolbar-right">
          <label className="sort-control">
            <span>{t("sortBy")}</span>
            <select value={sort} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as SortMode)}>
              <option value="recent">{t("sortRecent")}</option>
              <option value="name">{t("sortName")}</option>
              <option value="words">{t("sortWords")}</option>
            </select>
          </label>
          <div className="view-toggle" role="group" aria-label="Modo de vista">
            <button type="button" className={view === "grid" ? "active" : ""} aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              ▦ {t("gridView")}
            </button>
            <button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}>
              ☰ {t("listView")}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="drive-empty"><div className="spinner" /><p>{t("loadingDrive")}</p></div>
      ) : visibleFolders.length === 0 && visibleDocs.length === 0 ? (
        <div className="drive-empty">
          <div className="drive-empty-art">{section === "trash" ? "🗑" : section === "starred" ? "★" : "📄"}</div>
          <h2>
            {query ? t("noResults") : section === "trash" ? t("trashEmpty") : section === "starred" ? t("starredEmpty") : folderId ? t("folderEmpty") : t("noDocsYet")}
          </h2>
          <p>
            {query ? t("tryAnotherSearch") : section === "trash" ? t("trashEmptyHint") : section === "starred" ? t("starredEmptyHint") : folderId ? t("folderEmptyHint") : t("createFirst")}
          </p>
          {!query && section === "files" ? (
            <button type="button" className="drive-btn primary" onClick={() => onCreate(folderId)}>＋ {t("createDocument")}</button>
          ) : null}
        </div>
      ) : (
        <>
          {visibleFolders.length > 0 ? (
            <section className="drive-block">
              <h2 className="block-title">{t("folders")}</h2>
              <div className="folder-grid">
                {visibleFolders.map((folder) => {
                  const count = entries.filter((entry) => !entry.trashed && entry.folderId === folder.id).length;
                  return (
                    <article className="folder-card" key={folder.id} onDoubleClick={() => setFolderId(folder.id)}>
                      <button type="button" className="folder-main" onClick={() => setFolderId(folder.id)}>
                        <span className="folder-ico">📁</span>
                        <span className="folder-text">
                          <strong>{folder.name}</strong>
                          <small>{t("itemsCount", { n: count })}</small>
                        </span>
                      </button>
                      <div className="folder-actions">
                        <button
                          type="button"
                          title={t("renameFolder")}
                          onClick={() => {
                            const name = window.prompt(t("renameFolder"), folder.name);
                            if (name && name.trim()) props.onRenameFolder(folder, name.trim());
                          }}
                        >✎</button>
                        <button
                          type="button"
                          className="danger"
                          title={`${t("deleteFolder")} — ${t("deleteFolderHint")}`}
                          onClick={() => {
                            if (window.confirm(`${t("deleteFolder")}: «${folder.name}»?\n${t("deleteFolderHint")}`)) {
                              props.onDeleteFolder(folder);
                            }
                          }}
                        >🗑</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {visibleDocs.length > 0 ? (
            <section className="drive-block">
              {visibleFolders.length > 0 ? <h2 className="block-title">{t("statDocuments")}</h2> : null}
              <div className={view === "grid" ? "drive-grid" : "drive-list"}>
                {visibleDocs.map((entry) => {
                  const meta = entry.document.metadata;
                  const badge = locationBadge(entry.location, t);
                  const words = documentWordCount(entry.document);
                  const isRenaming = renamingId === meta.id;
                  const inTrash = entry.trashed;
                  return (
                    <article key={meta.id} className="file-card" onDoubleClick={() => !inTrash && onOpen(entry.document)}>
                      <div
                        className="file-thumb"
                        onClick={() => !inTrash && onOpen(entry.document)}
                        role="presentation"
                      >
                        <div className="file-thumb-page">
                          <span className="file-thumb-lines" />
                          <p className="file-thumb-preview">{documentPreview(entry.document, 180) || t("emptyDoc")}</p>
                        </div>
                        <span className="file-kind">W</span>
                        {entry.starred && !inTrash ? <span className="file-star-flag" aria-hidden>★</span> : null}
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
                          <h3 className="file-title" title={meta.title}>{meta.title || t("untitled")}</h3>
                        )}
                        <div className="file-meta">
                          <span className={`loc-badge ${badge.tone}`}>{badge.icon} {badge.text}</span>
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
                        {inTrash ? (
                          <>
                            <button type="button" className="file-open" onClick={() => props.onRestore(entry.document)}>
                              ↺ {t("restore")}
                            </button>
                            <div className="file-icons">
                              <button type="button" className="danger" title={t("deleteForever")} onClick={() => confirmDeleteForever(entry.document)}>
                                🗑
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <button type="button" className="file-open" onClick={() => onOpen(entry.document)}>{t("open")}</button>
                            <div className="file-icons">
                              <button
                                type="button"
                                className={entry.starred ? "starred" : ""}
                                title={entry.starred ? t("unstar") : t("star")}
                                aria-pressed={entry.starred}
                                onClick={() => props.onStar(entry.document, !entry.starred)}
                              >★</button>
                              <div className="menu-anchor" ref={menuFor === meta.id ? menuRef : undefined}>
                                <button
                                  type="button"
                                  title={t("moreActions")}
                                  aria-expanded={menuFor === meta.id}
                                  onClick={() => setMenuFor(menuFor === meta.id ? null : meta.id)}
                                >⋯</button>
                                {menuFor === meta.id ? (
                                  <div className="card-menu" role="menu">
                                    <button type="button" onClick={() => startRename(entry.document)}>✎ {t("rename")}</button>
                                    <button type="button" onClick={() => { setMenuFor(null); setMovingDoc(entry.document); }}>
                                      📁 {t("moveTo")}
                                    </button>
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDuplicate(entry.document); }}>
                                      ⧉ {t("duplicate")}
                                    </button>
                                    <hr />
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDownload(entry.document, "docx"); }}>
                                      ↓ {t("downloadDocx")}
                                    </button>
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDownload(entry.document, "odt"); }}>
                                      ↓ {t("downloadOdt")}
                                    </button>
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDownload(entry.document, "json"); }}>
                                      ↓ {t("downloadJson")}
                                    </button>
                                    <hr />
                                    <button type="button" className="danger" onClick={() => { setMenuFor(null); props.onTrash(entry.document); }}>
                                      🗑 {t("sendToTrash")}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

      {movingDoc ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setMovingDoc(null)}>
          <div className="modal" role="dialog" aria-label={t("moveTo")} onClick={(event) => event.stopPropagation()}>
            <p className="modal-title">{t("moveTo")}</p>
            <div className="folder-picker">
              <button type="button" onClick={() => { props.onMove(movingDoc, ""); setMovingDoc(null); }}>
                🗂 {t("rootFolder")}
              </button>
              {folders.map((folder) => (
                <button key={folder.id} type="button" onClick={() => { props.onMove(movingDoc, folder.id); setMovingDoc(null); }}>
                  📁 {folder.name}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="drive-btn ghost" onClick={() => setMovingDoc(null)}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
