// src/components/GestioneScarichiDettaglio.js
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, setDoc, serverTimestamp,Timestamp  } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { FiUpload, FiDownload } from 'react-icons/fi';
import autoTable from "jspdf-autotable";
// --- Blocchetto Data/Ora per editor ---
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
            fir: cer.fir,
            sourceCollection: cer.sourceCollection,
tipo: tipoMov,
            fornitore: scarico.fornitore,
            listino: scarico.listino,
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
      const netto = Number(cer.netto || cer.peso || 0);
      const prezzoVendita = Number(cer.prezzoVendita ?? 0);
const prezzoAcquisto = Number(cer.prezzoAcquisto ?? 0);
      const dataObj = scarico.data?.toDate?.() || null;
      return [{
        docId: scarico.id,
        cerIndex,
        rIndex: 0,
        cer: cer.cer,
        fir: cer.fir || "",
        materiale: cer.materiale || "N/D",
       sourceCollection: cer.sourceCollection,
tipo: tipoMov,
        fornitore: scarico.fornitore,
        listino: scarico.listino,
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
  const sorted = [...righePronte];
  setRighe(sorted);
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
const valoriFIR = ordinaDropdown([...new Set(righe.map(r => r.fir || ""))]);
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
  if (!riga || !riga.docId) return alert("Riga non valida per la stampa");
  // tipo: carico o scarico (qui ci interessa scarico)
  const tipo = riga.tipo?.toLowerCase() === "carico" ? "carico" : "scarico";
  // chiama la funzione esistente passando docId e tipo
  await handlePrint(riga.docId, tipo);
};
const handlePrint = async (movimentoId = null, tipo) => {
  try {
    if (!tipo) return alert("Errore: tipo di movimento non specificato (carico/scarico)");
    const collezione = tipo === "carico" ? "carichi" : "scarichi";
    let docData;
    // --- Recupero documento ---
    if (movimentoId) {
      // Stampa movimento specifico
      const movimentoRef = doc(db, collezione, movimentoId);
      const movimentoSnap = await getDoc(movimentoRef);
      if (!movimentoSnap.exists()) throw new Error("Movimento non trovato");
      docData = movimentoSnap.data();
    } else {
      // Stampa ultimo movimento dell'utente
      const utente = getUtenteReact();
      const movimentoSnap = await getDocs(collection(db, collezione));
      // Filtra per utente e ordina per data
      const userDocs = movimentoSnap.docs
        .filter(d => (d.data().utente || "").toLowerCase() === utente.toLowerCase())
        .sort((a, b) => {
          const aTime = a.data().data?.toDate ? a.data().data.toDate().getTime() : 0;
          const bTime = b.data().data?.toDate ? b.data().data.toDate().getTime() : 0;
          return bTime - aTime; // dal più recente al più vecchio
        });
      if (!userDocs.length) return alert(`Nessun movimento ${tipo} da stampare`);
      docData = userDocs[0].data();
    }
    const { pdf, startY } = await PdfHeader();
    const dataObj = docData.data?.toDate ? docData.data.toDate() : new Date();
    let y = startY + 30;
    pdf.setFontSize(14);
    pdf.text(`Movimento: ${tipo === "carico" ? "Carico" : "Scarico"}`, 10, startY - 20);
    const label = tipo === "carico" ? "Controparte:" : "Controparte:";
    pdf.setFontSize(12);
    pdf.text(`${label} ${docData.fornitore || "-"}`, 10, startY -12);
    pdf.text(`Data e Ora: ${formattaDataItaliana(dataObj)} ${formattaOra24(dataObj)}`, 10, startY -6);
    pdf.text(`Listino: ${docData.listino || "-"}`, 10, startY );
if (docData.note && docData.note.trim() !== "") {
  const noteLines = pdf.splitTextToSize(docData.note, 180);

  const noteBlockHeight = noteLines.length * 5 + 10;

  // se non c'è spazio sufficiente → nuova pagina
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
    
    const righeMovimento = Array.isArray(docData[tipo === "carico" ? "carico" : "scarico"])
      ? docData[tipo === "carico" ? "carico" : "scarico"]
      : [];
    for (const c of righeMovimento) {
      const innerRighe = Array.isArray(c.righe) ? c.righe : [];
      if (!innerRighe.length) continue; // salta CER senza righe
      pdf.setFontSize(14);
      let titoloCer = `CER ${c.cer}`;
      if (c.fir) titoloCer += ` - FIR: ${c.fir}`;
      pdf.text(titoloCer, 10, y);
      y += 6;
      const bodyRighe = innerRighe.map(r => [
        r.materiale || "-",
        r.peso != null ? Number(r.peso).toFixed(2) : "-",
        r.calo != null ? Number(r.calo).toFixed(2) : "-",
        r.netto != null ? Number(r.netto).toFixed(2) : "-"
      ]);
      autoTable(pdf, {
        startY: y,
        head: [["Materiale", "Peso", "Calo", "Netto"]],
        body: bodyRighe,
        theme: "grid",
        margin: { left: 10 },
        headStyles: { fillColor: [200, 200, 200] },
        styles: { fontSize: 12 },
      });
      y = pdf.lastAutoTable.finalY + 6;
      pdf.setFontSize(12);
      pdf.text(`Totale CER: ${c.totaleCer != null ? Number(c.totaleCer).toFixed(2) : 0} kg`, 10, y);
      y += 10;
    }
// --- FIX POSIZIONE FOTO ---
// usa SEMPRE la posizione reale dell'ultima tabella
if (pdf.lastAutoTable) {
  y = pdf.lastAutoTable.finalY + 10;
}
// se sei troppo in basso → nuova pagina
if (y > 250) {
  pdf.addPage();
  y = 20;
}
// Aggiungi foto se presente
// Aggiungi foto scarichi se presenti (ARRAY supportato)
const fotoArray = docData.fotoURL || [];
if (Array.isArray(fotoArray) && fotoArray.length > 0) {
  for (const url of fotoArray) {
    try {
      const response = await fetch(url, {
  method: "GET",
  mode: "cors",
  cache: "no-cache",
  credentials: "omit",
  headers: {
    "Accept": "image/*"
  }
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status} su immagine`);
}

const blob = await response.blob();

const base64data = await new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});
      // nuova pagina se serve spazio
      if (y > 200) {
        pdf.addPage();
        y = 20;
      }
      pdf.addImage(base64data, "JPEG", 10, y, 80, 80);
      y += 90;
    } catch (e) {
      console.error("Errore immagine:", url, e);
    }
  }
}

   await salvaESharePdfCapacitor(pdf, `${tipo === "carico" ? "Carico" : "Scarico"}_${docData.fornitore || "Sconosciuto"}_${docData.listino || "Sconosciuto"}.pdf`);
  } catch (err) {
    console.error("Errore generazione PDF:", err);
    alert("Errore generazione PDF, vedi console");
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
  const vaiGestioneListini = ()=>navigate("/gestione-scarichi", { state: { refresh: true } });

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
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      padding: "10px",
      border: "1px solid #ccc",
      borderRadius: 8,
      background: "#f9f9f9"
    }}
  >

    <label>Utente:
      <select value={filtroUtente} onChange={e=>{
        setFiltroUtente(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriUtente.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>

    <label>Ora:
      <select value={filtroOra} onChange={e=>{
        setFiltroOra(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriOra.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>

    <label>{getLabelFornDest()}:
      <select value={filtroFornitore} onChange={e=>{
        setFiltroFornitore(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriFornitore.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>

    <label>CER:
      <select value={filtroCER} onChange={e=>{
        setFiltroCER(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriCER.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>

    <label>Listino:
      <select value={filtroListino} onChange={e=>{
        setFiltroListino(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriListino.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>

    <label>FIR:
      <select value={filtroFIR} onChange={e=>{
        setFiltroFIR(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriFIR.map(v => <option key={v} value={v}>{v || "(vuoto)"}</option>)}
      </select>
    </label>

    <label>Materiale:
      <select value={filtroMateriale} onChange={e=>{
        setFiltroMateriale(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriMateriale.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>

    <label>Tipo:
      <select value={filtroTipo} onChange={e=>{
        setFiltroTipo(e.target.value);
        setCurrentPageCarichi(1);
        setCurrentPageScarichi(1);
      }}>
        {valoriTipo.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>

   

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
    <tr key={`${r.docId}-${r.cerIndex}-${r.rIndex}`}>
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
        <button onClick={() => selezionaRiga(r, "carico")}>✏ Modifica</button>
        <button onClick={() => handleStampaScaricoRiga(r)}>
    🖨 Stampa
  </button>

  <button onClick={() => modificaScarico(r)}>
    🔧 Apri originale
  </button>
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
    <tr key={`${r.docId}-${r.cerIndex}-${r.rIndex}`}>
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
        <button onClick={() => selezionaRiga(r, "scarico")}>✏ Modifica</button>
        <button onClick={() => handleStampaScaricoRiga(r)}>
    🖨 Stampa
  </button>

  <button onClick={() => modificaScarico(r)}>
    🔧 Apri originale
  </button>
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