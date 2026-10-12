import {
  collection,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";

export const validaEPreparaProspetto = async (db, movimentiIds) => {
  const collections = ["prospettiFattura", "fattureCarichi"];
  const conflittiPagati = [];
  const daEliminare = [];

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));

    snap.docs.forEach((d) => {
      const p = d.data();
      const ids = p.movimentiIds || p.scarichiIds || [];

      if (!Array.isArray(ids)) return;

      const overlap = ids.filter((id) => movimentiIds.includes(id));

      if (overlap.length === 0) return;

      if (p.DataPagamento) {
        conflittiPagati.push({
          id: d.id,
          collection: col,
          fornitore: p.fornitore,
          dataPagamento: p.DataPagamento,
          overlap,
        });
      } else {
        daEliminare.push({
          id: d.id,
          collection: col,
        });
      }
    });
  }

  if (conflittiPagati.length > 0) {
    const msg = conflittiPagati
      .map(
        (c) =>
          `Fornitore: ${c.fornitore} - Pagato il: ${
            c.dataPagamento?.toDate?.()?.toLocaleDateString("it-IT") ||
            c.dataPagamento ||
            "N/D"
          }`
      )
      .join("\n");

    throw new Error("SCARICO_GIA_PAGATO\n\n" + msg);
  }

  for (const d of daEliminare) {
    await deleteDoc(doc(db, d.collection, d.id));
  }

  return true;
};