import { collection, addDoc, doc,setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/* =========================
   SNAPSHOT (SAFE)
========================= */
export const createSnapshot = (docData) => {
  return JSON.parse(JSON.stringify(docData, (key, value) => {
    if (value?.toDate) {
      return {
        __type: "timestamp",
        value: value.toDate().toISOString()
      };
    }
    return value;
  }));
};

/* =========================
   RESTORE SNAPSHOT
========================= */
export const restoreSnapshot = (snap) => {
  const parsed = JSON.parse(JSON.stringify(snap));

  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    Object.keys(obj).forEach((k) => {
      const v = obj[k];

      // 🔥 FIX TIMESTAMP FIRESTORE
      if (v?.__type === "timestamp") {
        obj[k] = new Date(v.value); // ok per Firebase (lo converte lui)
      }

      // 🔥 FIX TIMESTAMP SERIALIZZATI FIRESTORE (seconds/nanoseconds)
      else if (
        v &&
        typeof v === "object" &&
        "seconds" in v &&
        "nanoseconds" in v
      ) {
        obj[k] = new Date(v.seconds * 1000);
      }

      // 🔥 RICORSIVO
      else if (typeof v === "object") {
        obj[k] = walk(v);
      }
    });

    return obj;
  };

  return walk(parsed);
};
/* =========================
   SCRIVI LOG
========================= */
export const scriviLog = async ({
  pagina,
  evento,
  riferimento,
  before,
  after,
  utente,
  ripristinabile = true,
  meta = {}
}) => {
  const safe = (obj) =>
    Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined)
    );

  return await addDoc(collection(db, "log_operazioni"), safe({
    pagina,
    evento,
    riferimento,
    before: createSnapshot(before),
    after: createSnapshot(after),
    utente: utente ?? "sconosciuto",
    timestamp: serverTimestamp(),
    meta,
    ripristinabile,
    ripristinato: false
  }));
};

/* =========================
   RIPRISTINA LOG
========================= */
export const ripristinaLog = async (log) => {
  if (!log?.before) {
    throw new Error("Snapshot BEFORE mancante");
  }

  const collezione = log?.riferimento?.collezione;
  const documentoId = log?.riferimento?.documentoId;

  if (!collezione || !documentoId) {
    throw new Error("Riferimento log non valido");
  }

  const ref = doc(db, collezione, documentoId);

  const restored = restoreSnapshot(log.before);

  await setDoc(ref, restored, { merge: false }); // 🔥 overwrite vero

  await setDoc(
    doc(db, "log_operazioni", log.id),
    {
      ripristinato: true,
      timestampRipristino: serverTimestamp()
    },
    { merge: true }
  );
};