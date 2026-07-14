import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  type DriveCatalog,
  type DriveEntry,
  type DriveFolder,
  type TextDocument,
} from "@web-office/engine-client";
import { useSettings, type Translator } from "../settings/SettingsContext";
import type { DriveSection as Section } from "../routing";

export type DownloadFormat = "docx" | "odt" | "json";
type ViewMode = "grid" | "list";
type SortMode = "recent" | "name" | "words";

interface DriveViewProps {
  catalog: DriveCatalog | null;
  loading: boolean;
  onOpen: (entry: DriveEntry) => void;
  onCreate: (folderId: string) => void;
  onRename: (entry: DriveEntry, title: string) => void;
  onDuplicate: (entry: DriveEntry) => void;
  onDownload: (entry: DriveEntry, format: DownloadFormat) => void;
  onStar: (entry: DriveEntry, starred: boolean) => void;
  onMove: (entry: DriveEntry, folderId: string) => void;
  onTrash: (entry: DriveEntry) => void;
  onRestore: (entry: DriveEntry) => void;
  onDeleteForever: (entry: DriveEntry) => void;
  onCreateFolder: (name: string, parentId: string) => void;
  onRenameFolder: (folder: DriveFolder, name: string) => void;
  onDeleteFolder: (folder: DriveFolder) => void;
  onUpload: (files: FileList | File[], folderId: string) => void;
  onRefresh: () => void;
  onSyncAll: () => void;
  /** Documento abierto ahora mismo en el editor, si lo hay. */
  openDocumentId: string | null;
  /** Sección y carpeta vienen de la ruta: la URL manda. */
  section: Section;
  folderId: string;
  onSectionChange: (section: Section) => void;
  onFolderChange: (folderId: string) => void;
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
  const { catalog, loading, onOpen, onCreate, section, folderId } = props;
  const { t, lang } = useSettings();

  const setSection = props.onSectionChange;
  const setFolderId = props.onFolderChange;
  const [dragging, setDragging] = useState(false);
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("recent");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<DriveEntry | null>(null);
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
      // "Recientes" es una vista plana: atraviesa carpetas, como en Drive.
      if (section === "recent") return true;
      // Al buscar, se busca en toda la unidad, no solo en la carpeta actual.
      return needle ? true : entry.folderId === folderId;
    });
    // El texto de búsqueda y el conteo vienen precalculados con el catálogo: no
    // se vuelve a recorrer el documento por cada tecla ni por cada comparación.
    if (needle) list = list.filter((entry) => entry.searchText.includes(needle));

    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", lang));
    } else if (sort === "words") {
      sorted.sort((a, b) => b.wordCount - a.wordCount);
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [entries, section, folderId, query, sort, lang]);

  const startRename = (entry: DriveEntry) => {
    setMenuFor(null);
    setRenamingId(entry.id);
    setDraftTitle(entry.title || "");
  };

  const commitRename = (entry: DriveEntry) => {
    const title = draftTitle.trim();
    if (title && title !== entry.title) props.onRename(entry, title);
    setRenamingId(null);
  };

  const handleRenameKey = (event: KeyboardEvent<HTMLInputElement>, entry: DriveEntry) => {
    if (event.key === "Enter") commitRename(entry);
    if (event.key === "Escape") setRenamingId(null);
  };

  const submitFolder = () => {
    const name = folderDraft.trim();
    if (name) props.onCreateFolder(name, folderId);
    setFolderDraft("");
    setCreatingFolder(false);
  };

  const confirmDeleteForever = (entry: DriveEntry) => {
    const name = entry.title || t("untitled");
    if (window.confirm(t("confirmDeleteForever", { name }))) props.onDeleteForever(entry);
  };

  const emptyTrash = () => {
    const trashed = entries.filter((entry) => entry.trashed);
    if (window.confirm(t("confirmEmptyTrash", { n: trashed.length }))) {
      for (const entry of trashed) props.onDeleteForever(entry);
    }
  };

  const sections: { key: Section; label: string; icon: string; count: number }[] = [
    { key: "recent", label: t("recent"), icon: "🕘", count: stats.total },
    { key: "files", label: t("myFiles"), icon: "🗂", count: stats.total },
    { key: "starred", label: t("starred"), icon: "★", count: stats.starred },
    { key: "trash", label: t("trash"), icon: "🗑", count: stats.trashed },
  ];

  const folderName = (id: string) => folders.find((folder) => folder.id === id)?.name ?? null;

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    props.onUpload(files, section === "files" ? folderId : "");
  };

  const headings: Record<Section, string> = {
    recent: t("recent"),
    files: t("myFiles"),
    starred: t("starred"),
    trash: t("trash"),
  };

  return (
    <div
      className={`drive ${dragging ? "dropping" : ""}`}
      onDragOver={(event) => { event.preventDefault(); if (!dragging) setDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer?.files ?? null); }}
    >
      {dragging ? (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-card">
            <span className="drop-art">📥</span>
            <strong>{t("dropHere")}</strong>
            <small>{t("dropHint")}</small>
          </div>
        </div>
      ) : null}

      <input
        ref={uploadRef}
        type="file"
        multiple
        accept=".docx,.odt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => { handleFiles(event.target.files); event.target.value = ""; }}
      />

      <header className="drive-head">
        <div className="drive-head-title">
          <h1>{headings[section]}</h1>
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
          {section !== "trash" ? (
            <button type="button" className="drive-btn ghost" onClick={() => uploadRef.current?.click()}>
              ↑ {t("uploadFile")}
            </button>
          ) : null}
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
            /* Solo cambia la sección: onSectionChange ya vuelve a la raíz. Llamar
               además a onFolderChange pisaba la sección recién elegida. */
            onClick={() => { setSection(item.key); setQuery(""); }}
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
          <div className="drive-empty-art">{section === "trash" ? "🗑" : section === "starred" ? "★" : section === "recent" ? "🕘" : "📄"}</div>
          <h2>
            {query ? t("noResults")
              : section === "trash" ? t("trashEmpty")
                : section === "starred" ? t("starredEmpty")
                  : section === "recent" ? t("recentEmpty")
                    : folderId ? t("folderEmpty") : t("noDocsYet")}
          </h2>
          <p>
            {query ? t("tryAnotherSearch")
              : section === "trash" ? t("trashEmptyHint")
                : section === "starred" ? t("starredEmptyHint")
                  : section === "recent" ? t("recentEmptyHint")
                    : folderId ? t("folderEmptyHint") : t("createFirst")}
          </p>
          {!query && (section === "files" || section === "recent") ? (
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
                    <article
                      className={`folder-card ${dropFolderId === folder.id ? "drop-target" : ""}`}
                      key={folder.id}
                      onDragOver={(event) => {
                        if (!draggingDocId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        setDropFolderId(folder.id);
                      }}
                      onDragLeave={() => setDropFolderId((current) => (current === folder.id ? null : current))}
                      onDrop={(event) => {
                        if (!draggingDocId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const dragged = entries.find((item) => item.id === draggingDocId);
                        if (dragged && dragged.folderId !== folder.id) props.onMove(dragged, folder.id);
                        setDraggingDocId(null);
                        setDropFolderId(null);
                      }}
                      onDoubleClick={() => setFolderId(folder.id)}
                    >
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
                  const badge = locationBadge(entry.location, t);
                  const words = entry.wordCount;
                  const isRenaming = renamingId === entry.id;
                  const inTrash = entry.trashed;
                  return (
                    <article
                      key={entry.id}
                      className={`file-card ${draggingDocId === entry.id ? "dragging" : ""}`}
                      draggable={!inTrash}
                      onDragStart={(event) => {
                        setDraggingDocId(entry.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", entry.id);
                      }}
                      onDragEnd={() => { setDraggingDocId(null); setDropFolderId(null); }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenuFor(entry.id);
                        setMenuPoint({ x: event.clientX, y: event.clientY });
                      }}
                      onDoubleClick={() => !inTrash && onOpen(entry)}
                    >
                      <div
                        className="file-thumb"
                        onClick={() => !inTrash && onOpen(entry)}
                        role="presentation"
                      >
                        <div className="file-thumb-page">
                          <span className="file-thumb-lines" />
                          <p className="file-thumb-preview">{entry.preview || t("emptyDoc")}</p>
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
                            onBlur={() => commitRename(entry)}
                            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleRenameKey(event, entry)}
                          />
                        ) : (
                          <h3 className="file-title" title={entry.title}>{entry.title || t("untitled")}</h3>
                        )}
                        <div className="file-meta">
                          {props.openDocumentId === entry.id ? <span className="loc-badge open">● {t("openNow")}</span> : null}
                          <span className={`loc-badge ${badge.tone}`}>{badge.icon} {badge.text}</span>
                          {entry.outOfSync ? <span className="loc-badge warn">⚠ {t("localChanges")}</span> : null}
                          {section !== "files" && entry.folderId && folderName(entry.folderId) ? (
                            <span className="loc-badge folder">📁 {t("inFolder", { name: folderName(entry.folderId)! })}</span>
                          ) : null}
                        </div>
                        <div className="file-submeta">
                          <span>{relativeTime(entry.updatedAt, t, lang)}</span>
                          <span>·</span>
                          <span>{t("words", { n: words })}</span>
                          <span>·</span>
                          <span>r{entry.revision}</span>
                        </div>
                      </div>

                      <div className="file-actions">
                        {inTrash ? (
                          <>
                            <button type="button" className="file-open" onClick={() => props.onRestore(entry)}>
                              ↺ {t("restore")}
                            </button>
                            <div className="file-icons">
                              <button type="button" className="danger" title={t("deleteForever")} onClick={() => confirmDeleteForever(entry)}>
                                🗑
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <button type="button" className="file-open" onClick={() => onOpen(entry)}>{t("open")}</button>
                            <div className="file-icons">
                              <button
                                type="button"
                                className={entry.starred ? "starred" : ""}
                                title={entry.starred ? t("unstar") : t("star")}
                                aria-pressed={entry.starred}
                                onClick={() => props.onStar(entry, !entry.starred)}
                              >★</button>
                              <div className="menu-anchor" ref={menuFor === entry.id ? menuRef : undefined}>
                                <button
                                  type="button"
                                  title={t("moreActions")}
                                  aria-expanded={menuFor === entry.id}
                                  onClick={() => { setMenuPoint(null); setMenuFor(menuFor === entry.id ? null : entry.id); }}
                                >⋯</button>
                                {menuFor === entry.id ? (
                                  <div
                                    className="card-menu"
                                    role="menu"
                                    /* Con clic derecho el menú sale donde está el cursor;
                                       con el botón ⋯ se ancla a la tarjeta. */
                                    style={menuPoint ? { position: "fixed", left: menuPoint.x, top: menuPoint.y, right: "auto", bottom: "auto" } : undefined}
                                  >
                                    <button type="button" onClick={() => startRename(entry)}>✎ {t("rename")}</button>
                                    <button type="button" onClick={() => { setMenuFor(null); setMovingDoc(entry); }}>
                                      📁 {t("moveTo")}
                                    </button>
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDuplicate(entry); }}>
                                      ⧉ {t("duplicate")}
                                    </button>
                                    <hr />
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDownload(entry, "docx"); }}>
                                      ↓ {t("downloadDocx")}
                                    </button>
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDownload(entry, "odt"); }}>
                                      ↓ {t("downloadOdt")}
                                    </button>
                                    <button type="button" onClick={() => { setMenuFor(null); props.onDownload(entry, "json"); }}>
                                      ↓ {t("downloadJson")}
                                    </button>
                                    <hr />
                                    <button type="button" className="danger" onClick={() => { setMenuFor(null); props.onTrash(entry); }}>
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
