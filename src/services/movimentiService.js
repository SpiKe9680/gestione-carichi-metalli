import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  writeBatch 
} from "firebase/firestore";

/**
 * Applica un determinato listino prezzi a una lista di movimenti.
 */
export const applyListino = async ({
  movimentiIds = [],
  listino,
  db,
  collectionName = "scarichi",
  tipoMovimento
}) => {
  if (!movimentiIds.length || !listino) return;

  try {
    // 1. Query mirata per caricare solo il listino richiesto
    const q = query(
      collection(db, "listini"), 
      where("nome", "==", listino.toString().trim())
    );
    const listiniSnap = await getDocs(q);

    if (listiniSnap.empty) {
      console.error("❌ LISTINO NON TROVATO:", listino);
      return;
    }

    const listinoSelezionato = listiniSnap.docs[0].data();
    const prezzi = listinoSelezionato.prezzi || {};

    // Helper per normalizzare le chiavi di ricerca materiale
    const norm = (v) =>
      (v ?? "")
        .toString()
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]/g, "");

    // Build Mappa Prezzi
    const smartMap = {};
    Object.entries(prezzi).forEach(([key, val]) => {
      smartMap[norm(key)] = val;
    });

    // 2. Utilizziamo un Batch per unificare gli update nel DB
    const batch = writeBatch(db);

    // Recupero parallelo dei documenti per abbattere i tempi di attesa
    const docSnaps = await Promise.all(
      movimentiIds.map((id) => getDoc(doc(db, collectionName, id)))
    );

    let operazioniBatch = 0;

    for (const snap of docSnaps) {
      if (!snap.exists()) {
        console.error("❌ DOC NON ESISTE:", snap.id);
        continue;
      }

      const data = snap.data();
      const tipo = data.tipo || tipoMovimento || "scarico";
      const field = tipo === "carico" ? "carico" : "scarico";
      const blocco = Array.isArray(data[field]) ? data[field] : [];

      let modifiche = 0;

      const aggiornato = blocco.map((cer) => ({
        ...cer,
        righe: (cer.righe || []).map((r) => {
          const raw = r.materiale;
          const key = norm(raw);
          const prezzoObj = smartMap[key] || smartMap[raw] || null;

          if (!prezzoObj) return r;

          modifiche++;
          const acquisto = prezzoObj.acquisto ?? prezzoObj.prezzoAcquisto ?? 0;
          const vendita = prezzoObj.vendita ?? prezzoObj.prezzoVendita ?? 0;
          const prezzoFinale = tipo === "scarico" ? acquisto : vendita;

          return {
            ...r,
            prezzoAcquisto: tipo === "scarico" ? Number(acquisto) : Number(r.prezzoAcquisto ?? 0),
            prezzoVendita: tipo === "carico" ? Number(vendita) : Number(r.prezzoVendita ?? 0),
            prezzo: Number(prezzoFinale ?? 0),
            listino,
          };
        }),
      }));

      if (modifiche > 0) {
        batch.update(snap.ref, {
          [field]: aggiornato,
          listino,
          lastUpdate: Date.now()
        });
        operazioniBatch++;
      }
    }

    // Committa le modifiche in un'unica chiamata atomica
    if (operazioniBatch > 0) {
      await batch.commit();
    }

  } catch (e) {
    console.error("💥 ERRORE APPLYLISTINO:", e);
    throw e; // Rilancia per far gestire l'errore al chiamante se necessario
  }
};