// src/components/GestioneLog.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ripristinaLog } from "../utils/log";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
const GestioneLog = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [dal, setDal] = useState(null);
  const [al, setAl] = useState(null);
  const [tutti, setTutti] = useState(false);
  const [paginaFilter, setPaginaFilter] = useState("tutte");
  const [utenteFilter, setUtenteFilter] = useState("tutti");
  const [tipoFilter, setTipoFilter] = useState("tutte");
  const [pagineDisponibili, setPagineDisponibili] = useState([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState([]);
  const [tipiDisponibili, setTipiDisponibili] = useState([]);
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);
const [currentPage, setCurrentPage] = useState(1);
const pageSize = 50;
  const navigate = useNavigate();

  // NAV
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  
  const goHome = () => navigate("/admin");
const logRipristinabile = (log) => {
  return (
    log?.ripristinabile === true &&
    log?.ripristinato === false &&
    log?.riferimento?.collezione &&
    log?.riferimento?.documentoId &&
    log?.before &&
    typeof log.before === "object"
  );
};
  // FETCH LOG
  const fetchLogs = async () => {
    try {
      const snap = await getDocs(collection(db, "log_operazioni"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dati.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setLogs(dati);

      if (dati.length) {
        const timestamps = dati.map(l => l.timestamp?.toDate()).filter(Boolean);
        setMinDataDB(new Date(Math.min(...timestamps)));
        setMaxDataDB(new Date(Math.max(...timestamps)));
      }
    } catch (err) {
      console.error("Errore caricamento log:", err);
    }
  };
  useEffect(() => { fetchLogs(); }, []);

  // DATE DEFAULT
 useEffect(() => {
  if (maxDataDB) {
    const end = new Date(maxDataDB);
    const start = new Date(maxDataDB);

    start.setDate(start.getDate() - 2); // 🔥 ultimi 2 giorni

    setDal(start);
    setAl(end);
  }
}, [maxDataDB]);

useEffect(() => {
  const computeFiltered = () => {
    let dati = [...logs];

    if (!tutti && dal && al) {
      const start = new Date(dal);
      const end = new Date(al);
      end.setHours(23, 59, 59, 999);

      dati = dati.filter(l =>
        l.timestamp?.toDate &&
        l.timestamp.toDate() >= start &&
        l.timestamp.toDate() <= end
      );
    }

    if (paginaFilter !== "tutte") {
      dati = dati.filter(l => l.pagina === paginaFilter);
    }

    if (utenteFilter !== "tutti") {
      dati = dati.filter(l => l.utente === utenteFilter);
    }

    if (tipoFilter !== "tutte") {
      dati = dati.filter(l => l.evento === tipoFilter);
    }

    return dati;
  };

  const risultati = computeFiltered();
setCurrentPage(1);
  // ✅ SOLO QUESTO
  setFilteredLogs(risultati);

  setPagineDisponibili([...new Set(risultati.map(l => l.pagina || "sconosciuta"))]);
  setUtentiDisponibili([...new Set(risultati.map(l => l.utente || "sconosciuto"))]);
  setTipiDisponibili([...new Set(risultati.map(l => l.evento).filter(Boolean))]);

}, [logs, dal, al, tutti, paginaFilter, utenteFilter, tipoFilter]);


  const apriDettagli = (log) => navigate("/dettagli-log", { state: { log } });
  const formattaData = ts => ts?.toDate ? `${ts.toDate().toLocaleDateString("it-IT")} ${ts.toDate().toLocaleTimeString("it-IT")}` : "";
const selectStyle = {
  control: (base) => ({ ...base, minWidth: 200 }),
  menu: (base) => ({ ...base, zIndex: 9999 })
};




const totalPages = Math.ceil(filteredLogs.length / pageSize);
const handlePrintLogs = async () => {
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();

  const dati = filteredLogs || [];

  // =========================
  // TITOLO
  // =========================
  pdf.setFontSize(14);
  pdf.text("GESTIONE LOG OPERAZIONI", 14, startY);

  // =========================
  // FILTRI
  // =========================
  pdf.setFontSize(9);

  const filtri = [
    `Dal: ${dal ? dal.toLocaleDateString("it-IT") : "-"}`,
    `Al: ${al ? al.toLocaleDateString("it-IT") : "-"}`,
    `Pagina filtro: ${paginaFilter || "-"}`,
    `Utente: ${utenteFilter || "-"}`,
    `Tipo: ${tipoFilter || "-"}`,
    `Totale record: ${dati.length}`
  ];

  let y = startY + 10;

  filtri.forEach(f => {
    pdf.text(String(f), 14, y);
    y += 5;
  });

  // =========================
  // SAFE FORMATTER
  // =========================
  const safeFormatObj = (obj) => {
    if (!obj || typeof obj !== "object") return "-";

    return Object.entries(obj)
      .map(([k, v]) => {
        if (v === null || v === undefined) return `${k}: -`;

        if (typeof v === "object") {
          try {
            return `${k}: ${JSON.stringify(v)}`;
          } catch {
            return `${k}: [object]`;
          }
        }

        return `${k}: ${String(v)}`;
      })
      .join(" | ");
  };

  // =========================
  // BUILD BODY SAFE
  // =========================
  const body = [];

  dati.forEach(l => {
    const data =
      l?.timestamp?.toDate
        ? l.timestamp.toDate().toLocaleString("it-IT")
        : "-";

    const mainRow = [
      data,
      l?.pagina || "-",
      l?.utente || "-",
      l?.evento || "-"
    ];

    body.push(mainRow);

    if (l?.before || l?.after) {
      body.push([
        {
          content:
            `Dati originali: ${safeFormatObj(l.before)}\n` +
            `Dati modificati: ${safeFormatObj(l.after)}`,
          colSpan: 4,
          styles: {
            fontSize: 6,
            textColor: [120, 120, 120]
          }
        }
      ]);
    }
  });

  // =========================
  // TABELLA
  // =========================
  autoTable(pdf, {
    startY: y + 5,

    head: [["Data", "Pagina", "Utente", "Tipo"]],
    body,

    styles: {
      fontSize: 7,
      overflow: "linebreak"
    },

    headStyles: {
      fillColor: [30, 30, 30]
    },

    didDrawPage: function () {
      const pageSize = pdf.internal.pageSize;

      pdf.setFontSize(8);

      pdf.text(
        `Pagina ${pdf.internal.getCurrentPageInfo().pageNumber}`,
        pageSize.getWidth() - 30,
        pageSize.getHeight() - 10
      );
    }
  });

  // =========================
  // EXPORT
  // =========================
  await salvaESharePdfCapacitor(
    pdf,
    `LOG_${new Date()
  .toLocaleDateString("it-IT")
  .replace(/\//g, "-")}.pdf`
  );
};
const paginatedLogs = filteredLogs.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);

  return (
    <div className="gestione-log-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
       <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>  
<button onClick={handlePrintLogs}>
  🖨️ Stampa
</button>
</div>

      <h2>Gestione Log Operazioni</h2>

      <div className="filtri-log">
        <label style={{display:"flex",alignItems:"center"}}>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)} />
          Disabilita filtro date
        </label>

        {!tutti && (
          <div style={{display:"flex", gap:"12px", marginTop:"8px"}}>
            <label className="filter-item">
              Dal:
              <DatePicker
                selected={dal}
                onChange={setDal}
                minDate={minDataDB || null}
                maxDate={al || maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>

            <label>
              Al:
              <DatePicker
                selected={al}
                onChange={setAl}
                minDate={dal || minDataDB || null}
                maxDate={maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>
          </div>
        )}

        <div style={{marginTop:"12px"}}>
          <label>
            Pagina:
<div style={{ marginBottom: 10 }}>
  <label style={{ display: "block", marginBottom: 5 }}>
    📄 Pagina
  </label>

  <Select
    styles={selectStyle}
    value={{ value: paginaFilter, label: paginaFilter }}
    onChange={(opt) => setPaginaFilter(opt?.value || "tutte")}
    options={[
      { value: "tutte", label: "Tutte" },
      ...pagineDisponibili.map(p => ({ value: p, label: p }))
    ]}
  />
</div>
          </label>

          <label style={{marginLeft:"12px"}}>
            Utente:
<div style={{ marginBottom: 10 }}>
  <label style={{ display: "block", marginBottom: 5 }}>
    👤 Utente
  </label>

  <Select
    styles={selectStyle}
    value={{ value: utenteFilter, label: utenteFilter }}
    onChange={(opt) => setUtenteFilter(opt?.value || "tutti")}
    options={[
      { value: "tutti", label: "Tutti" },
      ...utentiDisponibili.map(u => ({ value: u, label: u }))
    ]}
  />
</div>
          </label>

          <label style={{marginLeft:"12px"}}>
            Tipo:
<div style={{ marginBottom: 10 }}>
  <label style={{ display: "block", marginBottom: 5 }}>
    ⚙️ Tipo evento
  </label>

  <Select
    styles={selectStyle}
    value={{ value: tipoFilter, label: tipoFilter }}
    onChange={(opt) => setTipoFilter(opt?.value || "tutte")}
    options={[
      { value: "tutte", label: "Tutte" },
      ...tipiDisponibili.map(t => ({ value: t, label: t }))
    ]}
  />
</div>
          </label>
        </div>
      </div>

      <table className="tabella-log" style={{marginTop:"16px"}}>
        <thead>
          <tr>
            <th>Data / Ora</th>
            <th>Pagina</th>
            <th>Utente</th>
            <th>Tipo</th>
            <th>Ripristinato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {paginatedLogs.map(log=>(
            <tr key={log.id} style={{background: log.ripristinato ? "#ddd" : "transparent"}}>
              <td>{formattaData(log.timestamp)}</td>
              <td>{log.pagina || "sconosciuta"}</td>
              <td>{log.utente || "sconosciuto"}</td>
              <td>{log.evento || (log.azione ? `${log.azione}_${log.tipo}` : log.tipo) || "NON DEFINITO"}</td>
              <td>{log.ripristinato ? "✅" : "❌"}</td>
              <td>
                {logRipristinabile(log) && (  <button    onClick={async () => {      await ripristinaLog(log);

      setLogs(prev =>
        prev.map(l =>
          l.id === log.id
            ? { ...l, ripristinato: true }
            : l
        )
      );
    }}
  >
    Ripristina
  </button>
)}
                <button style={{marginLeft:"8px"}} onClick={()=>apriDettagli(log)}>Dettagli</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 10 }}>
  <button
    disabled={currentPage === 1}
    onClick={() => setCurrentPage(p => p - 1)}
  >
    ⬅️ Prev
  </button>

  <span>
    Pagina {currentPage} / {totalPages || 1}
  </span>

  <button
    disabled={currentPage === totalPages}
    onClick={() => setCurrentPage(p => p + 1)}
  >
    Next ➡️
  </button>
</div>
    </div>
  );
};

export default GestioneLog;