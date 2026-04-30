// src/components/GestioneLog.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ripristinaLog } from "../utils/log";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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
    if (minDataDB && maxDataDB) {
      setDal(minDataDB);
      setAl(maxDataDB);
    }
  }, [minDataDB, maxDataDB]);

  // FILTRI
  useEffect(() => {
    let dati = [...logs];

    if (!tutti && dal && al) {
      const start = new Date(dal);
      const end = new Date(al);
      end.setHours(23,59,59,999);
      dati = dati.filter(l => l.timestamp?.toDate && l.timestamp.toDate() >= start && l.timestamp.toDate() <= end);
    }
    if (paginaFilter !== "tutte") dati = dati.filter(l => l.pagina === paginaFilter);
    if (utenteFilter !== "tutti") dati = dati.filter(l => l.utente === utenteFilter);
  if (tipoFilter !== "tutte") {
  dati = dati.filter(l => l.evento === tipoFilter);
}
  


    setFilteredLogs(dati);
    setPagineDisponibili([...new Set(dati.map(l=>l.pagina || "sconosciuta"))]);
    setUtentiDisponibili([...new Set(dati.map(l=>l.utente || "sconosciuto"))]);
 setTipiDisponibili([
  ...new Set(dati.map(l => l.evento).filter(Boolean))
]);
  }, [logs, dal, al, tutti, paginaFilter, utenteFilter, tipoFilter]);

  const apriDettagli = (log) => navigate("/dettagli-log", { state: { log } });
  const formattaData = ts => ts?.toDate ? `${ts.toDate().toLocaleDateString("it-IT")} ${ts.toDate().toLocaleTimeString("it-IT")}` : "";

  return (
    <div className="gestione-log-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
       <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>  </div>

      <h2>Gestione Log Operazioni</h2>

      <div className="filtri-log">
        <label style={{display:"flex",alignItems:"center"}}>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)} />
          Disabilita filtro date
        </label>

        {!tutti && (
          <div style={{display:"flex", gap:"12px", marginTop:"8px"}}>
            <label>
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
            <select value={paginaFilter} onChange={e=>setPaginaFilter(e.target.value)}>
              <option value="tutte">Tutte</option>
              {pagineDisponibili.map(p=><option key={p}>{p}</option>)}
            </select>
          </label>

          <label style={{marginLeft:"12px"}}>
            Utente:
            <select value={utenteFilter} onChange={e=>setUtenteFilter(e.target.value)}>
              <option value="tutti">Tutti</option>
              {utentiDisponibili.map(u=><option key={u}>{u}</option>)}
            </select>
          </label>

          <label style={{marginLeft:"12px"}}>
            Tipo:
            <select value={tipoFilter} onChange={e=>setTipoFilter(e.target.value)}>
              <option value="tutte">Tutte</option>
              {tipiDisponibili.map(t=><option key={t}>{t}</option>)}
            </select>
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
          {filteredLogs.map(log=>(
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
    </div>
  );
};

export default GestioneLog;