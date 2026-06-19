// src/components/MovimentiGiorno.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { collection, getDocs, updateDoc, doc, getDoc, deleteDoc, addDoc, onSnapshot } from "firebase/firestore";
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
  const unsubFin = onSnapshot(collection(db, "MovimentoFinanziario"), (snap) => {
    console.log("🟦 SNAP MovimentoFinanziario — numero documenti:", snap.docs.length);
    console.log("🟦 Documenti:", snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setMovFin(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  const unsubFatture = onSnapshot(collection(db, "fattureCarichi"), (snap) => {
    const map = {};
    snap.docs.forEach(d => map[d.id] = { id: d.id, ...d.data() });
    setMapFatture(map);
  });

  const unsubProspetti = onSnapshot(collection(db, "prospettiFattura"), (snap) => {
    const map = {};
    snap.docs.forEach(d => map[d.id] = { id: d.id, ...d.data() });
    setMapProspetti(map);
  });

  const unsubScarichi = onSnapshot(collection(db, "scarichi"), (snap) => {
    const map = {};
    snap.docs.forEach(d => map[d.id] = { id: d.id, ...d.data() });
    setMapScarichi(map);
  });

  const unsubAnagrafica = onSnapshot(collection(db, "AnagraficaMovimentoFinanziario"), (snap) => {
    setAnagraficaMov(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  return () => {
    unsubFin();
    unsubFatture();
    unsubProspetti();
    unsubScarichi();
    unsubAnagrafica();
  };
}, []);


const runSafe = async (fn) => {
  if (globalLoading) return;
  setGlobalLoading(true);
  try {
    await fn();
  } finally {
    setGlobalLoading(false);
  }
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

useEffect(() => {
  // forza un re-render quando cambia la data
  setCarichiScarichi([...carichiScarichi]);
}, [selectedDate, movFin, mapFatture, mapProspetti, mapScarichi]);

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
  pdf.text("Movimenti del giorno", 14, y);
  y += 6;
  pdf.setFontSize(10);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const totalPages = pdf.getNumberOfPages();
  pdf.setPage(totalPages);
  const x = pageWidth - 70;
  const yy = pageHeight - 20;

  pdf.text(` ${new Date(selectedDate).toLocaleDateString("it-IT")}`, 14, y);
  y += 8;
  pdf.text(` Carichi / Scarichi`, x, y);
  y += 8;

  // ---------------------------------------------------------
  // COLORAZIONE IMPORTI BASATA SU TIPO
  // ---------------------------------------------------------
  const colorizeImportByTipo = (data) => {
    const raw = String(data.cell.raw || "");
    const [valStr, tipo] = raw.split("|");
    const val = Number(valStr || 0);
    const entrata = isEntrata(tipo);

    if (entrata) {
      data.cell.styles.textColor = [0, 128, 0];
      data.cell.text = [`+${val.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`];
    } else {
      data.cell.styles.textColor = [200, 0, 0];
      data.cell.text = [`-${val.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`];
    }
  };

  // ---------------------------------------------------------
  // CARICHI / SCARICHI CONSUNTIVATI
  // ---------------------------------------------------------
  autoTable(pdf, {
    startY: y,
    head: [["CONTROPARTE", "DATA MOVIMENTO", "IMPORTO"]],
    body: rows.map((r) => [
      r.controparte,
      toDate(r.dataMov)?.toLocaleDateString("it-IT") || "",
      `${Number(r.importo || 0).toFixed(2)}|${r.tipo || ""}`,
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [39, 174, 96] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) colorizeImportByTipo(data);
    },
  });

  y = pdf.lastAutoTable.finalY + 6;

  // ---------------------------------------------------------
  // CARICHI / SCARICHI DA CONSUNTIVARE
  // ---------------------------------------------------------
  autoTable(pdf, {
    startY: y,
    head: [["CONTROPARTE", "DATA", "IMPORTO"]],
    body: daConsuntivare.map((r) => [
      r.controparte,
      new Date(r.dataMov).toLocaleDateString("it-IT"),
      `${Number(r.importo || 0).toFixed(2)}|${r.tipo || ""}`,
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [231, 76, 60] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) colorizeImportByTipo(data);
    },
  });

  y = pdf.lastAutoTable.finalY + 10;

  // Introiti (sempre positivi → verde)
pdf.setTextColor(0, 128, 0);
pdf.text(
  `Introiti: +${introitiTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
  14,
  y
);
y += 5;

// Spese (sempre positive ma da mostrare in rosso e con -)
pdf.setTextColor(200, 0, 0);
pdf.text(
  `Spese: -${speseTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
  14,
  y
);
y += 5;

// Utile (può essere positivo o negativo)
if (guadagno >= 0) {
  pdf.setTextColor(0, 128, 0);
  pdf.text(
    `Utile: +${guadagno.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
} else {
  pdf.setTextColor(200, 0, 0);
  pdf.text(
    `Utile: ${guadagno.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
}

y += 8;
pdf.setTextColor(0, 0, 0); // reset colore

  pdf.text(` Altri Movimenti`, x, y);
  y += 8;

  // ---------------------------------------------------------
  // ALTRI CONSUNTIVATI (movFin + anagraficaMov)
  // ---------------------------------------------------------
  const consuntivatiAltri = anagraficaMov
    .map(item => {
      const movs = movFin.filter(m =>
        m.anagraficaId === item.id &&
        isSameDay(m.data, selectedDate)
      );
      if (movs.length === 0) return null;

      const totale = movs.reduce((s, m) => s + Number(m.importo || 0), 0);
      const tipo = movs[0]?.tipo || item.tipo || "";

      return [
        item.nomeBreve,
        item.periodicita,
        `${totale.toFixed(2)}|${tipo}`,
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
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) colorizeImportByTipo(data);
    },
  });

  y = pdf.lastAutoTable.finalY + 10;

  // ---------------------------------------------------------
  // ALTRI DA CONSUNTIVARE (anagraficaMov + getOccorrenze)
  // ---------------------------------------------------------
  const daConsAltri = anagraficaMov
    .map(item => {
      const occ = getOccorrenze(item);
      if (!occ.length) return null;

      const tipo = item.tipo || "";
      const importo = Number(item.importo || 0);

      return [
        item.nomeBreve,
        item.periodicita,
        `${importo.toFixed(2)}|${tipo}`,
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
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) colorizeImportByTipo(data);
    },
  });

  y = pdf.lastAutoTable.finalY + 10;

  // ---------------------------------------------------------
  // TOTALI ATTIVITÀ
  // ---------------------------------------------------------
 pdf.setFontSize(10);

// Introiti Attività (sempre positivi → verde)
pdf.setTextColor(0, 128, 0);
pdf.text(
  `Introiti (Attività): +${introitiAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
  14,
  y
);
y += 5;

// Spese Attività (positive ma da mostrare in rosso e con -)
pdf.setTextColor(200, 0, 0);
pdf.text(
  `Spese (Attività): -${speseAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
  14,
  y
);
y += 5;

// Utile Attività (può essere positivo o negativo)
if (guadagnoAttDaCons >= 0) {
  pdf.setTextColor(0, 128, 0);
  pdf.text(
    `Utile (Attività): +${guadagnoAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
} else {
  pdf.setTextColor(200, 0, 0);
  pdf.text(
    `Utile (Attività): ${guadagnoAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`,
    14,
    y
  );
}

y += 8;
pdf.setTextColor(0, 0, 0); // reset colore


  // ---------------------------------------------------------
  // FOOTER
  // ---------------------------------------------------------
  pdf.setTextColor(0, 128, 0);
  pdf.text("Consuntivati", x, yy);
  pdf.setTextColor(200, 0, 0);
  pdf.text("Da Consuntivare", x, yy + 6);
  pdf.setTextColor(0, 0, 0);

  const dataSafe = new Date().toLocaleDateString("it-IT").replace(/\//g, "-");
  await salvaESharePdfCapacitor(pdf, `Movimenti_${dataSafe}.pdf`);
};




const handleConsuntiva = async (row) => {
  console.log("🟦 handleConsuntiva() START");
  console.log("➡️ row:", row);

  const ok = window.confirm(`Confermare consuntivazione per ${row.controparte}?`);
  console.log("➡️ Conferma utente:", ok);
  if (!ok) return;

  await runSafe(async () => {
    try {
      console.log("🟦 runSafe() → dentro FN");

      console.log("➡️ Creo MovimentoFinanziario...");
      const movRef = await addDoc(collection(db, "MovimentoFinanziario"), {
        anagraficaId: row.anagraficaId || row.id,
        data: selectedDate,
        dataDocumento: row.dataMov,
        importo: row.importo,
        tipo: row.tipo
      });

      const movimentoId = movRef.id;
      console.log("✅ MovimentoFinanziario creato:", movimentoId);

      console.log("➡️ linkMovimentiAFinanziario...");
      await linkMovimentiAFinanziario(
        row.tipo,
        row.anagraficaId || row.id,
        movimentoId
      );
      console.log("✅ linkMovimentiAFinanziario OK");

      if (row.tipo === "fattureCarichi") {
        console.log("➡️ Aggiorno fattureCarichi...");
        await updateDoc(doc(db, "fattureCarichi", row.id), {
          movimentoFinanziarioId: movimentoId
        });
        console.log("✅ fattureCarichi aggiornato");
      }

      if (row.tipo === "prospettiFattura") {
        console.log("➡️ Aggiorno prospettiFattura...");
        await updateDoc(doc(db, "prospettiFattura", row.id), {
          movimentoFinanziarioId: movimentoId
        });
        console.log("✅ prospettiFattura aggiornato");
      }

      if (row.tipo === "PRIVATI") {
        console.log("➡️ Aggiorno scarichi PRIVATI...");
        await updateDoc(doc(db, "scarichi", row.id), {
          movimentoFinanziarioId: movimentoId
        });
        console.log("✅ scarichi PRIVATI aggiornato");
      }

      console.log("🟦 TUTTO OK FINO A QUI");

      // 🔥 QUI DOVREBBE PARTIRE IL POPUP
      console.log("➡️ Popup stampa contabile...");
      const stampa = window.confirm("Vuoi stampare la contabile di questo movimento?");
      console.log("➡️ Risposta popup stampa:", stampa);

      if (stampa) {
        console.log("➡️ handleStampaContabileSingola()...");
        await handleStampaContabileSingola(movimentoId);
        console.log("✅ Stampa singola completata");
      }

      console.log("🟩 handleConsuntiva() FINITA SENZA ERRORI");

    } catch (err) {
      console.error("💥 ERRORE INTERNO IN handleConsuntiva:", err);
      throw err; // importantissimo per far uscire l’errore da runSafe
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
console.log("linkMovimentiAFinanziario tipo, anagraficaId, movimentoFinanziarioId",tipo, anagraficaId, movimentoFinanziarioId);
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
console.log("linkMovimentiAFinanziario movimentiIds",movimentiIds);
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



const handleStampaContabiliGiorno = async () => {
  try {
    const { PdfHeader } = await import("../utils/dateUtils");
    const autoTable = (await import("jspdf-autotable")).default;

    const movGiorno = movFin.filter(
      m =>
        isSameDay(m.data, selectedDate) &&
        ["prospettiFattura", "fattureCarichi", "PRIVATI"].includes(m.tipo)
    );

    if (!movGiorno.length) {
      alert("Nessuna contabile da stampare per questo giorno.");
      return;
    }

    const { pdf } = await PdfHeader();
    let primaPagina = true;

    for (const mf of movGiorno) {
      if (!primaPagina) pdf.addPage();
      primaPagina = false;

      await stampaContabileMovimento(pdf, mf);
    }

    const today = new Date().toLocaleDateString("it-IT").replace(/\//g, "-");
    await salvaESharePdfCapacitor(pdf, `contabili_giorno_${today}.pdf`);

  } catch (err) {
    console.error(err);
    alert("Errore durante la stampa delle contabili del giorno.");
  }
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





const stampaContabileMovimento = async (pdf, mf) => {
  const { PdfHeader } = await import("../utils/dateUtils");
  const autoTable = (await import("jspdf-autotable")).default;

  // 🔥 CARICO I CARICHI QUI (così mapCarichi ESISTE)
  const carichiSnap = await getDocs(collection(db, "carichi"));
  const mapCarichi = {};
  carichiSnap.docs.forEach(d => {
    mapCarichi[d.id] = { id: d.id, ...d.data() };
  });

  const movimentoId = mf.id;
  const tipo = mf.tipo;
  const anagraficaId = mf.anagraficaId;

  const { startY } = await PdfHeader(pdf);

  // Recupero MovimentoFinanziario
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

  // Recupero documento origine
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

  // Recupero indirizzo / piva
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

  // Titolo dinamico
  let titoloContabile = "CONTABILE DI PAGAMENTO EFFETTUATO";
  if (tipo === "fattureCarichi") titoloContabile = "CONTABILE DI PAGAMENTO RICEVUTO";

  pdf.setFontSize(16);
  pdf.text(titoloContabile, 14, startY - 12);

  pdf.setFontSize(12);
  let y = startY + 2;

  pdf.text(`Controparte: ${controparte}`, 14, y);
  y += 6;

  if (indirizzo && indirizzo.trim() !== "" && indirizzo !== "-") {
    pdf.text(`Indirizzo: ${indirizzo}`, 14, y);
    y += 6;
  }

  if (piva && piva.trim() !== "" && piva !== "-") {
    pdf.text(`P.IVA: ${piva}`, 14, y);
    y += 6;
  }

  y += 4;

  pdf.text(`Movimento Finanziario: ${movimentoId}`, 14, y);
  y += 6;

  pdf.text(`Data Pagamento: ${dataPagamentoTxt}`, 14, y);
  y += 6;

  pdf.text(`Data Documento: ${dataDocumentoTxt}`, 14, y);
  y += 10;

  // ---------------------------------------------------------
  // COSTRUZIONE RIGHE FIR
  // ---------------------------------------------------------
  const righeFIR = [];

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
  // RAGGRUPPO PER FIR
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
  // STAMPA TABELLE
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
 <div style={{ display: "flex", gap: 10 }}>
    <button onClick={handlePrintPDF}>🖨️ Stampa PDF</button>
    <button onClick={handleStampaContabiliGiorno}>🧾 Stampa Contabili del giorno</button>
  </div>
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
  <thead>    <tr>      <th>CONTROPARTE</th>      <th>DATA MOVIMENTO</th>      <th>IMPORTO</th> <th>Tipo</th>   <th>stampa</th>  </tr>  </thead>
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
<td>
  <button
    style={{
      padding: "4px 8px",
      background: "#2980b9",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer"
    }}
    title={`Fare click per stampare la contabile del movimento di ${r.controparte} per € ${r.importo.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`}
    onClick={(e) => {
      e.stopPropagation(); // evita lo storno
      handleStampaContabileSingola(r.id);
    }}
  >
    🧾
  </button>
</td>


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

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "20px",
      marginTop: "20px",
      alignItems: "flex-start"
    }}
  >
    {/* 🔵 COLONNA SINISTRA — CONSUNTIVATI */}
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "15px",
        background: "#f8f8f8"
      }}
    >
      <h4>📌 Consuntivati</h4>

      <p>🟢 Introiti: {introitiTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
      <p>🔴 Spese: {speseTot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
      <p><b>Utile:</b> {guadagno.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
    </div>

    {/* 🔴 COLONNA DESTRA — DA CONSUNTIVARE */}
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "15px",
        background: "#f8f8f8"
      }}
    >
      <h4>📌 Da Consuntivare</h4>

      <p>🟢 Introiti: {introitiAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
      <p>🔴 Spese: {speseAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
      <p><b>Utile:</b> {guadagnoAttDaCons.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €</p>
    </div>
  </div>
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

      <button
  style={{
    marginLeft: 10,
    background: "#2980b9",
    color: "white"
  }}
  disabled={loadingBulk}
  onClick={async () => {
    const ok = window.confirm("Confermi consuntivazione giornaliera?");
    if (!ok) return;

    await runSafe(async () => {
      for (const o of occList) {
        await addDoc(collection(db, "MovimentoFinanziario"), {
          anagraficaId: contItem.id,
          data: o.data,              // 🔥 DATA REALE DEL MOVIMENTO
          dataDocumento: o.data,     // 🔥 COERENTE
          importo: contItem.importo,
          tipo: contItem.tipo
        });
      }
    });

    await scriviLog({
      pagina: "movimenti-giorno",
      evento: "CONTABILIZZAZIONE_GIORNALIERA",
      riferimento: { anagraficaId: contItem.id },
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
  CONSUNTIVA GIORNALMENTE
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