// Client-side photo storage for AI draft listings, keyed by draft id.
// chrome.storage.local / Firestore hold the text fields; the actual photo
// blobs live here since they're too large for either — IndexedDB persists
// across reloads and browser restarts without needing any server storage.
const DB_NAME = 'anzeigenboost-drafts';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraftPhotos(draftId: string, files: File[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(files, draftId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDraftPhotos(draftId: string): Promise<File[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(draftId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraftPhotos(draftId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(draftId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
