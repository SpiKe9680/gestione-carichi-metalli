
// src/utils/log.js
import { db, auth } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  deleteDoc
} from "firebase/firestore";

/**
 * ===============================
 * SCRITTURA LOG UNIVERSALE
 * ===============================
 */
export const scriviLog = async ({
  pagina,
  tipo,
  collezioneRef = null,
  documentoId = null,
  dati_originali = null,
  dati_modificati = null
}) => {
  try {
    const ripristinabile = tipo !== "RIPRISTINO";

    await addDoc(collection(db, "log_operazioni"), {
      pagina,
      tipo,
      utente: auth.currentUser?.email || "sconosciuto",
      timestamp: serverTimestamp(),

      collezioneRef,
      documentoId,

      // per MODIFICA e CANCELLAZIONE salvare TUTTO il documento originale
      dati_originali,
      dati_modificati,

      ripristinato: false,
      ripristinabile
    });
  } catch (e) {
    console.error("Errore scrittura log:", e);
  }
};

/**
 * ===============================
 * RIPRISTINO UNIVERSALE
 * ===============================
 */
export const ripristinaLog = async (log) => {
  try {
    const { tipo, collezioneRef, documentoId, dati_originali } = log;

    if (!collezioneRef || !documentoId) throw new Error("Log non ripristinabile");

    const ref = doc(db, collezioneRef, documentoId);

    // =============================
    // CREAZIONE → DELETE
    // =============================
    if (tipo.startsWith("CREAZIONE")) {
      await deleteDoc(ref);
    }

    // =============================
    // MODIFICA / CANCELLAZIONE → RIPRISTINO COMPLETO
    // =============================
    else if ((tipo.startsWith("MODIFICA") || tipo.startsWith("CANCELLAZIONE")) && dati_originali) {
      // Sovrascrive TUTTO il campo scarico originale salvato nel log
      await updateDoc(ref, { scarico: dati_originali.scarico || [] });
    }

    // =============================
    // MARCA RIPRISTINATO
    // =============================
    await updateDoc(doc(db, "log_operazioni", log.id), {
      ripristinato: true,
      data_ripristino: serverTimestamp()
    });

    alert("Ripristino completato");

  } catch (err) {
    console.error(err);
    alert("Errore durante il ripristino");
  }
};