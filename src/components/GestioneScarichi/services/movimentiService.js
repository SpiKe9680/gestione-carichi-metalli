import { auth } from "../../../firebase";

import { collection, getDocs } from "firebase/firestore";
import { normalizeDate } from "../utils/calcoli";

export const caricaMovimenti = async (db) => {
  const scarichiSnap = await getDocs(collection(db, "scarichi"));
  const carichiSnap = await getDocs(collection(db, "carichi"));

  const parseDoc = (d, tipo) => {
    const data = d.data();
    const movimenti = Array.isArray(data[tipo]) ? data[tipo] : [];

    return {
      id: d.id,
      uiId: `${tipo}_${d.id}`,
      realId: d.id,
      tipo,
      data: normalizeDate(data.data),
      fornitore: data.fornitore || "sconosciuto",
      listino: data.listino || "sconosciuto",
      utente: data.utente || "sconosciuto",
      movimentoFinanziarioId:
        data.movimentoFinanziarioId !== undefined &&
        data.movimentoFinanziarioId !== null &&
        String(data.movimentoFinanziarioId).trim() !== ""
          ? data.movimentoFinanziarioId
          : null,
      cer: movimenti.map((m) => ({
        fir: m.fir || "-",
        cer: m.cer || m.codiceCER || "-",
        tipo: m.tipo,
        righe: (m.righe || []).map((r) => ({
          ...r,
          netto: r.netto || 0,
          prezzoAcquisto: r.prezzoAcquisto || 0,
          prezzoVendita: r.prezzoVendita || 0,
        })),
      })),
    };
  };

  const scarichi = scarichiSnap.docs.map((d) => parseDoc(d, "scarico"));
  const carichi = carichiSnap.docs.map((d) => parseDoc(d, "carico"));

  const tuttiMovimenti = [...scarichi, ...carichi];
  tuttiMovimenti.sort((a, b) => b.data - a.data);

  return tuttiMovimenti;
};


export const getUtenteReact = () => {
  const u = JSON.parse(sessionStorage.getItem("utenteLoggato"));

  return (
    u?.username ||
    u?.email ||
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    "sconosciuto"
  );
};


export const applyListino = async ({
  movimentiIds = [],
  listino,
  db,
  scarichi = [],
  setScarichi
}) => {
  if (!movimentiIds.length) return scarichi;
  if (!listino || listino === "tutti") return scarichi;

  try {
    const listiniSnap = await getDocs(collection(db, "listini"));

    let listinoSelezionato = null;

    listiniSnap.docs.forEach((d) => {
      const data = d.data();
      const nome = (data.nome || "").toString().trim().toLowerCase();

      if (nome === listino.toString().trim().toLowerCase()) {
        listinoSelezionato = data;
      }
    });

    if (!listinoSelezionato) {
      console.error("❌ LISTINO NON TROVATO:", listino);
      return scarichi;
    }

    const prezzi = listinoSelezionato.prezzi || {};
    const smartMap = {};

    Object.entries(prezzi).forEach(([key, val]) => {
      const k = (key ?? "")
        .toString()
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]/g, "");

      smartMap[k] = val;
      smartMap[k.replace(/\./g, "")] = val;
    });

    const norm = (v) =>
      (v ?? "")
        .toString()
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]/g, "");

    const aggiornati = scarichi.map((movimento) => {
      if (!movimentiIds.includes(movimento.id)) {
        return movimento;
      }

      const tipo = movimento.tipo || "scarico";

      if (!Array.isArray(movimento.cer)) {
        return movimento;
      }

      const cerAggiornati = movimento.cer.map((cer) => ({
        ...cer,
        righe: (cer.righe || []).map((r) => {
          const raw = r.materiale;
          const key = norm(raw);

          const prezzoObj =
            smartMap[key] ||
            smartMap[raw] ||
            null;

          if (!prezzoObj) {
            return r;
          }

          const acquisto =
            prezzoObj.acquisto ??
            prezzoObj.prezzoAcquisto ??
            0;

          const vendita =
            prezzoObj.vendita ??
            prezzoObj.prezzoVendita ??
            0;

          const prezzoFinale =
            tipo === "scarico"
              ? acquisto
              : vendita;

          return {
            ...r,
            prezzoAcquisto:
              tipo === "scarico"
                ? Number(acquisto)
                : Number(r.prezzoAcquisto ?? 0),
            prezzoVendita:
              tipo === "carico"
                ? Number(vendita)
                : Number(r.prezzoVendita ?? 0),
            prezzo: Number(prezzoFinale ?? 0),
            listino
          };
        })
      }));

      return {
        ...movimento,
        cer: cerAggiornati,
        listino
      };
    });

    if (typeof setScarichi === "function") {
      setScarichi(aggiornati);
    }

    return aggiornati;
  } catch (e) {
    console.error("💥 ERRORE APPLYLISTINO:", e);
    return scarichi;
  }
};


export const caricaListini = async (db) => {
  const snap = await getDocs(collection(db, "listini"));
  const mapListini = {};

  snap.docs.forEach((d) => {
    const data = d.data();
    mapListini[data.nome] = {
      prezzi: data.prezzi,
      tipoListino: data.tipoListino
    };
  });

  return mapListini;
};
