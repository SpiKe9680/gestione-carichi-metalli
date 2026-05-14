
// src/components/GestioneScarichi.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import GestioneScarichiDettaglio from "./GestioneScarichiDettaglio";
import DatePicker, { registerLocale } from "react-datepicker";
import { it } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { addDoc, serverTimestamp } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PdfHeader } from "../utils/dateUtils";


registerLocale("it", it);



const GestioneScarichi = () => {
  const [scarichi, setScarichi] = useState([]);
  const [filteredScarichi, setFilteredScarichi] = useState([]);
const [filtroFIR, setFiltroFIR] = useState(""); // filtro dropdown FIR
const [firDisponibili, setFirDisponibili] = useState([]); // lista FIR disponibili per il filtro
const [firSearch, setFirSearch] = useState(""); // testo digitato per FIR
const [dal, setDal] = useState(null);   // oggetto Date
const [al, setAl] = useState(null);     // oggetto Date
const [sortConfig, setSortConfig] = useState({ key: "data", direction: "desc" });
const [tipoMovimento, setTipoMovimento] = useState("tutti");
const [listinoApplicato, setListinoApplicato] = useState("tutti");

  const [tutti, setTutti] = useState(false);
  const [filtroFornitore, setFiltroFornitore] = useState("tutti");
  const [filtroListino, setFiltroListino] = useState("tutti");
  const [filtroUtente, setFiltroUtente] = useState("tutti");
  const [giornoSelezionato, setGiornoSelezionato] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
const [filtroDestinatario, setFiltroDestinatario] = useState("tutti");
  const [fornitoriDisponibili, setFornitoriDisponibili] = useState([]);
  const [listiniDisponibili, setListiniDisponibili] = useState([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState([]);
  const [numeroFIR, setNumeroFIR] = useState({});
  const [listini, setListini] = useState({});
 const listiniDisponibiliNomi = Object.entries(listini || {})
  .filter(([nome, l]) => {
    if (tipoMovimento === "tutti") return false;
    return l?.tipo === tipoMovimento;
  })
  .map(([nome]) => nome);
const [filtroCER, setFiltroCER] = useState("tutti");
const [cerDisponibili, setCerDisponibili] = useState([]);
  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);
const [config, setConfig] = useState({});
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const normalizeDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  return new Date(d);
};
  const getLabelFornDest = () => {
  if (tipoMovimento === "carico") return "Smaltitori";
  if (tipoMovimento === "scarico") return "Fornitori";
  return "Fornitore / Smaltitore";
};

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
 const goHome = () => {
  window.location.href = "/admin";
};
  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
const requestSort = (key) => {
  let direction = "asc";
  if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
  setSortConfig({ key, direction });
};





  const parseItalianDate = (value, endOfDay=false) => {
    if (!value) return null;
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    if (endOfDay) date.setHours(23,59,59,999);
    return date;
  };

  // --- INIT DAL/AL ---
  useEffect(() => {
  const today = new Date();
  const primo = new Date(today.getFullYear(), today.getMonth(), 1);
  setDal(primo);
  setAl(today);
}, []);


const fetchMovimenti = async () => {
  try {
    const scarichiSnap = await getDocs(collection(db, "scarichi"));
    const carichiSnap = await getDocs(collection(db, "carichi"));

    const parseData = normalizeDate;

    const parseDoc = (d, tipo) => {
      const data = d.data();
      return {
        id: d.id,
        cer: Array.isArray(data[tipo]) ? data[tipo] : [],
        data: parseData(data.data),
        fornitore: data.fornitore || "sconosciuto",
        listino: data.listino || "sconosciuto",
        utente: data.utente || "sconosciuto",
        tipo: tipo
      };
    };

    const scarichi = scarichiSnap.docs.map(d => parseDoc(d, "scarico"));
    const carichi = carichiSnap.docs.map(d => parseDoc(d, "carico"));

    const tuttiMovimenti = [...scarichi, ...carichi];
    tuttiMovimenti.sort((a,b) => b.data - a.data);

    setScarichi(tuttiMovimenti);

    if (tuttiMovimenti.length) {
      const ordinati = [...tuttiMovimenti].sort((a,b) => a.data - b.data);
      setMinDataDB(ordinati[0].data);
      setMaxDataDB(ordinati[ordinati.length-1].data);
    }

  } catch (err) {
    console.error("Errore caricamento movimenti:", err);
  }
};
const refreshScarichi = async () => {
  await fetchMovimenti();
};

useEffect(() => {
  if (location.state?.refresh) {
    fetchMovimenti(); // ricarica i dati correttamente
    // Pulisci lo stato per evitare refresh multipli
    navigate(location.pathname, { replace: true, state: {} });
  }
}, [location.state]);


useEffect(() => {
  fetchMovimenti();
}, [reloadKey]);



  // --- LOAD LISTINI (FIX NUOVO DB) ---
const loadListini = async () => {
  try {
    const snap = await getDocs(collection(db, "listini"));

    const mapListini = {};

    snap.docs.forEach(d => {
      const data = d.data();

      mapListini[data.nome] = {
        prezzi: data.prezzi,
        tipoListino: data.tipoListino
      };
    });

    setListini(mapListini);

  } catch (e) {
    console.error(e);
  }
};
useEffect(() => {
  const set = new Set();

  scarichi.forEach(s => {
    (s.cer || []).forEach(cer => {
      const val = cer.codiceCER || cer.cer || cer.codice;
      if (val) set.add(val);
    });
  });

  setCerDisponibili([...set].sort());
}, [scarichi]);


  useEffect(() => { loadListini(); }, []);
useEffect(() => {
  const firSet = new Set();
  filteredScarichi.forEach(s => {
    s.cer.forEach(cer => {
      if (cer.fir) firSet.add(cer.fir);
    });
  });
  const firArray = Array.from(firSet).sort(); // ordine crescente
  setFirDisponibili(firArray);
}, [filteredScarichi]);
  // --- QUERY STRING: selezione listino/fornitore/utente e disabilita date quando presente ---
  useEffect(() => {
    // aspetta che dati e dropdown siano popolati
    if (scarichi.length === 0) return;
    // Notare: listiniDisponibili/fornitoriDisponibili/utentiDisponibili possono essere vuoti per alcuni dataset,
    // quindi non blocchiamo brutalmente; però preferiamo applicare filtri solo se esistono (per evitare valori fantasma)
    const params = new URLSearchParams(location.search);
    const f = params.get("fornitore");
    const l = params.get("listino");
    const u = params.get("utente");

    let hasQueryFilter = false;

    if (f) {
      // se il fornitore esiste tra quelli disponibili lo selezioniamo, altrimenti comunque lo impostiamo (se vuoi forzare solo esistenti, usare includes)
      if (fornitoriDisponibili.length === 0 || fornitoriDisponibili.includes(f)) {
        setFiltroFornitore(f);
        hasQueryFilter = true;
      }
    }
    if (l) {
      if (listiniDisponibili.length === 0 || listiniDisponibili.includes(l)) {
        setFiltroListino(l);
        hasQueryFilter = true;
      }
    }
    if (u) {
      if (utentiDisponibili.length === 0 || utentiDisponibili.includes(u)) {
        setFiltroUtente(u);
        hasQueryFilter = true;
      }
    }

    if (hasQueryFilter) {
      // se viene passato almeno un filtro via query string vogliamo *vedere quei risultati*
      // quindi disabilitiamo il filtro date (tutti = true)
      setTutti(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scarichi, listiniDisponibili, fornitoriDisponibili, utentiDisponibili, location.search]);



useEffect(() => {
  if (!scarichi.length) return;

  let dati = [...scarichi];

  const norm = (v) =>
    (v ?? "")
      .toString()
      .trim()
      .toLowerCase();

  // --- FILTRO CER ---
  if (filtroCER !== "tutti") {
    const cerFiltro = norm(filtroCER);

    dati = dati.filter(s =>
      (s.cer || []).some(cer => {
        const val =
          cer.codiceCER || cer.cer || cer.codice || "";
        return norm(val) === cerFiltro;
      })
    );
  }

  // --- FILTRO DATE ---
  if (!tutti && dal && al) {
    let endDate = new Date(al);
    endDate.setHours(23, 59, 59, 999);
    dati = dati.filter(s => s.data >= dal && s.data <= endDate);
  }

  // --- FILTRI BASE ---
  if (filtroFornitore !== "tutti") {
    dati = dati.filter(s => s.fornitore === filtroFornitore);
  }

  if (filtroListino !== "tutti") {
    dati = dati.filter(s => s.listino === filtroListino);
  }

  if (filtroUtente !== "tutti") {
    dati = dati.filter(s => (s.utente || "sconosciuto") === filtroUtente);
  }

  // --- FIR ---
  if (filtroFIR.trim() !== "") {
    const fir = filtroFIR.toLowerCase().trim();

dati = dati.filter(s =>
  (s.cer || []).some(cer =>
    (cer.fir || "").toLowerCase().trim().includes(fir)
  )
);
  }

  // --- TIPO MOVIMENTO ---
 if (tipoMovimento !== "tutti") {
  dati = dati.filter(s => s.tipo === tipoMovimento);
}
  setFilteredScarichi(dati);
}, [
  scarichi,
  dal,
  al,
  tutti,
  filtroFornitore,
  filtroListino,
  filtroUtente,
  filtroFIR,
  tipoMovimento,
  filtroCER
]);

useEffect(() => {
  const source = scarichi || [];

  setFornitoriDisponibili(
    [...new Set(source.map(s => s.fornitore || "sconosciuto"))]
      .sort((a,b)=>a.localeCompare(b,"it"))
  );

  setListiniDisponibili(
    [...new Set(source.map(s => s.listino || "sconosciuto"))]
  );

  setUtentiDisponibili(
    [...new Set(source.map(s => s.utente || "sconosciuto"))]
      .sort((a,b)=>a.localeCompare(b,"it"))
  );
}, [scarichi]);
const estimateResults = () => {
  if (!scarichi?.length) return 0;

  let dati = [...scarichi];

  const norm = (v) =>
    (v ?? "").toString().trim().toLowerCase();

  if (filtroCER !== "tutti") {
    const cerFiltro = norm(filtroCER);
    dati = dati.filter(s =>
      (s.cer || []).some(cer => {
        const val = cer.codiceCER || cer.cer || cer.codice || "";
        return norm(val) === cerFiltro;
      })
    );
  }

  if (!tutti && dal && al) {
    let endDate = new Date(al);
    endDate.setHours(23,59,59,999);

    let startDate = new Date(dal);
    startDate.setHours(0,0,0,0);

    dati = dati.filter(s => {
      if (!s.data) return false;
      const d = s.data instanceof Date ? s.data : new Date(s.data);
      return d >= startDate && d <= endDate;
    });
  }

  if (filtroFornitore !== "tutti") {
    dati = dati.filter(s => s.fornitore === filtroFornitore);
  }

  if (filtroListino !== "tutti") {
    dati = dati.filter(s => s.listino === filtroListino);
  }

  if (filtroUtente !== "tutti") {
    dati = dati.filter(s => (s.utente || "sconosciuto") === filtroUtente);
  }

  if (filtroFIR.trim() !== "") {
    const fir = filtroFIR.toLowerCase().trim();
    dati = dati.filter(s =>
      (s.cer || []).some(cer =>
        (cer.fir || "").toLowerCase().includes(fir)
      )
    );
  }

  if (tipoMovimento !== "tutti") {
    dati = dati.filter(s => s.tipo === tipoMovimento);
  }

  return dati.length;
};

const getTrafficLight = (count) => {
  if (count <= 1000) return "green";
  if (count <= 2000) return "yellow";
  return "red";
};
  // --- SCARICHI PER GIORNO ---
// --- SCARICHI PER GIORNO ---
// --- SCARICHI PER GIORNO ---
const scarichiPerGiorno = {};
filteredScarichi.forEach(s => {
  if (!s.data) return;  // basta verificare s.data
  const giornoIT = formatDataIT(s.data); // usa direttamente Date
  if (!scarichiPerGiorno[giornoIT]) scarichiPerGiorno[giornoIT] = [];
  scarichiPerGiorno[giornoIT].push(s);
});
const getConfigAzienda = async () => {
  const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
  if (!snap.exists()) return null;
  return snap.data();
};
const stampaProspettoFatturaScarichi = async (
  righe,
  fornitore = "",
  configurazione = {}
) => {
   const config = await getConfigAzienda();

    const pdf = new jsPDF();
    let y = 10;

   // ---------------- LOGO + HEADER ----------------
    if (config?.logoBase64) {
      pdf.addImage(
        `data:image/png;base64,${config.logoBase64}`,
        "PNG",
        10,
        5,
        40,
        20
      );
    }

    pdf.setFontSize(11);

    pdf.text(config?.ragioneSociale || "", 60, 10);
    pdf.text(config?.indirizzo || "", 60, 16);
    pdf.text(config?.capCitta || "", 60, 22);
    pdf.text(`P.IVA: ${config?.piva || "-"}`, 60, 28);

    y = 40;

    // ---------------- TITOLO ----------------
    pdf.setFontSize(14);
    pdf.text("PROSPETTO FATTURA SCARICHI", 10, y);
    y += 8;

  pdf.setFontSize(11);
  pdf.text(`Fornitore: ${fornitore || "-"}`, 10, y);
  y += 8;

  // ---------------- COLONNE ----------------
  const head = [["Data", "FIR", "Materiale", "Peso(kg)", "Calo(kg)", "Netto(kg)", "€/Kg", "Totale €"]];

  // ---------------- RIGHE ----------------
  let totale = 0;

  const body = righe.map(r => {
    const rigaTot = (r.netto || 0) * (r.prezzoKg || 0);
    totale += rigaTot;

    return [
      r.giorno || "",
      r.fir || "",
      r.materiale || "",
      Number(r.peso || 0).toFixed(2),
      Number(r.calo || 0).toFixed(2),
      Number(r.netto || 0).toFixed(2),
      Number(r.prezzoKg || 0).toFixed(2),
      rigaTot.toFixed(2)
    ];
  });

  // ---------------- TABELLA ----------------
  autoTable(pdf, {
    startY: y,
    head,
    body,
    theme: "grid",
    styles: { fontSize: 9 },
    margin: { left: 10 }
  });

  // ---------------- TOTALE ----------------
  const finalY = pdf.lastAutoTable.finalY || y;

  pdf.setFontSize(12);
  pdf.text(`TOTALE PROSPETTO: € ${totale.toFixed(2)}`, 10, finalY + 10);

  // ---------------- SAVE SICURO ----------------
  const safeName = (fornitore || "fornitore")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();

  pdf.save(`prospetto_${safeName}.pdf`);
};


// --- SCARICHI PER GIORNO CORRETTO CON DETTAGLI MATERIALI ---
const righePerGiorno = Object.keys(scarichiPerGiorno).map(giornoIT => {
  const movimentiDelGiorno = scarichiPerGiorno[giornoIT];

  const safe = (v) => Number(v) || 0;

 const tuttiCer = movimentiDelGiorno.flatMap(s => {
  const controparte = s.fornitore || s.destinatario || "sconosciuto";

  return (s.cer || []).map(cer => ({
    ...cer,
    tipo: cer.tipo ?? s.tipo,
    listino: s.listino,
    fir: cer.fir || "",

    controparte,

    righe: cer.righe || [{
      netto: safe(cer.netto),
      prezzoAcquisto: safe(cer.prezzoAcquisto),
      prezzoVendita: safe(cer.prezzoVendita),
      materiale: cer.materiale
    }]
  }));
});

  const nrMovimentiScarico = tuttiCer.filter(c => c.tipo === "scarico").length;
  const nrMovimentiCarico = tuttiCer.filter(c => c.tipo === "carico").length;
  const nrFIR = tuttiCer.map(c => c.fir).filter(Boolean).length;

  const pesoScarichi = tuttiCer
    .filter(c => c.tipo === "scarico")
    .reduce((tot, c) => tot + c.righe.reduce((s, r) => s + safe(r.netto), 0), 0);

  const pesoCarichi = tuttiCer
    .filter(c => c.tipo === "carico")
    .reduce((tot, c) => tot + c.righe.reduce((s, r) => s + safe(r.netto), 0), 0);

  // 🔥 COSTI = SOLO SCARICHI (prezzo acquisto)
  const costiTotali = tuttiCer
    .filter(c => c.tipo === "scarico")
    .reduce((tot, c) =>
      tot + c.righe.reduce((s, r) =>
        s + safe(r.prezzoAcquisto) * safe(r.netto), 0
      )
    , 0);

  // 🔥 RICAVI = SOLO CARICHI (prezzo vendita)
  const ricaviTotali = tuttiCer
    .filter(c => c.tipo === "carico")
    .reduce((tot, c) =>
      tot + c.righe.reduce((s, r) =>
        s + safe(r.prezzoVendita) * safe(r.netto), 0
      )
    , 0);

const utentiDelGiorno = [...new Set(
  movimentiDelGiorno.map(s =>
    `${s.fornitore || s.destinatario || "sconosciuto"} / ${s.utente || "Sconosciuto"}`
  )
)].join("; ");

  let backgroundColor = "";
  let textColor = "#000";

  if (nrMovimentiScarico > 0 && nrMovimentiCarico > 0) {
    backgroundColor = "#326c9f";
    textColor = "#fff";
  } else if (nrMovimentiCarico > 0) {
    backgroundColor = "#C8E6C9";
  } else {
    backgroundColor = "#FFECB3";
  }

  return {
    giornoIT,
    nrMovimentiScarico,
    nrMovimentiCarico,
    nrFIR,
    pesoScarichi,
    pesoCarichi,
    costiTotali,
    ricaviTotali,
    utenti: utentiDelGiorno,
    backgroundColor,
    textColor,
    dettagliScarichi: tuttiCer.filter(c => c.tipo === "scarico"),
    dettagliCarichi: tuttiCer.filter(c => c.tipo === "carico"),
  };
});

const righeOrdinate = [...righePerGiorno].sort((a, b) => {
  if (sortConfig.key === "data") {
    const [ggA, mmA, yyyyA] = a.giornoIT.split("/").map(Number);
    const [ggB, mmB, yyyyB] = b.giornoIT.split("/").map(Number);
    return sortConfig.direction === "asc"
      ? new Date(yyyyA, mmA-1, ggA) - new Date(yyyyB, mmB-1, ggB)
      : new Date(yyyyB, mmB-1, ggB) - new Date(yyyyA, mmA-1, ggA);
  } else if (sortConfig.key === "movimenti") {
    const totA = a.nrMovimentiScarico + a.nrMovimentiCarico;
    const totB = b.nrMovimentiScarico + b.nrMovimentiCarico;
    return sortConfig.direction === "asc" ? totA - totB : totB - totA;
  } else if (sortConfig.key === "costi") {
    return sortConfig.direction === "asc" ? a.costiTotali - b.costiTotali : b.costiTotali - a.costiTotali;
  } else if (sortConfig.key === "ricavi") {
    return sortConfig.direction === "asc" ? a.ricaviTotali - b.ricaviTotali : b.ricaviTotali - a.ricaviTotali;
  } else if (sortConfig.key === "nrFIR") {
    return sortConfig.direction === "asc" ? a.nrFIR - b.nrFIR : b.nrFIR - a.nrFIR;
  } else if (sortConfig.key === "nrFornitori") {
    return sortConfig.direction === "asc" ? a.nrFornitori - b.nrFornitori : b.nrFornitori - a.nrFornitori;
  }
  return 0;
});

  // Calcolo FIR per giorno (opzionale se vuoi mostrare/controllare)
const firPerGiorno = {};
filteredScarichi.forEach(s => {
 const dataObj = normalizeDate(s.data);
if (!dataObj) return;
const giornoIT = formatDataIT(dataObj);
  if (!firPerGiorno[giornoIT]) firPerGiorno[giornoIT] = [];
  s.cer.forEach(cer => {
    if(cer.numeroFIR) firPerGiorno[giornoIT].push(cer.numeroFIR);
  });
});

//console.log("📌 giornoSelezionato:", giornoSelezionato);
//console.log("📌 filteredScarichi:", filteredScarichi);
//const scarichiDelGiorno = filteredScarichi.filter(s => formatDataIT(s.data) === giornoSelezionato.giorno);
//console.log("📌 scarichiDelGiorno:", scarichiDelGiorno);

if (giornoSelezionato) {
  // PRIMA: filtravamo filteredScarichi che poteva essere vuoto
  // ORA: prendiamo direttamente dallo scarichi originali
  const scarichiDelGiorno = scarichi.filter(s => {
    const dataObj = s.data instanceof Date ? s.data : (s.data?.toDate ? s.data.toDate() : new Date("1970-01-01"));
    return formatDataIT(dataObj) === giornoSelezionato.giorno;
  });

  return (
    <GestioneScarichiDettaglio
  giornoSelezionato={giornoSelezionato.giorno}
  movimentiDelGiorno={scarichi.filter(s => {
    const dataObj = s.data instanceof Date ? s.data : (s.data?.toDate ? s.data.toDate() : new Date("1970-01-01"));
    return formatDataIT(dataObj) === giornoSelezionato.giorno;
  })}
goBack={() => {
  setGiornoSelezionato(null);
  setReloadKey(prev => prev + 1);
}}
  filtroFornitoreProp={filtroFornitore}
  filtroListinoProp={filtroListino}
  filtroUtenteProp={filtroUtente}
  filtroDestinatarioProp={filtroDestinatario}
  filtroFIRProp={filtroFIR}
  tipoMovimentoProp={tipoMovimento}
  tutti={tutti}
  dal={dal}
  al={al}
 refreshScarichi={async () => {
  await fetchMovimenti();
}}
/>
  );
}
const applyListino = async () => {
  if (tipoMovimento !== "scarico") return;
  if (listinoApplicato === "tutti") return;

  const listino = listini[listinoApplicato];
  if (!listino || listino.tipoListino !== "SCARICO") return;

  if (!window.confirm("Applicare il listino agli scarichi filtrati?")) return;

  try {

    for (const m of filteredScarichi) {

      if (m.tipo !== "scarico") continue;

      const ref = doc(db, "scarichi", m.id);

      const nuoviScarichi = (m.cer || []).map(blocco => {

        const nuoveRighe = (blocco.righe || []).map(r => {

          const prezzi = listino.prezzi?.[r.materiale];
          if (!prezzi) return r;

          return {
            ...r,
            prezzoAcquisto: prezzi.acquisto ?? r.prezzoAcquisto,
            prezzoKg: prezzi.acquisto ?? r.prezzoKg
          };
        });

        return {
          ...blocco,
          righe: nuoveRighe
        };
      });

      await updateDoc(ref, {
        scarico: nuoviScarichi, // 🔥 QUESTO È GIUSTO (NON cer)
        listino: listinoApplicato,
        lastUpdate: new Date()
      });
    }

    await fetchMovimenti();

    alert("✅ Listino SCARICO applicato correttamente");

  } catch (err) {
    console.error("Errore applyListino:", err);
    alert("❌ Errore applicazione listino");
  }
};

const handleStampa = async () => {
  const movimenti = filteredScarichi;

  if (!movimenti || !Array.isArray(movimenti)) return;

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const formatDate = (date) => {
    const d =
      date instanceof Date
        ? date
        : date?.toDate
        ? date.toDate()
        : new Date(date);
    return d.toLocaleDateString("it-IT");
  };

  const formatHour = (date) => {
    const d =
      date instanceof Date
        ? date
        : date?.toDate
        ? date.toDate()
        : new Date(date);
    return d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const safe = (v) => Number(v) || 0;

  const getUtente = (m) => m.utente || m.email || "sconosciuto";

  const gruppi = {};

  let totaleScarichi = 0;
  let totaleCarichi = 0;
  let totalePesoScarichi = 0;
  let totalePesoCarichi = 0;
  let totaleCosti = 0;
  let totaleRicavi = 0;

  movimenti.forEach((s) => {
    if (!s.data) return;

    const dataObj =
      s.data instanceof Date
        ? s.data
        : s.data?.toDate
        ? s.data.toDate()
        : null;

    if (!dataObj) return;

    const giorno = formatDate(dataObj);

    if (!gruppi[giorno]) {
      gruppi[giorno] = {
        scarichi: 0,
        carichi: 0,
        firSet: new Set(),
        pesoScarichi: 0,
        pesoCarichi: 0,
        costi: 0,
        ricavi: 0,
        utenti: new Set(),
        dettagli: [],
      };
    }

    const g = gruppi[giorno];
    const utente = getUtente(s);
    const controparte = s.fornitore || s.destinatario || "sconosciuto";

    (s.cer || []).forEach((cer) => {
      const tipo = cer.tipo ?? s.tipo;

      const righe =
        cer.righe || [
          {
            netto: safe(cer.netto),
            prezzoAcquisto: safe(cer.prezzoAcquisto),
            prezzoVendita: safe(cer.prezzoVendita),
          },
        ];

      const peso = righe.reduce((t, r) => t + safe(r.netto), 0);
      const costo = righe.reduce(
        (t, r) => t + safe(r.prezzoAcquisto) * safe(r.netto),
        0
      );
      const ricavo = righe.reduce(
        (t, r) => t + safe(r.prezzoVendita) * safe(r.netto),
        0
      );

      if (tipo === "scarico") {
        g.scarichi++;
        g.pesoScarichi += peso;
        g.costi += costo;

        totaleScarichi++;
        totalePesoScarichi += peso;
        totaleCosti += costo;
      } else {
        g.carichi++;
        g.pesoCarichi += peso;
        g.ricavi += ricavo;

        totaleCarichi++;
        totalePesoCarichi += peso;
        totaleRicavi += ricavo;
      }

      if (cer.fir) g.firSet.add(cer.fir);
      g.utenti.add(utente);

      g.dettagli.push({
        ora: formatHour(dataObj),
        controparte,
        fir: cer.fir || "-",
        peso,
        costo,
        ricavo,
        utente,
        tipo,
      });
    });
  });

  const { pdf, startY } = await PdfHeader();

  let y = startY-30;

  pdf.setFontSize(14);
  pdf.text("Report Movimenti", 14, y);
  y += 8;

  Object.keys(gruppi)
    .sort((a, b) => new Date(b.split("/").reverse().join("-")) - new Date(a.split("/").reverse().join("-")))
    .forEach((giorno) => {
      const g = gruppi[giorno];

      pdf.setFontSize(12);
      pdf.text(`Giorno: ${giorno}`, 14, y);
      y += 4;

      autoTable(pdf, {
        startY: y,
        head: [
          ["Ora", "Movimento", "FIR", "Peso", "Costi", "Ricavi", "Utente"],
        ],
        body: g.dettagli.map((d) => [
          d.ora,
          d.controparte,
          d.fir,
          d.peso.toFixed(2),
          d.tipo === "scarico" ? d.costo.toFixed(2) : "",
          d.tipo === "carico" ? d.ricavo.toFixed(2) : "",
          d.utente,
        ]),
        theme: "grid",
        styles: { fontSize: 9 },
      });

      y = pdf.lastAutoTable.finalY + 5;

      pdf.text(
        `Totale giorno: ${g.scarichi}/${g.carichi} | FIR: ${g.firSet.size}`,
        14,
        y
      );

      y += 10;

      if (y > 260) {
        pdf.addPage();
        y = 20;
      }
    });

  const utile = totaleRicavi - totaleCosti;

  pdf.addPage();
  pdf.setFontSize(14);
  pdf.text("Totali Complessivi", 14, 20);

  autoTable(pdf, {
    startY: 30,
    head: [["Movimenti", "Peso S", "Peso C", "Costi", "Ricavi", "Utile"]],
    body: [
      [
        `${totaleScarichi}/${totaleCarichi}`,
        totalePesoScarichi.toFixed(2),
        totalePesoCarichi.toFixed(2),
        totaleCosti.toFixed(2),
        totaleRicavi.toFixed(2),
        utile.toFixed(2),
      ],
    ],
  });

  pdf.save("movimenti.pdf");
};
const handleEmettiFattura = async () => {
  try {
    if (filtroFornitore === "tutti") return;

    const movimenti = filteredScarichi.filter(
      m => m.fornitore === filtroFornitore && m.tipo === "carico"
    );

    if (!movimenti.length) return;

    // 🔢 calcolo totali
    let totaleKg = 0;
    let totaleImporto = 0;

    movimenti.forEach(m => {
      (m.cer || []).forEach(c => {
        (c.righe || []).forEach(r => {
          totaleKg += Number(r.netto || 0);
          totaleImporto += Number(r.prezzoVendita || 0) * Number(r.netto || 0);
        });
      });
    });

    const idFattura = `FATT-${new Date().getFullYear()}-${Date.now()}`;

    // 1️⃣ CREA DOC FIRESTORE
    const ref = await addDoc(collection(db, "fatture"), {
      id: idFattura,
      tipo: "carico",
      fornitore: filtroFornitore,
      data: serverTimestamp(),
      movimenti,
      totaleKg,
      totaleImporto,
      stato: "in_generazione",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || "unknown"
    });

    // 2️⃣ GENERAZIONE PDF (placeholder ora)
    const html = buildFatturaHTML(movimenti, idFattura, totaleKg, totaleImporto);

    const blob = new Blob([html], { type: "text/html" });

    // ⚠️ qui poi lo sostituiamo con PDF vero (jsPDF o Cloud Function)
    const url = URL.createObjectURL(blob);

    // 3️⃣ UPDATE DOC CON URL
    await updateDoc(doc(db, "fatture", ref.id), {
      pdfURL: url,
      stato: "emessa"
    });

    // 4️⃣ LOG
  

    alert("Fattura emessa con successo");
  } catch (err) {
    console.error("Errore emissione fattura:", err);
  }
};

const buildFatturaHTML = (movimenti, id, kg, importo) => {
  return `
  <html>
  <body>
    <h1>FATTURA ${id}</h1>
    <h3>Fornitore: ${filtroFornitore}</h3>

    <table border="1" width="100%">
      <tr>
        <th>Data</th>
        <th>FIR</th>
        <th>Kg</th>
        <th>Prezzo</th>
      </tr>

      ${movimenti.map(m => `
        <tr>
          <td>${m.data?.toDate ? m.data.toDate().toLocaleDateString() : ""}</td>
          <td>${(m.cer || []).map(c => c.fir).join(", ")}</td>
          <td>${(m.cer || []).reduce((t,c)=>t+(c.righe||[]).reduce((s,r)=>s+Number(r.netto||0),0),0)}</td>
          <td>---</td>
        </tr>
      `).join("")}

    </table>

    <h3>Totale Kg: ${kg}</h3>
    <h3>Totale €: ${importo.toFixed(2)}</h3>
  </body>
  </html>
  `;
};

const handleProspetto = () => {
  if (!righeOrdinate?.length) return;

  const righe = [];

  righeOrdinate.forEach(g => {
    // troviamo i movimenti reali di quel giorno
    const movimentiDelGiorno = filteredScarichi.filter(s => {
      const dataObj =
        s.data instanceof Date
          ? s.data
          : s.data?.toDate?.() || null;

      if (!dataObj) return false;

      const giornoIT = dataObj.toLocaleDateString("it-IT");
      return giornoIT === g.giornoIT;
    });

    movimentiDelGiorno.forEach(m => {
      if (m.tipo !== "scarico") return;

      const dataObj =
        m.data instanceof Date
          ? m.data
          : m.data?.toDate?.() || null;

      const giorno = dataObj
        ? dataObj.toLocaleDateString("it-IT")
        : "";

      (m.cer || []).forEach(c => {
        (c.righe || []).forEach(r => {
          righe.push({
            giorno,
            fir: c.fir || "",
            materiale: r.materiale || "",
            peso: Number(r.peso || 0),
            calo: Number(r.calo || 0),
            netto: Number(r.netto || 0),
            prezzoKg: Number(r.prezzoAcquisto || 0),
            fornitore: m.fornitore || ""
          });
        });
      });
    });
  });

  console.log("📑 PROSPETTO (ORDINE IDENTICO GRIGLIA):", righe);

  const fornitoreFinale =
    filtroFornitore && filtroFornitore !== "tutti"
      ? filtroFornitore
      : righe[0]?.fornitore || "";

  stampaProspettoFatturaScarichi(righe, fornitoreFinale);
};

const resetFiltri = () => {
  setFiltroFornitore("tutti");
  setFiltroListino("tutti");
  setFiltroUtente("tutti");
  setFiltroFIR("");
  setTipoMovimento("tutti");
setFirSearch("");
setFiltroFIR("");
setFiltroCER("tutti");
  setTutti(false);

  const today = new Date();
  const primo = new Date(today.getFullYear(), today.getMonth(), 1);

  const minDate = minDataDB ?? primo;
  const maxDate = maxDataDB ?? today;

  // ✅ QUI LA FIX: passiamo Date, NON stringhe
  setDal(minDate);
  setAl(maxDate);
};
const estimated = estimateResults();
const traffic = getTrafficLight(estimated);

  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
        <button
  disabled={tipoMovimento !== "scarico" || filtroFornitore === "tutti"}
  style={{
    marginLeft: 10,
    opacity: (tipoMovimento !== "scarico" || filtroFornitore === "tutti") ? 0.4 : 1,
    cursor: (tipoMovimento !== "scarico" || filtroFornitore === "tutti") ? "not-allowed" : "pointer"
  }}
  onClick={() => {
    if (tipoMovimento === "carico") {
      handleEmettiFattura();
    } else if (tipoMovimento === "scarico") {
      handleProspetto();
    }
  }}
>
  {tipoMovimento === "carico"
    ? "📄 Emetti Fattura"
    : tipoMovimento === "scarico"
    ? "📑 Prospetto Fattura"
    : ""}
</button>
      </div>

      <h2>Gestione Carichi / Scarichi</h2>
<div style={{
  display: "flex",
  gap: "20px",
  margin: "10px 0",
  alignItems: "center",
  fontSize: "14px"
}}>
  <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
    <div style={{width:"15px",height:"15px",background:"#FFECB3",border:"1px solid #ccc"}}></div>
    <span>Scarichi</span>
  </div>

  <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
    <div style={{width:"15px",height:"15px",background:"#C8E6C9",border:"1px solid #ccc"}}></div>
    <span>Carichi</span>
  </div>

  <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
    <div style={{width:"15px",height:"15px",background:"#326c9f",border:"1px solid #ccc"}}></div>
    <span>Misti (Carico + Scarico)</span>
  </div>
</div>
      {/* FILTRI */}
      <div className="filtri">
        <button onClick={resetFiltri} style={{marginLeft:"12px"}}>🔄 Reset filtri</button>

        <label style={{display:"flex",alignItems:"center"}}>
          <input
  type="checkbox"
  checked={tutti}
  onChange={(e) => {
    const checked = e.target.checked;

    const estimated = estimateResults();

    if (checked && estimated > 2000) {
      const ok = window.confirm(
        "⚠️ Attenzione: questa ricerca restituirà circa " +
        estimated +
        " record.\n\nPotrebbe rallentare il sistema.\n\nVuoi continuare?"
      );

      if (!ok) return;
    }

    setTutti(checked);
  }}
/>
          Disabilita filtro date
        </label>

       
       {!tutti && (
  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
    <label>
  Dal:
  <DatePicker
    selected={dal}
    onChange={(date) => setDal(date)}
    minDate={minDataDB || new Date(2000,0,1)}
    maxDate={al || maxDataDB || new Date()}
    dateFormat="dd/MM/yyyy"
    placeholderText="gg/mm/yyyy"
  />
</label>

<label>
  Al:
  <DatePicker
    selected={al}
    onChange={(date) => setAl(date)}
    minDate={dal instanceof Date ? dal : minDataDB || new Date(2000,0,1)}
    maxDate={al instanceof Date ? al : maxDataDB || new Date()}
    dateFormat="dd/MM/yyyy"
    placeholderText="gg/mm/yyyy"
  />
</label>
<label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
  FIR/DDT:
  <input
    type="text"
    placeholder="Scrivi per filtrare..."
    value={filtroFIR}
    onChange={e => setFiltroFIR(e.target.value)}
    style={{ padding: "4px 6px", width: "150px" }}
  />
</label>
 <label style={{ marginLeft: "12px" }}>
          Codice CER:
          <select value={filtroCER} onChange={e => setFiltroCER(e.target.value)}>
            <option value="tutti">Tutti</option>
            {cerDisponibili.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
  </div>
)}

        <label style={{marginLeft:"12px"}}>
         {getLabelFornDest()}:
          <select value={filtroFornitore} onChange={e => setFiltroFornitore(e.target.value)}>
            <option value="tutti">Tutti</option>
            {fornitoriDisponibili.map(f => <option key={f}>{f}</option>)}
          </select>
        </label>

        <label style={{marginLeft:"12px"}}>
          Listino:
          <select value={filtroListino} onChange={e => setFiltroListino(e.target.value)}>
            <option value="tutti">Tutti</option>
            {listiniDisponibili.map(l => <option key={l}>{l}</option>)}
          </select>
        </label>

        <label style={{marginLeft:"12px"}}>
          Utente:
          <select value={filtroUtente} onChange={e => setFiltroUtente(e.target.value)}>
            <option value="tutti">Tutti</option>
            {utentiDisponibili.map(u => <option key={u}>{u}</option>)}
          </select>
        </label>

        <label style={{marginLeft:"12px"}}>
  Tipo:
  <select value={tipoMovimento} onChange={e => setTipoMovimento(e.target.value)}>
    <option value="tutti">Tutti</option>
    <option value="scarico">Scarico</option>
    <option value="carico">Carico</option>
  </select>
</label>

      
      </div>

<div style={{ marginTop: "15px", marginBottom: "10px", display: "flex", gap: "10px", alignItems: "center" }}>
  
  <label>
    📊 Applica listino:
    <select
  value={listinoApplicato}
  onChange={(e) => setListinoApplicato(e.target.value)}
  disabled={tipoMovimento === "tutti"}
>
      <option value="tutti">Nessuno</option>
      {Object.keys(listini)
  .filter(nome => listini[nome]?.tipoListino === "SCARICO")
  .map(nome => (
    <option key={nome} value={nome}>{nome}</option>
))}
    </select>
  </label>

  <button
  onClick={() => applyListino()}
  disabled={tipoMovimento === "tutti" || listinoApplicato === "tutti"}
>
    ⚡ Applica
  </button>

</div>
{/* SEMAFORO RISULTATI */}
<div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
  <span>Risultati stimati:</span>

  <span style={{
    width: 12,
    height: 12,
    borderRadius: "50%",
    backgroundColor:
      traffic === "green"
        ? "green"
        : traffic === "yellow"
        ? "orange"
        : "red"
  }} />

  <strong>{estimated}</strong>
</div>
      {/* TABELLA */}
<table className="tabella-scarichi" style={{marginTop:"16px"}}>
  <thead>
    <tr>
      <th onClick={() => requestSort("data")} style={{ cursor: "pointer" }}>
        Data {sortConfig.key === "data" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      <th onClick={() => requestSort("movimenti")} style={{ cursor: "pointer" }}>
        Movimenti (scarico / carico) {sortConfig.key === "movimenti" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      <th onClick={() => requestSort("nrFIR")} style={{ cursor: "pointer" }}>
        Nr FIR {sortConfig.key === "nrFIR" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      <th onClick={() => requestSort("pesoScarichi")} style={{ cursor: "pointer" }}>
        Peso Scarichi {sortConfig.key === "pesoScarichi" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      <th onClick={() => requestSort("pesoCarichi")} style={{ cursor: "pointer" }}>
        Peso Carichi {sortConfig.key === "pesoCarichi" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      <th onClick={() => requestSort("costi")} style={{ cursor: "pointer" }}>
        Costi € {sortConfig.key === "costi" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      <th onClick={() => requestSort("ricavi")} style={{ cursor: "pointer" }}>
        Ricavi € {sortConfig.key === "ricavi" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>
      {filtroUtente === "tutti" && (
        <th>
          (Fornitore|Smaltitore)/Utente
        </th>
      )}
    </tr>
  </thead>
  <tbody>
    {righeOrdinate.map(r => (
      <tr
        key={r.giornoIT}
        onClick={() => setGiornoSelezionato({ giorno: r.giornoIT })}
        style={{
  cursor: "pointer",
  backgroundColor: r.backgroundColor,
  color: r.textColor
}}
      >
        <td>{r.giornoIT}</td>
        <td>{r.nrMovimentiScarico} / {r.nrMovimentiCarico}</td>
        <td>{r.nrFIR}</td>
        <td>{r.pesoScarichi.toFixed(2)}</td>
        <td>{r.pesoCarichi.toFixed(2)}</td>
        <td>{r.costiTotali.toFixed(2)}</td>
        <td>{r.ricaviTotali.toFixed(2)}</td>
        {filtroUtente === "tutti" && <td>{r.utenti || r.utentiDelGiorno || "-"}</td>}
      </tr>
    ))}
  </tbody>
</table>
    </div>
  );
};

export default GestioneScarichi;