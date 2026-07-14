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
