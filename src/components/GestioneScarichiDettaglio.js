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

import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
registerLocale("it", it);
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


const registraErroreDb = async ({
  operazione,
  collezione = null,
  documentoId = null,
  errore,
  before = null
}) => {
  console.error(
    `❌ ERRORE DB - ${operazione}:`,
    errore
  );

  try {
    await scriviLog({
      pagina: "gestione-scarichi-dettaglio",
      evento: "DB_ERRORE",
      utente: getUtenteReact(),
      riferimento: {
        collezione,
        documentoId,
        operazione
      },
      before,
      after: {
        errore: errore?.message || "Errore sconosciuto",
        codice: errore?.code || null,
        stack: errore?.stack || null
      },
      ripristinabile: false,
      meta: {
        tipo: "DB_ERRORE",
        operazione
      }
    });
  } catch (erroreLog) {
    console.error(
      "❌ ERRORE SCRITTURA LOG DB:",
      erroreLog
    );
  }
};


const GestioneScarichiDettaglio = ({ giornoSelezionato, goBack, filtroFornitoreProp = "tutti", filtroListinoProp = "tutti", tipoMovimentoProp = "scarico" }) => {

  const [tipoMovimento] = useState(tipoMovimentoProp); // default scarico
  const [righe, setRighe] = useState([]);

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

const [filtroTipo, setFiltroTipo] = useState("tutti");
const [sortConfigCarichi, setSortConfigCarichi] = useState({
  key: "ora",
  direction: "desc"
});

const [sortConfigScarichi, setSortConfigScarichi] = useState({
  key: "ora",
  direction: "desc"
});

const cambiaSort = (
  key,
  sortConfig,
  setSortConfig,
  setPagina
) => {
  const direction =
    sortConfig.key === key && sortConfig.direction === "asc"
      ? "desc"
      : "asc";

  setSortConfig({
    key,
    direction
  });

  setPagina(1);
};

const iconaSort = (sortConfig, key) => {
  if (sortConfig.key !== key) return " ↕";
  return sortConfig.direction === "asc"
    ? " ▲"
    : " ▼";
};

const ordinaRighe = (righe, sortConfig) => {
  const getValore = (r, key) => {
    switch (key) {
      case "totale":
        return Number(r.netto ?? 0) * Number(r.prezzoKg ?? 0);

      default:
        return r[key];
    }
  };

  return [...righe].sort((a, b) => {
    let va = getValore(a, sortConfig.key);
    let vb = getValore(b, sortConfig.key);

    if (va == null) va = "";
    if (vb == null) vb = "";

    // Ordinamento numerico
    if (
      typeof va === "number" ||
      typeof vb === "number"
    ) {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
    }

    // Ordinamento ora
    if (sortConfig.key === "ora") {
      const parseOra = (valore) => {
        if (!valore) return -1;

        const [hh, mm] = String(valore)
          .split(":")
          .map(Number);

        return (hh || 0) * 60 + (mm || 0);
      };

      va = parseOra(va);
      vb = parseOra(vb);
    }

    // Ordinamento testo
    if (
      typeof va === "string" &&
      typeof vb === "string"
    ) {
      va = va.toLowerCase();
      vb = vb.toLowerCase();
    }

    if (va < vb) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }

    if (va > vb) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }

    return 0;
  });
};
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
    const snap = await getDocs(
      collection(db, "listini")
    );

    const mapListini = {};

    snap.docs.forEach(d => {
      mapListini[d.data().nome] =
        d.data().prezzi || {};
    });

    setListini(mapListini);

  } catch (e) {
    await registraErroreDb({
      operazione: "CARICAMENTO_LISTINI",
      collezione: "listini",
      errore: e
    });
  }
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
      const snapScarichi = await getDocs(
        collection(db, "scarichi")
      );

      const snapCarichi = await getDocs(
        collection(db, "carichi")
      );

      const tuttiDocs = [
        ...snapScarichi.docs.map(d => ({
          id: d.id,
          ...d.data()
        })),

        ...snapCarichi.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      ];

      const giornoParsedLocal =
        parseData(giornoSelezionato);

      if (!giornoParsedLocal) return;

      const start =
        new Date(giornoParsedLocal);

      start.setHours(
        0,
        0,
        0,
        0
      );

      const end =
        new Date(giornoParsedLocal);

      end.setHours(
        23,
        59,
        59,
        999
      );

      const datiGiorno =
        tuttiDocs.filter(d => {
          if (!d.data) return false;

          const ts =
            d.data.toDate
              ? d.data.toDate()
              : new Date(d.data);

          return (
            ts >= start &&
            ts <= end
          );
        });

      setScarichiDelGiorno(
        datiGiorno
      );

    } catch (e) {
      await registraErroreDb({
        operazione:
          "CARICAMENTO_MOVIMENTI_GIORNO",
        collezione:
          "scarichi/carichi",
        errore: e
      });

      setErrori(prev => [
        ...prev,
        e.message
      ]);
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

  // ============================
  // CASO 1: CER CON RIGHE
  // ============================
  if (cer.righe && cer.righe.length > 0) {
  return cer.righe.map((r, rIndex) => {

  const dataObj =
    scarico.data?.toDate?.() ||
    parseData(scarico.dataScaricoStr) ||
    parseData(scarico.data) ||
    null;

  return {
    ...r,                 // 🔥 VALORI ORIGINALI DEL DB — NON TOCCARLI
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

    // 🔥 NON RICALCOLARE NIENTE
    peso: r.peso,
    calo: r.calo,
    netto: r.netto,
    prezzoKg: r.prezzoKg ?? r.prezzoAcquisto ?? r.prezzoVendita ?? 0,
    costoTotale: r.costoTotale ?? 0
  };
});

  }

  // ============================
  // CASO 2: CER SENZA RIGHE
  // ============================
  const pesoLordo = Number(cer.peso ?? cer.netto ?? 0);
  const caloVal = Number(cer.calo ?? 0);

  let caloKg = 0;

  if (cer.caloTipo === "perc") {
    caloKg = pesoLordo * (caloVal / 100);
  } else {
    caloKg = caloVal;
  }

  caloKg = caloKg <= 0.50 ? Math.floor(caloKg) : Math.ceil(caloKg);

  const nettoCalc = pesoLordo - caloKg;

  const prezzoVendita = Number(cer.prezzoVendita ?? 0);
  const prezzoAcquisto = Number(cer.prezzoAcquisto ?? 0);

  const prezzoKg = tipoMov === "carico" ? prezzoVendita : prezzoAcquisto;
  const costoTotale = nettoCalc * prezzoKg;

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

    // 🔥 VALORI CORRETTI
    peso: pesoLordo,
    calo: caloKg,
    netto: nettoCalc,
    prezzoKg,
    costoTotale
  }];
});


  });
const sorted = [...righePronte];
setRighe(sorted);
}, [scarichiDelGiorno]);
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
const righeCarichiAll = ordinaRighe(
  righeFiltrate.filter(
    r => (r.tipo || "").toLowerCase() === "carico"
  ),
  sortConfigCarichi
);

const righeScarichiAll = ordinaRighe(
  righeFiltrate.filter(
    r => (r.tipo || "").toLowerCase() === "scarico"
  ),
  sortConfigScarichi
);

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











const selezionaRiga = async (r, tipo) => {
  try {
    const ref = doc(
      db,
      r.sourceCollection || "scarichi",
      r.docId
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const errore =
        new Error(
          "Documento non trovato"
        );

      await registraErroreDb({
        operazione:
          "LETTURA_RIGA_MODIFICA",
        collezione:
          r.sourceCollection ||
          "scarichi",
        documentoId:
          r.docId,
        errore
      });

      alert("Documento non trovato");
      return;
    }

    const dati = snap.data();

    const field =
      Array.isArray(dati.scarico)
        ? "scarico"
        : "carico";

    const cerObj =
      dati[field]?.[r.cerIndex];

    if (!cerObj) {
      throw new Error(
        "CER non trovato nel documento"
      );
    }

    const rigaOriginale =
      cerObj.righe?.[r.rIndex];

    if (!rigaOriginale) {
      throw new Error(
        "Riga non trovata nel documento"
      );
    }

    const editorCompleto = {
      ...rigaOriginale,

      fir:
        cerObj.fir,

      prezzoKg:
        rigaOriginale.prezzoKg ??
        rigaOriginale.prezzoAcquisto ??
        rigaOriginale.prezzoVendita ??
        rigaOriginale.prezzo ??
        0,

      prezzoAcquisto:
        rigaOriginale.prezzoAcquisto ??
        null,

      prezzoVendita:
        rigaOriginale.prezzoVendita ??
        null,

      prezzo:
        rigaOriginale.prezzo ??
        null,

      docId:
        r.docId,

      cerIndex:
        r.cerIndex,

      rIndex:
        r.rIndex,

      tipo,

      sourceCollection:
        r.sourceCollection,

      fornitore:
        dati.fornitore,

      listino:
        dati.listino,

      data:
        dati.data?.toDate?.() ||
        new Date(),

      ora:
        dati.data?.toDate?.()
          ? dati.data
              .toDate()
              .toLocaleTimeString(
                "it-IT",
                {
                  hour: "2-digit",
                  minute: "2-digit"
                }
              )
          : r.ora
    };

    setEditor(
      structuredClone(
        editorCompleto
      )
    );

    setOriginalEditor(
      structuredClone(
        editorCompleto
      )
    );

  } catch (error) {
    await registraErroreDb({
      operazione:
        "LETTURA_RIGA_MODIFICA",
      collezione:
        r?.sourceCollection ||
        "scarichi",
      documentoId:
        r?.docId || null,
      errore:
        error
    });

    alert(
      "Errore durante il caricamento della riga"
    );
  }
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
    // PESO LORDO
    // =========================
    if (campo === "peso") {
      nuovo.peso = num(valore);
    }

    // =========================
    // CALO
    // =========================
    if (campo === "calo") {
      nuovo.calo = num(valore);
    }

    // =========================
    // TIPO CALO
    // =========================
    if (campo === "caloTipo") {
      nuovo.caloTipo = valore;
    }

    // =========================
    // TARA
    // =========================
    if (campo === "tara") {
      nuovo.tara = num(valore);
    }

    // =========================
    // CALCOLO NETTO
    // =========================
    if (
      campo === "peso" ||
      campo === "calo" ||
      campo === "caloTipo" ||
      campo === "tara"
    ) {
      const pesoLordo =
        Number(nuovo.peso ?? 0);

      const caloVal =
        Number(nuovo.calo ?? 0);

      const taraKg =
        Number(nuovo.tara ?? 0);

      let caloKg = caloVal;

      if (nuovo.caloTipo === "perc") {
        caloKg =
          pesoLordo * (caloVal / 100);

        caloKg =
          caloKg <= 0.50
            ? Math.floor(caloKg)
            : Math.ceil(caloKg);
      }

      nuovo.netto =
        pesoLordo -
        caloKg -
        taraKg;
    }

    // =========================
    // PREZZO
    // =========================
    if (campo === "prezzoKg") {
      const prezzo = num(valore);

      nuovo.prezzoKg = prezzo;

      nuovo.costoTotale =
        (nuovo.netto || 0) * prezzo;
    }

    // =========================
    // LISTINO
    // =========================
    if (campo === "listino") {
      nuovo.listino = valore;

      const materiale =
        nuovo.materiale;

      const tipoPrezzo =
        nuovo.tipo === "carico"
          ? "vendita"
          : "acquisto";

      const prezziListino =
        listini?.[valore];

      const prezzoDaListino =
        prezziListino?.[materiale]?.[
          tipoPrezzo
        ];

      if (prezzoDaListino != null) {
        const prezzo =
          num(prezzoDaListino);

        nuovo.prezzoKg = prezzo;

        nuovo.costoTotale =
          (nuovo.netto || 0) * prezzo;
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
    // DATA + ORA SEMPRE SINCRONIZZATE
    // =========================
    const base =
      nuovo.data
        ? new Date(nuovo.data)
        : new Date();

    const oraFinale =
      nuovo.ora ||
      prev.ora ||
      "00:00";

    let hh = 0;
    let mm = 0;

    if (oraFinale.includes(":")) {
      const parts =
        oraFinale.split(":");

      hh =
        Number(parts[0]) || 0;

      mm =
        Number(parts[1]) || 0;
    }

    base.setHours(
      hh,
      mm,
      0,
      0
    );

    nuovo.data =
      new Date(base);

    nuovo.ora =
      `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

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

// ===============================
// 🔥 CALCOLO TOTALE RIGA (SEMPRE CORRETTO)
// ===============================
const calcTotaleRiga = (r) => {
  const netto = Number(r.netto ?? 0);
  const prezzo = Number(r.prezzoKg ?? 0);
  return netto * prezzo;
};

// ===============================
// 🔥 CARICHI TOTALI
// ===============================
const totCarichiNetto = carichi.reduce(
  (tot, r) => tot + Number(r.netto ?? 0),
  0
);

const totCarichiRicavi = carichi.reduce(
  (tot, r) => tot + calcTotaleRiga(r),
  0
);

const mediaCarichi =
  totCarichiNetto > 0 ? totCarichiRicavi / totCarichiNetto : 0;

// ===============================
// 🔥 SCARICHI TOTALI
// ===============================
const totScarichiNetto = scarichi.reduce(
  (tot, r) => tot + Number(r.netto ?? 0),
  0
);

const totScarichiCosti = scarichi.reduce(
  (tot, r) => tot + calcTotaleRiga(r),
  0
);

const mediaScarichi =
  totScarichiNetto > 0 ? totScarichiCosti / totScarichiNetto : 0;

// ===============================
// 🔥 UTILE
// ===============================
const utile = totCarichiRicavi - totScarichiCosti;


const handleStampaScaricoRiga = async (r) => {
  if (!r || !r.docId) return alert("Riga non valida per la stampa");
								  
									   
										 
   
  

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");
  

  // 🔥 PDF SEMPRE LANDSCAPE
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // 🔥 Applica header sul PDF landscape
  const { startY } = await PdfHeader(pdf);
								  
										 
										 
   
  

  // 🔥 VALORI SEMPRE DAL DB — NESSUN RICALCOLO
  const pesoLordo = Number(r.peso ?? 0);
  const caloVal = Number(r.calo ?? 0);       // già pronto (kg o %)
  const tipo = (r.caloTipo || "").toLowerCase();

  // 🔥 NON convertiamo % → kg
  // Se DB dice 6% → stampiamo 6%
  // Se DB dice 2 kg → stampiamo 2 kg
  const caloKg = tipo === "perc" ? caloVal : caloVal;

  // 🔥 Netto SEMPRE dal DB
  const netto = Number(r.netto ?? (pesoLordo - caloKg));
								  
												  

  const prezzoKg = Number(
    r.prezzoKg ??
    r.prezzoAcquisto ??
    r.prezzoVendita ??
    0
  );

  const totale = Number(r.costoTotale ?? (netto * prezzoKg));
										  
															  
														   

																				
  let y = startY - 25;

  pdf.setFontSize(16);
  pdf.text("Stampa Singola Riga", 14, y);
  y += 10;
										   
								  

  // 🔥 Tabella singola riga — landscape, larga, leggibile
  autoTable(pdf, {
    startY: y,
   head: [
  [
    "Ora", "Fornitore", "CER", "FIR", "Materiale",
    "Peso Lordo(Kg)", "Calo", "Tara(Kg)",
    "Peso Netto(Kg)", "€/Kg", "Totale(€)", "Listino"
  ]
],
  body: [
  [
    r.ora,
    r.fornitore,
    r.cer,
    r.fir || "",
    r.materiale,
    pesoLordo.toFixed(2),

    Number(caloVal) === 0
      ? "-"
      : `${Number(caloVal).toFixed(2)} ${
          tipo === "perc" ? "%" : "Kg"
        }`,

    Number(r.tara ?? 0) === 0
      ? "-"
      : `${Number(r.tara).toFixed(2)}`,

    netto.toFixed(2),
    prezzoKg.toFixed(2),
    totale.toFixed(2),
    r.listino || ""
  ]
],
    theme: "grid",
    styles: { fontSize: 10 }
  });

  await salvaESharePdfCapacitor(pdf, "riga.pdf");
};



async function salvaModifiche({ docRef, editor }) {
  let datiPrima = null;

  try {
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error("Documento non trovato");
    }

    const dati = snap.data();
    datiPrima = dati;

    const field =
      Array.isArray(dati.scarico)
        ? "scarico"
        : "carico";

    const normalize = (v) =>
      (v ?? "")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    const scarichiAggiornati =
      (dati[field] || []).map(
        (cerObj, cerIndex) => {

          const righeAggiornate =
            (cerObj.righe || []).map(
              (r, rIndex) => {

                const match =
                  cerIndex === editor.cerIndex &&
                  rIndex === editor.rIndex;

                if (!match) return r;

                // =========================
                // VALORI MODIFICABILI
                // =========================
                const peso =
                  Number(
                    editor.peso ?? r.peso ?? 0
                  );

                const caloVal =
                  Number(
                    editor.calo ?? r.calo ?? 0
                  );

                const tara =
                  Number(
                    editor.tara ?? r.tara ?? 0
                  );

                const tipoCalo =
                  editor.caloTipo ??
                  r.caloTipo ??
                  "kg";

                // =========================
                // CALCOLO CALO IN KG
                // =========================
                let caloKg = caloVal;

                if (tipoCalo === "perc") {
                  caloKg =
                    peso *
                    (caloVal / 100);

                  caloKg =
                    caloKg <= 0.5
                      ? Math.floor(caloKg)
                      : Math.ceil(caloKg);
                }

                // =========================
                // CALCOLO NETTO
                // =========================
                const netto =
                  peso -
                  caloKg -
                  tara;

                // =========================
                // PREZZO
                // =========================
                const prezzoKg =
                  Number(
                    editor.prezzoKg ??
                    r.prezzoKg ??
                    0
                  );

                return {
                  ...r,

                  // valori aggiornati
                  peso,
                  calo: caloVal,
                  caloTipo: tipoCalo,
                  tara,
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

                  costoTotale:
                    netto * prezzoKg,

                  // FIR e CER
                  fir: normalize(
                    editor.fir ?? r.fir
                  ),

                  cer: normalize(
                    editor.cer ?? r.cer
                  )
                };
              }
            );

          return {
            ...cerObj,

            righe:
              righeAggiornate,

            fir:
              normalize(editor.fir) ||
              cerObj.fir,

            cer:
              normalize(editor.cer) ||
              cerObj.cer
          };
        }
      );

    const payload = {
      [field]:
        scarichiAggiornati,

      ...(editor.data
        ? { data: editor.data }
        : {}),

      lastUpdate:
        serverTimestamp(),

      listino:
        editor.listino ??
        dati.listino
    };

    // =========================
    // SCRITTURA DB
    // =========================
    await updateDoc(
      docRef,
      payload
    );

    // =========================
    // LEGGIAMO LO STATO REALE
    // DOPO LA SCRITTURA
    // =========================
    const snapAfter =
      await getDoc(docRef);

    if (!snapAfter.exists()) {
      throw new Error(
        "Documento non trovato dopo la modifica"
      );
    }

    const datiDopo =
      snapAfter.data();

    // =========================
    // LOG MODIFICA
    // =========================
    await scriviLog({
      pagina:
        "gestione-scarichi-dettaglio",

      evento:
        "MODIFICA_RIGA",

      riferimento: {
        collezione:
          editor.sourceCollection ||
          (
            editor.tipo === "carico"
              ? "carichi"
              : "scarichi"
          ),

        documentoId:
          editor.docId,

        cerIndex:
          editor.cerIndex,

        rIndex:
          editor.rIndex
      },

      utente:
        getUtenteReact(),

      before:
        datiPrima,

      after:
        datiDopo,

      ripristinabile:
        true,

      meta: {
        tipo: "MODIFICA",
        operazione:
          "MODIFICA_RIGA"
      }
    });

  } catch (err) {
    await registraErroreDb({
      operazione:
        "MODIFICA_RIGA",

      collezione:
        editor?.sourceCollection ||
        (
          editor?.tipo === "carico"
            ? "carichi"
            : "scarichi"
        ),

      documentoId:
        editor?.docId || null,

      errore:
        err,

      before:
        datiPrima
    });

    throw err;
  }
}
						 


const eliminaRiga = async (riga) => {
  let datiPrima = null;

  try {
    const collezione =
      riga.sourceCollection ||
      "scarichi";

    const ref = doc(
      db,
      collezione,
      riga.docId
    );

    const snap =
      await getDoc(ref);

    if (!snap.exists()) {
      throw new Error(
        "Documento non trovato"
      );
    }

    const dati =
      snap.data();

    datiPrima = dati;

    const field =
      Array.isArray(dati.scarico)
        ? "scarico"
        : "carico";

    const movimenti =
      dati[field] || [];

    const cerTarget =
      movimenti[riga.cerIndex];

    if (!cerTarget) {
      throw new Error(
        "CER non trovato"
      );
    }

    const confermaTesto =
      cerTarget.righe?.length === 1
        ? "⚠️ Questo è l’ULTIMO CER dello scarico. Eliminando verrà cancellato tutto lo scarico. Continuare?"
        : "Confermi eliminazione del CER selezionato?";

    if (!window.confirm(confermaTesto)) {
      return;
    }

    const updatedMovimenti =
      movimenti
        .map((cerObj, cIdx) => {
          if (
            cIdx !== riga.cerIndex
          ) {
            return cerObj;
          }

          const nuoveRighe =
            (cerObj.righe || [])
              .filter(
                (_, rIdx) =>
                  rIdx !== riga.rIndex
              );

          return {
            ...cerObj,
            righe: nuoveRighe
          };
        })
        .filter(
          cerObj =>
            cerObj.righe &&
            cerObj.righe.length > 0
        );

    const utente =
      getUtenteReact();

    // =========================================================
    // CASO 1
    // ELIMINAZIONE MOVIMENTO COMPLETO
    // =========================================================
    if (
      updatedMovimenti.length === 0
    ) {
      if (
        !window.confirm(
          "Confermi eliminazione DEFINITIVA dello scarico?"
        )
      ) {
        return;
      }

      await deleteDoc(ref);

      await scriviLog({
        pagina:
          "gestione-scarichi-dettaglio",

        evento:
          field === "carico"
            ? "ELIMINA_CARICO"
            : "ELIMINA_SCARICO",

        riferimento: {
          collezione,
          documentoId:
            riga.docId
        },

        utente,

        before:
          datiPrima,

        after:
          null,

        ripristinabile:
          true,

        meta: {
          tipo: "ELIMINAZIONE",
          operazione:
            "ELIMINA_MOVIMENTO"
        }
      });

      alert(
        "🗑 Movimento eliminato completamente"
      );
    }

    // =========================================================
    // CASO 2
    // ELIMINAZIONE SINGOLA RIGA / CER
    // =========================================================
    else {
      await updateDoc(
        ref,
        {
          [field]:
            updatedMovimenti,

          lastUpdate:
            new Date()
        }
      );

      const snapAfter =
        await getDoc(ref);

      if (!snapAfter.exists()) {
        throw new Error(
          "Documento non trovato dopo l'eliminazione"
        );
      }

      const datiDopo =
        snapAfter.data();

      await scriviLog({
        pagina:
          "gestione-scarichi-dettaglio",

        evento:
          "ELIMINA_CER",

        riferimento: {
          collezione,
          documentoId:
            riga.docId,

          cerIndex:
            riga.cerIndex,

          rIndex:
            riga.rIndex
        },

        utente,

        before:
          datiPrima,

        after:
          datiDopo,

        ripristinabile:
          true,

        meta: {
          tipo: "ELIMINAZIONE",
          operazione:
            "ELIMINA_RIGA"
        }
      });

      alert(
        "🗑 Riga eliminata con successo"
      );
    }

    setEditor(null);
    setOriginalEditor(null);
    setSelectedIndex(null);

    await reloadDati();

    setRefresh(
      p => p + 1
    );

  } catch (e) {
    await registraErroreDb({
      operazione:
        "ELIMINAZIONE_MOVIMENTO",

      collezione:
        riga?.sourceCollection ||
        "scarichi",

      documentoId:
        riga?.docId || null,

      errore: e,

      before:
        datiPrima
    });

    alert(
      "Errore durante eliminazione"
    );
  }
};

const reloadDati = async () => {
  try {
    const snapScarichi = await getDocs(
      collection(db, "scarichi")
    );

    const snapCarichi = await getDocs(
      collection(db, "carichi")
    );

    const tuttiDocs = [
      ...snapScarichi.docs.map(d => ({
        id: d.id,
        ...d.data()
      })),

      ...snapCarichi.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
    ];

    const giornoParsedLocal =
      parseData(giornoSelezionato);

    if (!giornoParsedLocal) return;

    const start =
      new Date(giornoParsedLocal);

    start.setHours(
      0,
      0,
      0,
      0
    );

    const end =
      new Date(giornoParsedLocal);

    end.setHours(
      23,
      59,
      59,
      999
    );

    const datiGiorno =
      tuttiDocs.filter(d => {
        if (!d.data) return false;

        const ts =
          d.data.toDate
            ? d.data.toDate()
            : new Date(d.data);

        return (
          ts >= start &&
          ts <= end
        );
      });

    setScarichiDelGiorno(
      datiGiorno
    );

  } catch (e) {
    await registraErroreDb({
      operazione:
        "RICARICAMENTO_MOVIMENTI",
      collezione:
        "scarichi/carichi",
      errore: e
    });
  }
};


  const annullaModifiche = ()=>{ setSelectedIndex(null); setEditor(null); setOriginalEditor(null); };
  const handleLogout = async ()=>{ await auth.signOut(); navigate("/login"); };
  const goHome = ()=>navigate("/admin");
  const vaiGestioneListini = ()=>navigate("/gestione-scarichi", { state: { refresh: true } });

const salvaDraftScarico = async (riga) => {
  let snapshot = null;

  try {
    const utenteId =
      getUtenteReact();

    const utenteNome =
      getUtenteReact();

    if (!utenteId || !riga) {
      return;
    }

    const draftRef =
      doc(
        db,
        "scarichi_draft",
        utenteId
      );

    snapshot =
      scarichiDelGiorno.find(
        d => d.id === riga.docId
      );

    if (!snapshot) {
      return;
    }

    const field =
      Array.isArray(snapshot.scarico)
        ? "scarico"
        : "carico";

    const fullCopy =
      (snapshot[field] || []).map(
        cerObj => ({
          ...cerObj,

          righe:
            (cerObj.righe || []).map(
              r => ({ ...r })
            )
        })
      );

    const selectedPointer = {
      docId:
        riga.docId,

      cer:
        riga.cer,

      fir:
        riga.fir,

      materiale:
        riga.materiale,

      rIndex:
        riga.rIndex,

      cerIndex:
        riga.cerIndex
    };

    await setDoc(
      draftRef,
      {
        [field]:
          fullCopy,

        fornitore:
          snapshot.fornitore || "",

        listino:
          snapshot.listino || "",

        tipoMovimento:
          riga.tipo || "scarico",

        selected:
          selectedPointer,

        data:
          snapshot.data?.toDate?.() ||
          new Date(),

        dataScaricoStr:
          snapshot.dataScaricoStr ||
          "",

        oraStr:
          riga.ora || "",

        fotoURL:
          Array.isArray(snapshot.fotoURL)
            ? snapshot.fotoURL
            : [],

        note:
          snapshot.note || "",

        inModifica:
          true,

        docIdOriginale:
          riga.docId,

        originalFir:
          riga.fir,

        utente:
          utenteNome,

        updatedAt:
          serverTimestamp(),

        source:
          "gestione_scarichi_dettaglio"
      },
      {
        merge: true
      }
    );

  } catch (e) {
    await registraErroreDb({
      operazione:
        "SALVATAGGIO_DRAFT",
      collezione:
        "scarichi_draft",
      documentoId:
        riga?.docId || null,
      errore:
        e,
      before:
        snapshot
    });
  }
};

const modificaScarico = async (riga) => {
  let datiPrima = null;

  try {
    const collectionName =
      riga.sourceCollection ||
      "scarichi";

    const ref = doc(
      db,
      collectionName,
      riga.docId
    );

    const snap =
      await getDoc(ref);

    if (!snap.exists()) {
      throw new Error(
        "Documento non trovato"
      );
    }

    const dati =
      snap.data();

    datiPrima = dati;

    const field =
      Array.isArray(dati.scarico)
        ? "scarico"
        : "carico";

    // =========================
    // FOTO
    // =========================
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
      } else if (
        typeof src === "string" &&
        src.trim()
      ) {
        fotoArray.push(src);
      }
    }

    fotoArray = [
      ...new Set(fotoArray)
    ].filter(
      f =>
        typeof f === "string" &&
        f.startsWith("http")
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

    const updatedField =
      (dati[field] || []).map(
        (cerObj, cIdx) => {
          if (
            cIdx !== riga.cerIndex
          ) {
            return cerObj;
          }

          return {
            ...cerObj,

            righe:
              (cerObj.righe || [])
                .map(
                  (r, rIdx) => {
                    if (
                      rIdx !== riga.rIndex
                    ) {
                      return r;
                    }

                    // =========================
                    // VALORI DB
                    // =========================
                    const pesoFinale =
                      riga.peso ??
                      r.peso;

                    const prezzoFinale =
                      riga.prezzoKg ??
                      r.prezzoKg;

                    const costoTotaleFinale =
                      riga.costoTotale ??
                      r.costoTotale;

                    return {
                      ...r,

                      peso:
                        pesoFinale,

                      prezzoKg:
                        prezzoFinale,

                      costoTotale:
                        costoTotaleFinale,

                      // calo/netto NON vengono
                      // alterati da questa funzione
                      calo:
                        r.calo,

                      netto:
                        r.netto
                    };
                  }
                ),

            fir:
              riga.fir ??
              cerObj.fir,

            cer:
              riga.cer ??
              cerObj.cer
          };
        }
      );

    const updatePayload = {
      [field]:
        updatedField,

      data:
        dati.data?.toDate?.() ||
        new Date(),

      fotoURL:
        fotoArray,

      fileName,

      sitoWeb,

      lastUpdate:
        serverTimestamp()
    };

    // =========================
    // SCRITTURA DB
    // =========================
    await updateDoc(
      ref,
      updatePayload
    );

    // =========================
    // DATI REALI DOPO UPDATE
    // =========================
    const snapAfter =
      await getDoc(ref);

    if (!snapAfter.exists()) {
      throw new Error(
        "Documento non trovato dopo la modifica"
      );
    }

    const datiDopo =
      snapAfter.data();

    // =========================
    // LOG MODIFICA
    // =========================
    await scriviLog({
      pagina:
        "gestione-scarichi-dettaglio",

      evento:
        "MODIFICA_SCARICO",

      riferimento: {
        collezione:
          collectionName,

        documentoId:
          riga.docId,

        cerIndex:
          riga.cerIndex,

        rIndex:
          riga.rIndex
      },

      utente:
        getUtenteReact(),

      before:
        datiPrima,

      after:
        datiDopo,

      ripristinabile:
        true,

      meta: {
        tipo: "MODIFICA",
        operazione:
          "MODIFICA_SCARICO"
      }
    });

    await salvaDraftScarico({
      ...riga,
      fotoURL:
        fotoArray
    });

    navigate(
      "/scarichi",
      {
        state: {
          returnToDettaglio:
            true
        }
      }
    );

  } catch (error) {
    await registraErroreDb({
      operazione:
        "MODIFICA_SCARICO",

      collezione:
        riga?.sourceCollection ||
        "scarichi",

      documentoId:
        riga?.docId || null,

      errore:
        error,

      before:
        datiPrima
    });

    alert(
      "Errore durante la modifica"
    );
  }
};




const handleStampa = async () => {
  if (righeFiltrate.length === 0) {
    return alert("Nessuna riga da stampare");
  }

  try {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { PdfHeader } = await import("../utils/dateUtils");

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const { startY } = await PdfHeader(pdf);

    /*
     * 🔥 USA ESATTAMENTE LO STESSO ORDINAMENTO
     * DELLE DUE GRIGLIE.
     *
     * Non utilizziamo più un ordinamento autonomo
     * basato sull'ora.
     *
     * La stampa usa tutti i risultati filtrati,
     * non soltanto la pagina visualizzata.
     */
    const carichi = righeCarichiAll;
    const scarichi = righeScarichiAll;

    const calc = (r) => {
      const pesoLordo = Number(r.peso ?? 0);
      const netto = Number(r.netto ?? 0);
      const prezzoKg = Number(r.prezzoKg ?? 0);
      const totale = netto * prezzoKg;

      return {
        pesoLordo,
        netto,
        prezzoKg,
        totale
      };
    };

    const totCarichiNetto = carichi.reduce(
      (t, r) => t + calc(r).netto,
      0
    );

    const totCarichiRicavi = carichi.reduce(
      (t, r) => t + calc(r).totale,
      0
    );

    const mediaCarichi =
      totCarichiNetto > 0
        ? totCarichiRicavi / totCarichiNetto
        : 0;

    const totScarichiNetto = scarichi.reduce(
      (t, r) => t + calc(r).netto,
      0
    );

    const totScarichiCosti = scarichi.reduce(
      (t, r) => t + calc(r).totale,
      0
    );

    const mediaScarichi =
      totScarichiNetto > 0
        ? totScarichiCosti / totScarichiNetto
        : 0;

    const utileFinale =
      totCarichiRicavi - totScarichiCosti;

    let y = startY - 25;

    pdf.setFontSize(16);
    pdf.text(
      "Riepilogo Movimenti " + dataLabel,
      14,
      y
    );

    y += 10;

    // ============================
    // CARICHI
    // ============================
    if (carichi.length > 0) {
      pdf.setFontSize(13);
      pdf.text("CARICHI", 14, y);
      y += 5;

      autoTable(pdf, {
        startY: y,
        head: [[
          "Ora",
          "Destinatario",
          "CER",
          "FIR",
          "Materiale",
          "Peso Lordo (Kg)",
          "Calo",
          "Tara (Kg)",
          "Netto (Kg)",
          "€/Kg",
          "Totale (€)",
          "Listino"
        ]],
        body: carichi.map(r => {
          const c = calc(r);

          return [
            r.ora,
            r.fornitore,
            r.cer,
            r.fir || "",
            r.materiale,
            c.pesoLordo.toFixed(2),

            Number(r.calo ?? 0) === 0
              ? "-"
              : `${Number(r.calo).toFixed(2)} ${
                  r.caloTipo === "perc"
                    ? "%"
                    : "Kg"
                }`,

            Number(r.tara ?? 0) === 0
              ? "-"
              : `${Number(r.tara).toFixed(2)} Kg`,

            c.netto.toFixed(2),
            c.prezzoKg.toFixed(2),
            c.totale.toFixed(2),
            r.listino || ""
          ];
        }),
        theme: "grid",
        styles: {
          fontSize: 9
        }
      });

      y = pdf.lastAutoTable.finalY + 5;

      pdf.text(
        `Netto: ${totCarichiNetto.toFixed(2)} Kg | Media: ${mediaCarichi.toFixed(2)} €/Kg | Ricavi: ${totCarichiRicavi.toFixed(2)} €`,
        14,
        y
      );

      y += 10;
    }

    // ============================
    // SCARICHI
    // ============================
    if (scarichi.length > 0) {
      pdf.setFontSize(13);
      pdf.text("SCARICHI", 14, y);
      y += 5;

      autoTable(pdf, {
        startY: y,
        head: [[
          "Ora",
          "Fornitore",
          "CER",
          "FIR",
          "Materiale",
          "Peso Lordo (Kg)",
          "Calo",
          "Tara (Kg)",
          "Netto (Kg)",
          "€/Kg",
          "Totale (€)",
          "Listino"
        ]],
        body: scarichi.map(r => {
          const c = calc(r);

          return [
            r.ora,
            r.fornitore,
            r.cer,
            r.fir || "",
            r.materiale,
            c.pesoLordo.toFixed(2),

            Number(r.calo ?? 0) === 0
              ? "-"
              : `${Number(r.calo).toFixed(2)} ${
                  r.caloTipo === "perc"
                    ? "%"
                    : "Kg"
                }`,

            Number(r.tara ?? 0) === 0
              ? "-"
              : `${Number(r.tara).toFixed(2)} Kg`,

            c.netto.toFixed(2),
            c.prezzoKg.toFixed(2),
            c.totale.toFixed(2),
            r.listino || ""
          ];
        }),
        theme: "grid",
        styles: {
          fontSize: 9
        }
      });

      y = pdf.lastAutoTable.finalY + 5;

      pdf.text(
        `Netto: ${totScarichiNetto.toFixed(2)} Kg | Media: ${mediaScarichi.toFixed(2)} €/Kg | Costi: ${totScarichiCosti.toFixed(2)} €`,
        14,
        y
      );

      y += 10;
    }

    // ============================
    // UTILE
    // ============================
    if (carichi.length && scarichi.length) {
      pdf.setFontSize(14);

      pdf.text(
        `UTILE COMPLESSIVO: ${utileFinale.toFixed(2)} €`,
        14,
        y + 10
      );
    }

    await salvaESharePdfCapacitor(
      pdf,
      "movimenti.pdf"
    );

  } catch (err) {
    console.error(
      "❌ ERRORE handleStampa:",
      err
    );

  await scriviLog({
  pagina: "gestione-scarichi-dettaglio",
  evento: "ERRORE_STAMPA",
  utente: getUtenteReact(),
  riferimento: {
    operazione: "STAMPA_MOVIMENTI"
  },
  before: null,
  after: {
    errore:
      err?.message ||
      "Errore stampa",
    codice:
      err?.code ||
      null,
    stack:
      err?.stack ||
      null
  },
  ripristinabile: false,
  meta: {
    tipo: "STAMPA"
  }
}).catch(() => {});

    alert("Errore durante la stampa");
  }
};









const nessunMovimento =
  righeCarichiAll.length === 0 && righeScarichiAll.length === 0;

  





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
      <th
  onClick={() =>
    cambiaSort(
      "ora",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Ora{iconaSort(sortConfigCarichi, "ora")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "fornitore",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Destinatario{iconaSort(sortConfigCarichi, "fornitore")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "fir",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  FIR{iconaSort(sortConfigCarichi, "fir")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "cer",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  CER{iconaSort(sortConfigCarichi, "cer")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "materiale",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Materiale{iconaSort(sortConfigCarichi, "materiale")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "peso",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Peso (Kg){iconaSort(sortConfigCarichi, "peso")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "calo",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Calo{iconaSort(sortConfigCarichi, "calo")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "tara",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Tara (Kg){iconaSort(sortConfigCarichi, "tara")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "netto",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Netto (Kg){iconaSort(sortConfigCarichi, "netto")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "prezzoKg",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  €/Kg{iconaSort(sortConfigCarichi, "prezzoKg")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "totale",
      sortConfigCarichi,
      setSortConfigCarichi,
      setCurrentPageCarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Ricavo Totale (€){iconaSort(sortConfigCarichi, "totale")}
</th>

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

       <td>{Number(r.peso ?? 0).toFixed(2)}</td>
        <td>  {Number(r.calo ?? 0) === 0    ? "-"    : `${Number(r.calo).toFixed(2)} ${        r.caloTipo === "perc" ? "%" : "Kg"      }`}</td>
        <td>  {Number(r.tara ?? 0) === 0    ? "-"    : `${Number(r.tara).toFixed(2)}`}</td>
        <td>{Number(r.netto ?? 0).toFixed(2)}</td>

        <td>{Number(r.prezzoKg ?? 0).toFixed(2)} €/Kg</td>

        <td>
          {(Number(r.netto ?? 0) * Number(r.prezzoKg ?? 0)).toFixed(2)} €
        </td>

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
 <th
  onClick={() =>
    cambiaSort(
      "ora",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Ora{iconaSort(sortConfigScarichi, "ora")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "fornitore",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Fornitore{iconaSort(sortConfigScarichi, "fornitore")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "fir",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  FIR{iconaSort(sortConfigScarichi, "fir")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "cer",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  CER{iconaSort(sortConfigScarichi, "cer")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "materiale",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Materiale{iconaSort(sortConfigScarichi, "materiale")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "peso",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Peso (Kg){iconaSort(sortConfigScarichi, "peso")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "calo",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Calo{iconaSort(sortConfigScarichi, "calo")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "tara",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Tara (Kg){iconaSort(sortConfigScarichi, "tara")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "netto",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Netto (Kg){iconaSort(sortConfigScarichi, "netto")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "prezzoKg",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  €/Kg{iconaSort(sortConfigScarichi, "prezzoKg")}
</th>

<th
  onClick={() =>
    cambiaSort(
      "totale",
      sortConfigScarichi,
      setSortConfigScarichi,
      setCurrentPageScarichi
    )
  }
  style={{ cursor: "pointer" }}
>
  Costo Totale (€){iconaSort(sortConfigScarichi, "totale")}
</th>

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
      <td>{Number(r.peso ?? 0).toFixed(2)}</td>
      <td>  {Number(r.calo ?? 0) === 0    ? "-"    : `${Number(r.calo).toFixed(2)} ${        r.caloTipo === "perc" ? "%" : "Kg"      }`}</td>
      <td>  {Number(r.tara ?? 0) === 0    ? "-"    : `${Number(r.tara).toFixed(2)}`}</td>
      <td>{Number(r.netto ?? 0).toFixed(2)}</td>
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
  if (!time) {
    return;
  }

  const hh = time.getHours();
  const mm = time.getMinutes();

  updateEditor(
    "ora",
    `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
  );
}}
  showTimeSelect
  showTimeSelectOnly
  timeIntervals={15}
  timeFormat="HH:mm"
  dateFormat="HH:mm"
/>
</label>
</div>
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(6, minmax(120px, 1fr))",
    gap: "12px",
    marginTop: 15,
    alignItems: "end"
  }}
>
  <label>
    Peso Lordo (Kg):
    <input
      type="number"
      value={editor.peso ?? ""}
      onChange={e =>
        updateEditor(
          "peso",
          e.target.value
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box"
      }}
    />
  </label>

  <label>
    Calo
    {editor.caloTipo === "perc"
      ? " (%)"
      : " (Kg)"}
    :
    <input
      type="number"
      value={editor.calo ?? ""}
      onChange={e =>
        updateEditor(
          "calo",
          e.target.value
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box"
      }}
    />
  </label>
<label>
  Tipo Calo:
  <select
    value={editor.caloTipo || "kg"}
    onChange={e =>
      updateEditor(
        "caloTipo",
        e.target.value
      )
    }
    style={{
      width: "100%",
      boxSizing: "border-box"
    }}
  >
    <option value="kg">Kg</option>
    <option value="perc">%</option>
  </select>
</label>
  <label>
    Tara (Kg):
    <input
      type="number"
      value={editor.tara ?? ""}
      onChange={e =>
        updateEditor(
          "tara",
          e.target.value
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box"
      }}
    />
  </label>

  <label>
    Netto (Kg):
    <input
      type="number"
      value={Number(
        editor.netto ?? 0
      ).toFixed(2)}
      readOnly
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "#eee",
        fontWeight: "bold"
      }}
    />
  </label>

  <label>
    €/Kg:
    <input
      type="number"
      value={editor.prezzoKg ?? ""}
      onChange={e =>
        updateEditor(
          "prezzoKg",
          e.target.value
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box"
      }}
    />
  </label>
</div>

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(200px, 1fr))",
    gap: "12px",
    marginTop: 12
  }}
>
  <label>
    FIR:
    <input
      type="text"
      value={editor.fir || ""}
      onChange={e =>
        updateEditor(
          "fir",
          e.target.value.toUpperCase()
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box",
        textTransform: "uppercase"
      }}
    />
  </label>

  <label>
    Listino:
    <select
      value={editor.listino}
      onChange={e =>
        updateEditor(
          "listino",
          e.target.value
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box"
      }}
    >
      {Object.keys(listini).map(l => (
        <option
          key={l}
          value={l}
        >
          {l}
        </option>
      ))}
    </select>
  </label>
</div>      
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
  !campoModificato("tara") &&
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