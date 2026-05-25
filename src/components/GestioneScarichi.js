
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
const [modalProspetto, setModalProspetto] = useState(null);
  const [tutti, setTutti] = useState(false);
  const [filtroFornitore, setFiltroFornitore] = useState("tutti");
  const [filtroListino, setFiltroListino] = useState("tutti");
  const [filtroUtente, setFiltroUtente] = useState("tutti");
  const [giornoSelezionato, setGiornoSelezionato] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const forceModalRefresh = () => {
  setReloadKey(prev => prev + 1);
};
  const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const [prospettoRighe, setProspettoRighe] = useState([]);
const [filtroDestinatario, setFiltroDestinatario] = useState("tutti");
  const [fornitoriDisponibili, setFornitoriDisponibili] = useState([]);
  const [listiniDisponibili, setListiniDisponibili] = useState([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState([]);
  const [modalTipo, setModalTipo] = useState(null); 
// "prospetto" | "fattura"
const round2 = (n) => {
  const num = Number(n) || 0;
  return Number(num.toFixed(2));
};
const [modalData, setModalData] = useState(null);
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

  const movimenti = Array.isArray(data[tipo]) ? data[tipo] : [];

  return {
    id: d.id,
    data: parseData(data.data),
    fornitore: data.fornitore || "sconosciuto",
    listino: data.listino || "sconosciuto",
    utente: data.utente || "sconosciuto",
    tipo,

    consuntivato: data.consuntivato === true, // 🔥 AGGIUNTO

    cer: movimenti.map(m => ({
      fir: m.fir || "-",
      cer: m.cer || m.codiceCER || "-",
      righe: m.righe || []
    }))
  };
};
    const scarichi = scarichiSnap.docs.map(d => parseDoc(d, "scarico"));
    const carichi = carichiSnap.docs.map(d => parseDoc(d, "carico"));
    const tuttiMovimenti = [...scarichi, ...carichi];
    tuttiMovimenti.sort((a,b) => b.data - a.data);
    setScarichi(tuttiMovimenti);
    if (tuttiMovimenti.length) {
     const ordinati = [...tuttiMovimenti].sort((a,b) => a.data - b.data);

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

      if (p.DataPagamento) {
        conflittiPagati.push({
          id: d.id,
          collection: col,
          fornitore: p.fornitore,
          dataPagamento: p.DataPagamento,
          overlap,
        });
      } else {
        daEliminare.push({ id: d.id, collection: col });
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
const handleSalvaDocumento = async () => {
  try {
    console.log("🟡 START SALVATAGGIO MODAL:", modalData);

    if (!modalData) {
      alert("❌ Dati modal mancanti");
      return;
    }

    const tipo = modalTipo === "prospetto" ? "prospetto" : "fattura";

    const collectionName =
      tipo === "prospetto" ? "prospettiFattura" : "fattureCarichi";

    const movimentiIds = (modalData.movimentiIds || []).filter(Boolean);

const movimentiSelezionati = scarichi.filter(m =>
  movimentiIds.includes(m.id)
);

// 🔥 SOLO NON CONSUNTIVATI
const validi = movimentiSelezionati.filter(m => !m.consuntivato);

if (validi.length === 0) {
  alert("❌ Tutti i movimenti selezionati sono già consuntivati");
  return;
}

const validiIds = validi.map(m => m.id);

    if (!validiIds.length) {
      alert("❌ Nessun movimento selezionato");
      return;
    }

    console.log("🟡 IDS:", validiIds);

    // 🔥 VALIDAZIONE UNIFICATA (carichi + scarichi)
    try {
      await validaEPreparaProspetto(validiIds);
    } catch (e) {
      console.error("❌ ERRORE VALIDAZIONE:", e);
      alert(
        e.message?.includes("SCARICO_GIA_PAGATO")
          ? "❌ Uno o più movimenti sono già pagati"
          : "❌ Errore validazione prospetto"
      );
      return;
    }

    // 🔥 CALCOLO TOTALE
    let totale = 0;

    (modalData.blocchi || []).forEach((b) => {
      (b.righe || []).forEach((r) => {
       const kg = money(r.netto);
        const prezzo = money(r.prezzo);

totale = round2(totale + round2(kg * prezzo));
      });
    });

    const payload = {
      tipo,
      cliente: modalData.cliente || "",
      totale,
      validiIds,
      blocchi: JSON.parse(JSON.stringify(modalData.blocchi || [])),
      dataCreazione: new Date().toISOString(),
      DataPagamento: null,
    };

    // 🔥 ID STABILE
    const docId = validiIds.slice().sort().join("-");

    console.log("🟡 DOC ID:", docId);

    // 🔥 PULIZIA FINALE SICURA
    const snap = await getDocs(collection(db, collectionName));

    const daEliminare = [];

    snap.docs.forEach((d) => {
      const data = d.data();
      const ids = data.validiIds || [];

      const overlap = ids.some((id) => validiIds.includes(id));

      if (overlap) {
        daEliminare.push(d.id);
      }
    });

    for (const id of daEliminare) {
      console.log("🧹 ELIMINO PROSPETTO CONFLITTUALE:", id);
      await deleteDoc(doc(db, collectionName, id));
    }

    await setDoc(doc(db, collectionName, docId), payload, { merge: true });

    console.log("🟢 SALVATO OK:", docId);

    alert("✅ Documento salvato correttamente");
    setModalData(null);
  } catch (err) {
    console.error("❌ ERRORE SALVATAGGIO:", err);
    alert("❌ Errore salvataggio (controlla console)");
  }
};
const salvaProspettoUnificato = async (modalData, tipo) => {
  const scarichiIds = modalData.movimentiIds || [];

  if (!scarichiIds.length) {
    throw new Error("Nessun movimento selezionato");
  }

  // 🔥 1. pulizia centrale
  await validaEPreparaProspetto(scarichiIds);

 let totale = 0;

(modalData.blocchi || []).forEach(b => {
  (b.righe || []).forEach(r => {
   const kg = money(r.netto);
    const prezzo = money(r.prezzo);

    totale += round2(kg * prezzo);
  });
});

totale = round2(totale);

  // 🔥 3. scrittura unica
  const collectionName =
    tipo === "prospetto" ? "prospetti" : "fattureCarichi";

  return addDoc(collection(db, collectionName), {
    tipo,
    cliente: modalData.cliente,
    totale,
    movimentiIds: scarichiIds,
    blocchi: modalData.blocchi,
    dataCreazione: new Date().toISOString(),
    DataPagamento: null
  });
};

const handleStampaDocumento = async () => {
  const isFattura = modalTipo === "fattura";

  const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
  const config = snap.exists() ? snap.data() : {};

  const win = window.open("", "_blank");

  // 🔥 USA SEMPRE DATI FRESCHI DALLO STATE
  const movimenti = scarichi.filter(m =>
    modalData.movimentiIds.includes(m.id)
  );

  let totale = 0;

  const htmlHeader = `
  <html>
  <head>
    <title>${isFattura ? "FATTURA" : "PROSPETTO FATTURA"}</title>
    <style>
      body { font-family: Arial; padding: 25px; color:#000; }
      .header { display:flex; justify-content:space-between; margin-bottom:20px; }
      .azienda { font-size:12px; line-height:1.4; }
      .titolo { text-align:right; }
      .titolo h1 { margin:0; font-size:20px; }
      .cliente { margin:15px 0; font-size:14px; }
      table { width:100%; border-collapse:collapse; margin-bottom:15px; }
      th, td { border:1px solid #000; padding:6px; font-size:12px; }
      th { background:#eee; }
      .fir { background:#ddd; font-weight:bold; }
      .totale { text-align:right; font-size:18px; margin-top:20px; }
    </style>
  </head>
  <body>

    <div class="header">
      <div class="azienda">
        ${config.logoBase64 ? `
          <img src="data:image/png;base64,${config.logoBase64}" style="width:120px;margin-bottom:10px;" />
        ` : ""}
        <div><b>${config.ragioneSociale || ""}</b></div>
        <div>${config.indirizzo || ""}</div>
        <div>${config.capCitta || ""}</div>
        <div>P.IVA: ${config.piva || ""}</div>
      </div>

      <div class="titolo">
        <h1>${isFattura ? "FATTURA CARICHI" : "PROSPETTO FATTURA"}</h1>
        <div>${new Date().toLocaleDateString("it-IT")}</div>
      </div>
    </div>

    <div class="cliente">
      <b>Cliente:</b> ${modalData.cliente}
    </div>
  `;

  let body = "";

  movimenti.forEach(m => {
    (m.cer || []).forEach(c => {
      const fir = c.fir || "-";
      const cer = c.cer || "-";

      body += `
        <table>
          <tr class="fir">
            <td colspan="4">FIR: ${fir} | CER: ${cer}</td>
          </tr>
          <tr>
            <th>Materiale</th>
            <th>Kg</th>
            <th>Prezzo</th>
            <th>Totale</th>
          </tr>
      `;

      (c.righe || []).forEach(r => {
        const kg = Number(r.netto || 0);

        // 🔥 QUESTO È IL PUNTO CRITICO
        const prezzo =
          isFattura
            ? Number(r.prezzoVendita || 0)
            : Number(r.prezzoAcquisto || 0);

        const tot = kg * prezzo;
        totale += tot;

        body += `
          <tr>
            <td>${r.materiale || "-"}</td>
            <td>${kg.toFixed(2)}</td>
            <td>${prezzo.toFixed(2)}</td>
            <td>${tot.toFixed(2)}</td>
          </tr>
        `;
      });

      body += `</table>`;
    });
  });

  body += `
    <div class="totale">
      <b>TOTALE: € ${totale.toFixed(2)}</b>
    </div>
  </body>
  </html>
  `;

  win.document.write(htmlHeader + body);
  win.document.close();
  win.print();
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
 if (tipoMovimento !== "tutti") {
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
  pdf.save(`prospetto_${(fornitore || "cliente").replace(/[^a-z0-9]/gi, "_")}.pdf`);
};
const righePerGiorno = Object.keys(scarichiPerGiorno).map(giornoIT => {
  const movimentiDelGiorno = scarichiPerGiorno[giornoIT];

  const safe = (v) => Number(v) || 0;

  const tuttiCer = movimentiDelGiorno.flatMap(s =>
    (s.cer || []).map(cer => ({
      fir: cer.fir || "-",
      cer: cer.cer || cer.codiceCER || "-",
      tipo: cer.tipo ?? s.tipo,
      listino: s.listino,
      consuntivato: s.consuntivato === true, // 🔥 AGGIUNTO

      righe: (cer.righe || []).map(r => ({
        ...r,
        fir: cer.fir || "-",
        cer: cer.cer || cer.codiceCER || "-",
        materiale: r.materiale,
        netto: r.netto || 0,
        prezzoAcquisto: r.prezzoAcquisto || 0,
        prezzoVendita: r.prezzoVendita || 0,
      }))
    }))
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

  // 🔥 CONSUNTIVATI LOGIC
  const totaleMovimenti = movimentiDelGiorno.length;
  const consuntivati = movimentiDelGiorno.filter(m => m.consuntivato).length;
  const hasConsuntivati = consuntivati > 0;

  let backgroundColor = "";
  let textColor = "#000";

  if (hasConsuntivati) {
    backgroundColor = "#FFF59D"; // GIALLO
  } else if (nrMovimentiScarico > 0 && nrMovimentiCarico > 0) {
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

    // 🔥 NUOVO
    tooltip: hasConsuntivati
      ? `In questo giorno esistono movimenti ${totaleMovimenti}, i già contabilizzati sono ${consuntivati}`
      : ""
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
  if (listinoApplicato === "tutti") return;
  const listino = listini[listinoApplicato];
  if (!listino) return;
  const tipo = tipoMovimento; // 🔥 scarico o carico
  if (!window.confirm(`Applicare il listino ${tipo.toUpperCase()} ai dati filtrati?`)) return;
  try {
    for (const m of filteredScarichi) {
      if (m.tipo !== tipo) continue;
      const collectionName = tipo === "scarico" ? "scarichi" : "carichi";
      const ref = doc(db, collectionName, m.id);
      const nuoviBlocchi = (m.cer || []).map(blocco => {
        const nuoveRighe = (blocco.righe || []).map(r => {
          const prezzi = listino.prezzi?.[r.materiale];
          if (!prezzi) return r;
          return {
            ...r,
            prezzoAcquisto: tipo === "scarico"
              ? (prezzi.acquisto ?? r.prezzoAcquisto)
              : r.prezzoAcquisto,

            prezzoVendita: tipo === "carico"
              ? (prezzi.vendita ?? r.prezzoVendita)
              : r.prezzoVendita
          };
        });
        return {
          ...blocco,
          righe: nuoveRighe
        };
      });
      await updateDoc(ref, {
        [tipo]: nuoviBlocchi, // 🔥 dinamico
        listino: listinoApplicato,
        lastUpdate: new Date()
      });
    }
await fetchMovimenti();

// 🔥 aggiorna solo UI + cache modale
forceModalRefresh();

//alert(`✅ Listino ${tipo.toUpperCase()} applicato`);
  } catch (err) {
    console.error(err);
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
  (t, r) => t + round2(round2(r.prezzoAcquisto) * round2(r.netto)),
  0
);
const ricavo = righe.reduce(
  (t, r) => t + round2(round2(r.prezzoVendita) * round2(r.netto)),
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
      g.dettagli.push({        ora: formatHour(dataObj),        controparte,        fir: cer.fir || "-",        peso,        costo,        ricavo,        utente,        tipo,      });    });
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
  pdf.save("movimenti.pdf");
};
const confermaSalvataggioProspetto = async () => {
  setModalProspetto(false);
 await salvaProspettoUnificato(modalData, modalTipo === "prospetto" ? "prospetto" : "fattura");
};
const stampaSoloProspetto = () => {
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
  setDal(minDate);
  setAl(maxDate);
};
const estimated = estimateResults();
const traffic = getTrafficLight(estimated);
const movimentiSelezionati = scarichi.filter(m =>
  m.fornitore === filtroFornitore &&
  m.tipo === tipoMovimento
);

// 🔥 esiste almeno un movimento NON consuntivato?
const hasValidi = movimentiSelezionati.some(m => !m.consuntivato);

// 🔥 se non ci sono movimenti o solo consuntivati → blocca
const bottoneDisabilitato =
  filtroFornitore === "tutti" || !hasValidi;
  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
<button
  disabled={bottoneDisabilitato}
  style={{
    marginLeft: 10,
    opacity: bottoneDisabilitato ? 0.4 : 1,
    cursor: bottoneDisabilitato ? "not-allowed" : "pointer"
  }}
  onClick={() => {
    if (bottoneDisabilitato) return;

    const movimenti = filteredScarichi.filter(
      m =>
        m.fornitore === filtroFornitore &&
        m.tipo === tipoMovimento &&
        !m.consuntivato // 🔥 sicurezza extra
    );

    if (!movimenti.length) {
      alert("❌ Nessun movimento valido (già consuntivato)");
      return;
    }

    const blocchi = [];
    let totale = 0;

    movimenti.forEach(m => {
      (m.cer || []).forEach(c => {
        const righe = (c.righe || []).map(r => {
          const netto = Number(r.netto || 0);

          const prezzo =
            tipoMovimento === "scarico"
              ? Number(r.prezzoAcquisto || 0)
              : Number(r.prezzoVendita || 0);

          const tot = money(netto * prezzo);
          totale += tot;

          return {
            materiale: r.materiale,
            netto,
            prezzo,
            totale: tot
          };
        });

        blocchi.push({
          fir: c.fir || m.fir || "N/D",
          data: m.data,
          cer: c.cer || c.codiceCER || "-",
          righe
        });
      });
    });

    setModalTipo(tipoMovimento === "scarico" ? "prospetto" : "fattura");

    setModalData({
      cliente: filtroFornitore,
      blocchi,
      movimentiIds: movimenti.map(m => m.id)
    });
  }}
>
  {tipoMovimento === "carico"
    ? "📄 Emetti Fattura"
    : tipoMovimento === "scarico"
      ? "📑 Prospetto Fattura"
      : "📄 Documento"}
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
/>   Disabilita filtro date        </label>
       {!tutti && (
  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
    <label>
  Dal:
  <DatePicker
    selected={dal}
    onChange={(date) => setDal(date)}
    minDate={minDataDB || new Date(2000,0,1)}
    maxDate={maxDataDB || new Date()}
    dateFormat="dd/MM/yyyy"
    placeholderText="gg/mm/yyyy"
  />
</label>
<label>  Al:  <DatePicker
    selected={al}
    onChange={(date) => setAl(date)}
    minDate={dal instanceof Date ? dal : minDataDB || new Date(2000,0,1)}
   maxDate={maxDataDB || new Date()}
    dateFormat="dd/MM/yyyy"
    placeholderText="gg/mm/yyyy"
  />
</label>
<label style={{ display: "flex", alignItems: "center", gap: "4px" }}>  FIR/DDT:
  <input
    type="text"
    placeholder="Scrivi per filtrare..."
    value={filtroFIR}
    onChange={e => setFiltroFIR(e.target.value)}
    style={{ padding: "4px 6px", width: "150px" }}
  />
</label>
 <label style={{ marginLeft: "12px" }}>          Codice CER:
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
        <label style={{marginLeft:"12px"}}>  Tipo:
  <select value={tipoMovimento} onChange={e => setTipoMovimento(e.target.value)}>
    <option value="tutti">Tutti</option>
    <option value="scarico">Scarico</option>
    <option value="carico">Carico</option>
  </select>
</label>
      </div>

{/* SEMAFORO RISULTATI */}
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
{modalProspetto && (
  <div style={{
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  }}>
    <div style={{
      background: "white",
      padding: 20,
      borderRadius: 10,
      width: "80%",
      maxHeight: "80vh",
      overflow: "auto"
    }}>
      <h3>Prospetto Fattura</h3>
      <table border="1" cellPadding="5" style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>
            <th>FIR</th>
            <th>CER</th>
            <th>Materiale</th>
            <th>Kg</th>
            <th>Calo</th>
            <th>Netto</th>
            <th>€/Kg</th>
            <th>Totale</th>
          </tr>
        </thead>
        <tbody>
{prospettoRighe.map((r, i) => {
  const netto = round2(r.netto);
 const prezzo = money(r.prezzo);


  const tot = money(netto * prezzo);

  return (
    <tr key={i}>
      <td>{r.fir}</td>
      <td>{r.cer}</td>
      <td>{r.materiale}</td>
      <td>{round2(r.peso)}</td>
      <td>{round2(r.calo)}</td>
      <td>{netto}</td>
      <td>{prezzo}</td>
      <td>{tot.toFixed(2)}</td>
    </tr>
  );
})}
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
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 99999
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "white",
        padding: 20,
        borderRadius: 10,
        width: "80%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
      }}
    >
      <h2>
        {modalTipo === "prospetto"
          ? "📑 Prospetto Fattura"
          : "📄 Fattura"}
      </h2>
      <div style={{
  marginBottom: "15px",
  display: "flex",
  gap: "10px",
  alignItems: "center",
  border: "1px solid #ddd",
  padding: "10px",
  borderRadius: "6px",
  background: "#f9f9f9"
}}>

  <label>
    📊 Applica listino:
    <select
      value={listinoApplicato}
      onChange={(e) => setListinoApplicato(e.target.value)}
    >
      <option value="tutti">Nessuno</option>

      {Object.keys(listini)
        .filter(nome => {
          if (modalTipo === "prospetto") {
            return listini[nome]?.tipoListino === "SCARICO";
          }
          if (modalTipo === "fattura") {
            return listini[nome]?.tipoListino === "CARICO";
          }
          return true;
        })
        .map(nome => (
          <option key={nome} value={nome}>
            {nome}
          </option>
        ))}
    </select>
  </label>

  <button
    onClick={() => applyListino()}
    disabled={listinoApplicato === "tutti"}
  >
    ⚡ Applica
  </button>

</div>
      <p><b>Cliente:</b> {modalData.cliente}</p>
      <table border="1" cellPadding="5" style={{ width: "100%", marginTop: 10 }}>
        <thead>
          <tr>
            <th>Materiale</th>
            <th>Kg</th>
            <th>Prezzo</th>
            <th>Totale</th>
          </tr>
        </thead>
        <tbody>
{scarichi
  .filter(m => modalData.movimentiIds.includes(m.id))
  .flatMap(m => m.cer.map(c => ({
    fir: c.fir || m.fir || "-",
    cer: c.cer || c.codiceCER || "-",
    righe: c.righe || []
  })))
  .map((b, i) => (
    <React.Fragment key={i}>
      <tr>
        <td colSpan="4" style={{ background: "#eee", fontWeight: "bold" }}>
          FIR: {b.fir} | CER: {b.cer}
        </td>
      </tr>

      {b.righe.map((r, j) => {
        const prezzo =
          tipoMovimento === "scarico"
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
  Totale: {round2(
    (scarichi
      .filter(m => modalData.movimentiIds.includes(m.id))
      .flatMap(m => m.cer)
      .flatMap(c => (c.righe || []))
      .reduce((tot, r) => {
        const kg = Number(r.netto || 0);
        const prezzo =
          tipoMovimento === "scarico"
            ? Number(r.prezzoAcquisto || 0)
            : Number(r.prezzoVendita || 0);

        return tot + (kg * prezzo);
      }, 0)
    )
  ).toFixed(2)}
</h3>
      <div style={{ marginTop: 20 }}>
        <button onClick={handleSalvaDocumento}>
          💾 Salva
        </button>
        <button onClick={handleStampaDocumento} style={{ marginLeft: 10 }}>
          🖨️ Stampa
        </button>
        <button
          onClick={() => setModalData(null)}
          style={{ marginLeft: 10 }}
        >
          ❌ Chiudi
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};
export default GestioneScarichi;