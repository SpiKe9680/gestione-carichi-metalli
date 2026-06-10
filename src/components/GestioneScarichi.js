// src/components/GestioneScarichi.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, getDoc, addDoc, setDoc,deleteDoc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import GestioneScarichiDettaglio from "./GestioneScarichiDettaglio";
import DatePicker, { registerLocale } from "react-datepicker";
import { it } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Select from "react-select";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
export const applyListino = async ({
  movimentiIds = [],
  listino,
  db,
  collectionName = "scarichi",
  tipoMovimento
}) => {
  if (!movimentiIds.length) return;
  if (!listino) return;
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
      return;
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
    for (const id of movimentiIds) {
      const ref = doc(db, collectionName, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        console.error("❌ DOC NON ESISTE:", id);
        continue;
      }
      const data = snap.data();
      const tipo = data.tipo || tipoMovimento || "scarico";
      const field = tipo === "carico" ? "carico" : "scarico";
      const blocco = Array.isArray(data[field]) ? data[field] : [];
      let modifiche = 0;
      let nonTrovati = 0;
      const aggiornato = blocco.map((cer) => ({
        ...cer,
        righe: (cer.righe || []).map((r) => {
          const raw = r.materiale;
          const key = norm(raw);
          const prezzoObj =            smartMap[key] ||            smartMap[raw] ||            null;          if (!prezzoObj) {
            nonTrovati++;
            return r;
          }
          modifiche++;
          const acquisto =            prezzoObj.acquisto ?? prezzoObj.prezzoAcquisto ?? 0;
          const vendita =            prezzoObj.vendita ?? prezzoObj.prezzoVendita ?? 0;
          const prezzoFinale =            tipo === "scarico" ? acquisto : vendita;
          return {            ...r,            prezzoAcquisto:              tipo === "scarico"                ? Number(acquisto)                : Number(r.prezzoAcquisto ?? 0),            prezzoVendita:              tipo === "carico"                ? Number(vendita)                : Number(r.prezzoVendita ?? 0),            prezzo: Number(prezzoFinale ?? 0),            listino,          };        }),      }));
      if (modifiche === 0) {
        console.warn(          "⚠️ applyListino: nessuna modifica applicata (check matching dati)"        );      }
      await updateDoc(ref, {        [field]: aggiornato,        listino,        lastUpdate: Date.now()      });    }
  } catch (e) {    console.error("💥 ERRORE APPLYLISTINO:", e);  }};
registerLocale("it", it);
const GestioneScarichi = () => {
const [scarichi, setScarichi] = useState([]);
const [filteredScarichi, setFilteredScarichi] = useState([]);
const [filtroFIR, setFiltroFIR] = useState(""); // filtro dropdown FIR
const [firDisponibili, setFirDisponibili] = useState([]); // lista FIR disponibili per il filtro
const [firSearch, setFirSearch] = useState(""); // testo digitato per FIR

const vaiScarichi= ()=>navigate("/scarichi", { state: { refresh: true } });
const [dataSalvataggio, setDataSalvataggio] = useState(new Date());
const [minDataSalvataggio, setMinDataSalvataggio] = useState(null);
const [dal, setDal] = useState(null);   // oggetto Date
const [al, setAl] = useState(null);     // oggetto Date
const [sortConfig, setSortConfig] = useState({ key: "data", direction: "desc" });
const [tipoMovimento, setTipoMovimento] = useState("tutti");
const [listinoApplicato, setListinoApplicato] = useState("tutti");
const [modalProspetto, setModalProspetto] = useState(null);
const [tutti, setTutti] = useState(false);
const [filtroFornitore, setFiltroFornitore] = useState("tutti");
const [filtroListino, setFiltroListino] = useState("tutti");
const [filtroUtente, setFiltroUtente] = useState("tutti");
const [giornoSelezionato, setGiornoSelezionato] = useState(null);
const [reloadKey, setReloadKey] = useState(0);
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
 const [prospettoRighe, setProspettoRighe] = useState([]);
const [filtroDestinatario, setFiltroDestinatario] = useState("tutti");
  const [fornitoriDisponibili, setFornitoriDisponibili] = useState([]);
  const [listiniDisponibili, setListiniDisponibili] = useState([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState([]);
  const [modalTipo, setModalTipo] = useState(null); 
const round2 = (n) => {  const num = Number(n) || 0;  return Number(num.toFixed(2));};
const [modalData, setModalData] = useState(null);
  const [listini, setListini] = useState({});
const [filtroCER, setFiltroCER] = useState("tutti");
const [cerDisponibili, setCerDisponibili] = useState([]);
  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const normalizeDate = (d) => {  if (!d) return null;  if (d instanceof Date) return d;  if (d?.toDate) return d.toDate();  return new Date(d);};
  const getLabelFornDest = () => {  if (tipoMovimento === "carico") return "Smaltitori";  if (tipoMovimento === "scarico") return "Fornitori";  return "Fornitore / Smaltitore";};
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
 const goHome = () => {  window.location.href = "/admin";};
  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
const requestSort = (key) => {  let direction = "asc";  if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";  setSortConfig({ key, direction });};
useEffect(() => {
  const today = new Date();
  const primo = new Date(today.getFullYear(), today.getMonth(), 1);
  setDal(primo);
  setAl(today);
}, []);
const pulitiIds = React.useMemo(() => {
  return (modalData?.movimentiIds || []).map(id =>
    id.replace(/^scarico_/, "").replace(/^carico_/, "")
  );
}, [modalData]);
const fetchMovimenti = async () => {
  try {
    const scarichiSnap = await getDocs(collection(db, "scarichi"));
    const carichiSnap = await getDocs(collection(db, "carichi"));
    const parseData = normalizeDate;
  const parseDoc = (d, tipo) => {
  const data = d.data();
  const movimenti = Array.isArray(data[tipo]) ? data[tipo] : [];
  return {
    id: d.id, // 🔥 ID FIRESTORE VERO (OBBLIGATORIO)
    uiId: `${tipo}_${d.id}`, // solo UI
    realId: d.id, // safety
    tipo,    data: parseData(data.data),    fornitore: data.fornitore || "sconosciuto",    listino: data.listino || "sconosciuto",    utente: data.utente || "sconosciuto",    
    movimentoFinanziarioId:
  data.movimentoFinanziarioId !== undefined &&
  data.movimentoFinanziarioId !== null &&
  String(data.movimentoFinanziarioId).trim() !== ""    ? data.movimentoFinanziarioId    : null,
    cer: movimenti.map(m => ({
      fir: m.fir || "-",      cer: m.cer || m.codiceCER || "-",      tipo: m.tipo,      righe: (m.righe || []).map(r => ({        ...r,        netto: r.netto || 0,        prezzoAcquisto: r.prezzoAcquisto || 0,        prezzoVendita: r.prezzoVendita || 0      }))    }))  };};
    const scarichi = scarichiSnap.docs.map(d => parseDoc(d, "scarico"));
    const carichi = carichiSnap.docs.map(d => parseDoc(d, "carico"));
    const tuttiMovimenti = [...scarichi, ...carichi];
    tuttiMovimenti.sort((a, b) => b.data - a.data);
    setScarichi(tuttiMovimenti);
    if (tuttiMovimenti.length) {
      const ordinati = [...tuttiMovimenti].sort((a, b) => a.data - b.data);
      const oggi = new Date();
      oggi.setHours(23, 59, 59, 999);
      setMinDataDB(ordinati[0]?.data || null);
      setMaxDataDB(oggi);
    }
  } catch (err) {
    console.error("Errore caricamento movimenti:", err);
  }
};
const validaEPreparaProspetto = async (movimentiIds) => {
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
      if (p.DataPagamento) {        conflittiPagati.push({          id: d.id,          collection: col,          fornitore: p.fornitore,          dataPagamento: p.DataPagamento,          overlap,        });      
    } else {        daEliminare.push({ id: d.id, collection: col });      }    });
  }
  if (conflittiPagati.length > 0) {    const msg = conflittiPagati
      .map(
        (c) =>
          `Fornitore: ${c.fornitore} - Pagato il: ${            c.dataPagamento?.toDate?.()?.toLocaleDateString("it-IT") ||            c.dataPagamento ||            "N/D"          }`      )
      .join("\n");
    throw new Error("SCARICO_GIA_PAGATO\n\n" + msg);
  }
  for (const d of daEliminare) {    await deleteDoc(doc(db, d.collection, d.id));  }
  return true;
};
const handleSalvaDocumento = async () => {
  try {
    if (!modalData) {
      alert("❌ Dati modal mancanti");
      return;
    }

    const tipo = modalTipo === "prospetto" ? "prospetto" : "fattura";
    const collectionName =
      tipo === "prospetto" ? "prospettiFattura" : "fattureCarichi";

    const movimentiIds = (modalData.movimentiIds || []).filter(Boolean);

    // 🔥 USA STATO UI, NON FIRESTORE RAW
    const movs = filteredScarichi
      .filter(m => movimentiIds.includes(m.id));

    if (!movs.length) {
      console.error("❌ MOVS VUOTO - IDS:", movimentiIds);
      alert("❌ Nessun movimento trovato (UI state vuoto)");
      return;
    }

    const blocchi = movs.flatMap(m =>
      (m.cer || []).map(c => ({
        fir: c.fir || m.fir || "-",
        cer: c.cer || c.codiceCER || "-",
        righe: (c.righe || []).map(r => ({
          materiale: r.materiale,
          netto: Number(r.netto || 0),

          // 🔥 FIX FONDAMENTALE: usa prezzo già valorizzato da UI/applyListino
          prezzo:
            Number(
              r.prezzo ??
              r.prezzoVendita ??
              r.prezzoAcquisto ??
              0
            ),
        }))
      }))
    );

    if (!blocchi.length) {
      console.error("❌ BLOCCHI VUOTI:", movs);
      alert("❌ Blocchi vuoti: dati non coerenti");
      return;
    }

    let totale = 0;

    blocchi.forEach(b => {
      b.righe.forEach(r => {
        totale += Number(r.netto || 0) * Number(r.prezzo || 0);
      });
    });

    const payload = {
      tipo,
      cliente: modalData.cliente || "",
      totale: round2(totale),
      movimentiIds,
      blocchi,
      dataCreazione: dataSalvataggio.toISOString(),
      movimentoFinanziarioId: null,
    };

    await setDoc(
      doc(db, collectionName, movimentiIds.sort().join("-")),
      payload,
      { merge: true }
    );

    alert("✅ Documento salvato correttamente");
    setModalData(null);

  } catch (err) {
    console.error(err);
    alert("❌ Errore salvataggio");
  }
};
const salvaProspettoUnificato = async (modalData, tipo) => {
  const scarichiIds = modalData.movimentiIds || [];
  if (!scarichiIds.length) {    throw new Error("Nessun movimento selezionato");  }
  await validaEPreparaProspetto(scarichiIds);
 let totale = 0;
(modalData.blocchi || []).forEach(b => {
  (b.righe || []).forEach(r => {   const kg = money(r.netto);    const prezzo = money(r.prezzo);    totale += round2(kg * prezzo);  });
});
totale = round2(totale);
  const collectionName =
    tipo === "prospetto" ? "prospetti" : "fattureCarichi";
  return addDoc(collection(db, collectionName), {    tipo,    cliente: modalData.cliente,    totale,    movimentiIds: scarichiIds,    blocchi: modalData.blocchi,    dataCreazione: new Date().toISOString(),    DataPagamento: null  });
};
const handleStampaDocumento = async () => {
  const isFattura = modalTipo === "fattura";

  const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
  const config = snap.exists() ? snap.data() : {};

  const isConsuntivato = (v) =>
    v !== null && v !== undefined && String(v).trim() !== "";

  const movimenti = filteredScarichi.filter(
    (m) =>
      modalData.movimentiIds.includes(m.id) &&
      !isConsuntivato(m.movimentoFinanziarioId)
  );

  let totale = 0;

  const buildGruppi = (useVendita) => {
    const gruppi = {};

    movimenti.forEach((m) => {
      const dataMov =
        m.dataDocumento ||
        m.dataScarico ||
        m.dataCreazione ||
        m.data ||
        null;

      (m.cer || []).forEach((c) => {
        const firKey = c.fir || "SENZA FIR";

        if (!gruppi[firKey]) {
          gruppi[firKey] = {
            data: dataMov,
            righe: [],
          };
        }

        if (!gruppi[firKey].data && dataMov) {
          gruppi[firKey].data = dataMov;
        }

        (c.righe || []).forEach((r) => {
          gruppi[firKey].righe.push({
            cer: c.cer,
            materiale: r.materiale,
            kg: Number(r.netto || 0),
            prezzo: Number(
              r.prezzo ??
              (useVendita ? r.prezzoVendita : r.prezzoAcquisto) ??
              0
            ),
            dataDocumento: dataMov, // 🔥 FIX
          });
        });
      });
    });

    return gruppi;
  };

  const gruppi = buildGruppi(isFattura);

  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();

  pdf.setFontSize(14);
  pdf.text(
    isFattura ? "FATTURA" : "PROSPETTO FATTURA",
    14,
    startY - 10
  );

  if (config?.ragioneSociale) {
    pdf.setFontSize(10);
    pdf.text(config.ragioneSociale, 14, startY - 2);
  }

  let body = [];

  Object.keys(gruppi).forEach((fir) => {
    const gruppo = gruppi[fir];

    gruppo.righe.forEach((r) => {
      const tot = r.kg * r.prezzo;
      totale += tot;

      body.push([
        fir,
        r.dataDocumento
          ? new Date(r.dataDocumento).toLocaleDateString("it-IT")
          : "-",
        r.cer || "-",
        r.materiale || "-",
        r.kg.toFixed(2),
        r.prezzo.toFixed(2),
        tot.toFixed(2),
      ]);
    });
  });

  autoTable(pdf, {
    startY: startY,
    head: [["FIR", "DATA", "CER", "Materiale", "Kg", "Prezzo", "Totale"]],
    body,
    styles: { fontSize: 9 },
  });

  pdf.text(
    `Totale: € ${totale.toFixed(2)}`,
    14,
    pdf.lastAutoTable.finalY + 10
  );

  const nomeCliente = (modalData.cliente || "cliente")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();

  const today = new Date()
    .toLocaleDateString("it-IT")
    .replace(/\//g, "-");

  await salvaESharePdfCapacitor(
    pdf,
    `${isFattura ? "fattura" : "prospetto"}_${nomeCliente}_${today}.pdf`
  );
};
useEffect(() => {
  if (location.state?.refresh) {
    fetchMovimenti(); // ricarica i dati correttamente
    // Pulisci lo stato per evitare refresh multipli
    navigate(location.pathname, { replace: true, state: {} });
  }
}, [location.state]);
useEffect(() => {
  if (!modalData?.movimentiIds?.length) return;

  const movs = filteredScarichi.filter(m =>
    modalData.movimentiIds.includes(m.id)
  );

  const dates = movs
    .map(m => m.data)
    .filter(Boolean)
    .map(d => normalizeDate(d))
    .filter(Boolean);

  if (!dates.length) return;

  const min = new Date(Math.min(...dates.map(d => d.getTime())));

  setMinDataSalvataggio(min);

  // 🔥 se la data attuale è "troppo piccola", la correggiamo automaticamente
  setDataSalvataggio(prev =>
    prev && prev >= min ? prev : min
  );
}, [modalData, filteredScarichi]);
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
  useEffect(() => {
    if (scarichi.length === 0) return;
    const params = new URLSearchParams(location.search);
    const f = params.get("fornitore");
    const l = params.get("listino");
    const u = params.get("utente");
    let hasQueryFilter = false;
    if (f) {
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
      setTutti(true);
    }
  }, [scarichi, listiniDisponibili, fornitoriDisponibili, utentiDisponibili, location.search]);
useEffect(() => {
  if (!scarichi.length) return;
  let dati = [...scarichi];
  const norm = (v) =>
    (v ?? "")
      .toString()
      .trim()
      .toLowerCase();
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
  if (!tutti && dal && al) {
    let endDate = new Date(al);
    endDate.setHours(23, 59, 59, 999);
    dati = dati.filter(s => s.data >= dal && s.data <= endDate);
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
    (cer.fir || "").toLowerCase().trim().includes(fir)
  )
);
  }
if (tipoMovimento === "scarico" || tipoMovimento === "carico") {
  dati = dati.filter(s => s.tipo === tipoMovimento);
}
  setFilteredScarichi(dati);
}, [  scarichi,  dal,  al,  tutti,  filtroFornitore,  filtroListino,  filtroUtente,  filtroFIR,  tipoMovimento,  filtroCER]);
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
  if (tipoMovimento === "scarico" || tipoMovimento === "carico") {
    dati = dati.filter(s => s.tipo === tipoMovimento);
  }
  return dati.length;
};
const isDocumentoDisabled = () => {
  return (
    filtroFornitore === "tutti" ||
    tipoMovimento === "tutti"
  );
};
const getDocumentoLabel = () => {
  if (filtroFornitore === "tutti") {
    return "⚠️ Seleziona controparte";
  }
  if (tipoMovimento === "tutti") {
    return "⚠️ Seleziona tipo";
  }
  const movimenti = getMovimentiValidi();
  const hasScarico = movimenti.some(m => m.tipo === "scarico");
  const hasCarico = movimenti.some(m => m.tipo === "carico");
  if (!hasScarico && hasCarico) return "📄 Emetti Fattura";
  if (hasScarico && !hasCarico) return "📑 Prospetto Fattura";
  if (hasScarico && hasCarico) return "⚠️ Separa Carichi/Scarichi";
  return "📄 Documento";
};
const getTrafficLight = (count) => {
  if (count <= 1000) return "green";
  if (count <= 2000) return "yellow";
  return "red";
};
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
const stampaProspettoFatturaScarichi = async (righe, fornitore = "") => {
  const config = await getConfigAzienda();
  const pdf = new jsPDF();
  let y = 10;
  if (config?.logoBase64) {
    pdf.addImage(      `data:image/png;base64,${config.logoBase64}`,      "PNG",      10,      5,      40,      20    );
  }
  pdf.setFontSize(11);
  pdf.text(config?.ragioneSociale || "", 60, 10);
  pdf.text(config?.indirizzo || "", 60, 16);
  pdf.text(config?.capCitta || "", 60, 22);
  pdf.text(`P.IVA: ${config?.piva || "-"}`, 60, 28);
  y = 42;
  pdf.setFontSize(14);
  pdf.text("PROSPETTO FATTURA SCARICHI", 10, y);
  y += 8;
  pdf.setFontSize(11);
  pdf.text(`Cliente: ${fornitore || "-"}`, 10, y);
  y += 10;
  const head = [["FIR", "CER", "Materiale", "Kg", "Prezzo", "Totale"]];
  let totale = 0;
  const body = righe.map(r => {
   const tot = money(r.netto * r.prezzoKg);
totale += round2(tot);
    return [      r.fir || "-",      r.cer || "-",      r.materiale || "-",      Number(r.netto || 0).toFixed(2),      Number(r.prezzoKg || 0).toFixed(2),      tot.toFixed(2),];
  });
  autoTable(pdf, {    startY: y,    head,    body,    theme: "grid",    styles: { fontSize: 9 }  });
  const finalY = pdf.lastAutoTable.finalY || y;
  pdf.setFontSize(12);
  totale = round2(totale);
  pdf.text(`TOTALE: € ${totale.toFixed(2)}`, 10, finalY + 10);

  await salvaESharePdfCapacitor(pdf, `prospetto_${(fornitore || "cliente").replace(/[^a-z0-9]/gi, "_")}.pdf`);
};
const righePerGiorno = Object.keys(scarichiPerGiorno).map(giornoIT => {
  const movimentiDelGiorno = scarichiPerGiorno[giornoIT];
  const safe = (v) => Number(v) || 0;
const tuttiCer = movimentiDelGiorno.flatMap(s =>
  (s.cer || []).map(cer => ({    fir: cer.fir || "-",    cer: cer.cer || cer.codiceCER || "-",    tipo: cer.tipo ?? s.tipo,    listino: s.listino,    movimentoFinanziarioId: s.movimentoFinanziarioId,
    righe: (cer.righe || []).map(r => ({      ...r,      fir: cer.fir || "-",      cer: cer.cer || cer.codiceCER || "-",
      materiale: r.materiale,      netto: r.netto || 0,      prezzoAcquisto: r.prezzoAcquisto || 0,      prezzoVendita: r.prezzoVendita || 0,    }))  }))
);
  const nrMovimentiScarico = tuttiCer.filter(c => c.tipo === "scarico").length;
  const nrMovimentiCarico = tuttiCer.filter(c => c.tipo === "carico").length;
  const nrFIR = tuttiCer.map(c => c.fir).filter(Boolean).length;
  const pesoScarichi = tuttiCer
    .filter(c => c.tipo === "scarico")
    .reduce((tot, c) => tot + c.righe.reduce((s, r) => s + safe(r.netto), 0), 0);
  const pesoCarichi = tuttiCer
    .filter(c => c.tipo === "carico")
    .reduce((tot, c) => tot + c.righe.reduce((s, r) => s + safe(r.netto), 0), 0);
  const costiTotali = tuttiCer
    .filter(c => c.tipo === "scarico")
    .reduce((tot, c) =>
      tot + c.righe.reduce((s, r) =>
        s + safe(r.prezzoAcquisto) * safe(r.netto), 0
      )
    , 0);
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
 const totaleMovimenti = movimentiDelGiorno.length;
const consuntivati = movimentiDelGiorno.filter(
  m => m.movimentoFinanziarioId
).length;
const hasConsuntivati = consuntivati > 0;
let backgroundColor = "";
let textColor = "#000";
const filtroAttivo =
  filtroFornitore !== "tutti" ||
  filtroListino !== "tutti" ||
  filtroUtente !== "tutti" ||
  filtroCER !== "tutti";
if (hasConsuntivati && filtroAttivo) {
  backgroundColor = "#40ef46"; // verde SOLO con controparti selezionate
} else if (nrMovimentiScarico > 0 && nrMovimentiCarico > 0) {
  backgroundColor = "#326c9f";
  textColor = "#fff";
} else if (nrMovimentiCarico > 0) {
  backgroundColor = "#C8E6C9";
} else {
  backgroundColor = "#FFECB3";
}
  return {    giornoIT,    nrMovimentiScarico,    nrMovimentiCarico,    nrFIR,    pesoScarichi,    pesoCarichi,    costiTotali,    ricaviTotali,    utenti: utentiDelGiorno,
    backgroundColor,    textColor,    tooltip: hasConsuntivati  ? `Consuntivati: ${consuntivati}/${totaleMovimenti}`     : ""  };});
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
if (giornoSelezionato) {
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
}}/>  );}
const handleApriDocumento = () => {
  if (isDocumentoDisabled()) return;
  const movimenti = getMovimentiValidi();
  if (!movimenti.length) {
    alert("⚠️ Nessun movimento valido");
    return;
  }
  const hasScarico = movimenti.some(m => m.tipo === "scarico");
  const hasCarico = movimenti.some(m => m.tipo === "carico");
  if (hasScarico && hasCarico) {
    alert("⚠️ Non puoi mischiare carichi e scarichi");
    return;
  }
  const tipo = hasScarico ? "prospetto" : "fattura";
  setModalTipo(tipo);
  setModalData({
    cliente: filtroFornitore,
    movimentiIds: movimenti.map(m => m.id),
    blocchi: movimenti.flatMap(m => m.cer || [])
  });
};
const handleStampa = async () => {
  const movimenti = filteredScarichi;
  if (!movimenti || !Array.isArray(movimenti)) return;
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");
  const formatDate = (date) => {
    const d =
      date instanceof Date        ? date        : date?.toDate        ? date.toDate()        : new Date(date);    return d.toLocaleDateString("it-IT");  };
  const formatHour = (date) => {
    const d =      date instanceof Date        ? date        : date?.toDate        ? date.toDate()        : new Date(date);
    return d.toLocaleTimeString("it-IT", {      hour: "2-digit",      minute: "2-digit",    });  };
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
    const dataObj =      s.data instanceof Date        ? s.data        : s.data?.toDate        ? s.data.toDate()        : null;
    if (!dataObj) return;
    const giorno = formatDate(dataObj);
    if (!gruppi[giorno]) {
      gruppi[giorno] = {        scarichi: 0,        carichi: 0,        firSet: new Set(),        pesoScarichi: 0,        pesoCarichi: 0,        costi: 0,        ricavi: 0,        utenti: new Set(),        dettagli: [],      };    }
    const g = gruppi[giorno];
    const utente = getUtente(s);
    const controparte = s.fornitore || s.destinatario || "sconosciuto";
    (s.cer || []).forEach((cer) => {
      const tipo = cer.tipo ?? s.tipo;
      const righe =
        cer.righe || [          {            netto: safe(cer.netto),            prezzoAcquisto: safe(cer.prezzoAcquisto),            prezzoVendita: safe(cer.prezzoVendita),          },        ];
      const peso = righe.reduce((t, r) => t + safe(r.netto), 0);
   const costo = righe.reduce(
  (t, r) => t + round2(round2(r.prezzoAcquisto) * round2(r.netto)),
  0
);
const ricavo = righe.reduce(
  (t, r) => t + round2(round2(r.prezzoVendita) * round2(r.netto)),
  0
);
      if (tipo === "scarico") {        g.scarichi++;        g.pesoScarichi += peso;        g.costi += costo;
        totaleScarichi++;        totalePesoScarichi += peso;        totaleCosti += costo;
      } else {        g.carichi++;        g.pesoCarichi += peso;        g.ricavi += ricavo;
        totaleCarichi++;        totalePesoCarichi += peso;        totaleRicavi += ricavo;      }
      if (cer.fir) g.firSet.add(cer.fir);
      g.utenti.add(utente);
      g.dettagli.push({        ora: formatHour(dataObj),        controparte,        fir: cer.fir || "-",        peso,        costo,        ricavo,        utente,        tipo,      });    });  });
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
        body: g.dettagli.map((d) => [          d.ora,          d.controparte,          d.fir,          d.peso.toFixed(2),          d.tipo === "scarico" ? d.costo.toFixed(2) : "",          d.tipo === "carico" ? d.ricavo.toFixed(2) : "",          d.utente,        ]),        theme: "grid",        styles: { fontSize: 9 },      });
      y = pdf.lastAutoTable.finalY + 5;
      pdf.text(        `Totale giorno: ${g.scarichi}/${g.carichi} | FIR: ${g.firSet.size}`,        14,        y      );
      y += 10;
      if (y > 260) {        pdf.addPage();        y = 20;      }    });
  const utile = totaleRicavi - totaleCosti;
  pdf.addPage();
  pdf.setFontSize(14);
  pdf.text("Totali Complessivi", 14, 20);
  autoTable(pdf, {
    startY: 30,
    head: [["Movimenti", "Peso S", "Peso C", "Costi", "Ricavi", "Utile"]],
    body: [      [        `${totaleScarichi}/${totaleCarichi}`,        totalePesoScarichi.toFixed(2),        totalePesoCarichi.toFixed(2),        totaleCosti.toFixed(2),        totaleRicavi.toFixed(2),        utile.toFixed(2),      ],    ],  });
  await salvaESharePdfCapacitor(pdf, "movimenti.pdf");
};
const confermaSalvataggioProspetto = async () => {
  setModalProspetto(false);
 await salvaProspettoUnificato(modalData, modalTipo === "prospetto" ? "prospetto" : "fattura");
};
const stampaSoloProspetto = async () => {
  setModalProspetto(false);

  const righe = [];

  righeOrdinate.forEach(g => {
    const movimentiDelGiorno = filteredScarichi.filter(s => {
      const dataObj =
        s.data instanceof Date
          ? s.data
          : s.data?.toDate?.() || null;

      if (!dataObj) return false;

      return dataObj.toLocaleDateString("it-IT") === g.giornoIT;
    });

    movimentiDelGiorno.forEach(m => {
      if (m.tipo !== "scarico") return;

      (m.cer || []).forEach(c => {
        (c.righe || []).forEach(r => {
          righe.push({
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

  const fornitoreFinale =
    filtroFornitore && filtroFornitore !== "tutti"
      ? filtroFornitore
      : righe[0]?.fornitore || "";

  // 🔥 PDF
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();

  pdf.setFontSize(14);
  pdf.text("Prospetto Fattura", 14, startY - 10);

  autoTable(pdf, {
    startY: startY,
    head: [["FIR", "Materiale", "Peso", "Prezzo", "Totale"]],
    body: righe.map(r => {
      const tot = r.netto * r.prezzoKg;

      return [
        r.fir || "-",
        r.materiale || "-",
        r.netto.toFixed(2),
        r.prezzoKg.toFixed(2),
        tot.toFixed(2)
      ];
    }),
    styles: { fontSize: 9 }
  });

  // 🔥 nome file pulito + data
  const nomePulito = (fornitoreFinale || "sconosciuto")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();

  const today = new Date()
    .toLocaleDateString("it-IT")
    .replace(/\//g, "-");

  await salvaESharePdfCapacitor(
    pdf,
    `prospetto_${nomePulito}_${today}.pdf`
  );
};
const resetFiltri = () => {
  setFiltroFornitore("tutti");  setFiltroListino("tutti");
  setFiltroUtente("tutti");  setFiltroFIR("");
  setTipoMovimento("tutti");setFirSearch("");
setFiltroFIR(""); setFiltroCER("tutti");
  setTutti(false);
  const today = new Date();
  const primo = new Date(today.getFullYear(), today.getMonth(), 1);
  const minDate = minDataDB ?? primo;
  const maxDate = maxDataDB ?? today;
  setDal(minDate);  setAl(maxDate);
};
const estimated = estimateResults();
const traffic = getTrafficLight(estimated);
const getMovimentiValidi = () => {
  const isConsuntivato = (v) =>
    v !== null &&
    v !== undefined &&
    String(v).trim() !== "";
  return filteredScarichi.filter((m) => {
    if (tipoMovimento !== "tutti" && m.tipo !== tipoMovimento) {
      return false;
    }
    if (filtroFornitore !== "tutti" && m.fornitore !== filtroFornitore) {
      return false;
    }
    if (isConsuntivato(m.movimentoFinanziarioId)) {
      return false;
    }
    return true;
  });
};
const toOptions = (arr) =>
  arr.map(v => ({ value: v, label: v }));
  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
        <button onClick={vaiScarichi} style={{marginLeft:10}}>⚙ Nuovo Carico/Scarico</button>
<button
  onClick={handleApriDocumento}
  disabled={isDocumentoDisabled()}
  title={
    isDocumentoDisabled()
      ? "Selezionare il Tipo di documento e la controparte per cui creare la contabile"
      : "Crea documento"
  }
  style={{
    opacity: isDocumentoDisabled() ? 0.5 : 1,
    cursor: isDocumentoDisabled() ? "not-allowed" : "pointer"
  }}
>
  {getDocumentoLabel()}
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
   <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
    <div style={{width:"15px",height:"15px",background:"#40ef46",border:"1px solid #ccc"}}></div>
    <span>Già Fatturati</span>
  </div>
</div>
<div className="filtri">

  <button onClick={resetFiltri} className="filter-item">🔄 Reset filtri</button>

  <label className="filter-item">
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
    <div className="filtri-group">
<div>
      <label className="filter-item">
        Dal:
        <DatePicker
          selected={dal}
          onChange={(date) => setDal(date)}
          minDate={minDataDB || new Date(2000, 0, 1)}
          maxDate={maxDataDB || new Date()}
          dateFormat="dd/MM/yyyy"
          placeholderText="gg/mm/yyyy"
        />
      </label>
</div><div>
      <label className="filter-item">
        Al:
        <DatePicker
          selected={al}
          onChange={(date) => setAl(date)}
          minDate={dal instanceof Date ? dal : minDataDB || new Date(2000, 0, 1)}
          maxDate={maxDataDB || new Date()}
          dateFormat="dd/MM/yyyy"
          placeholderText="gg/mm/yyyy"
        />
      </label></div>

    </div>
  )}
<div>
      <label className="filter-item">
        FIR/DDT:
        <input
          type="text"
          placeholder="Scrivi per filtrare..."
          value={filtroFIR} width="100%"
          onChange={e => setFiltroFIR(e.target.value)}
        />
      </label></div><div>
      <label className="filter-item">
        Codice CER:
        <Select
          value={
            filtroCER === "tutti"
              ? null
              : { value: filtroCER, label: filtroCER }
          }
          onChange={(opt) => setFiltroCER(opt ? opt.value : "tutti")}
          options={[
            { value: "tutti", label: "Tutti" },
            ...toOptions(cerDisponibili)
          ]}
          isClearable
          placeholder="CER"
        />
      </label></div>
  <label className="filter-item">
    {getLabelFornDest()}:
    <Select
      value={
        filtroFornitore === "tutti"
          ? null
          : { value: filtroFornitore, label: filtroFornitore }
      }
      onChange={(opt) => setFiltroFornitore(opt ? opt.value : "tutti")}
      options={[
        { value: "tutti", label: "Tutti" },
        ...toOptions(fornitoriDisponibili)
      ]}
      isClearable
      placeholder="Fornitore / Smaltitore"
    />
  </label>

  <label className="filter-item">
    Listino:
    <Select
      value={
        filtroListino === "tutti"
          ? null
          : { value: filtroListino, label: filtroListino }
      }
      onChange={(opt) => setFiltroListino(opt ? opt.value : "tutti")}
      options={[
        { value: "tutti", label: "Tutti" },
        ...toOptions(listiniDisponibili)
      ]}
      isClearable
      placeholder="Listino"
    />
  </label>

  <label className="filter-item">
    Utente:
    <Select
      value={
        filtroUtente === "tutti"
          ? null
          : { value: filtroUtente, label: filtroUtente }
      }
      onChange={(opt) => setFiltroUtente(opt ? opt.value : "tutti")}
      options={[
        { value: "tutti", label: "Tutti" },
        ...toOptions(utentiDisponibili)
      ]}
      isClearable
      placeholder="Utente"
    />
  </label>

  <label className="filter-item">
    Tipo:
    <select value={tipoMovimento} onChange={e => setTipoMovimento(e.target.value)}>
      <option value="tutti">Tutti</option>
      <option value="scarico">Scarico</option>
      <option value="carico">Carico</option>
    </select>
  </label>

</div>
<div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
  <span>Movimenti:</span>
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
  color: r.textColor}}      >
        <td>{r.giornoIT}</td>
        <td>{r.nrMovimentiScarico} / {r.nrMovimentiCarico}</td>
        <td>{r.nrFIR}</td>
        <td>{r.pesoScarichi.toFixed(2)}</td>
        <td>{r.pesoCarichi.toFixed(2)}</td>
        <td>{r.costiTotali.toFixed(2)}</td>
        <td>{r.ricaviTotali.toFixed(2)}</td>
        {filtroUtente === "tutti" && <td>{r.utenti || r.utentiDelGiorno || "-"}</td>}
      </tr>    ))}
  </tbody>
</table>{modalProspetto && (
  <div style={{
    position: "fixed",    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)",    display: "flex",
    justifyContent: "center",    alignItems: "center"
  }}>    <div style={{
      background: "white",      padding: 20,
      borderRadius: 10,      width: "80%",
      maxHeight: "80vh",      overflow: "auto"
    }}>
      <h3>Prospetto Fattura</h3>
      <table border="1" cellPadding="5" style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>
            <th>FIR</th>            <th>CER</th>
            <th>Materiale</th>            <th>Kg</th>
            <th>Calo</th>            <th>Netto</th>
            <th>€/Kg</th>            <th>Totale</th>
          </tr>
        </thead>
        <tbody>
{prospettoRighe.map((r, i) => {
  const netto = round2(r.netto);
 const prezzo = money(r.prezzo);
  const tot = money(netto * prezzo);
  return (
    <tr key={i}>      <td>{r.fir}</td>
      <td>{r.cer}</td>      <td>{r.materiale}</td>
      <td>{round2(r.peso)}</td>      <td>{round2(r.calo)}</td>
      <td>{netto}</td>      <td>{prezzo}</td>
      <td>{tot.toFixed(2)}</td>    </tr>  );})}
        </tbody>
      </table>
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={stampaSoloProspetto}>🖨 Stampa</button>
        <button onClick={confermaSalvataggioProspetto}>💾 Salva</button>
        <button onClick={() => setModalProspetto(false)}>❌ Chiudi</button>
      </div>
    </div>
  </div>
)}
{modalData && (
  <div key={reloadKey} style={{
      position: "fixed",      top: 0,      left: 0,      width: "100vw",      height: "100vh",      background: "rgba(0,0,0,0.6)",      display: "flex",      justifyContent: "center",      alignItems: "center",      zIndex: 99999    }}  >
    <div      onClick={(e) => e.stopPropagation()}      style={{        background: "white",        padding: 20,        borderRadius: 10,        width: "80%",        maxHeight: "80vh",        overflowY: "auto",        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"      }}    >
      <h2>        {modalTipo === "prospetto"          ? "📑 Prospetto Fattura"          : "📄 Fattura"}
      </h2>
      <div style={{  marginBottom: "15px",  display: "flex",  gap: "10px",  alignItems: "center",  border: "1px solid #ddd",  padding: "10px",  borderRadius: "6px",  background: "#f9f9f9"}}>
  <label>    📊 Applica listino:    <select      value={listinoApplicato}      onChange={(e) => setListinoApplicato(e.target.value)}    >      <option value="tutti">Nessuno</option>
      {Object.keys(listini)
        .filter(nome => {
          if (modalTipo === "prospetto") {            return listini[nome]?.tipoListino === "SCARICO";          }
          if (modalTipo === "fattura") {            return listini[nome]?.tipoListino === "CARICO";          }
          return true;
        })
        .map(nome => (
          <option key={nome} value={nome}>
            {nome}
          </option>
        ))}
    </select>
  </label>
  <button onClick={async () => {  await applyListino({    movimentiIds: pulitiIds,    listino: listinoApplicato,    db,    collectionName: tipoMovimento === "carico" ? "carichi" : "scarichi"  });
  await fetchMovimenti();      // 🔥 RICARICA DB
  setReloadKey(prev => prev + 1); // 🔥 FORZA RE-RENDER MODAL
}}
  disabled={listinoApplicato === "tutti"} >
    ⚡ Applica
  </button>
</div>
      <p><b>Cliente:</b> {modalData.cliente}</p>
      <table border="1" cellPadding="5" style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>            <th>Materiale</th>            <th>Kg</th>            <th>Prezzo</th>            <th>Totale</th>          </tr>
        </thead>
        <tbody>
{(() => {
  const movs = scarichi.filter(m =>
    modalData.movimentiIds.includes(m.id)
  );
  console.group("🧾 MODAL RENDER DEBUG");
  console.log("modalTipo:", modalTipo);
  console.log("movimentiIds:", modalData.movimentiIds);
  console.log("movimenti trovati:", movs.length);
  movs.forEach(m => {
    console.log("➡️ MOVIMENTO:", {
      id: m.id,
      tipo: m.tipo,
      cerCount: m.cer?.length || 0,
      movimentoFinanziarioId: m.movimentoFinanziarioId
    });
    (m.cer || []).forEach(c => {
      console.log("   FIR:", c.fir);
      console.log("   CER:", c.cer || c.codiceCER);
      console.log("   RIGHE COUNT:", c.righe?.length || 0);
    });
  });
  console.groupEnd();
  return movs;
})()
  .filter(m => {
    if (modalTipo === "prospetto") return m.tipo === "scarico";
    if (modalTipo === "fattura") return m.tipo === "carico";
    return true;
  })
.flatMap(m =>
  (m.cer || []).map(c => {
    const dataDocumento =
      m.dataDocumento ||
      m.dataScarico ||
      m.dataCreazione ||
      m.data ||
      null;

    return {
      fir: c.fir || m.fir || "-",
      cer: c.cer || c.codiceCER || "-",
      tipo: m.tipo,
      dataDocumento, // 🔥 FIX CHIAVE
      righe: c.righe || []
    };
  })
)
  .map((b, i) => (
    <React.Fragment key={i}>
      <tr>
        <td colSpan="4" style={{ background: "#eee", fontWeight: "bold" }}>
          FIR: {b.fir} | CER: {b.cer} | DATA:{" "}
  {b.dataDocumento
    ? new Date(b.dataDocumento).toLocaleDateString("it-IT")
    : "-"}
        </td>
      </tr>
      {b.righe.map((r, j) => {
       const prezzo =
  b.tipo === "scarico"
    ? (r.prezzoAcquisto ?? 0)
    : (r.prezzoVendita ?? 0);
        const tot = money(r.netto * prezzo);
        return (
          <tr key={j}>
            <td>{r.materiale}</td>
            <td>{r.netto}</td>
            <td>{prezzo}</td>
            <td>{tot}</td>
          </tr>
        );
      })}
    </React.Fragment>
  ))}
        </tbody>
      </table>
<h3 style={{ marginTop: 20 }}>
  Totale: {(() => {
    const movs = scarichi
      .filter(m => modalData.movimentiIds.includes(m.id))
      .filter(m => {
        if (modalTipo === "prospetto") return m.tipo === "scarico";
        if (modalTipo === "fattura") return m.tipo === "carico";
        return true;
      });

    return round2(
      movs
        .flatMap(m => m.cer || [])
        .flatMap(c => c.righe || [])
        .reduce((tot, r) => {
          const kg = Number(r.netto || 0);

          // qui NON puoi usare movimento.tipo globale: serve il CER owner
          const prezzo =
            modalTipo === "prospetto"
              ? (r.prezzoAcquisto ?? 0)
              : (r.prezzoVendita ?? 0);

          return tot + kg * prezzo;
        }, 0)
    ).toFixed(2);
  })()}
</h3>
<div style={{ marginTop: 10, marginBottom: 10 }}>
  <div style={{ fontWeight: "bold", marginBottom: 5 }}>
    Salva il movimento pagabile dal:
  </div>
  <DatePicker
    selected={dataSalvataggio}    onChange={(date) => setDataSalvataggio(date)}
    minDate={minDataSalvataggio}    maxDate={new Date()}    dateFormat="dd/MM/yyyy"  />
</div>
      <div style={{ marginTop: 20 }}>
        <button onClick={handleSalvaDocumento}>          💾 Salva        </button>
        <button onClick={handleStampaDocumento} style={{ marginLeft: 10 }}>          🖨️ Stampa        </button>
        <button          onClick={() => setModalData(null)}          style={{ marginLeft: 10 }}        >          ❌ Chiudi        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};
export default GestioneScarichi;