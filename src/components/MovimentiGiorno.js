// src/components/MovimentiGiorno.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { collection, getDocs, updateDoc, doc, getDoc, deleteDoc, addDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

  // --------------------------
  // MOCK DATA (poi Firestore)
  // --------------------------
  const [carichiScarichi, setCarichiScarichi] = useState([]);
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);

  const d = new Date(v);
  return isNaN(d) ? null : d;
};
  // --------------------------
  // CONFIG
  // --------------------------
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

const refreshAll = async () => {
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

  // --------------------------
  // NAVIGATION
  // --------------------------
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
  const [selectedDate] = useState(
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
const alreadyConsuntivati = new Set(
  movFin.map(m => {
    const id = m.anagraficaId || m.id;
    return `${m.tipo}_${id}`;
  })
);
// =====================
// FATTURE CARICHI
// =====================
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
// =====================
// PROSPETTI
// =====================
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

// =====================
// PRIVATI (scarichi)
// =====================
// 🔥 porta la data a fine giornata


// 🔥 filtra solo FORNITORE PRIVATO
const scarichiPrivati = Object.values(mapScarichi).filter(s => {
  return (s.fornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO";
});

scarichiPrivati.forEach(s => {
  // 🔥 conversione robusta Firestore Timestamp → Date
  let data = null;

  if (s.data?.seconds) {
    data = new Date(s.data.seconds * 1000);
  } else if (s.data instanceof Date) {
    data = s.data;
  }

  if (!data) return;

  // 🔥 confronto corretto (fine giornata)
  if (data.getTime() > endOfDay.getTime()) return;

  // 🔥 pagamento (gestione completa casi)
  const pagato =
    s.DataPagamento ??
    s.dataPagamento ??
    null;

  if (pagato) return;

  // 🔥 calcolo totale
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

//console.log("DEBUG scarichiPrivati:", scarichiPrivati);

// 🔥 ORDINAMENTO
daConsuntivare.sort((a, b) => a.dataMov - b.dataMov);
  const goDashboard = () => navigate("/admin");

const handlePrintPDF = async () => {
  const input = document.getElementById("area-stampa");
  if (!input) return;

  const canvas = await html2canvas(input, {
    scale: 2,
    useCORS: true
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(
    `Movimenti_${new Date(selectedDate).toLocaleDateString("it-IT")}.pdf`
  );
};

const handleConsuntiva = async (row) => {
  const ok = window.confirm(
    `Confermare consuntivazione per ${row.controparte}?`
  );
  if (!ok) return;

  try {
    // 1. crea MovimentoFinanziario
    const movRef = await addDoc(collection(db, "MovimentoFinanziario"), {
      anagraficaId: row.anagraficaId || row.id,
      data: selectedDate,
      dataDocumento: row.dataMov,
      importo: row.importo,
      tipo: row.tipo
    });

    const movimentoId = movRef.id;

    // =========================
    // 🔥 FATTURE CARICHI
    // =========================
    if (row.tipo === "fattureCarichi") {

      // documento
      await updateDoc(doc(db, "fattureCarichi", row.id), {
        movimentoFinanziarioId: movimentoId
      });

      // 🔥 PROPAGAZIONE SU CARICHI
      const fattura = mapFatture[row.id];

      if (fattura?.movimentiIds?.length) {
        for (const id of fattura.movimentiIds) {
          await updateDoc(doc(db, "carichi", id), {
            movimentoFinanziarioId: movimentoId
          });
        }
      }
    }

    // =========================
    // 🔥 PROSPETTI → SCARICHI
    // =========================
    if (row.tipo === "prospettiFattura") {

      // documento
      await updateDoc(doc(db, "prospettiFattura", row.id), {
        movimentoFinanziarioId: movimentoId
      });

      // 🔥 PROPAGAZIONE SU SCARICHI
      const prospetto = mapProspetti[row.id];

      if (prospetto?.movimentiIds?.length) {
        for (const id of prospetto.movimentiIds) {
          await updateDoc(doc(db, "scarichi", id), {
            movimentoFinanziarioId: movimentoId
          });
        }
      }
    }

    // =========================
    // 🔥 PRIVATI (scarico singolo)
    // =========================
    if (row.tipo === "PRIVATI") {
      await updateDoc(doc(db, "scarichi", row.id), {
        movimentoFinanziarioId: movimentoId
      });
    }

    await refreshAll();

  } catch (err) {
    console.error(err);
  }
};



const handleDeleteFin = async (row) => {
  const ok = window.confirm(
    `Vuoi rimuovere la consuntivazione di ${row.controparte} di € ${row.importo.toFixed(2)}?`
  );
  if (!ok) return;

  try {
    // 1. elimina MovimentoFinanziario
    await deleteDoc(doc(db, "MovimentoFinanziario", row.id));

    // =========================
    // 🔥 FATTURE CARICHI
    // =========================
    if (row.tipo === "fattureCarichi") {

      await updateDoc(doc(db, "fattureCarichi", row.anagraficaId), {
        movimentoFinanziarioId: null
      });

      const fattura = mapFatture[row.anagraficaId];

      if (fattura?.movimentiIds?.length) {
        for (const id of fattura.movimentiIds) {
          await updateDoc(doc(db, "carichi", id), {
            movimentoFinanziarioId: null
          });
        }
      }
    }

    // =========================
    // 🔥 PROSPETTI
    // =========================
    if (row.tipo === "prospettiFattura") {

      await updateDoc(doc(db, "prospettiFattura", row.anagraficaId), {
        movimentoFinanziarioId: null
      });

      const prospetto = mapProspetti[row.anagraficaId];

      if (prospetto?.movimentiIds?.length) {
        for (const id of prospetto.movimentiIds) {
          await updateDoc(doc(db, "scarichi", id), {
            movimentoFinanziarioId: null
          });
        }
      }
    }

    // =========================
    // 🔥 PRIVATI
    // =========================
    if (row.tipo === "PRIVATI") {
      await updateDoc(doc(db, "scarichi", row.anagraficaId), {
        movimentoFinanziarioId: null
      });
    }

    await refreshAll();

  } catch (err) {
    console.error(err);
  }
};

const entrateUsciteTop = rows.map(r => ({
  tipo: r.tipo,
  importo: Number(r.importo) || 0
}));

const entrateUsciteBottom = anagraficaMov.flatMap(item => {
  return movFin
    .filter(m =>
      m.anagraficaId === item.id &&
      isSameDay(m.data, selectedDate)
    )
    .map(m => ({
      tipo: item.tipo, // oppure m.tipo se affidabile
      importo: Number(m.importo) || 0
    }));
});

const allMovimentiGiorno = [
  ...entrateUsciteTop,
  ...entrateUsciteBottom
];

const introitiTot = allMovimentiGiorno
  .filter(m =>
    m.tipo === "fattureCarichi" ||
    m.tipo === "ENTRATA"
  )
  .reduce((s, m) => s + m.importo, 0);

const speseTot = allMovimentiGiorno
  .filter(m =>
    m.tipo === "PRIVATI" ||
     m.tipo === "prospettiFattura" ||
    m.tipo === "USCITA"
  )
  .reduce((s, m) => s + m.importo, 0);

const guadagno = introitiTot - speseTot;
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

  // 🔥 MOVIMENTI REALMENTE CONSUNTIVATI PER ITEM
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

    // 🔥 FIX CHIAVE: confronto su DATA DOCUMENTO NON SU DATA CONSUNTIVO
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


  // --------------------------
  // UI
  // --------------------------
 return (
  <div style={{ padding: 20 }}>
    
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={goDashboard}>🏠 Dashboard</button>
<button onClick={handlePrintPDF}>
  🖨️ Stampa PDF
</button>
 <button
  onClick={() =>
  navigate("/MovimentiFinanziari", {
  state: { date: selectedDate.toISOString() }
})
  }
>
  🔙 Calendario
</button>

        <button onClick={handleLogout}>
          🚪 Logout ({currentUser.username || currentUser.email})
        </button>
      </div>

      {/* TITLE */}
      <h2>Movimento Giorno</h2>
<div id="area-stampa">
      <p>
        📅 Giorno:{" "}
        <strong>{new Date(selectedDate).toLocaleDateString("it-IT")}</strong>
      </p>

      {giornoAvviamento && (
        <p>
          ⚠️ Avvio impianto:{" "}
          <strong>{giornoAvviamento.toLocaleDateString("it-IT")}</strong>
        </p>
      )}

      {/* ===================== */}
      {/* SEZIONE 1 */}
      {/* ===================== */}
      <h3>Carichi / Scarichi</h3>

      <div style={{ display: "flex", gap: 20 }}>
        {/* PAGATI */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
          <h4>🟢 Consuntivati</h4>

 <table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      <th>CONTROPARTE</th>
      <th>DATA MOVIMENTO</th>
      <th>IMPORTO</th>
    </tr>
  </thead>
  <tbody>
    {rows.map((r, i) => {
      const isEntrata =
        r.tipo === "ENTRATA" || r.tipo === "fattureCarichi";

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
          <td>{r.controparte}</td>
          <td>
            {toDate(r.dataMov)?.toLocaleDateString("it-IT") || ""}
          </td>
          <td>
  {r.importo.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €
</td>
        </tr>
      );
    })}
  </tbody>
</table>
        </div>

        {/* DA PAGARE */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
<h4>🔴 Da Consuntivare</h4>

<table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      <th>CONTROPARTE</th>
      <th>DATA</th>
      <th>IMPORTO</th>
    </tr>
  </thead>
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
</td>
        </tr>
      );
    })}
  </tbody>
</table>
        </div>
      </div>

     

      {/* ===================== */}
{/* ALTRI MOVIMENTI */}
{/* ===================== */}
<h3 style={{ marginTop: 40 }}>Altri Movimenti</h3>

<div style={{ display: "flex", gap: 20 }}>

  {/* ===================== */}
  {/* CONSUNTIVATI (SINISTRA) */}
  {/* ===================== */}
  <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
    <h4>🟢 Consuntivati</h4>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th>MOVIMENTO</th>
          <th>FREQUENZA</th>
          <th>€</th>
          <th>CONT.</th>
        </tr>
      </thead>

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
    setOccList(movs);
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
      <td>{item.nomeBreve}</td>
      <td>{item.periodicita}</td>
     <td>
  {movs
    .reduce((sum, m) => sum + (Number(m.importo) || 0), 0)
    .toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} €
</td>
      <td>{movs.length}</td>
    </tr>
  );
})}
      </tbody>
    </table>
  </div>

  {/* ===================== */}
  {/* DA CONSUNTIVARE (DESTRA) */}
  {/* ===================== */}
  <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
    <h4>🔴 Da Consuntivare</h4>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th>MOVIMENTO</th>
          <th>FREQUENZA</th>
          <th>€</th>
          <th>CONT.</th>
        </tr>
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

          setLoadingBulk(true);

          try {
            for (const o of occList) {
              await addDoc(collection(db, "MovimentoFinanziario"), {
                anagraficaId: contItem.id,
                data: selectedDate,
                dataDocumento: o.data,
                importo: contItem.importo,
                tipo: contItem.tipo
              });
            }

            await refreshAll();

            setShowModal(false);
            setContItem(null);
            setOccList([]);

          } finally {
            setLoadingBulk(false);
          }
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

          setLoadingBulk(true);

          try {
            for (const o of occList) {
              await deleteDoc(doc(db, "MovimentoFinanziario", o.id));
            }

            await refreshAll();

            setShowContabilizza(false);
            setContItem(null);
            setOccList([]);

          } finally {
            setLoadingBulk(false);
          }
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