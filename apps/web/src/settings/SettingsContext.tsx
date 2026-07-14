import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "es" | "en";
export type Theme = "light" | "dark" | "auto";

const LANG_KEY = "rhino.lang";
const THEME_KEY = "rhino.theme";

type Dict = Record<string, string>;

const es: Dict = {
  newDocument: "Nuevo documento",
  myFiles: "Mis archivos",
  editor: "Editor",
  modules: "Módulos",
  documents: "Documentos",
  spreadsheet: "Hoja de cálculo",
  presentations: "Presentaciones",
  pdf: "PDF",
  active: "Activo",
  soon: "Próximo",
  cloudConnected: "Nube conectada",
  cloudOffline: "Nube sin conexión",
  filesSubtitle: "Tus documentos, disponibles desde cualquier equipo.",
  refresh: "Actualizar",
  sync: "Sincronizar",
  statDocuments: "Documentos",
  statInCloud: "En la nube",
  statOnDevice: "En este equipo",
  statUnsynced: "Sin sincronizar",
  searchPlaceholder: "Buscar por título o contenido…",
  gridView: "Cuadrícula",
  listView: "Lista",
  loadingDrive: "Cargando tu unidad…",
  noResults: "Sin resultados",
  noDocsYet: "Aún no tienes documentos",
  tryAnotherSearch: "Prueba con otro término de búsqueda.",
  createFirst: "Crea tu primer documento para empezar.",
  createDocument: "Crear documento",
  open: "Abrir",
  rename: "Renombrar",
  duplicate: "Duplicar",
  download: "Descargar",
  delete: "Eliminar",
  locCloud: "En la nube",
  locSynced: "Sincronizado",
  locLocal: "Solo local",
  localChanges: "Cambios locales",
  emptyDoc: "Documento vacío",
  untitled: "Sin título",
  savedCloud: "Guardado en la nube",
  savingState: "Guardando…",
  pendingChanges: "Cambios pendientes",
  localOnlyState: "Solo en este equipo",
  settings: "Ajustes",
  language: "Idioma",
  visualMode: "Modo visual",
  light: "Claro",
  dark: "Oscuro",
  auto: "Automático",
  justNow: "hace instantes",
  minAgo: "hace {n} min",
  hoursAgo: "hace {n} h",
  yesterday: "ayer",
  daysAgo: "hace {n} días",
  words: "{n} palabras",
  starred: "Destacados",
  trash: "Papelera",
  newFolder: "Nueva carpeta",
  folderName: "Nombre de la carpeta",
  create: "Crear",
  cancel: "Cancelar",
  folders: "Carpetas",
  moveTo: "Mover a…",
  moveHere: "Mover aquí",
  rootFolder: "Mis archivos (raíz)",
  restore: "Restaurar",
  deleteForever: "Eliminar definitivamente",
  emptyTrash: "Vaciar papelera",
  sendToTrash: "Enviar a la papelera",
  sortBy: "Ordenar",
  sortRecent: "Recientes",
  sortName: "Nombre",
  sortWords: "Tamaño",
  star: "Destacar",
  unstar: "Quitar destacado",
  trashEmpty: "La papelera está vacía",
  starredEmpty: "No hay documentos destacados",
  folderEmpty: "Esta carpeta está vacía",
  starredEmptyHint: "Marca un documento con ★ para verlo aquí.",
  trashEmptyHint: "Lo que envíes a la papelera aparecerá aquí.",
  folderEmptyHint: "Crea un documento o mueve uno aquí.",
  downloadDocx: "Descargar DOCX",
  downloadOdt: "Descargar ODT",
  downloadJson: "Descargar copia interna",
  renameFolder: "Renombrar carpeta",
  deleteFolder: "Eliminar carpeta",
  deleteFolderHint: "Los documentos volverán a Mis archivos.",
  moreActions: "Más acciones",
  itemsCount: "{n} elementos",
  confirmDeleteForever: "¿Eliminar «{name}» para siempre? No se puede deshacer.",
  confirmEmptyTrash: "¿Vaciar la papelera? Se eliminarán {n} documentos para siempre.",
  recent: "Recientes",
  recentEmpty: "Todavía no hay actividad",
  recentEmptyHint: "Los documentos que abras o edites aparecerán aquí.",
  uploadFile: "Subir archivo",
  dropHere: "Suelta el archivo para subirlo",
  dropHint: "Se admiten documentos DOCX y ODT",
  unsupportedFile: "Solo se pueden subir archivos DOCX u ODT.",
  continueEditing: "Continuar",
  openNow: "abierto",
  inFolder: "en {name}",
  selectedCount: "{n} seleccionados",
  clearSelection: "Quitar selección",
  selectAll: "Seleccionar todo",
  shortcuts: "Atajos",
  shortcutsTitle: "Atajos de teclado",
  scOpen: "Abrir",
  scSearch: "Buscar",
  scSelectAll: "Seleccionar todo",
  scTrash: "Enviar a la papelera",
  scNew: "Nuevo documento",
  scClose: "Cerrar o quitar selección",
  scFind: "Buscar y reemplazar",
  scSave: "Guardar",
  inDrive: "En la unidad",
  inEditor: "En el editor",
};

const en: Dict = {
  newDocument: "New document",
  myFiles: "My files",
  editor: "Editor",
  modules: "Modules",
  documents: "Documents",
  spreadsheet: "Spreadsheet",
  presentations: "Presentations",
  pdf: "PDF",
  active: "Active",
  soon: "Soon",
  cloudConnected: "Cloud connected",
  cloudOffline: "Cloud offline",
  filesSubtitle: "Your documents, available from any device.",
  refresh: "Refresh",
  sync: "Sync",
  statDocuments: "Documents",
  statInCloud: "In the cloud",
  statOnDevice: "On this device",
  statUnsynced: "Not synced",
  searchPlaceholder: "Search by title or content…",
  gridView: "Grid",
  listView: "List",
  loadingDrive: "Loading your drive…",
  noResults: "No results",
  noDocsYet: "You don't have any documents yet",
  tryAnotherSearch: "Try a different search term.",
  createFirst: "Create your first document to get started.",
  createDocument: "Create document",
  open: "Open",
  rename: "Rename",
  duplicate: "Duplicate",
  download: "Download",
  delete: "Delete",
  locCloud: "In the cloud",
  locSynced: "Synced",
  locLocal: "Local only",
  localChanges: "Local changes",
  emptyDoc: "Empty document",
  untitled: "Untitled",
  savedCloud: "Saved to cloud",
  savingState: "Saving…",
  pendingChanges: "Pending changes",
  localOnlyState: "On this device only",
  settings: "Settings",
  language: "Language",
  visualMode: "Visual mode",
  light: "Light",
  dark: "Dark",
  auto: "Auto",
  justNow: "just now",
  minAgo: "{n} min ago",
  hoursAgo: "{n} h ago",
  yesterday: "yesterday",
  daysAgo: "{n} days ago",
  words: "{n} words",
  starred: "Starred",
  trash: "Trash",
  newFolder: "New folder",
  folderName: "Folder name",
  create: "Create",
  cancel: "Cancel",
  folders: "Folders",
  moveTo: "Move to…",
  moveHere: "Move here",
  rootFolder: "My files (root)",
  restore: "Restore",
  deleteForever: "Delete forever",
  emptyTrash: "Empty trash",
  sendToTrash: "Move to trash",
  sortBy: "Sort",
  sortRecent: "Recent",
  sortName: "Name",
  sortWords: "Size",
  star: "Star",
  unstar: "Remove star",
  trashEmpty: "Trash is empty",
  starredEmpty: "No starred documents",
  folderEmpty: "This folder is empty",
  starredEmptyHint: "Star a document with ★ to see it here.",
  trashEmptyHint: "Anything you move to trash shows up here.",
  folderEmptyHint: "Create a document or move one here.",
  downloadDocx: "Download DOCX",
  downloadOdt: "Download ODT",
  downloadJson: "Download internal copy",
  renameFolder: "Rename folder",
  deleteFolder: "Delete folder",
  deleteFolderHint: "Documents will move back to My files.",
  moreActions: "More actions",
  itemsCount: "{n} items",
  confirmDeleteForever: "Delete «{name}» forever? This can't be undone.",
  confirmEmptyTrash: "Empty the trash? {n} documents will be deleted forever.",
  recent: "Recent",
  recentEmpty: "No activity yet",
  recentEmptyHint: "Documents you open or edit will show up here.",
  uploadFile: "Upload file",
  dropHere: "Drop the file to upload it",
  dropHint: "DOCX and ODT documents are supported",
  unsupportedFile: "Only DOCX or ODT files can be uploaded.",
  continueEditing: "Continue",
  openNow: "open",
  inFolder: "in {name}",
  selectedCount: "{n} selected",
  clearSelection: "Clear selection",
  selectAll: "Select all",
  shortcuts: "Shortcuts",
  shortcutsTitle: "Keyboard shortcuts",
  scOpen: "Open",
  scSearch: "Search",
  scSelectAll: "Select all",
  scTrash: "Move to trash",
  scNew: "New document",
  scClose: "Close or clear selection",
  scFind: "Find and replace",
  scSave: "Save",
  inDrive: "In the drive",
  inEditor: "In the editor",
};

const dictionaries: Record<Lang, Dict> = { es, en };

export type Translator = (key: keyof typeof es, params?: Record<string, string | number>) => string;

interface SettingsValue {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  t: Translator;
}

const SettingsContext = createContext<SettingsValue | null>(null);

function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = window.localStorage.getItem(key) as T | null;
    if (value && allowed.includes(value)) return value;
  } catch {
    /* localStorage no disponible */
  }
  return fallback;
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const resolved = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = resolved;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStored(LANG_KEY, "es", ["es", "en"] as const));
  const [theme, setThemeState] = useState<Theme>(() => readStored(THEME_KEY, "auto", ["light", "dark", "auto"] as const));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  }, []);

  const t = useCallback<Translator>((key, params) => {
    let text = dictionaries[lang][key] ?? dictionaries.es[key] ?? String(key);
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }
    return text;
  }, [lang]);

  const value = useMemo<SettingsValue>(() => ({ lang, theme, setLang, setTheme, t }), [lang, theme, setLang, setTheme, t]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings debe usarse dentro de SettingsProvider.");
  return value;
}
