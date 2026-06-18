// --- MODULO OFFLINE FOTO (fuori da Scarichi) ---
const DB_NAME = "scarichi_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "scarichi_foto";

const openOfflineDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });

export const saveOfflinePhotos = async (utenteId, files) => {
  if (!files || !files.length) return;
  const db = await openOfflineDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  for (const file of files) {
    const id = `${utenteId}__${file.name}__${Date.now()}`;
    const reader = new FileReader();

    await new Promise((res, rej) => {
      reader.onload = (ev) => {
        store.put({
          id,
          utenteId,
          name: file.name,
          type: file.type,
          data: ev.target.result // ArrayBuffer
        });
        res();
      };
      reader.onerror = rej;
      reader.readAsArrayBuffer(file);
    });
  }

  await tx.complete;
};

export const loadOfflinePhotos = async (utenteId) => {
  const db = await openOfflineDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      resolve(all.filter((f) => f.utenteId === utenteId));
    };
    req.onerror = () => resolve([]);
  });
};

export const clearOfflinePhotos = async (utenteId) => {
  const db = await openOfflineDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  for (const f of all) {
    if (f.utenteId === utenteId) {
      store.delete(f.id);
    }
  }

  await tx.complete;
};
