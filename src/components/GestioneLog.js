// src/components/GestioneLog.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ripristinaLog } from "../utils/log";

const GestioneLog = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [tutti, setTutti] = useState(false);
  const [paginaFilter, setPaginaFilter] = useState("tutte");
  const [utenteFilter, setUtenteFilter] = useState("tutti");
  const [tipoFilter, setTipoFilter] = useState("tutte");
  const [pagineDisponibili, setPagineDisponibili] = useState([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState([]);
  const [tipiDisponibili, setTipiDisponibili] = useState([]);

  const navigate = useNavigate();

  // NAV
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goHome = () => navigate("/admin");

  // DATE DEFAULT
  useEffect(() => {
    const today = new Date();
    const primo = new Date(today.getFullYear(), today.getMonth(), 1);
    setDal(`${String(primo.getDate()).padStart(2,"0")}/${String(primo.getMonth()+1).padStart(2,"0")}/${primo.getFullYear()}`);
    setAl(`${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`);
  }, []);

  // FETCH LOG
  const fetchLogs = async () => {
    try {
      const snap = await getDocs(collection(db, "log_operazioni"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dati.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setLogs(dati);
    } catch (err) {
      console.error("Errore caricamento log:", err);
    }
  };
  useEffect(() => { fetchLogs(); }, []);

  // =========================
  // PARSE DATE gg/mm/yyyy -> Date
  const parseData = (val, endOfDay = false) => {
    const [gg, mm, yyyy] = val.split("/").map(Number);
    if (!gg || !mm || !yyyy) return null;
    const d = new Date(yyyy, mm-1, gg);
    if (endOfDay) d.setHours(23,59,59,999);
    return d;
  };

  // FILTRI
  useEffect(() => {
    let dati = [...logs];
    if (!tutti) {
      const start = parseData(dal);
      const end = parseData(al, true);
      if (start && end) dati = dati.filter(l => l.timestamp?.toDate && l.timestamp.toDate() >= start && l.timestamp.toDate() <= end);
    }
    if (paginaFilter !== "tutte") dati = dati.filter(l => l.pagina === paginaFilter);
    if (utenteFilter !== "tutti") dati = dati.filter(l => l.utente === utenteFilter);
    if (tipoFilter !== "tutte") dati = dati.filter(l => l.tipo === tipoFilter);

    setFilteredLogs(dati);
    setPagineDisponibili([...new Set(dati.map(l=>l.pagina || "sconosciuta"))]);
    setUtentiDisponibili([...new Set(dati.map(l=>l.utente || "sconosciuto"))]);
    setTipiDisponibili([...new Set(dati.map(l=>l.tipo || "NON DEFINITO"))]);
  }, [logs, dal, al, tutti, paginaFilter, utenteFilter, tipoFilter]);

  const apriDettagli = (log) => navigate("/dettagli-log", { state: { log } });

  const formattaData = ts => ts?.toDate ? `${ts.toDate().toLocaleDateString("it-IT")} ${ts.toDate().toLocaleTimeString("it-IT")}` : "";

  return (
    <div className="gestione-log-container">

      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
           
      </div>

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
              <input type="text" value={dal} placeholder="gg/mm/yyyy"
                onChange={e => setDal(e.target.value)}
                style={{ width:"100px" }}
              />
            </label>

            <label>
              Al:
              <input type="text" value={al} placeholder="gg/mm/yyyy"
                onChange={e => setAl(e.target.value)}
                style={{ width:"100px" }}
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
              <td>{log.tipo || "NON DEFINITO"}</td>
              <td>{log.ripristinato ? "✅" : "❌"}</td>
              <td>
                {log.ripristinabile && !log.ripristinato && <button onClick={async () => {await ripristinaLog(log); await fetchLogs(); }}>
  Ripristina
</button>}
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