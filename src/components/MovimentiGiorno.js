// src/components/MovimentiGiorno.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { collection, getDocs, updateDoc, doc, getDoc, deleteDoc, addDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { scriviLog } from "../utils/log"; 
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
const MovimentiGiorno = () => {
  const navigate = useNavigate();
  const routerLocation  = useLocation();
const [anagraficaMov, setAnagraficaMov] = useState([]);
  const currentUser =
    JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const [contItem, setContItem] = useState(null);
const [occList, setOccList] = useState([]);
const [showModal, setShowModal] = useState(false);
const [loadingBulk, setLoadingBulk] = useState(false);
const [showContabilizza, setShowContabilizza] = useState(false);
  const [giornoAvviamento, setGiornoAvviamento] = useState(null);
const [movFin, setMovFin] = useState([]);
const [mapFatture, setMapFatture] = useState({});
const [mapProspetti, setMapProspetti] = useState({});
const [mapScarichi, setMapScarichi] = useState({});
const [globalLoading, setGlobalLoading] = useState(false);
  const [carichiScarichi, setCarichiScarichi] = useState([]);
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
const formatDate = (d) => {
  if (!d) return "-";
  const date = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("it-IT");
};
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
        if (snap.exists()) {
          const data = snap.data();
          setGiornoAvviamento(
            data.giornoAvviamento ? new Date(data.giornoAvviamento) : null
          );
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchConfig();
  }, []);
  
useEffect(() => {
  const fetchAll = async () => {
    try {
      const [
        finSnap,
        fattureSnap,
        prospettiSnap,
        scarichiSnap
      ] = await Promise.all([
        getDocs(collection(db, "MovimentoFinanziario")),
        getDocs(collection(db, "fattureCarichi")),
        getDocs(collection(db, "prospettiFattura")),
        getDocs(collection(db, "scarichi"))
      ]);
const anagraficaSnap = await getDocs(collection(db, "AnagraficaMovimentoFinanziario"));
const anagrafica = anagraficaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
setAnagraficaMov(anagrafica);      
const fin = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const fattureMap = {};
      fattureSnap.docs.forEach(d => {
        fattureMap[d.id] = { id: d.id, ...d.data() };
      });
      const prospettiMap = {};
      prospettiSnap.docs.forEach(d => {
        prospettiMap[d.id] = { id: d.id, ...d.data() };
      });
      const scarichiMap = {};
      scarichiSnap.docs.forEach(d => {
        scarichiMap[d.id] = { id: d.id, ...d.data() };
      });
      setMovFin(fin);
      setMapFatture(fattureMap);
      setMapProspetti(prospettiMap);
      setMapScarichi(scarichiMap);
    } catch (err) {
      console.error(err);
    }
  };
  fetchAll();
}, []);
const runSafe = async (fn) => {
  if (globalLoading) return; // 🔥 blocca doppio click
  setGlobalLoading(true);
  try {
    await fn();
    await refreshAll();
  } finally {
    setGlobalLoading(false);
  }
};
const refreshAll = async () => {
  const [
    finSnap,
    fattureSnap,
    prospettiSnap,
    scarichiSnap
  ] = await Promise.all([
    getDocs(collection(db, "MovimentoFinanziario")),
    getDocs(collection(db, "fattureCarichi")),
    getDocs(collection(db, "prospettiFattura")),
    getDocs(collection(db, "scarichi"))
  ]);
  const fin = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const fattureMap = {};
  fattureSnap.docs.forEach(d => {
    fattureMap[d.id] = { id: d.id, ...d.data() };
  });
  const prospettiMap = {};
  prospettiSnap.docs.forEach(d => {
    prospettiMap[d.id] = { id: d.id, ...d.data() };
  });
  const scarichiMap = {};
  scarichiSnap.docs.forEach(d => {
    scarichiMap[d.id] = { id: d.id, ...d.data() };
  });
  setMovFin(fin);
  setMapFatture(fattureMap);
  setMapProspetti(prospettiMap);
  setMapScarichi(scarichiMap);
};
   const isSameDay = (a, b) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };
const [selectedDate, setSelectedDate] = useState(
  routerLocation.state?.date ? new Date(routerLocation.state.date) : new Date()
);
const endOfDay = new Date(selectedDate);
endOfDay.setHours(23, 59, 59, 999);
const ALLOWED_TYPES = new Set([
  "fattureCarichi",
  "prospettiFattura",
  "PRIVATI"
]);
const rows = movFin
  .filter(m => isSameDay(m.data, selectedDate))
  .filter(m => ALLOWED_TYPES.has(m.tipo)) // 🔥 FILTRO CHIAVE
  .map(m => {
    let controparte = "";
    if (m.tipo === "fattureCarichi") {
      controparte = mapFatture[m.anagraficaId]?.cliente || "FATTURA";
    }
    if (m.tipo === "prospettiFattura") {
      controparte = mapProspetti[m.anagraficaId]?.cliente || "PROSPETTO";
    }
    if (m.tipo === "PRIVATI") {
      controparte = "FORNITORE PRIVATO";
    }
    return {
      id: m.id, // ID MovimentoFinanziario
      anagraficaId: m.anagraficaId, // 🔥 QUESTO È IL FIX
      tipo: m.tipo,
      controparte,
      dataMov: toDate(m.dataDocumento ?? m.data),
      importo: m.importo
    };
  });
const daConsuntivare = [];
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const canGoPrev = () => {
  if (!giornoAvviamento) return true;
  const prev = addDays(selectedDate, -1);
  return prev >= new Date(giornoAvviamento);
};

const goPrevDay = () => {
  if (!canGoPrev()) return;
  setSelectedDate(prev => addDays(prev, -1));
};

const goNextDay = () => {
  setSelectedDate(prev => addDays(prev, 1));
};
const alreadyConsuntivati = new Set(
  movFin.map(m => {
    const id = m.anagraficaId || m.id;
    return `${m.tipo}_${id}`;
  })
);
Object.values(mapFatture).forEach(f => {
  const data = toDate(f.dataCreazione);
  if (!data) return;
 if (alreadyConsuntivati.has(`fattureCarichi_${f.id}`) || movFin.some(m => m.tipo === "fattureCarichi" && m.anagraficaId === f.id)) return;
  if (!f.DataPagamento && data.getTime() <= endOfDay.getTime()) {
    daConsuntivare.push({
      id: f.id,
      tipo: "fattureCarichi",
      controparte: f.cliente,
      dataMov: data,
      importo: Number(f.totale || 0)
    });
  }
});
Object.values(mapProspetti).forEach(p => {
  const data = toDate(p.dataCreazione);
  if (!data) return;

  if (alreadyConsuntivati.has(`prospettiFattura_${p.id}`)) return;

  if (!p.DataPagamento && data.getTime() <= endOfDay.getTime()) {
    daConsuntivare.push({
      id: p.id,
      tipo: "prospettiFattura",
      controparte: p.cliente,
      dataMov: data,
      importo: Number(p.totale || 0)
    });
  }
});
const scarichiPrivati = Object.values(mapScarichi).filter(s => {
  return (s.fornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO";
});
scarichiPrivati.forEach(s => {
  // 🔥 FIX DUPLICAZIONE: evita reinserimento se già consuntivato
  if (
    alreadyConsuntivati.has(`PRIVATI_${s.id}`) ||
    movFin.some(m => m.tipo === "PRIVATI" && m.anagraficaId === s.id)
  ) {
    return;
  }
   let data = null;
  if (s.data?.seconds) {
    data = new Date(s.data.seconds * 1000);
  } else if (s.data instanceof Date) {
    data = s.data;
  }
  if (!data) return;
  if (data.getTime() > endOfDay.getTime()) return;
  const pagato =
    s.DataPagamento ??
    s.dataPagamento ??
    null;
  if (pagato) return;
  let totale = 0;
  (s.scarico || []).forEach(b => {
    (b.righe || []).forEach(r => {
      totale += (r.netto || 0) * (r.prezzoAcquisto || 0);
    });
  });
  daConsuntivare.push({
    id: s.id,
    tipo: "PRIVATI",
    controparte: "FORNITORE PRIVATO",
    dataMov: data,
    importo: Number(totale.toFixed(2))
  });
});
daConsuntivare.sort((a, b) => a.dataMov - b.dataMov);
  const goDashboard = () => navigate("/admin");
const handlePrintPDF = async () => {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");
  const { pdf, startY } = await PdfHeader();
  let y = startY;
  pdf.setFontSize(14);
  pdf.text("Movimento Giorno", 14, y);
  y += 6;
  pdf.setFontSize(10);
  pdf.text(
    `Giorno: ${new Date(selectedDate).toLocaleDateString("it-IT")}`,
    14,
    y
  );
  y += 8;
  autoTable(pdf, {
    startY: y,
    head: [["CONTROPARTE", "DATA MOVIMENTO", "IMPORTO"]],
    body: rows.map(r => [
      r.controparte,
      toDate(r.dataMov)?.toLocaleDateString("it-IT") || "",
      `${Number(r.importo).toLocaleString("it-IT", {
        minimumFractionDigits: 2
      })} €`
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [39, 174, 96] },
  });
  y = pdf.lastAutoTable.finalY + 6;
  autoTable(pdf, {
    startY: y,
    head: [["CONTROPARTE", "DATA", "IMPORTO"]],
    body: daConsuntivare.map(r => [
      r.controparte,
      new Date(r.dataMov).toLocaleDateString("it-IT"),
      `${Number(r.importo).toLocaleString("it-IT", {
        minimumFractionDigits: 2
      })} €`
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [231, 76, 60] },
  });
  y = pdf.lastAutoTable.finalY + 10;
  const consuntivatiAltri = anagraficaMov
    .map(item => {
      const movs = movFin.filter(m =>
        m.anagraficaId === item.id &&
        isSameDay(m.data, selectedDate)
      );
      if (movs.length === 0) return null;
      const totale = movs.reduce((s, m) => s + (Number(m.importo) || 0), 0);
      return [
        item.nomeBreve,
        item.periodicita,
        `${totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
        movs.length
      ];
    })
    .filter(Boolean);
  autoTable(pdf, {
    startY: y,
    head: [["MOVIMENTO", "FREQUENZA", "€", "CONT."]],
    body: consuntivatiAltri,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [39, 174, 96] },
  });
  y = pdf.lastAutoTable.finalY + 10;
  const daConsAltri = anagraficaMov
    .map(item => {
      const occ = getOccorrenze(item);
      if (!occ.length) return null;
      return [
        item.nomeBreve,
        item.periodicita,
        `${item.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
        occ.length
      ];
    })
    .filter(Boolean);
  autoTable(pdf, {
    startY: y,
    head: [["MOVIMENTO", "FREQUENZA", "€", "CONT."]],
    body: daConsAltri,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [231, 76, 60] },
  });
  y = pdf.lastAutoTable.finalY + 10;
  pdf.setFontSize(10);
  pdf.text(
    `Introiti: ${introitiTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
  y += 5;
  pdf.text(
    `Spese: ${speseTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
  y += 5;
  pdf.text(
    `Guadagno: ${guadagno.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
  y += 8;
  pdf.text(
    `Introiti (Attività): ${introitiAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
  y += 5;
  pdf.text(
    `Spese (Attività): ${speseAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
  y += 5;
  pdf.text(
    `Guadagno (Attività): ${guadagnoAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const totalPages = pdf.getNumberOfPages();
pdf.setPage(totalPages);
pdf.setFontSize(10);
const x = pageWidth - 70;
 y = pageHeight - 20;
pdf.setTextColor(0, 128, 0);
pdf.text("Consuntivati", x, y);
pdf.setTextColor(200, 0, 0);
pdf.text("Da Consuntivare", x, y + 6);
pdf.setTextColor(0, 0, 0);
    const dataSafe = new Date()
    .toLocaleDateString("it-IT")
    .replace(/\//g, "-");
  await salvaESharePdfCapacitor(pdf, `Movimenti_${dataSafe}.pdf`);
};
const handleConsuntiva = async (row) => {
  const ok = window.confirm(`Confermare consuntivazione per ${row.controparte}?`);
  if (!ok) return;
  await runSafe(async () => {
    const movRef = await addDoc(collection(db, "MovimentoFinanziario"), {
      anagraficaId: row.anagraficaId || row.id,
      data: selectedDate,
      dataDocumento: row.dataMov,
      importo: row.importo,
      tipo: row.tipo
    });
    const movimentoId = movRef.id;

    await linkMovimentiAFinanziario(
      row.tipo,
      row.anagraficaId || row.id,
      movimentoId
    );

    if (row.tipo === "fattureCarichi") {
      await updateDoc(doc(db, "fattureCarichi", row.id), {
        movimentoFinanziarioId: movimentoId
      });
    }
    if (row.tipo === "prospettiFattura") {
      await updateDoc(doc(db, "prospettiFattura", row.id), {
        movimentoFinanziarioId: movimentoId
      });
    }
    if (row.tipo === "PRIVATI") {
      await updateDoc(doc(db, "scarichi", row.id), {
        movimentoFinanziarioId: movimentoId
      });
    }
  });
};
const handleDeleteFin = async (row) => {
  const ok = window.confirm(
    `Vuoi rimuovere la consuntivazione di ${row.controparte} di € ${row.importo}`
  );
  if (!ok) return;

  await runSafe(async () => {

await unlinkMovimentiDaFinanziario(row.tipo, row.anagraficaId);
    await deleteDoc(doc(db, "MovimentoFinanziario", row.id));

    // 2️⃣ helper unica per lo storno reverse
    const reverseUnset = async (collectionName) => {
      const snap = await getDocs(collection(db, collectionName));

      const updates = snap.docs
        .filter(d => d.data()?.movimentoFinanziarioId === row.id)
        .map(d =>
          updateDoc(doc(db, collectionName, d.id), {
            movimentoFinanziarioId: null
          })
        );

      await Promise.all(updates);
    };

    // 3️⃣ FATTURE
    if (row.tipo === "fattureCarichi") {
      await reverseUnset("fattureCarichi");
    }

    // 4️⃣ PROSPETTI
    if (row.tipo === "prospettiFattura") {
      await reverseUnset("prospettiFattura");
    }

    // 5️⃣ PRIVATI / SCARICHI
    if (row.tipo === "PRIVATI") {
      await reverseUnset("scarichi");
    }

  });
};
const getDataLimite = (item) => {
  const oggi = new Date();
  const fine = item.dataDisabilitazione?.toDate
    ? item.dataDisabilitazione.toDate()
    : null;
  return fine && fine < oggi ? fine : oggi;
};
const getOccorrenze = (item) => {
  const start = item.createdAt?.toDate
    ? item.createdAt.toDate()
    : new Date(item.createdAt);
  const limite = getDataLimite(item);
    const movsItem = movFin
    .filter(m => String(m.anagraficaId) === String(item.id))
    .map(m => {
      const d = m.dataDocumento?.toDate
        ? m.dataDocumento.toDate()
        : m.dataDocumento
          ? new Date(m.dataDocumento)
          : new Date(m.data);
      return d.toDateString();
    });
  const occ = [];
  let cursor = new Date(start);
  for (let i = 0; i < 500; i++) {
    if (cursor > limite) break;
    const key = cursor.toDateString();
    const alreadyDone = movsItem.includes(key);
    if (!alreadyDone) {
      occ.push({
        data: new Date(cursor),
        importo: item.importo
      });
    }
    switch (item.periodicita) {
      case "GIORNALIERO":
        cursor.setDate(cursor.getDate() + 1);
        break;
      case "SETTIMANALE":
        cursor.setDate(cursor.getDate() + 7);
        break;
      case "MENSILE":
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      case "ANNUALE":
        cursor.setFullYear(cursor.getFullYear() + 1);
        break;
      default:
        i = 999;
    }
  }
  return occ;
};
const isEntrata = (tipo) => {
  return tipo === "fattureCarichi" || tipo === "ENTRATA";
};
const introitiCS = rows
  .filter(r => isEntrata(r.tipo))
  .reduce((s, r) => s + Number(r.importo || 0), 0);
const speseCS = rows
  .filter(r => !isEntrata(r.tipo))
  .reduce((s, r) => s + Number(r.importo || 0), 0);
const altriCons = anagraficaMov.flatMap(item => {
  return movFin
    .filter(m =>
      m.anagraficaId === item.id &&
      isSameDay(m.data, selectedDate)
    )
    .map(m => ({
      tipo: item.tipo,
      importo: Number(m.importo || 0)
    }));
});
const unlinkMovimentiDaFinanziario = async (tipo, anagraficaId) => {
  try {
    let refDoc = null;

    if (tipo === "prospettiFattura") {
      refDoc = doc(db, "prospettiFattura", anagraficaId);
    } else if (tipo === "fattureCarichi") {
      refDoc = doc(db, "fattureCarichi", anagraficaId);
    } else {
      return;
    }

    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;

    const data = snap.data();
    const movimentiIds = data.movimentiIds || [];

    for (const id of movimentiIds) {

      // SCARICHI
      const scaricoRef = doc(db, "scarichi", id);
      const scaricoSnap = await getDoc(scaricoRef);

      if (scaricoSnap.exists()) {
        await updateDoc(scaricoRef, {
          movimentoFinanziarioId: null
        });
        continue;
      }

      // CARICHI
      const caricoRef = doc(db, "carichi", id);
      const caricoSnap = await getDoc(caricoRef);

      if (caricoSnap.exists()) {
        await updateDoc(caricoRef, {
          movimentoFinanziarioId: null
        });
      }
    }

    console.log("✅ UNLINK MOVIMENTI OK");
  } catch (err) {
    console.error("💥 ERRORE UNLINK:", err);
  }
};
const linkMovimentiAFinanziario = async (tipo, anagraficaId, movimentoFinanziarioId) => {
  try {
    let refDoc = null;

    if (tipo === "prospettiFattura") {
      refDoc = doc(db, "prospettiFattura", anagraficaId);
    } else if (tipo === "fattureCarichi") {
      refDoc = doc(db, "fattureCarichi", anagraficaId);
    } else {
      return;
    }

    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;

    const data = snap.data();
    const movimentiIds = data.movimentiIds || [];

    for (const id of movimentiIds) {
      // 🔥 prova prima scarichi
      const scaricoRef = doc(db, "scarichi", id);
      const scaricoSnap = await getDoc(scaricoRef);

      if (scaricoSnap.exists()) {
        await updateDoc(scaricoRef, {
          movimentoFinanziarioId
        });
        continue;
      }

      // 🔥 altrimenti carichi
      const caricoRef = doc(db, "carichi", id);
      const caricoSnap = await getDoc(caricoRef);

      if (caricoSnap.exists()) {
        await updateDoc(caricoRef, {
          movimentoFinanziarioId
        });
      }
    }

    console.log("✅ Movimenti collegati al finanziario");
  } catch (err) {
    console.error("💥 ERRORE LINK MOVIMENTI:", err);
  }
};
const introitiAltri = altriCons
  .filter(m => isEntrata(m.tipo))
  .reduce((s, m) => s + m.importo, 0);
const speseAltri = altriCons
  .filter(m => !isEntrata(m.tipo))
  .reduce((s, m) => s + m.importo, 0);
const introitiTot = introitiCS + introitiAltri;
const speseTot = speseCS + speseAltri;
const guadagno = introitiTot - speseTot;
const introitiCS_Da = daConsuntivare
  .filter(r => isEntrata(r.tipo))
  .reduce((s, r) => s + Number(r.importo || 0), 0);
const speseCS_Da = daConsuntivare
  .filter(r => !isEntrata(r.tipo))
  .reduce((s, r) => s + Number(r.importo || 0), 0);
const altriDa = anagraficaMov.flatMap(item => {
  return getOccorrenze(item).map(o => ({
    tipo: item.tipo,
    importo: Number(item.importo || 0)
  }));
});
const introitiAltri_Da = altriDa
  .filter(m => isEntrata(m.tipo))
  .reduce((s, m) => s + m.importo, 0);
const speseAltri_Da = altriDa
  .filter(m => !isEntrata(m.tipo))
  .reduce((s, m) => s + m.importo, 0);
const introitiAttDaCons = introitiCS_Da + introitiAltri_Da;
const speseAttDaCons = speseCS_Da + speseAltri_Da;
const guadagnoAttDaCons = introitiAttDaCons - speseAttDaCons;
 return (
    <div style={{ padding: 20 }}>
    {globalLoading && (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    color: "white",
    fontSize: 20
  }}>
    ⏳ Operazione in corso...
  </div>
)}
    
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={goDashboard}>🏠 Dashboard</button>
<button onClick={handlePrintPDF}>  🖨️ Stampa PDF</button>
 <button  onClick={() =>  navigate("/MovimentiFinanziari", {  state: { date: selectedDate.toISOString() }})  }>  🔙 Calendario</button>        <button onClick={handleLogout}>          🚪 Logout ({currentUser.username || currentUser.email})        </button>
      </div>      <h2>Movimento Giorno</h2>
<div id="area-stampa">
     <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <button    onClick={goPrevDay}    disabled={!canGoPrev()}>    ⬅️  </button>
  <p style={{ margin: 0 }}>    📅 Giorno:{" "}    <strong>{selectedDate.toLocaleDateString("it-IT")}</strong>  </p>
  <button onClick={goNextDay}>    ➡️  </button></div>
      {giornoAvviamento && (
        <p>          ⚠️ Avvio impianto:{" "}          <strong>{giornoAvviamento.toLocaleDateString("it-IT")}</strong>        </p>
      )}
      <h3>Carichi / Scarichi</h3>
      <div style={{ display: "flex", gap: 20 }}>
        {/* PAGATI */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
          <h4>🟢 Consuntivati</h4>
 <table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>    <tr>      <th>CONTROPARTE</th>      <th>DATA MOVIMENTO</th>      <th>IMPORTO</th> <th>Tipo</th>   </tr>  </thead>
  <tbody>
    {rows.map((r, i) => {      const isEntrata =        r.tipo === "ENTRATA" || r.tipo === "fattureCarichi";
      return (
        <tr
          key={i}
          onDoubleClick={() => handleDeleteFin(r)}
          title={`effettua doppio click per Stornare il movimento ${r.controparte} di ${r.importo.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €`}
          style={{
            background: isEntrata ? "green" : "red",
            color: "white",
            cursor: "pointer"
          }}
        >
          <td>{r.controparte}</td>          <td>            {toDate(r.dataMov)?.toLocaleDateString("it-IT") || ""}          </td>          <td>
  {r.importo.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €
</td><td>{r.tipo}</td>
        </tr>
      );
    })}  </tbody></table>
        </div>
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
<h4>🔴 Da Consuntivare</h4>
<table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>    <tr>      <th>CONTROPARTE</th>      <th>DATA</th>      <th>IMPORTO</th> <th>Tipo</th>    </tr> </thead>
  <tbody>
    {daConsuntivare.map((r, i) => {
      const isEntrata =
        r.tipo === "fattureCarichi";
      return (
        <tr
          key={i}
          onClick={() => handleConsuntiva(r)}
          title={`effettua un click per consuntivare il movimento ${r.controparte} di ${r.importo.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €`}
          style={{
            background: isEntrata ? "#d4edda" : "#f8d7da",
            cursor: "pointer"
          }}
        >
          <td>{r.controparte}</td>
          <td>
            {new Date(r.dataMov).toLocaleDateString("it-IT")}
          </td>
          <td>
  {r.importo.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €
</td><td>{r.tipo}</td>
        </tr>
      );
    })}
  </tbody>
</table>
        </div>
      </div>
<h3 style={{ marginTop: 40 }}>Altri Movimenti</h3>
<div style={{ display: "flex", gap: 20 }}>
<div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
    <h4>🟢 Consuntivati</h4>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>        <tr>          <th>MOVIMENTO</th>          <th>FREQUENZA</th>          <th>€</th>          <th>CONT.</th>     <th>Tipo</th>   </tr>      </thead>
      <tbody>
  {anagraficaMov.map(item => {

 const movs = movFin.filter(m =>
  m.anagraficaId === item.id &&
  isSameDay(m.data, selectedDate)
).map(m => ({
  id: m.id,
 data: toDate(m.dataDocumento ?? m.data),
  importo: m.importo,
  tipo: m.tipo
}));
  if (movs.length === 0) return null;
const totale = movs.reduce((s, m) => s + (Number(m.importo) || 0), 0);

  return (
    
    <tr
  key={item.id}
  onDoubleClick={() => {
    if (movs.length === 0) return;
    setContItem(item);
    setOccList(
  [...movs].sort((a, b) => {
    const da = a.data ? new Date(a.data) : new Date(0);
    const db = b.data ? new Date(b.data) : new Date(0);
    return da - db;
  })
);
    setShowContabilizza(true);
  }}
   title={`effettua doppio click per Stornare il movimento ${item.nomeBreve} di ${totale.toLocaleString("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})} €`}
  style={{
        background: item.tipo === "ENTRATA" ? "#d4edda" : "#f8d7da"
      }}
    >
      <td>{item.nomeBreve}</td>      <td>{item.periodicita}</td>     <td>  {movs
    .reduce((sum, m) => sum + (Number(m.importo) || 0), 0)
    .toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} €</td>
      <td>{movs.length}</td>
      <td>{item.tipo}</td>
    </tr>
  );
})}
      </tbody>
    </table>
  </div>
  <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
    <h4>🔴 Da Consuntivare</h4>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>          <th>MOVIMENTO</th>          <th>FREQUENZA</th>          <th>€</th>          <th>CONT.</th>    <th>Tipo</th>    </tr>
      </thead>
      <tbody>
        {anagraficaMov.map(item => {
          const occ = getOccorrenze(item);
          if (occ.length === 0) return null;
          return (
            <tr
              key={item.id}
              onClick={() => {
  setContItem(item);
  setOccList(getOccorrenze(item));
  setShowModal(true);
}}
 title={`effettua un click per consuntivare il movimento ${item.nomeBreve} di ${item.importo}`}
              style={{
                background: item.tipo === "ENTRATA" ? "#d4edda" : "#f8d7da",
                cursor: "pointer"
              }}
            >
              <td>{item.nomeBreve}</td>
              <td>{item.periodicita}</td>
              <td>{item.importo} €</td>
              <td>{occ.length}</td>
              <td>{item.tipo}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>

</div>

   

      {/* FOOTER */}
      <div style={{ marginTop: 40 }}>
        <h4>📊 Riepilogo Giorno</h4>
      <p>Introiti: {introitiTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
<p>Spese: {speseTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
<p>Guadagno: {guadagno.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>

<h4>📌 Da Consuntivare (Attività)</h4>
<p>Introiti: {introitiAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
<p>Spese: {speseAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
<p>Guadagno: {guadagnoAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>

      </div>


      
      {showModal && contItem && (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999
  }}>
    <div style={{
      background: "#fff",
      padding: 20,
      minWidth: 450,
      maxHeight: "80vh",
      overflowY: "auto"
    }}>

      <h3>{contItem.nomeBreve}</h3>

      <div style={{ marginBottom: 10 }}>
        Occorrenze: <b>{occList.length}</b>
      </div>

      <button onClick={() => {
        setShowModal(false);
        setContItem(null);
        setOccList([]);
      }}>
        Chiudi
      </button>

      {/* BULK */}
      <button
        style={{
          marginLeft: 10,
          background: contItem.tipo === "ENTRATA" ? "#27ae60" : "#c0392b",
          color: "white"
        }}
        disabled={loadingBulk}
onClick={async () => {
  const ok = window.confirm("Confermi consuntivazione totale?");
  if (!ok) return;

  await runSafe(async () => {
    for (const o of occList) {
      await addDoc(collection(db, "MovimentoFinanziario"), {
        anagraficaId: contItem.id,
        data: selectedDate,
        dataDocumento: o.data,
        importo: contItem.importo,
        tipo: contItem.tipo
      });
    }
  });
await scriviLog({
  pagina: "movimenti-giorno",
  evento: "CONTABILIZZAZIONE_MASSIVA",

  riferimento: {
    anagraficaId: contItem.id
  },

  before: null,

  after: {
    dataInizio: formatDate(occList[0]?.data),
    dataFine: formatDate(occList[occList.length - 1]?.data),
    importoSingolo: contItem.importo,
    numeroOperazioni: occList.length,
    importoTotale: contItem.importo * occList.length,
    descrizione: contItem.nomeBreve
  },

  utente: currentUser.username || currentUser.email,
  ripristinabile: false
});
  setShowModal(false);
  setContItem(null);
  setOccList([]);
}}
      >
        CONSUNTIVA TUTTO
      </button>

      {/* LISTA */}
      {occList.map((o, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: 6,
          borderBottom: "1px solid #eee"
        }}>
          <span>{toDate(o.data)?.toLocaleDateString("it-IT") || ""}</span>
          <span>{o.importo} €</span>

          <button
            onClick={async () => {
              const ok = window.confirm("Confermi consuntivazione?");
              if (!ok) return;

              await addDoc(collection(db, "MovimentoFinanziario"), {
                anagraficaId: contItem.id,
                data: selectedDate,
                dataDocumento: o.data,
                importo: contItem.importo,
                tipo: contItem.tipo
              });

              setOccList(prev => {
                const next = prev.filter(x =>
                  x.data.toDateString() !== o.data.toDateString()
                );

                if (next.length === 0) {
                  setShowModal(false);
                  setContItem(null);
                }

                return next;
              });
await scriviLog({
  pagina: "movimenti-giorno",
  evento: "CONTABILIZZA_SINGOLO",

  

  before: null,

  after: {
    data: formatDate(selectedDate),
    dataDocumento: formatDate(o.data),
    importo: contItem.importo,
    descrizione: contItem.nomeBreve
  },

  utente: currentUser.username || currentUser.email,
  ripristinabile: false
});
//console.log("🔥 contItem SELECTED:", contItem);
              await refreshAll();
            }}
          >
            Consuntiva
          </button>

        </div>
      ))}

    </div>
  </div>
)}
{showContabilizza && contItem && (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999
  }}>
    <div style={{
      background: "#fff",
      padding: 20,
      minWidth: 450,
      maxHeight: "80vh",
      overflowY: "auto"
    }}>

      <h3>{contItem.nomeBreve}</h3>

      <div style={{ marginBottom: 10 }}>
        🔄 STORNO MOVIMENTI — Elementi: <b>{occList.length}</b>
      </div>

      <button onClick={() => {
        setShowContabilizza(false);
        setContItem(null);
        setOccList([]);
      }}>
        Chiudi
      </button>

      {/* BULK STORNO */}
      <button
        style={{
          marginLeft: 10,
          background: "#f39c12",
          color: "white"
        }}
        disabled={loadingBulk}
onClick={async () => {
  const ok = window.confirm("Confermi STORNO TOTALE?");
  if (!ok) return;

  await runSafe(async () => {
    for (const o of occList) {
      await deleteDoc(doc(db, "MovimentoFinanziario", o.id));
    }
  });
await scriviLog({
  pagina: "movimenti-giorno",
  evento: "STORNO_MASSIVO",

  riferimento: {
    anagraficaId: contItem.id
  },

  before: {
    dataInizio: formatDate(occList[0]?.data),
    dataFine: formatDate(occList[occList.length - 1]?.data),
    numeroOperazioni: occList.length,
    importoTotale: contItem.importo*occList.length,
     importoSingolo: contItem.importo,
  },

  after: null,

  utente: currentUser.username || currentUser.email,
  ripristinabile: false
});
  setShowContabilizza(false);
  setContItem(null);
  setOccList([]);
}}
      >
        🔄 STORNA TUTTO
      </button>

      {/* LISTA */}
      {occList.map((o, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: 6,
          borderBottom: "1px solid #eee"
        }}>
          <span>{toDate(o.data)?.toLocaleDateString("it-IT") || ""}</span>
          <span>{Number(o.importo).toFixed(2)} €</span>

          <button
            onClick={async () => {
              const ok = window.confirm("Confermi STORNO?");
              if (!ok) return;

              await deleteDoc(doc(db, "MovimentoFinanziario", o.id));

              setOccList(prev => {
                const next = prev.filter(x => x.id !== o.id);

                if (next.length === 0) {
                  setShowContabilizza(false);
                  setContItem(null);
                }

                return next;
              });
await scriviLog({
  pagina: "movimenti-giorno",
  evento: "STORNO_SINGOLO",

  riferimento: {
    anagraficaId: contItem.id,
    movimentoId: o.id
  },

  before: {
    dataDocumento: formatDate(o.data),
    importo: o.importo
  },

  after: null,

  utente: currentUser.username || currentUser.email,
  ripristinabile: false
});
console.log('log: ',o);
              await refreshAll();
            }}
          >
            STORNA
          </button>

        </div>
      ))}

    </div>
  </div>
)}
   </div> {/* FINE area-stampa */}
  </div>
  );
};


export default MovimentiGiorno;