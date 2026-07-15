/**
 * Cuentas y sesión. La sesión vive en una cookie HttpOnly que pone el servidor:
 * el token nunca pasa por JavaScript, así que un script inyectado no puede
 * llevárselo.
 */

const AUTH_URL = "/api/v1/auth";

export interface Account {
  id: string;
  email: string;
  name: string;
}

/** Se lanza cuando la API responde que hace falta iniciar sesión. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Hay que iniciar sesión.");
    this.name = "NotAuthenticatedError";
  }
}

async function problemDetail(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: string };
    if (problem && typeof problem.detail === "string") return problem.detail;
  } catch {
    /* sin cuerpo JSON */
  }
  return `La API respondió ${response.status}.`;
}

async function send(path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method: "POST", credentials: "same-origin" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return fetch(`${AUTH_URL}${path}`, init);
}

/** Crea una cuenta y deja la sesión iniciada. */
export async function register(email: string, name: string, password: string): Promise<Account> {
  const response = await send("/register", { email, name, password });
  if (!response.ok) throw new Error(await problemDetail(response));
  return (await response.json()) as Account;
}

/** Inicia sesión. */
export async function login(email: string, password: string): Promise<Account> {
  const response = await send("/login", { email, password });
  if (!response.ok) throw new Error(await problemDetail(response));
  return (await response.json()) as Account;
}

/** Cierra la sesión en el servidor, no solo en este navegador. */
export async function logout(): Promise<void> {
  await send("/logout");
}

/**
 * Devuelve la cuenta de la sesión actual, o null si no hay ninguna. No lanza
 * cuando no hay sesión: "aún no has entrado" es un estado normal al arrancar,
 * no un error.
 */
export async function currentAccount(): Promise<Account | null> {
  try {
    const response = await fetch(`${AUTH_URL}/me`, { credentials: "same-origin" });
    if (response.status === 401) return null;
    if (!response.ok) return null;
    return (await response.json()) as Account;
  } catch {
    return null;
  }
}
