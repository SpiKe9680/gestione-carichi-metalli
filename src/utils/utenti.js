// src/utils/utenti.js
import { db, auth } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { scriviLog } from "./log";

export const ripristinaUtente = async (log) => {
  try {
    const { dati_originali, documentoId } = log;
    if (!dati_originali || !documentoId) throw new Error("Log non ripristinabile");

    const { email, ruolo, password } = dati_originali;

    // Controllo se l'utente esiste già su Auth
    const userSnap = await getDoc(doc(db, "utenti", documentoId));
    if (userSnap.exists()) {
      alert(`Utente ${email} esiste già in Firestore. Impossibile ripristinare.`);
      return;
    }

    // Creazione utente Auth con password originale
    await createUserWithEmailAndPassword(auth, email, password);

    // Ripristino Firestore
    await setDoc(doc(db, "utenti", documentoId), {
      email,
      ruolo,
      uid: documentoId,
      password // così rimane in Firestore per futuri ripristini
    });

    // Log dell’operazione di ripristino
    await scriviLog({
      pagina: "gestione-utenti",
      tipo: "RIPRISTINO_UTENTE",
      collezioneRef: "utenti",
      documentoId,
      dati_originali,
      dati_modificati: null
    });

    alert(`Utente ${email} ripristinato con la stessa password!`);

  } catch (err) {
    console.error(err);
    alert("Errore durante il ripristino dell'utente: " + err.message);
  }
};