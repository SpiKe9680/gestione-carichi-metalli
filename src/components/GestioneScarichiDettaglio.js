// src/components/GestioneScarichiDettaglio.js
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, setDoc, serverTimestamp,Timestamp  } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { FiUpload, FiDownload } from 'react-icons/fi';
import autoTable from "jspdf-autotable";
import Select from "react-select";
import DatePicker, { registerLocale } from "react-datepicker";
import { it } from "date-fns/locale";
import {  PdfHeader } from "../utils/dateUtils";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
registerLocale("it", it);
const mesiItaliani = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const formattaDataItaliana = (date) => {
  if (!date) return "";
  const gg = String(date.getDate()).padStart(2, "0");
  const mese = mesiItaliani[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${gg} ${mese} ${yyyy}`;
};
const formattaOra24 = (date) =>
  `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
const getUtenteReact = () => {
  const u = JSON.parse(sessionStorage.getItem("utenteLoggato"));

  return (
    u?.username ||
    u?.email ||
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    "sconosciuto"
  );
};


const GestioneScarichiDettaglio = ({ giornoSelezionato, goBack, filtroFornitoreProp = "tutti", filtroListinoProp = "tutti", tipoMovimentoProp = "scarico" }) => {
  console.log("📌 Props ricevute nel dettaglio:", { 
    giornoSelezionato, 
    filtroFornitoreProp, 
    filtroListinoProp, 
    tipoMovimentoProp 
});

const vaiScarichi= ()=>navigate("/scarichi", { state: { refresh: true } });
  const [tipoMovimento] = useState(tipoMovimentoProp); // default scarico
  const [righe, setRighe] = useState([]);
  console.log("📌 Stato iniziale righe:", righe);
  const [listini, setListini] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editor, setEditor] = useState(null);
const [labelModifica, setLabelModifica] = useState(null);
  const [originalEditor, setOriginalEditor] = useState(null);
  const [errori, setErrori] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(6);
  const [showFiltri, setShowFiltri] = useState(false);
 const [currentPageCarichi, setCurrentPageCarichi] = useState(1);
const [currentPageScarichi, setCurrentPageScarichi] = useState(1);
  const [filtroOra, setFiltroOra] = useState("tutti");
  const [filtroFornitore, setFiltroFornitore] = useState(filtroFornitoreProp);
  const [filtroCER, setFiltroCER] = useState("tutti");
  const [filtroListino, setFiltroListino] = useState(filtroListinoProp);
  const [filtroUtente, setFiltroUtente] = useState("tutti");
const [filtroFIR, setFiltroFIR] = useState("tutti");
const [filtroMateriale, setFiltroMateriale] = useState("tutti");
const valoriTipo = React.useMemo(() => ["tutti", ...Array.from(new Set(righe.map(r => r.tipo).filter(Boolean)))], [righe]);
console.log("📌 Righe aggiornate:", righe);
const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [sortConfig] = useState({ key: "ora", direction: "desc" });
  const navigate = useNavigate();
  const editorRef = useRef(null);
  
  const parseData = val => {
    if(!val) return null;
    if(typeof val==="string" && val.includes("-")) {
      const d = new Date(val);
      return isNaN(d)?null:d;
    }
    const [gg, mm, yyyy] = val.split("/").map(Number);
    if(!gg || !mm || !yyyy) return null;
    return new Date(yyyy, mm-1, gg);
  };

  const giornoParsed = parseData(giornoSelezionato);
  const dataLabel = giornoParsed ? giornoParsed.toLocaleDateString("it-IT") : "Data non valida";
const getLabelFornDest = () => "Controparte";
  const loadListini = async () => {
    try {
      const snap = await getDocs(collection(db, "listini"));
      const mapListini = {};
      snap.docs.forEach(d => {
        mapListini[d.data().nome] = d.data().prezzi || {};
      });
      setListini(mapListini);
    } catch(e) { console.error("Errore load listini:", e); }
  };
  useEffect(() => {
  loadListini(); // carica la lista dei listini
}, []);
useEffect(() => {
  setFiltroTipo(tipoMovimentoProp?.toLowerCase() || "tutti");
}, [tipoMovimentoProp]);
const [refresh, setRefresh] = useState(0);
// Inserisci in alto, vicino agli altri useState
const [scarichiDelGiorno, setScarichiDelGiorno] = useState([]);
// ---------- CARICAMENTO SCARICHI E POPOLAMENTO RIGHE ----------
useEffect(() => {
  const load = async () => {
    try {
      const snapScarichi = await getDocs(collection(db, "scarichi"));
      const snapCarichi = await getDocs(collection(db, "carichi"));

      const tuttiDocs = [
        ...snapScarichi.docs.map(d => ({ id: d.id, ...d.data() })),
        ...snapCarichi.docs.map(d => ({ id: d.id, ...d.data() }))
      ];

      const giornoParsedLocal = parseData(giornoSelezionato);
      if (!giornoParsedLocal) return;

      const start = new Date(giornoParsedLocal);
      start.setHours(0, 0, 0, 0);

      const end = new Date(giornoParsedLocal);
      end.setHours(23, 59, 59, 999);

      const datiGiorno = tuttiDocs.filter(d => {
        if (!d.data) return false;
        const ts = d.data.toDate ? d.data.toDate() : new Date(d.data);
        return ts >= start && ts <= end;
      });

      setScarichiDelGiorno(datiGiorno);

    } catch (e) {
      console.error("Errore load:", e);
      setErrori(prev => [...prev, e.message]);
    }
  };

  load();
}, [giornoSelezionato, refresh]);
useEffect(() => {
  if (!scarichiDelGiorno || scarichiDelGiorno.length === 0) {
    setRighe([]);
    return;
  }

  const righePronte = scarichiDelGiorno.flatMap(scarico => {
    const movimenti = [
      ...(scarico.scarico || []).map((c, i) => ({
        ...c,
        tipoMov: "scarico",
        cerIndex: i,
        sourceCollection: "scarichi"
      })),
      ...(scarico.carico || []).map((c, i) => ({
        ...c,
        tipoMov: "carico",
        cerIndex: i,
        sourceCollection: "carichi"
      }))
    ];

    return movimenti.flatMap((cer) => {
      const tipoMov = cer.tipoMov;
      const cerIndex = cer.cerIndex;

      // 🔥 FIR FIX: prende FIR dal CER o dal documento
      const firFinale = (cer.fir || scarico.fir || "").toString().trim();

      if (cer.righe && cer.righe.length > 0) {
        return cer.righe.map((r, rIndex) => {
          const netto = Number(r.netto) || 0;
          const prezzo = Number(r.prezzoAcquisto || r.prezzoVendita) || 0;

          const dataObj =
            scarico.data?.toDate?.() ||
            parseData(scarico.dataScaricoStr) ||
            parseData(scarico.data) ||
            null;

          return {
            ...r,
            docId: scarico.id,
            cerIndex,
            rIndex,
            cer: cer.cer,
            fir: firFinale,   // 🔥 FIX
            sourceCollection: cer.sourceCollection,
            tipo: tipoMov,
            fornitore: scarico.fornitore,
            listino: scarico.listino,
            movimentoFinanziarioId: scarico.movimentoFinanziarioId || null,
            dataMovimentoObj: dataObj,
            ora: dataObj
              ? dataObj.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
              : "",
            utente: getUtenteReact(),
            prezzoKg: prezzo,
            costoTotale: netto * prezzo
          };
        });
      }

      // 🔥 CER SENZA RIGHE
      const netto = Number(cer.netto || cer.peso || 0);
      const prezzoVendita = Number(cer.prezzoVendita ?? 0);
      const prezzoAcquisto = Number(cer.prezzoAcquisto ?? 0);
      const dataObj = scarico.data?.toDate?.() || null;

      return [{
        docId: scarico.id,
        cerIndex,
        rIndex: 0,
        cer: cer.cer,
        fir: firFinale,   // 🔥 FIX
        materiale: cer.materiale || "N/D",
        sourceCollection: cer.sourceCollection,
        tipo: tipoMov,
        fornitore: scarico.fornitore,
        listino: scarico.listino,
        movimentoFinanziarioId: scarico.movimentoFinanziarioId || null,
        dataMovimentoObj: dataObj,
        ora: dataObj
          ? dataObj.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
          : "",
        utente: getUtenteReact(),
        prezzoVendita,
        prezzoAcquisto,
        prezzoKg: tipoMov === "carico" ? prezzoVendita : prezzoAcquisto,
        costoTotale: netto * (tipoMov === "carico" ? prezzoVendita : prezzoAcquisto)
      }];
    });
  });

  setRighe([...righePronte]);
}, [scarichiDelGiorno, sortConfig]);

  const ordinaDropdown = (valori) => {
  // Estrai tutti tranne "tutti" e ordina
  const ordinati = valori.filter(v => v !== "tutti").sort((a,b) => a.localeCompare(b));
  // Rimetti "tutti" in cima
  return ["tutti", ...ordinati];
};
// Poi li usi così:
const valoriOra = ordinaDropdown([...new Set(righe.map(r => r.ora))].map(v => v || ""));
const valoriFornitore = ordinaDropdown([...new Set(righe.map(r => r.fornitore))].map(v => v || ""));
const valoriCER = ordinaDropdown([...new Set(righe.map(r => r.cer))].map(v => v || ""));
const valoriListino = ordinaDropdown([...new Set(righe.map(r => r.listino))].map(v => v || ""));
const valoriUtente = ordinaDropdown([...new Set(righe.map(r => r.utente).filter(u => u))]);
const valoriFIR = ordinaDropdown(
  [...new Set(righe.map(r => (r.fir || "").toString().trim()))]
    .filter(v => v !== "")
);

const valoriMateriale = ordinaDropdown([...new Set(righe.map(r => r.materiale))]);
const righeFiltrate = righe.filter(r =>
  (filtroOra==="tutti" || r.ora===filtroOra) &&
  (filtroFornitore==="tutti" || r.fornitore===filtroFornitore) &&
  (filtroCER==="tutti" || r.cer===filtroCER) &&
  (filtroListino==="tutti" || r.listino===filtroListino) &&
  (filtroUtente==="tutti" || r.utente===filtroUtente) &&
  (filtroFIR==="tutti" || r.fir===filtroFIR) &&
  (filtroMateriale==="tutti" || r.materiale===filtroMateriale) &&
  (filtroTipo==="tutti" || (r.tipo || "").toLowerCase() === filtroTipo.toLowerCase())
);
const righeOrdinati = [...righeFiltrate].sort((a, b) => {
  const { key, direction } = sortConfig;

  let va = a[key];
  let vb = b[key];

  // null/undefined safe
  if (va == null) va = "";
  if (vb == null) vb = "";

  // numeri
  if (!isNaN(va) && !isNaN(vb)) {
    va = Number(va);
    vb = Number(vb);
  }

  // stringhe
  if (typeof va === "string") va = va.toLowerCase();
  if (typeof vb === "string") vb = vb.toLowerCase();

  // date (ora)
  if (key === "ora") {
    va = new Date("1970-01-01 " + a.ora);
    vb = new Date("1970-01-01 " + b.ora);
  }

  if (va < vb) return direction === "asc" ? -1 : 1;
  if (va > vb) return direction === "asc" ? 1 : -1;
  return 0;
});
// 🔥 PRIMA SPLIT
const righeCarichiAll = righeOrdinati.filter(r => (r.tipo || "").toLowerCase() === "carico");
const righeScarichiAll = righeOrdinati.filter(r => (r.tipo || "").toLowerCase() === "scarico");

// 🔥 PAGINAZIONE SEPARATA
const paginatedCarichi = rowsPerPage && rowsPerPage !== "tutte"
  ? righeCarichiAll.slice(
      (currentPageCarichi - 1) * rowsPerPage,
      currentPageCarichi * rowsPerPage
    )
  : righeCarichiAll;

const paginatedScarichi = rowsPerPage && rowsPerPage !== "tutte"
  ? righeScarichiAll.slice(
      (currentPageScarichi - 1) * rowsPerPage,
      currentPageScarichi * rowsPerPage
    )
  : righeScarichiAll;

const totalPagesCarichi = rowsPerPage && rowsPerPage !== "tutte"
  ? Math.ceil(righeCarichiAll.length / rowsPerPage)
  : 1;

const totalPagesScarichi = rowsPerPage && rowsPerPage !== "tutte"
  ? Math.ceil(righeScarichiAll.length / rowsPerPage)
  : 1;
  const carichi = righeFiltrate.filter(r => (r.tipo || "").toLowerCase() === "carico");
const scarichi = righeFiltrate.filter(r => (r.tipo || "").toLowerCase() === "scarico");

// CARICHI TOTALI
const totCarichiNetto = carichi.reduce((t, r) => t + (Number(r.netto) || 0), 0);
const totCarichiRicavi = carichi.reduce((t, r) => t + ((Number(r.netto) || 0) * (Number(r.prezzoKg) || 0)), 0);
const mediaCarichi = carichi.length ? totCarichiRicavi / totCarichiNetto : 0;

// SCARICHI TOTALI
const totScarichiNetto = scarichi.reduce((t, r) => t + (Number(r.netto) || 0), 0);
const totScarichiCosti = scarichi.reduce((t, r) => t + ((Number(r.netto) || 0) * (Number(r.prezzoKg) || 0)), 0);
const mediaScarichi = scarichi.length ? totScarichiCosti / totScarichiNetto : 0;

// UTILE
const utile = totCarichiRicavi - totScarichiCosti;
const selezionaRiga = (r, tipo) => {
  console.log("CLICK:", tipo, r);

  setLabelModifica(tipo);

  const baseDate =
    r.dataMovimentoObj ||
    parseData(r.dataScaricoStr) ||
    new Date();

  const oraCalcolata =
    r.ora ||
    `${String(baseDate.getHours()).padStart(2, "0")}:${String(baseDate.getMinutes()).padStart(2, "0")}`;

  // 🔥 editor = RIGA COMPLETA FLAT (NON SOLO POINTER)
  const editorCompleto = {
    ...r, // 👈 QUESTO è il FIX CRITICO

    tipo,

    sourceCollection: tipo === "carico" ? "carichi" : "scarichi",

    data: baseDate,
    ora: oraCalcolata,

    // sicurezza campi mancanti
    peso: r.peso ?? 0,
    calo: r.calo ?? 0,
    netto: r.netto ?? (r.peso - r.calo),
    prezzoKg: r.prezzoKg ?? r.prezzoAcquisto ?? r.prezzoVendita ?? 0
  };

  setEditor(editorCompleto);
  setOriginalEditor(editorCompleto);
};
  useEffect(()=>{
    if(editorRef.current){
      editorRef.current.scrollIntoView({behavior:"smooth", block:"start"});
    }
  }, [editor]);
const updateEditor = (campo, valore) => {
  setEditor(prev => {
    if (!prev) return prev;

    const nuovo = { ...prev };
    const num = (v) => Number(v) || 0;

    // =========================
    // PESI
    // =========================
    if (campo === "peso") {
      nuovo.peso = num(valore);
      nuovo.netto = nuovo.peso - (nuovo.calo || 0);
    }

    if (campo === "calo") {
      nuovo.calo = num(valore);
      nuovo.netto = (nuovo.peso || 0) - nuovo.calo;
    }

    if (campo === "netto") {
      nuovo.netto = num(valore);
      nuovo.peso = nuovo.netto + (nuovo.calo || 0);
    }

    // =========================
    // PREZZO
    // =========================
    if (campo === "prezzoKg") {
      const prezzo = num(valore);
      nuovo.prezzoKg = prezzo;
      nuovo.costoTotale = (nuovo.netto || 0) * prezzo;
    }

    // =========================
    // LISTINO
    // =========================
    if (campo === "listino") {
      nuovo.listino = valore;

      const materiale = nuovo.materiale;
      const tipoPrezzo = nuovo.tipo === "carico" ? "vendita" : "acquisto";

      const prezziListino = listini?.[valore];
      const prezzoDaListino = prezziListino?.[materiale]?.[tipoPrezzo];

      if (prezzoDaListino != null) {
        const prezzo = num(prezzoDaListino);
        nuovo.prezzoKg = prezzo;
        nuovo.costoTotale = (nuovo.netto || 0) * prezzo;
      }
    }

    // =========================
    // FIR
    // =========================
    if (campo === "fir") {
      nuovo.fir = valore;
    }

    // =========================
    // DATA
    // =========================
    if (campo === "data") {
      nuovo.data = valore;
    }

    // =========================
    // ORA
    // =========================
    if (campo === "ora") {
      nuovo.ora = valore;
    }

    // =========================
    // 🔥 FIX DEFINITIVO DATA + ORA (SEMPRE SINCRONIZZATI)
    // =========================

    const base = nuovo.data ? new Date(nuovo.data) : new Date();

    // ora finale sempre coerente
    const oraFinale = nuovo.ora || prev.ora || "00:00";

    let hh = 0;
    let mm = 0;

    if (oraFinale.includes(":")) {
      const parts = oraFinale.split(":");
      hh = Number(parts[0]) || 0;
      mm = Number(parts[1]) || 0;
    }

    base.setHours(hh, mm, 0, 0);

    // forza nuova istanza (React safe)
    nuovo.data = new Date(base);

    // normalizza formato ora
    nuovo.ora = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    return nuovo;
  });
};
const campoModificato = campo => {
  if (!editor || !originalEditor) return false;
  if (campo === "data") {
    return editor.data?.getTime() !== originalEditor.data?.getTime();
  }
  if (campo === "ora") {
    return editor.ora !== originalEditor.ora;
  }
  if (campo === "listino") {
    return editor.listino !== originalEditor.listino;
  }
  return editor[campo] !== originalEditor[campo];
};
  const ricalcolaTotaleCer = cerObj => {
    cerObj.totaleCer = cerObj.righe.reduce((tot,r)=>tot+(Number(r.netto)||0),0);
  };
const handleStampaScaricoRiga = async (riga) => {
  if (!riga) return;

  // 🔥 SE PAGATO → STAMPA CONTABILE
  if (riga.movimentoFinanziarioId) {
    await handleStampaContabileSingola(riga.movimentoFinanziarioId);
    return;
  }

  // 🔵 NON PAGATO → STAMPA MOVIMENTO
  await handlePrint(riga.docId, riga.tipo);
};


const stampaContabileMovimento = async (pdf, mf) => {
  const autoTable = (await import("jspdf-autotable")).default;

  // ---------------------------------------------------------
  // 1) CARICO TUTTI I DOCUMENTI NECESSARI
  // ---------------------------------------------------------
  const scarichiSnap = await getDocs(collection(db, "scarichi"));
  const carichiSnap = await getDocs(collection(db, "carichi"));
  const prospettiSnap = await getDocs(collection(db, "prospettiFattura"));
  const fattureSnap = await getDocs(collection(db, "fattureCarichi"));

  const mapScarichi = {};
  const mapCarichi = {};
  const mapProspetti = {};
  const mapFatture = {};

  scarichiSnap.docs.forEach(d => mapScarichi[d.id] = { id: d.id, ...d.data() });
  carichiSnap.docs.forEach(d => mapCarichi[d.id] = { id: d.id, ...d.data() });
  prospettiSnap.docs.forEach(d => mapProspetti[d.id] = { id: d.id, ...d.data() });
  fattureSnap.docs.forEach(d => mapFatture[d.id] = { id: d.id, ...d.data() });

  // ---------------------------------------------------------
  // 2) DATI BASE
  // ---------------------------------------------------------
  const movimentoId = mf.id;
  const tipo = mf.tipo; // "PRIVATI" | "prospettiFattura" | "fattureCarichi"
  const anagraficaId = mf.anagraficaId;

  const { startY } = await PdfHeader(pdf);

  // ---------------------------------------------------------
  // 3) RECUPERO DATE PAGAMENTO / DOCUMENTO
  // ---------------------------------------------------------
  const movimentoRef = doc(db, "MovimentoFinanziario", movimentoId);
  const movimentoSnap = await getDoc(movimentoRef);

  let dataPagamentoTxt = "-";
  let dataDocumentoTxt = "-";

  if (movimentoSnap.exists()) {
    const d = movimentoSnap.data();
    const dataPagamento = d.data?.toDate ? d.data.toDate() : null;
    const dataDocumento = d.dataDocumento?.toDate ? d.dataDocumento.toDate() : null;

    if (dataPagamento) dataPagamentoTxt = dataPagamento.toLocaleDateString("it-IT");
    if (dataDocumento) dataDocumentoTxt = dataDocumento.toLocaleDateString("it-IT");
  }

  // ---------------------------------------------------------
  // 4) RECUPERO DOCUMENTO ORIGINE
  // ---------------------------------------------------------
  let docOrigine = null;
  let controparte = "";

  if (tipo === "fattureCarichi") {
    docOrigine = mapFatture[anagraficaId];
    controparte = docOrigine?.cliente || "FATTURA";
  }

  if (tipo === "prospettiFattura") {
    docOrigine = mapProspetti[anagraficaId];
    controparte = docOrigine?.cliente || "PROSPETTO";
  }

  if (tipo === "PRIVATI") {
    controparte = "FORNITORE PRIVATO";
  }

  // ---------------------------------------------------------
  // 5) RECUPERO INDIRIZZO / PIVA
  // ---------------------------------------------------------
  let indirizzo = null;
  let piva = null;

  try {
    const snap = await getDocs(collection(db, "controparti"));
    snap.docs.forEach(d => {
      const c = d.data();
      if ((c.nome || "").trim() === controparte.trim()) {
        indirizzo = c.indirizzo || null;
        piva = c.piva || null;
      }
    });
  } catch (e) {}

  // ---------------------------------------------------------
  // 6) INTESTAZIONE PDF
  // ---------------------------------------------------------
  let titoloContabile = "CONTABILE DI PAGAMENTO EFFETTUATO";
  if (tipo === "fattureCarichi") titoloContabile = "CONTABILE DI PAGAMENTO RICEVUTO";

  pdf.setFontSize(16);
  pdf.text(titoloContabile, 14, startY - 12);

  pdf.setFontSize(12);
  let y = startY + 2;

  pdf.text(`Controparte: ${controparte}`, 14, y); y += 6;
  if (indirizzo) { pdf.text(`Indirizzo: ${indirizzo}`, 14, y); y += 6; }
  if (piva) { pdf.text(`P.IVA: ${piva}`, 14, y); y += 6; }

  y += 4;

  pdf.text(`Movimento Finanziario: ${movimentoId}`, 14, y); y += 6;
  pdf.text(`Data Pagamento: ${dataPagamentoTxt}`, 14, y); y += 6;
  pdf.text(`Data Documento: ${dataDocumentoTxt}`, 14, y); y += 10;

  // ---------------------------------------------------------
  // 7) COSTRUZIONE RIGHE FIR
  // ---------------------------------------------------------
  const righeFIR = [];

  const toDate = (d) => d?.toDate ? d.toDate() : new Date(d);

  // PROSPETTI
  if (tipo === "prospettiFattura" && docOrigine?.blocchi) {
    const movIds = docOrigine.movimentiIds || [];

    const mapDateFIR = {};
    movIds.forEach(idMov => {
      if (mapScarichi[idMov]) mapDateFIR[idMov] = toDate(mapScarichi[idMov].data);
      else if (mapCarichi[idMov]) mapDateFIR[idMov] = toDate(mapCarichi[idMov].data);
    });

    docOrigine.blocchi.forEach((b, index) => {
      const idMov = movIds[index];
      const dataFIR = mapDateFIR[idMov] || toDate(docOrigine.dataCreazione);

      (b.righe || []).forEach(r => {
        const prezzo = Number(r.prezzo ?? 0);
        const netto = Number(r.netto || 0);
        const tot = netto * prezzo;

        righeFIR.push({
          fir: b.fir || null,
          dataFIR,
          cer: b.cer || "-",
          materiale: r.materiale || "-",
          netto,
          prezzo,
          totale: tot,
          note: b.note || "-"
        });
      });
    });
  }

  // FATTURE CARICHI
  if (tipo === "fattureCarichi" && docOrigine?.blocchi) {
    const movIds = docOrigine.movimentiIds || [];

    const mapDateFIR = {};
    movIds.forEach(idMov => {
      if (mapScarichi[idMov]) mapDateFIR[idMov] = toDate(mapScarichi[idMov].data);
      else if (mapCarichi[idMov]) mapDateFIR[idMov] = toDate(mapCarichi[idMov].data);
    });

    docOrigine.blocchi.forEach((b, index) => {
      const idMov = movIds[index];
      const dataFIR = mapDateFIR[idMov] || toDate(docOrigine.dataCreazione);

      (b.righe || []).forEach(r => {
        const prezzo = Number(r.prezzo ?? 0);
        const netto = Number(r.netto || 0);
        const tot = netto * prezzo;

        righeFIR.push({
          fir: b.fir || null,
          dataFIR,
          cer: b.cer || "-",
          materiale: r.materiale || "-",
          netto,
          prezzo,
          totale: tot,
          note: b.note || "-"
        });
      });
    });
  }

  // PRIVATI
  if (tipo === "PRIVATI") {
    let scarico = mapScarichi[anagraficaId];
    if (!scarico) {
      scarico = Object.values(mapScarichi).find(
        s => s.movimentoFinanziarioId === movimentoId
      );
    }

    if (scarico) {
      const dataFIR = toDate(scarico.data);

      (scarico.scarico || []).forEach(b => {
        (b.righe || []).forEach(r => {
          const prezzo = Number(r.prezzoAcquisto ?? 0);
          const netto = Number(r.netto || 0);
          const tot = netto * prezzo;

          righeFIR.push({
            fir: b.fir || null,
            dataFIR,
            cer: b.cer || "-",
            materiale: r.materiale || "-",
            netto,
            prezzo,
            totale: tot,
            note: b.note || "-"
          });
        });
      });
    }
  }

  // ---------------------------------------------------------
  // 8) RAGGRUPPO PER FIR
  // ---------------------------------------------------------
  const gruppiFIR = {};
  righeFIR.forEach(r => {
    const key = r.fir || "NO_FIR";
    if (!gruppiFIR[key]) {
      gruppiFIR[key] = { fir: r.fir, dataFIR: r.dataFIR, righe: [] };
    }
    gruppiFIR[key].righe.push(r);
  });

  let totaleGenerale = 0;

  // ---------------------------------------------------------
  // 9) STAMPA TABELLE
  // ---------------------------------------------------------
  for (const key of Object.keys(gruppiFIR)) {
    const g = gruppiFIR[key];

    const dataFIRtxt = g.dataFIR
      ? g.dataFIR.toLocaleDateString("it-IT")
      : "-";

    if (g.fir && g.fir.trim() !== "") {
      pdf.text(`FIR: ${g.fir} – Data: ${dataFIRtxt}`, 14, y);
    } else {
      pdf.text(`Data: ${dataFIRtxt}`, 14, y);
    }
    y += 4;

    const totaleFIR = g.righe.reduce((sum, r) => sum + r.totale, 0);
    totaleGenerale += totaleFIR;

    const body = g.righe.map(r => [
      r.cer,
      r.materiale,
      r.netto.toFixed(2),
      r.prezzo.toFixed(2),
      r.totale.toFixed(2),
      r.note
    ]);

    autoTable(pdf, {
      startY: y,
      head: [["CER", "Materiale", "Kg", "Prezzo", "Totale", "Note"]],
      body,
      styles: { fontSize: 9 },
      theme: "grid"
    });

    y = pdf.lastAutoTable.finalY + 10;
  }

  if (!righeFIR.length) {
    totaleGenerale = Number(mf.importo || 0);
  }

  pdf.setFontSize(14);
  pdf.text(`Totale Pagato: € ${totaleGenerale.toFixed(2)}`, 14, y + 4);

  const pageNumber = pdf.internal.getNumberOfPages();
  pdf.setFontSize(10);
  pdf.text(
    `Pagina ${pageNumber}`,
    pdf.internal.pageSize.width - 40,
    pdf.internal.pageSize.height - 10
  );
};


const handleStampaContabileSingola = async (movimentoId) => {
  console.log("🟦 handleStampaContabileSingola START — movimentoId:", movimentoId);

  try {
    // 🔥 Leggo il movimento DIRETTAMENTE da Firestore
    const movRef = doc(db, "MovimentoFinanziario", movimentoId);
    const movSnap = await getDoc(movRef);

    if (!movSnap.exists()) {
      console.error("💥 Movimento non trovato su Firestore:", movimentoId);
      alert("Movimento non trovato su Firestore. Riprova.");
      return;
    }

    const mf = { id: movSnap.id, ...movSnap.data() };
    console.log("✅ Movimento letto da Firestore:", mf);

    const { PdfHeader } = await import("../utils/dateUtils");
    const autoTable = (await import("jspdf-autotable")).default;

    console.log("➡️ Creo PDF...");
    const { pdf } = await PdfHeader();

    console.log("➡️ Chiamo stampaContabileMovimento...");
    await stampaContabileMovimento(pdf, mf);

    const today = new Date().toLocaleDateString("it-IT").replace(/\//g, "-");
    console.log("➡️ Salvo PDF...");
    await salvaESharePdfCapacitor(pdf, `contabile_${today}_${movimentoId}.pdf`);

    console.log("🟩 handleStampaContabileSingola COMPLETATA");
  } catch (err) {
    console.error("💥 ERRORE IN handleStampaContabileSingola:", err);
    alert("Errore durante la stampa della contabile.");
  }
};


const handlePrint = async (movimentoId = null, tipo) => {
  try {
    if (!tipo) {
      alert("Errore: tipo movimento non specificato");
      return;
    }
   const collezione = tipo === "carico" ? "carichi" : "scarichi";
    let docData;

    // ---------------- RECUPERO DOCUMENTO ----------------
    if (movimentoId) {
      const refDoc = doc(db, collezione, movimentoId);
      const snap = await getDoc(refDoc);

      if (!snap.exists()) {
        alert("Movimento non trovato");
        return;
      }

      docData = snap.data();
    } else {
      const utente = getUtenteReact();

      if (!utente) {
        alert("Utente non loggato");
        return;
      }

      const snap = await getDocs(collection(db, collezione));
      const userDocs = snap.docs
        .filter(d => (d.data().utente || "").toLowerCase() === utente.toLowerCase())
        .sort((a, b) => {
          const at = a.data().data?.toDate ? a.data().data.toDate().getTime() : 0;
          const bt = b.data().data?.toDate ? b.data().data.toDate().getTime() : 0;
          return bt - at;
        });

      if (!userDocs.length) {
        alert(`Nessun movimento ${tipo}`);
        return;
      }

      docData = userDocs[0].data();
    }

    // ---------------- HEADER PDF ----------------
    const { pdf, startY } = await PdfHeader();
    pdf.setFontSize(16);
    let y = startY + 26;

    const dataObj = docData.data?.toDate
      ? docData.data.toDate()
      : new Date();

    pdf.text(
      `Movimento: ${tipo === "carico" ? "Carico" : "Scarico"}`,
      10,
      66
    );

    pdf.setFontSize(12);

    pdf.text(
      `${tipo === "carico" ? "Destinatario" : "Fornitore"}: ${docData.fornitore || "-"}`,
      10,
      76
    );

    pdf.text(
      `Data: ${formattaDataItaliana(dataObj)} ${formattaOra24(dataObj)}`,
      10,
      84
    );

    pdf.text(`Listino: ${docData.listino || "-"}`, 10, 92);

    // ---------------- NOTE ----------------
    if (docData.note && docData.note.trim() !== "") {
      const noteLines = pdf.splitTextToSize(docData.note, 180);
      const noteBlockHeight = noteLines.length * 5 + 10;

      if (y + noteBlockHeight > 280) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(12);
      pdf.text("Note:", 10, y);
      y += 6;

      pdf.setFontSize(10);
      pdf.text(noteLines, 10, y);

      y += noteLines.length * 5 + 10;
    }

    // ---------------- TABELLE CER ----------------
    const righe = docData.carico || docData.scarico || [];

    const isPrivatoScarico =
      tipo === "scarico" &&
      (
        (docData.fornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO" ||
        (docData.listino || "").trim().toUpperCase() === "LISTINOPRIVATI"
      );

    let totaleScaricoEuro = 0;

    for (const c of righe) {
      pdf.setFontSize(13);
      pdf.text(`CER ${c.cer}${c.fir ? " - FIR: " + c.fir : ""}`, 10, y);
      y += 6;

      if (isPrivatoScarico) {
        // 🔥 STAMPA PRIVATI (€/kg + totale €)
        autoTable(pdf, {
          startY: y,
          head: [["Materiale", "Netto kg", "€/kg", "Totale €"]],
          body: (c.righe || []).map(r => {
            const netto = Number(r.netto || 0);
            const prezzo = Number(r.prezzoAcquisto || 0);
            const totale = netto * prezzo;
            totaleScaricoEuro += totale;

            return [
              r.materiale,
              netto.toFixed(2),
              prezzo.toFixed(2),
              totale.toFixed(2),
            ];
          }),
          theme: "grid",
          styles: { fontSize: 10 },
          margin: { left: 10 },
        });

        y = pdf.lastAutoTable.finalY + 6;

        pdf.text(`Totale CER: ${(c.totaleCer || 0).toFixed(2)} kg`, 10, y);
        y += 10;

      } else {
        // 🔵 STAMPA NORMALE
        autoTable(pdf, {
          startY: y,
          head: [["Materiale", "Peso", "Calo", "Netto"]],
          body: (c.righe || []).map(r => [
            r.materiale,
            Number(r.peso || 0).toFixed(2),
            Number(r.calo || 0).toFixed(2),
            Number(r.netto || 0).toFixed(2),
          ]),
          theme: "grid",
          styles: { fontSize: 10 },
          margin: { left: 10 },
        });

        y = pdf.lastAutoTable.finalY + 6;

        pdf.text(`Totale CER: ${(c.totaleCer || 0).toFixed(2)} kg`, 10, y);
        y += 10;
      }
    }

    // ---------------- TOTALE FINALE PRIVATI ----------------
    if (isPrivatoScarico) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(14);
      pdf.text(
        `Totale scarico da pagare al fornitore: ${totaleScaricoEuro.toFixed(2)} €`,
        10,
        y
      );

      y += 14;
    }

    // ---------------- FOTO ----------------
    const fotos = Array.isArray(docData.fotoURL)
      ? docData.fotoURL
      : docData.fotoURL
      ? [docData.fotoURL]
      : [];

    if (fotos.length > 0) {
      if (y > 200) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(12);
      pdf.text("Foto movimento:", 10, y);
      y += 10;

      let x = 10;
      let imgY = y;

      for (let i = 0; i < fotos.length; i++) {
        try {
          const response = await fetch(fotos[i]);
          const blob = await response.blob();

          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (imgY + 60 > 280) {
            pdf.addPage();
            x = 10;
            imgY = 20;
          }

          pdf.addImage(base64, "JPEG", x, imgY, 60, 60);

          x += 65;

          if (x > 160) {
            x = 10;
            imgY += 65;
          }

        } catch (err) {
          console.error("Errore immagine PDF:", err);
        }
      }
    }

    // ---------------- SAVE ----------------
    const filename = `${tipo === "carico" ? "Carico" : "Scarico"}_${docData.fornitore || "X"}_${docData.listino || "X"}.pdf`;

    await salvaESharePdfCapacitor(pdf, filename);
    return;

  } catch (err) {
    console.error("Errore PDF:", err);
    alert("Errore generazione PDF");
  }
};


async function salvaModifiche({ docRef, editor }) {
  try {
    console.log("🟡 START salvaModifiche");

    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Documento non trovato");

    const dati = snap.data();

    const field = Array.isArray(dati.scarico) ? "scarico" : "carico";

    const normalize = (v) =>
      (v ?? "")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    console.log("📦 FIELD:", field);
    console.log("📦 EDITOR INPUT:", editor);

    const scarichiAggiornati = (dati[field] || []).map((cerObj, cerIndex) => {

      const righeAggiornate = (cerObj.righe || []).map((r, rIndex) => {

        // 🔥 MATCH STABILE: SOLO INDICI (NON FIR, NON CER, NON MATERIALI)
        const match =
          cerIndex === editor.cerIndex &&
          rIndex === editor.rIndex;

        if (!match) return r;

        const peso = Number(editor.peso ?? r.peso);
        const calo = Number(editor.calo ?? r.calo);
        const netto = peso - calo;
        const prezzoKg = Number(editor.prezzoKg ?? r.prezzoKg);

        return {
          ...r,
          peso,
          calo,
          netto,
          prezzoKg,

          prezzoAcquisto:
            editor.tipo === "scarico"
              ? prezzoKg
              : r.prezzoAcquisto,

          prezzoVendita:
            editor.tipo === "carico"
              ? prezzoKg
              : r.prezzoVendita,

          costoTotale: netto * prezzoKg
        };
      });

      return {
        ...cerObj,
        righe: righeAggiornate,

        // FIR aggiornato SOLO COME DATO, NON COME CHIAVE
        fir: normalize(editor.fir) || cerObj.fir
      };
    });

    const payload = {
      [field]: scarichiAggiornati,

      ...(editor.data ? { data: editor.data } : {}),

      lastUpdate: new Date(),

      listino: editor.listino ?? dati.listino
    };

    console.log("💾 PAYLOAD:", payload);

    await updateDoc(docRef, payload);

    console.log("✅ WRITE COMPLETATO");

  } catch (err) {
    console.error("❌ ERRORE salvaModifiche:", err);
    throw err;
  }
}

const resetFiltri = () => {
  setFiltroUtente("tutti");
  setFiltroOra("tutti");
  setFiltroFornitore("tutti");
  setFiltroCER("tutti");
  setFiltroListino("tutti");
  setFiltroFIR("tutti");
  setFiltroMateriale("tutti");
  setFiltroTipo("tutti");

setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
};


const eliminaRiga = async (riga) => {
  try {
    const collezione = riga.sourceCollection || "scarichi";
    const ref = doc(db, collezione, riga.docId);

    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const dati = snap.data();
    const field = Array.isArray(dati.scarico) ? "scarico" : "carico";

    const movimenti = dati[field] || [];

    const cerTarget = movimenti[riga.cerIndex];
    if (!cerTarget) return;

    const confermaTesto =
      cerTarget.righe?.length === 1
        ? "⚠️ Questo è l’ULTIMO CER dello scarico. Eliminando verrà cancellato tutto lo scarico. Continuare?"
        : "Confermi eliminazione del CER selezionato?";

    if (!window.confirm(confermaTesto)) return;

    const before = structuredClone(dati);

    const updatedMovimenti = movimenti
      .map((cerObj, cIdx) => {
        if (cIdx !== riga.cerIndex) return cerObj;

        const nuoveRighe = (cerObj.righe || []).filter(
          (_, rIdx) => rIdx !== riga.rIndex
        );

        return {
          ...cerObj,
          righe: nuoveRighe
        };
      })
      .filter(cerObj => cerObj.righe && cerObj.righe.length > 0);

    const utente = getUtenteReact();

    // =========================
    // CASO 1: DELETE DOCUMENTO
    // =========================
    if (updatedMovimenti.length === 0) {
      if (!window.confirm("Confermi eliminazione DEFINITIVA dello scarico?")) return;

      await deleteDoc(ref);

      await scriviLog({
        pagina: "scarichi",
        evento: "ELIMINA_SCARICO",

        riferimento: {
          collezione,
          documentoId: riga.docId
        },

        utente,

        before,
        after: null,

        ripristinabile: false
      });

      alert("🗑 Scarico eliminato completamente");
    }

    // =========================
    // CASO 2: UPDATE PARZIALE
    // =========================
    else {
      await updateDoc(ref, {
        [field]: updatedMovimenti,
        lastUpdate: new Date()
      });

      await scriviLog({
        pagina: "scarichi",
        evento: "ELIMINA_CER",

        riferimento: {
          collezione,
          documentoId: riga.docId,
          cerIndex: riga.cerIndex,
          rIndex: riga.rIndex
        },

        utente,

        before,
        after: {
          ...dati,
          [field]: updatedMovimenti
        },

        ripristinabile: true
      });

      alert("🗑 CER eliminato con successo");
    }

    setEditor(null);
    setOriginalEditor(null);
    setSelectedIndex(null);

    await reloadDati();
    setRefresh(p => p + 1);

  } catch (e) {
    console.error("Errore eliminaRiga:", e);
    alert("Errore durante eliminazione");
  }
};

const reloadDati = async () => {
  try {
    const snapScarichi = await getDocs(collection(db, "scarichi"));
    const snapCarichi = await getDocs(collection(db, "carichi"));

    const tuttiDocs = [
      ...snapScarichi.docs.map(d => ({ id: d.id, ...d.data() })),
      ...snapCarichi.docs.map(d => ({ id: d.id, ...d.data() }))
    ];

    const giornoParsedLocal = parseData(giornoSelezionato);
    if (!giornoParsedLocal) return;

    const start = new Date(giornoParsedLocal);
    start.setHours(0, 0, 0, 0);

    const end = new Date(giornoParsedLocal);
    end.setHours(23, 59, 59, 999);

    const datiGiorno = tuttiDocs.filter(d => {
      if (!d.data) return false;
      const ts = d.data.toDate ? d.data.toDate() : new Date(d.data);
      return ts >= start && ts <= end;
    });

    setScarichiDelGiorno(datiGiorno);

  } catch (e) {
    console.error("reloadDati error:", e);
  }
};


  const annullaModifiche = ()=>{ setSelectedIndex(null); setEditor(null); setOriginalEditor(null); };
  const handleLogout = async ()=>{ await auth.signOut(); navigate("/login"); };
  const goHome = ()=>navigate("/admin");
  const vaiGestioneListini = ()=>navigate("/gestione-listini", { state: { refresh: true } });

const salvaDraftScarico = async (riga) => {
  try {
    const utenteId = getUtenteReact();
    const utenteNome = getUtenteReact();
    if (!utenteId || !riga) return;

    const draftRef = doc(db, "scarichi_draft", utenteId);

    // 🔥 PRENDO DOCUMENTO ORIGINALE COMPLETO
    const snapshot = scarichiDelGiorno.find(d => d.id === riga.docId);
    if (!snapshot) return;

    const field = Array.isArray(snapshot.scarico) ? "scarico" : "carico";

    // 🔥 CLONE COMPLETO SENZA PERDITE
    const fullCopy = (snapshot[field] || []).map(cerObj => ({
      ...cerObj,
      righe: (cerObj.righe || []).map(r => ({ ...r }))
    }));

    // 🔥 IDENTIFICO SOLO IL PUNTO SELEZIONATO (NON TAGLIO NULLA)
    const selectedPointer = {
      docId: riga.docId,
      cer: riga.cer,
      fir: riga.fir,
      materiale: riga.materiale,
      rIndex: riga.rIndex,
      cerIndex: riga.cerIndex
    };

  await setDoc(draftRef, {
  [field]: fullCopy,
  fornitore: snapshot.fornitore || "",
  listino: snapshot.listino || "",
  tipoMovimento: riga.tipo || "scarico",
  selected: selectedPointer,

  data: snapshot.data?.toDate?.() || new Date(),
  dataScaricoStr: snapshot.dataScaricoStr || "",
  oraStr: riga.ora || "",

  fotoURL: Array.isArray(snapshot.fotoURL) ? snapshot.fotoURL : [],

  // 🔥 FIX MANCANTE
  note: snapshot.note || "",

  inModifica: true,
  docIdOriginale: riga.docId,
  originalFir: riga.fir,
  utente: utenteNome,
  updatedAt: serverTimestamp(),
  source: "gestione_scarichi_dettaglio"
}, { merge: true });

  } catch (e) {
    console.error("Errore salvaDraftScarico:", e);
  }
};

const modificaScarico = async (riga) => {
  try {
    const collectionName = riga.sourceCollection || "scarichi";
    const ref = doc(db, collectionName, riga.docId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Documento non trovato");
      return;
    }

    const dati = snap.data();
    const utente = getUtenteReact();

    const normalizeDate = (d) => {
      if (!d) return new Date();
      if (d.toDate) return d.toDate();
      if (d.seconds) return new Date(d.seconds * 1000);
      return new Date(d);
    };

    const baseDate = normalizeDate(dati.data);
    const safeDate = new Date(baseDate);

    if (dati.ora) {
      const [hh, mm] = dati.ora.split(":").map(Number);
      safeDate.setHours(hh || 0, mm || 0, 0, 0);
    }

    let fotoArray = [];

    const sorgenti = [
      dati.fotoURL,
      dati.foto,
      dati.fotoScarichi,
      riga.fotoURL,
      riga.foto
    ];

    for (const src of sorgenti) {
      if (!src) continue;

      if (Array.isArray(src)) {
        fotoArray.push(...src);
      } else if (typeof src === "string" && src.trim()) {
        fotoArray.push(src);
      }
    }

    fotoArray = [...new Set(fotoArray)].filter(
      f => typeof f === "string" && f.startsWith("http")
    );

    const fileName =
      riga.fileName ||
      dati.fileName ||
      dati.nomeFile ||
      "";

    const sitoWeb =
      riga.sitoWeb ||
      dati.sitoWeb ||
      dati.website ||
      "";

    const before = {
      fornitore: dati.fornitore || "-",
      listino: dati.listino || "-",
      tipo: dati.tipo || "-",
      righe: (dati.scarico || dati.carico || []).length
    };

    const field = Array.isArray(dati.scarico) ? "scarico" : "carico";

    const updatedField = (dati[field] || []).map((cerObj, cIdx) => {
      if (cIdx !== riga.cerIndex) return cerObj;

      return {
        ...cerObj,
        righe: (cerObj.righe || []).map((r, rIdx) => {
          if (rIdx !== riga.rIndex) return r;

          const peso = Number(riga.peso ?? r.peso ?? 0);
          const calo = Number(riga.calo ?? r.calo ?? 0);
          const netto = Number(riga.netto ?? (peso - calo));
          const prezzo = Number(riga.prezzoKg ?? r.prezzoKg ?? 0);

          return {
            ...r,
            peso,
            calo,
            netto,
            prezzoKg: prezzo,
            prezzoAcquisto: field === "scarico" ? prezzo : r.prezzoAcquisto,
            prezzoVendita: field === "carico" ? prezzo : r.prezzoVendita,
            costoTotale: netto * prezzo
          };
        }),
        fir: riga.fir ?? cerObj.fir,
        cer: riga.cer ?? cerObj.cer
      };
    });

    const updatePayload = {
      [field]: updatedField,
      data: safeDate,
      fotoURL: fotoArray,
      fileName,
      sitoWeb,
      lastUpdate: serverTimestamp()
    };

    await updateDoc(ref, updatePayload);

    const after = {
      fornitore: dati.fornitore || "-",
      listino: dati.listino || "-",
      tipo: dati.tipo || "-",
      righe: updatedField.length
    };

    await scriviLog({
      pagina: "scarichi",
      evento: "MODIFICA_RIGA",

      riferimento: {
        collezione: collectionName,
        documentoId: riga.docId,
        cerIndex: riga.cerIndex,
        rIndex: riga.rIndex
      },

      utente,

      before,
      after,

      ripristinabile: true
    });

    await salvaDraftScarico({
      ...riga,
      fotoURL: fotoArray
    });

    navigate("/scarichi");

  } catch (error) {
    console.error("Errore modifica scarico:", error);
    alert("Errore durante la modifica");
  }
};

  // ---------- FUNZIONE STAMPA ----------




const handleStampa = async () => {
  if (righeFiltrate.length === 0)
    return alert("Nessuna riga da stampare");

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  // 🔥 ORDINAMENTO SOLO PER ORA (DESC)
  const parseOra = (ora) => {
    if (!ora) return -1;
    const [h, m] = ora.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const righeOrdinate = [...righeFiltrate].sort(
    (a, b) => parseOra(b.ora) - parseOra(a.ora)
  );

  const carichi = righeOrdinate.filter(
    (r) => (r.tipo || "").toLowerCase() === "carico"
  );

  const scarichi = righeOrdinate.filter(
    (r) => (r.tipo || "").toLowerCase() === "scarico"
  );

  const totCarichiNetto = carichi.reduce(
    (t, r) => t + (Number(r.netto) || 0),
    0
  );

  const totCarichiRicavi = carichi.reduce(
    (t, r) =>
      t + (Number(r.netto) || 0) * (Number(r.prezzoKg) || 0),
    0
  );



  const mediaCarichi = totCarichiNetto
    ? totCarichiRicavi / totCarichiNetto
    : 0;

  const totScarichiNetto = scarichi.reduce(
    (t, r) => t + (Number(r.netto) || 0),
    0
  );

  const totScarichiCosti = scarichi.reduce(
    (t, r) =>
      t + (Number(r.netto) || 0) * (Number(r.prezzoKg) || 0),
    0
  );

  const mediaScarichi = totScarichiNetto
    ? totScarichiCosti / totScarichiNetto
    : 0;

  const utileScarichi = -totScarichiCosti;
  const utileCarichi = totCarichiRicavi;
  const utileFinale = utileCarichi + utileScarichi;

  const { pdf, startY } = await PdfHeader();

  let y = startY -25;

  pdf.setFontSize(16);

  
  pdf.text("Riepilogo Movimenti "+ dataLabel, 14, y);
  y += 10;

  if (carichi.length > 0) {
    pdf.setFontSize(13);
    pdf.text("CARICHI", 14, y);
    y += 5;

    autoTable(pdf, {
      startY: y,
      head: [["Ora", "Destinatario", "CER", "FIR", "Materiale", "Netto", "€/Kg", "Totale", "Listino"]],
      body: carichi.map((r) => [
        r.ora,
        r.fornitore,
        r.cer,
        r.fir || "",
        r.materiale,
        r.netto,
        Number(r.prezzoVendita || r.prezzoKg || 0).toFixed(2),
        (Number(r.netto || 0) * Number(r.prezzoVendita || r.prezzoKg || 0)).toFixed(2),
        r.listino || "",
      ]),
      theme: "grid",
      styles: { fontSize: 9 },
    });

    y = pdf.lastAutoTable.finalY + 5;

    pdf.text(
      `Netto: ${totCarichiNetto.toFixed(2)} Kg | Media: ${mediaCarichi.toFixed(2)} €/Kg | Ricavi: ${totCarichiRicavi.toFixed(2)} € | UTILE: ${utileCarichi.toFixed(2)} €`,
      14,
      y
    );

    y += 10;
  }

  if (scarichi.length > 0) {
    pdf.setFontSize(13);
    pdf.text("SCARICHI", 14, y);
    y += 5;

    autoTable(pdf, {
      startY: y,
      head: [["Ora", "Fornitore", "CER", "FIR", "Materiale", "Netto", "€/Kg", "Totale", "Listino"]],
      body: scarichi.map((r) => [
        r.ora,
        r.fornitore,
        r.cer,
        r.fir || "",
        r.materiale,
        r.netto,
        Number(r.prezzoAcquisto || r.prezzoKg || 0).toFixed(2),
        (Number(r.netto || 0) * Number(r.prezzoAcquisto || r.prezzoKg || 0)).toFixed(2),
        r.listino || "",
      ]),
      theme: "grid",
      styles: { fontSize: 9 },
    });

    y = pdf.lastAutoTable.finalY + 5;

    pdf.text(
      `Netto: ${totScarichiNetto.toFixed(2)} Kg | Media: ${mediaScarichi.toFixed(2)} €/Kg | Costi: ${totScarichiCosti.toFixed(2)} € | UTILE: ${utileScarichi.toFixed(2)} €`,
      14,
      y
    );

    y += 10;
  }

  if (carichi.length && scarichi.length) {
    pdf.setFontSize(14);
    pdf.text(`UTILE COMPLESSIVO: ${utileFinale.toFixed(2)} €`, 14, y + 10);
  }

  await salvaESharePdfCapacitor(pdf, "movimenti.pdf");
};

const optUtente = valoriUtente.map(v => ({ value: v, label: v }));
const optOra = valoriOra.map(v => ({ value: v, label: v }));
const optFornitore = valoriFornitore.map(v => ({ value: v, label: v }));
const optCER = valoriCER.map(v => ({ value: v, label: v }));
const optListino = valoriListino.map(v => ({ value: v, label: v }));
const optFIR = valoriFIR.map(v => ({ value: v, label: v || "(vuoto)" }));
const optMateriale = valoriMateriale.map(v => ({ value: v, label: v }));
const optTipo = valoriTipo.map(v => ({ value: v, label: v }));

const nessunMovimento =
  righeCarichiAll.length === 0 && righeScarichiAll.length === 0;
const trovaRigaIndex = (riga) =>
  righeOrdinati.findIndex(x =>
    x.docId === riga.docId &&
    x.cerIndex === riga.cerIndex &&
    x.rIndex === riga.rIndex
  );


  
  // ---------- RENDER ----------
  return (
    <div className="gestione-scarichi-container">
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({getUtenteReact()})</button>
      </div>

      <div style={{marginBottom:10}}>
  <h3>Lista movimenti giorno {dataLabel}</h3>  {/* ← nuova intestazione */}
  <button onClick={goBack}>
    ← Torna ai Carichi / Scarichi
  </button>
  <button onClick={vaiGestioneListini} style={{marginLeft:10}}>⚙ Gestione Listini</button>
  <button onClick={vaiScarichi} style={{marginLeft:10}}>⚙ Nuovo Carico/Scarico</button>
</div>

     {/* ===== FILTRI HEADER ===== */}
<div style={{ margin: "10px 0" }}>
  <button onClick={() => setShowFiltri(p => !p)}>
    {showFiltri ? "🔽 Nascondi Filtri" : "🔎  Filtra"}
  </button>

  <button onClick={handleStampa} style={{ marginLeft: 10 }}>
    🖨 Stampa
  </button>
</div>

{/* ===== FILTRI PANEL ===== */}
{showFiltri && (
  <div
    style={{
      padding: "10px",
      border: "1px solid #ccc",
      borderRadius: 8,
      background: "#f9f9f9"
    }}
  >
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>

        {/* UTENTE */}
        <tr>
          <td style={{ padding: "6px 4px", width: "30%", textAlign: "left" }}>
            Utente:
          </td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroUtente, label: filtroUtente }}
              onChange={(opt) => {
                setFiltroUtente(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optUtente}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* ORA */}
        <tr>
          <td style={{ padding: "6px 4px" }}>Ora:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroOra, label: filtroOra }}
              onChange={(opt) => {
                setFiltroOra(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optOra}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* FORNITORE / DESTINATARIO */}
        <tr>
          <td style={{ padding: "6px 4px" }}>{getLabelFornDest()}:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroFornitore, label: filtroFornitore }}
              onChange={(opt) => {
                setFiltroFornitore(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optFornitore}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* CER */}
        <tr>
          <td style={{ padding: "6px 4px" }}>CER:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroCER, label: filtroCER }}
              onChange={(opt) => {
                setFiltroCER(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optCER}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* LISTINO */}
        <tr>
          <td style={{ padding: "6px 4px" }}>Listino:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroListino, label: filtroListino }}
              onChange={(opt) => {
                setFiltroListino(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optListino}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* FIR */}
        <tr>
          <td style={{ padding: "6px 4px" }}>FIR:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroFIR, label: filtroFIR || "(vuoto)" }}
              onChange={(opt) => {
                setFiltroFIR(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optFIR}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* MATERIALE */}
        <tr>
          <td style={{ padding: "6px 4px" }}>Materiale:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroMateriale, label: filtroMateriale }}
              onChange={(opt) => {
                setFiltroMateriale(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optMateriale}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

        {/* TIPO */}
        <tr>
          <td style={{ padding: "6px 4px" }}>Tipo:</td>
          <td style={{ padding: "6px 4px" }}>
            <Select
              value={{ value: filtroTipo, label: filtroTipo }}
              onChange={(opt) => {
                setFiltroTipo(opt.value);
                setCurrentPageCarichi(1);
                setCurrentPageScarichi(1);
              }}
              options={optTipo}
              styles={{ container: base => ({ ...base, width: "100%" }) }}
            />
          </td>
        </tr>

      </tbody>
    </table>

    <button
      onClick={resetFiltri}
      style={{
        padding: "8px 12px",
        background: "#d9534f",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        marginTop: "10px",
        fontWeight: "bold",
        width: "100%"
      }}
    >
      Reset filtri
    </button>
  </div>
)}



 <label>Mostra:
      <select
        value={rowsPerPage}
        onChange={e=>{
          setRowsPerPage(e.target.value==="tutte"?"tutte":Number(e.target.value));
          setCurrentPageCarichi(1);
          setCurrentPageScarichi(1);
        }}
      >
        <option value={6}>6</option>
        <option value={12}>12</option>
        <option value={24}>24</option>
        <option value="tutte">Tutte</option>
      </select> righe
    </label>
{nessunMovimento && (
  <div style={{ marginTop: 40, textAlign: "center", fontSize: 18 }}>
    Nessun movimento per questo giorno
  </div>
)}
{/* ===================== CARICHI ===================== */}
{righeCarichiAll.length > 0 && (
   <>
<table className="tabella-scarichi">
<thead>
  <tr>
    <th>Ora</th>
    <th>Destinatario</th>
    <th>FIR</th>
    <th>CER</th>
    <th>Materiale</th>
    <th>Peso</th>
    <th>Calo</th>
    <th>Netto</th>
    <th>€/Kg</th>
    <th>Ricavo Totale</th>
    <th>Azioni</th>
  </tr>
</thead>
<tbody>
  {paginatedCarichi.map((r) => (
    <tr    key={`${r.docId}-${r.cerIndex}-${r.rIndex}`}    style={{      background: r.movimentoFinanziarioId ? "#d4edda" : "white"    }}  title={
    r.movimentoFinanziarioId
      ? "Movimento già consuntivato. Impossibile apportare modifiche."
      : ""
  } >
      <td>{r.ora}</td>
      <td>{r.fornitore}</td>
      <td>{r.fir}</td>
      <td>{r.cer}</td>
      <td>{r.materiale}</td>
      <td>{r.peso}</td>
      <td>{r.calo}</td>
      <td>{r.netto}</td>
      <td>{r.prezzoKg}</td>
      <td>{((r.netto || 0) * (r.prezzoKg || 0)).toFixed(2)}</td>
<td>
  {r.movimentoFinanziarioId ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      
      {/* 🔒 SOLO STAMPA */}
      <button
        onClick={() => handleStampaScaricoRiga(r)}
        title={`Fare click per stampare la contabile del movimento ${r.fornitore} per € ${((r.netto || 0) * (r.prezzoKg || 0)).toLocaleString("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`}
      >
        🖨 Stampa
      </button>

      {/* 🟢 BADGE PAGATO */}
      <span
        style={{
          background: "#28a745",
          color: "white",
          padding: "2px 6px",
          borderRadius: "4px",
          fontSize: "12px",
          textAlign: "center",
          fontWeight: "bold"
        }}
        title="Movimento già consuntivato. Impossibile apportare modifiche."
      >
        PAGATO ✔
      </span>
    </div>
  ) : (
    <>
      <button onClick={() => selezionaRiga(r, "carico")}>✏ Modifica</button>

  <button
  onClick={() => {
    if (r.movimentoFinanziarioId) {
      // 🔥 SE PAGATO → STAMPA CONTABILE
      handleStampaContabileSingola(r.movimentoFinanziarioId);
    } else {
      // 🔵 NON PAGATO → STAMPA MOVIMENTO
      handleStampaScaricoRiga(r);
    }
  }}
  title={
    r.movimentoFinanziarioId
      ? "Movimento già consuntivato: verrà stampata la CONTABILE"
      : "Stampa il movimento"
  }
>
  🖨 Stampa
</button>


      <button onClick={() => modificaScarico(r)}>🔧 Apri originale</button>
    </>
  )}
</td>


    </tr>
  ))}
</tbody>
</table>
<div style={{ margin: "10px 0" }}>
  {currentPageCarichi > 1 && (
    <button onClick={() => setCurrentPageCarichi(p => p - 1)}>◀</button>
  )}

  {Array.from({ length: totalPagesCarichi }, (_, i) => (
    <button
      key={i}
      style={{ fontWeight: i + 1 === currentPageCarichi ? "bold" : "normal" }}
      onClick={() => setCurrentPageCarichi(i + 1)}
    >
      {i + 1}
    </button>
  ))}

  {currentPageCarichi < totalPagesCarichi && (
    <button onClick={() => setCurrentPageCarichi(p => p + 1)}>▶</button>
  )}
</div>
<div style={{ margin: "10px 0", fontWeight: "bold" }}>
  Peso Netto Totale: {totCarichiNetto.toFixed(2)} |
  €/Kg medio: {mediaCarichi.toFixed(2)} |
  Ricavi Totali: {totCarichiRicavi.toFixed(2)}
</div>
</>
)}
{/* ===================== SCARICHI ===================== */}
{righeScarichiAll.length > 0 && (
  <>
<table className="tabella-scarichi">
<thead>
  <tr>
    <th>Ora</th>
    <th>Fornitore</th>
    <th>FIR</th>
    <th>CER</th>
    <th>Materiale</th>
    <th>Peso</th>
    <th>Calo</th>
    <th>Netto</th>
    <th>€/Kg</th>
    <th>Costo Totale</th>
    <th>Azioni</th>
  </tr>
</thead>
<tbody>
  {paginatedScarichi.map((r) => (
   <tr    key={`${r.docId}-${r.cerIndex}-${r.rIndex}`}    style={{      background: r.movimentoFinanziarioId ? "#d4edda" : "white"    }}  title={
    r.movimentoFinanziarioId
      ? "Movimento già consuntivato. Impossibile apportare modifiche."
      : ""
  } >
      <td>{r.ora}</td>
      <td>{r.fornitore}</td>
      <td>{r.fir}</td>
      <td>{r.cer}</td>
      <td>{r.materiale}</td>
      <td>{r.peso}</td>
      <td>{r.calo}</td>
      <td>{r.netto}</td>
      <td>{r.prezzoKg}</td>
      <td>{((r.netto || 0) * (r.prezzoKg || 0)).toFixed(2)}</td>
<td>
  {r.movimentoFinanziarioId ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      
      {/* 🔒 SOLO STAMPA */}
      <button
        onClick={() => handleStampaScaricoRiga(r)}
        title={`Fare click per stampare la contabile del movimento ${r.fornitore} per € ${((r.netto || 0) * (r.prezzoKg || 0)).toLocaleString("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`}
      >
        🖨 Stampa
      </button>

      {/* 🟢 BADGE PAGATO */}
      <span
        style={{
          background: "#28a745",
          color: "white",
          padding: "2px 6px",
          borderRadius: "4px",
          fontSize: "12px",
          textAlign: "center",
          fontWeight: "bold"
        }}
        title="Movimento già consuntivato. Impossibile apportare modifiche."
      >
        PAGATO ✔
      </span>
    </div>
  ) : (
    <>
      <button onClick={() => selezionaRiga(r, "scarico")}>✏ Modifica</button>

      <button
        onClick={() => handleStampaScaricoRiga(r)}
        title={`Fare click per stampare la contabile del movimento ${r.fornitore} per € ${((r.netto || 0) * (r.prezzoKg || 0)).toLocaleString("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`}
      >
        🖨 Stampa
      </button>

      <button onClick={() => modificaScarico(r)}>🔧 Apri originale</button>
    </>
  )}
</td>


    </tr>
  ))}
</tbody>
</table>
<div style={{ margin: "10px 0" }}>
  {currentPageScarichi > 1 && (
    <button onClick={() => setCurrentPageScarichi(p => p - 1)}>◀</button>
  )}

  {Array.from({ length: totalPagesScarichi }, (_, i) => (
    <button
      key={i}
      style={{ fontWeight: i + 1 === currentPageScarichi ? "bold" : "normal" }}
      onClick={() => setCurrentPageScarichi(i + 1)}
    >
      {i + 1}
    </button>
  ))}

  {currentPageScarichi < totalPagesScarichi && (
    <button onClick={() => setCurrentPageScarichi(p => p + 1)}>▶</button>
  )}
</div>
<div style={{ margin: "10px 0", fontWeight: "bold" }}>
  Peso Netto Totale: {totScarichiNetto.toFixed(2)} |
  €/Kg medio: {mediaScarichi.toFixed(2)} |
  Costi Totali: {totScarichiCosti.toFixed(2)}
</div>
</>
)}
{/* ===================== UTILE ===================== */}
<div style={{ marginTop: 20, fontSize: 18, fontWeight: "bold" }}>
  UTILE: {utile.toFixed(2)}
</div>

   

      {editor && (
        <div ref={editorRef} style={{marginTop:20, border:"1px solid #ccc", padding:10, background:"#f9f9f9"}}>
         <h3>
   Modifica riga{" "}
  <span style={{ fontWeight: "normal", fontSize: 14, color: "#666" }}>
    ({editor?.tipo?.toUpperCase() || "MOVIMENTO"} - {editor?.cer || "CER"} - {editor?.materiale || "Materiale"})
  </span>
</h3>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
 <label> Data:
  <DatePicker
    selected={editor.data}
    onChange={(date) => setEditor(prev => ({ ...prev, data: date }))}
    dateFormat="dd MMM yyyy"
    locale="it"
  />
</label>

<label> Ora:
<DatePicker
  selected={
    editor.data
      ? (() => {
          const d = new Date(editor.data);

          if (editor.ora) {
            const [hh, mm] = editor.ora.split(":").map(Number);
            d.setHours(hh, mm, 0, 0);
          }

          return d;
        })()
      : new Date()
  }
  onChange={(time) => {
    const hh = time.getHours();
    const mm = time.getMinutes();

   updateEditor("ora", `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }}
  showTimeSelect
  showTimeSelectOnly
  timeIntervals={15}
  timeFormat="HH:mm"
  dateFormat="HH:mm"
/>
</label>
</div>
 <label>Netto: <input type="number" value={editor.netto} onChange={e=>updateEditor("netto", e.target.value)} /></label>
          <label>Calo: 
  <input type="number" value={editor.calo} onChange={e=>updateEditor("calo", e.target.value)} />
</label>

          <label>€/Kg: <input type="number" value={editor.prezzoKg} onChange={e=>updateEditor("prezzoKg", e.target.value)} /></label>
          <label>FIR: 
  <input
    type="text"
    value={editor.fir || ""}
    onChange={e => updateEditor("fir", e.target.value.toUpperCase())}
    style={{ textTransform: "uppercase" }}
  />
</label>
          <label>Listino: 
             <select value={editor.listino} onChange={e => updateEditor("listino", e.target.value)}>
                {Object.keys(listini).map(l => <option key={l} value={l}>{l}</option>)}  </select></label>         
          <div style={{marginTop:10}}>


<button
  onClick={async () => {
    if (!editor) return;
    try {
      const collezione = editor.sourceCollection || (editor.tipo === "carico" ? "carichi" : "scarichi");
      const ref = doc(db, collezione, editor.docId);
console.log("EDITOR PRIMA SAVE:", editor);
      // 🔥 SALVATAGGIO NEL DB
      await salvaModifiche({ docRef: ref, editor, tipoMovimento: editor.tipo });

      // 🔥 REFRESH DATI
      setRefresh(prev => prev + 1);

      // 🔥 VERIFICA SE CI SONO RIGHE FILTRATE DOPO L'UPDATE
      const snapshotScarichi = await getDocs(collection(db, "scarichi"));
      const snapshotCarichi = await getDocs(collection(db, "carichi"));
      const tuttiDocs = [
        ...snapshotScarichi.docs.map(d => ({ id: d.id, ...d.data() })),
        ...snapshotCarichi.docs.map(d => ({ id: d.id, ...d.data() }))
      ];

      const giornoParsedLocal = parseData(giornoSelezionato);
      const start = new Date(giornoParsedLocal); start.setHours(0,0,0,0);
      const end = new Date(giornoParsedLocal); end.setHours(23,59,59,999);

      const datiGiorno = tuttiDocs.filter(d => {
        if (!d.data) return false;
        const timestamp = d.data.toDate ? d.data.toDate() : new Date(d.data);
        return timestamp >= start && timestamp <= end;
      });

      if (datiGiorno.length === 0) {
        // 🔥 NESSUNA RIGA RIMASTA → TORNA ALLA PAGINA PRECEDENTE
        goBack();
      } else {
        // 🔥 CI SONO ANCORA RIGHE → RIMANI NEL DETTAGLIO
        setEditor(null);
        setOriginalEditor(null);
        setSelectedIndex(null);
      }

    } catch (e) {
      console.error(e);
      setErrori(prev => [...prev, e.message]);
    }
  }}
  disabled={
    !campoModificato("peso") &&
    !campoModificato("calo") &&
    !campoModificato("netto") &&
    !campoModificato("prezzoKg") &&
    !campoModificato("listino") &&
    !campoModificato("fir") &&
    !campoModificato("data") &&
    !campoModificato("ora")
  }
>
  💾 Salva modifiche
</button>
 <button onClick={annullaModifiche} style={{marginLeft:5}}>✖ Annulla</button>
            <button
  onClick={() =>
    eliminaRiga(
      editor,
      editor.cerIndex,
      editor.rIndex
    )
  }
  style={{ marginLeft: 5 }}
>
  🗑 Elimina
</button>
          </div>
        </div>
      )}

      {errori.length>0 && (
        <div style={{marginTop:10, color:"red"}}>
          <h4>Errore/i:</h4>
          <ul>{errori.map((e,i)=><li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </div>
  );
};
export default GestioneScarichiDettaglio;