/**
 * Rutas de la aplicación. Cada vista tiene su propia URL, de modo que recargar
 * devuelve al mismo sitio, el botón atrás funciona y un documento se puede
 * marcar o compartir por enlace, como en cualquier suite de oficina web.
 */

export type DriveSection = "recent" | "files" | "starred" | "trash";

export type Route =
  | { view: "drive"; section: DriveSection; folderId: string }
  | { view: "editor"; documentId: string };

export const DEFAULT_ROUTE: Route = { view: "drive", section: "recent", folderId: "" };

/** Traduce la ruta a la URL que la representa. */
export function routeToPath(route: Route): string {
  if (route.view === "editor") return `/document/${encodeURIComponent(route.documentId)}`;
  if (route.section === "files") {
    return route.folderId ? `/drive/folder/${encodeURIComponent(route.folderId)}` : "/drive";
  }
  if (route.section === "recent") return "/";
  return `/drive/${route.section}`;
}

/** Interpreta la URL actual. Cualquier ruta desconocida cae en la de entrada. */
export function parsePath(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "document" && parts[1]) {
    return { view: "editor", documentId: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "drive") {
    if (parts[1] === "folder" && parts[2]) {
      return { view: "drive", section: "files", folderId: decodeURIComponent(parts[2]) };
    }
    if (parts[1] === "starred" || parts[1] === "trash" || parts[1] === "recent") {
      return { view: "drive", section: parts[1], folderId: "" };
    }
    return { view: "drive", section: "files", folderId: "" };
  }
  return DEFAULT_ROUTE;
}

export function routesEqual(left: Route, right: Route): boolean {
  if (left.view !== right.view) return false;
  if (left.view === "editor" && right.view === "editor") return left.documentId === right.documentId;
  if (left.view === "drive" && right.view === "drive") {
    return left.section === right.section && left.folderId === right.folderId;
  }
  return false;
}
