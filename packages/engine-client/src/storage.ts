import { normalizeDocument, type TextDocument } from "./model";

const DATABASE = "web-office-suite";
const VERSION = 1;
const STORE = "documents";

interface StoredDocument {
  id: string;
  document: TextDocument;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
  });
}

export async function saveDocument(document: TextDocument): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put({
      id: document.metadata.id,
      document: normalizeDocument(document),
      updatedAt: document.metadata.updatedAt,
    } satisfies StoredDocument);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar."));
  });
  database.close();
}

export async function listDocuments(): Promise<TextDocument[]> {
  const database = await openDatabase();
  const records = await new Promise<StoredDocument[]>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredDocument[]);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer."));
  });
  database.close();
  return records
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((record) => normalizeDocument(record.document));
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo eliminar."));
  });
  database.close();
}
