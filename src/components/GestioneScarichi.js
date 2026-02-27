// src/components/GestioneScarichi.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import GestioneScarichiDettaglio from "./GestioneScarichiDettaglio";

const GestioneScarichi = () => {
  const [scarichi, setScarichi] = useState([]);
  const [filteredScarichi, setFilteredScarichi] = useState([]);
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [tutti, setTutti] = useState(false);
  const [filtroFornitore, setFiltroFornitore] = useState("tutti");
  const [filtroListino, setFiltroListino] = useState("tutti");
  const [giornoSelezionato, setGiornoSelezionato] = useState(null);

  const [fornitoriDisponibili, setFornitoriDisponibili] = useState([]);
  const [listiniDisponibili, setListiniDisponibili] = useState([]);

  const navigate = useNavigate();

  // NAV
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goHome = () => navigate("/admin");

  // DATE DEFAULT DD/MM/YYYY
  useEffect(() => {
    const today = new Date();
    const primo = new Date(today.getFullYear(), today.getMonth(), 1);
    setDal(`${String(primo.getDate()).padStart(2,"0")}/${String(primo.getMonth()+1).padStart(2,"0")}/${primo.getFullYear()}`);
    setAl(`${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`);
  }, []);

  // FETCH SCARICHI
  const fetchScarichi = async () => {
    try {
      const snap = await getDocs(collection(db, "scarichi"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dati.sort((a,b) => (b.data?.seconds || 0) - (a.data?.seconds || 0));
      setScarichi(dati);

      // Lista dinamica fornitori/listini
      setFornitoriDisponibili([...new Set(dati.map(s => s.fornitore || "sconosciuto"))]);
      setListiniDisponibili([...new Set(dati.map(s => s.listino || "sconosciuto"))]);
    } catch (err) {
      console.error("Errore caricamento scarichi:", err);
    }
  };
  useEffect(() => { fetchScarichi(); }, []);

  // PARSE DATE DD/MM/YYYY -> Date
  const parseData = (val, endOfDay = false) => {
    if(!val) return null;
    const [gg, mm, yyyy] = val.split("/").map(Number);
    if (!gg || !mm || !yyyy) return null;
    const d = new Date(yyyy, mm-1, gg);
    if (endOfDay) d.setHours(23,59,59,999);
    return d;
  };

  // FILTRI
  useEffect(() => {
    let dati = [...scarichi];
    if (!tutti) {
      const start = parseData(dal);
      const end = parseData(al, true);
      if (start && end) dati = dati.filter(s => s.data?.toDate && s.data.toDate() >= start && s.data.toDate() <= end);
    }
    if (filtroFornitore !== "tutti") dati = dati.filter(s => s.fornitore === filtroFornitore);
    if (filtroListino !== "tutti") dati = dati.filter(s => s.listino === filtroListino);

    setFilteredScarichi(dati);
  }, [scarichi, dal, al, tutti, filtroFornitore, filtroListino]);

  // RAGGRUPPAMENTO PER GIORNO DD/MM/YYYY
  const scarichiPerGiorno = {};
  filteredScarichi.forEach(s => {
    if (!s.data?.toDate) return;
    const d = s.data.toDate();
    const giornoIT = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    if (!scarichiPerGiorno[giornoIT]) scarichiPerGiorno[giornoIT] = [];
    scarichiPerGiorno[giornoIT].push(s);
  });

  // DETTAGLIO
  if (giornoSelezionato) {
    return (
      <GestioneScarichiDettaglio
        giornoSelezionato={giornoSelezionato.giorno}
        goBack={() => setGiornoSelezionato(null)}
        filtroFornitoreProp={filtroFornitore !== "tutti" ? filtroFornitore : "Tutti"}
        filtroListinoProp={filtroListino !== "tutti" ? filtroListino : "Tutti"}
      />
    );
  }

  // --- FUNZIONE STAMPA PUNTUALE ---
  const handleStampa = () => {
    const filtriHtml = `
      <div style="margin-bottom:15px;font-size:14px">
        <strong>Filtri applicati:</strong><br/>
        ${!tutti ? `Dal: ${dal}<br/>Al: ${al}<br/>` : ""}
        Fornitore: ${filtroFornitore}<br/>
        Listino: ${filtroListino}
      </div>
    `;

    let righeHtml = "";
    let totaleGenerale = 0;

    Object.keys(scarichiPerGiorno).sort((a,b)=>b.localeCompare(a)).forEach(giornoIT => {
      const scarichiDelGiorno = scarichiPerGiorno[giornoIT];
      const nrScarichi = scarichiDelGiorno.length;
      const nrFornitori = [...new Set(scarichiDelGiorno.map(s=>s.fornitore))].length;
      const pesoTotale = scarichiDelGiorno.reduce(
        (acc, s) => acc + s.scarico.reduce(
          (sum, cer) => sum + cer.righe.reduce((suma, r) => suma + (r.netto || 0), 0), 0), 0
      );
      const costoTotaleGiorno = scarichiDelGiorno.reduce(
        (acc, s) => acc + s.scarico.reduce(
          (sum, cer) => sum + cer.righe.reduce((suma, r) => suma + ((r.prezzoAcquisto||0)*(r.netto||0)),0),0),0
      );
      totaleGenerale += costoTotaleGiorno;

      righeHtml += `<tr>
        <td>${giornoIT}</td>
        <td>${nrScarichi}</td>
        <td>${nrFornitori}</td>
        <td>${pesoTotale.toFixed(2)}</td>
        <td>${costoTotaleGiorno.toFixed(2)}</td>
      </tr>`;
    });

    const html = `
      <html>
        <head>
          <title>Stampa Scarichi</title>
          <style>
            body { font-family: Arial; padding:20px; }
            h2 { margin-bottom:10px; }
            table { width:100%; border-collapse: collapse; margin-top:15px; }
            th, td { border:1px solid #000; padding:6px; text-align:left; font-size:12px; }
            th { background:#eee; }
            .totale { margin-top:15px; font-weight:bold; font-size:14px; }
          </style>
        </head>
        <body>
          <h2>Gestione Scarichi</h2>
          ${filtriHtml}
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Nr Totale Scarichi</th>
                <th>Nr Fornitori</th>
                <th>Peso Totale (kg)</th>
                <th>Costo Totale €</th>
              </tr>
            </thead>
            <tbody>
              ${righeHtml}
            </tbody>
          </table>
          <div class="totale" style="text-align:left;">
            Totale generale €: ${totaleGenerale.toFixed(2)}
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
        {/* Pulsante Stampa */}
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
      </div>

      <h2>Gestione Scarichi</h2>

      {/* FILTRI */}
      <div className="filtri">
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

        <label style={{marginLeft:"12px"}}>
          Fornitore:
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
      </div>

      {/* TABELLA */}
      <table className="tabella-scarichi" style={{marginTop:"16px"}}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Nr Totale Scarichi</th>
            <th>Nr Fornitori</th>
            <th>Peso Totale (kg)</th>
            <th>Costo Totale €</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(scarichiPerGiorno).sort((a,b) => b.localeCompare(a)).map(giornoIT => {
            const scarichiDelGiorno = scarichiPerGiorno[giornoIT];
            const fornitoriUnici = [...new Set(scarichiDelGiorno.map(s => s.fornitore))];
            const pesoTotale = scarichiDelGiorno.reduce(
              (acc, s) => acc + s.scarico.reduce(
                (sum, cer) => sum + cer.righe.reduce((suma, r) => suma + (r.netto || 0), 0),
                0
              ),
              0
            );
            const costoTotaleGiorno = scarichiDelGiorno.reduce(
              (acc, s) => acc + s.scarico.reduce(
                (sum, cer) => sum + cer.righe.reduce((suma, r) => suma + ((r.prezzoAcquisto||0)*(r.netto||0)),0),
                0
              ),
              0
            );

            return (
              <tr key={giornoIT} 
                  onClick={() => setGiornoSelezionato({ giorno: giornoIT })}
                  style={{ cursor: "pointer" }}>
                <td>{giornoIT}</td>
                <td>{scarichiDelGiorno.length}</td>
                <td>{fornitoriUnici.length}</td>
                <td>{pesoTotale.toFixed(2)}</td>
                <td>{costoTotaleGiorno.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default GestioneScarichi;