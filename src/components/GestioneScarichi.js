// src/components/GestioneScarichi.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import GestioneScarichiDettaglio from "./GestioneScarichiDettaglio";
import DatePicker, { registerLocale } from "react-datepicker";
import { it } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";


registerLocale("it", it);
const GestioneScarichi = () => {
  const [scarichi, setScarichi] = useState([]);
  const [filteredScarichi, setFilteredScarichi] = useState([]);


const [dal, setDal] = useState(null);   // oggetto Date
const [al, setAl] = useState(null);     // oggetto Date
  const [tutti, setTutti] = useState(false);
  const [filtroFornitore, setFiltroFornitore] = useState("tutti");
  const [filtroListino, setFiltroListino] = useState("tutti");
  const [filtroUtente, setFiltroUtente] = useState("tutti");
  const [giornoSelezionato, setGiornoSelezionato] = useState(null);

  const [fornitoriDisponibili, setFornitoriDisponibili] = useState([]);
  const [listiniDisponibili, setListiniDisponibili] = useState([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState([]);
  const [listini, setListini] = useState({});

  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goHome = () => navigate("/admin");

  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

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

  // --- FETCH SCARICHI ---
  const fetchScarichi = async () => {
    try {
      const snap = await getDocs(collection(db, "scarichi"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dati.sort((a,b) => (b.data?.seconds || 0) - (a.data?.seconds || 0));
      setScarichi(dati);

      if (dati.length) {
        const ordinati = [...dati].sort((a,b) => (a.data?.seconds || 0) - (b.data?.seconds || 0));
        setMinDataDB(ordinati[0].data.toDate());
        setMaxDataDB(ordinati[ordinati.length-1].data.toDate());
      }

      setFornitoriDisponibili([...new Set(dati.map(s => s.fornitore || "sconosciuto"))]);
      setListiniDisponibili([...new Set(dati.map(s => s.listino || "sconosciuto"))]);
      setUtentiDisponibili([...new Set(dati.map(s => s.utente || "sconosciuto"))]);
    } catch (err) {
      console.error("Errore caricamento scarichi:", err);
    }
  };
  useEffect(() => { fetchScarichi(); }, []);

  const loadListini = async () => {
    try {
      const snap = await getDocs(collection(db, "listini"));
      const mapListini = {};
      snap.docs.forEach(d => {
        mapListini[d.data().nome] = d.data().prezzi || {};
      });
      setListini(mapListini);
    } catch (e) { console.error("Errore load listini:", e); }
  };
  useEffect(() => { loadListini(); }, []);

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

  // --- FILTRAGGIO SCARICHI ---
  useEffect(() => {
    let start = dal;
let end = al ? new Date(al) : null;
if (end) end.setHours(23,59,59,999);

    let dati = [...scarichi];

    // applichiamo filtro date solo se la checkbox NON è attiva
    if (!tutti && start && end) {
      dati = dati.filter(s => s.data?.toDate && s.data.toDate() >= start && s.data.toDate() <= end);
    }

    // Validazione dei filtri rispetto ai valori disponibili (se esistono)
    if (fornitoriDisponibili.length > 0 && !fornitoriDisponibili.includes(filtroFornitore) && filtroFornitore !== "tutti") {
      setFiltroFornitore("tutti");
    }
    if (listiniDisponibili.length > 0 && !listiniDisponibili.includes(filtroListino) && filtroListino !== "tutti") {
      setFiltroListino("tutti");
    }
    if (utentiDisponibili.length > 0 && !utentiDisponibili.includes(filtroUtente) && filtroUtente !== "tutti") {
      setFiltroUtente("tutti");
    }

    if (filtroFornitore !== "tutti") dati = dati.filter(s => s.fornitore === filtroFornitore);
    if (filtroListino !== "tutti") dati = dati.filter(s => s.listino === filtroListino); // listino sempre applicato se selezionato
    if (filtroUtente !== "tutti") dati = dati.filter(s => (s.utente ?? "sconosciuto") === filtroUtente);

    setFilteredScarichi(dati);
  }, [scarichi, dal, al, tutti, filtroFornitore, filtroListino, filtroUtente, fornitoriDisponibili, listiniDisponibili, utentiDisponibili]);

  // --- SCARICHI PER GIORNO ---
  const scarichiPerGiorno = {};
  filteredScarichi.forEach(s => {
    if (!s.data?.toDate) return;
    const d = s.data.toDate();
    const giornoIT = formatDataIT(d);
    if (!scarichiPerGiorno[giornoIT]) scarichiPerGiorno[giornoIT] = [];
    scarichiPerGiorno[giornoIT].push(s);
  });

  // --- RETURN DETTAGLIO ---
  if (giornoSelezionato) {
    return (
      <GestioneScarichiDettaglio
        giornoSelezionato={giornoSelezionato.giorno}
        goBack={() => setGiornoSelezionato(null)}
        filtroFornitoreProp={filtroFornitore !== "tutti" ? filtroFornitore : "Tutti"}
        filtroListinoProp={filtroListino !== "tutti" ? filtroListino : "Tutti"}
        filtroUtenteProp={filtroUtente !== "tutti" ? filtroUtente : "Tutti"}
      />
    );
  }

  // --- STAMPA ---
  const handleStampa = () => {
    const filtriHtml = `
      <div style="margin-bottom:15px;font-size:14px">
        <strong>Filtri applicati:</strong><br/>
        ${!tutti ? `Dal: ${dal}<br/>Al: ${al}<br/>` : ""}
        Fornitore: ${filtroFornitore}<br/>
        Listino: ${filtroListino}<br/>
        Utente: ${filtroUtente}
      </div>
    `;
    let righeHtml = "";
    let totaleGenerale = 0;

    Object.keys(scarichiPerGiorno)
      .sort((a,b)=>{
        const [ggA,mmA,yyyyA]=a.split("/").map(Number);
        const [ggB,mmB,yyyyB]=b.split("/").map(Number);
        return new Date(yyyyB,mmB-1,ggB)-new Date(yyyyA,mmA-1,ggA);
      })
      .forEach(giornoIT => {
        const scarichiDelGiorno = scarichiPerGiorno[giornoIT];
        const nrScarichi = scarichiDelGiorno.length;
        const nrFornitori = [...new Set(scarichiDelGiorno.map(s=>s.fornitore))].length;
        const pesoTotale = scarichiDelGiorno.reduce(
          (acc, s) => acc + s.scarico.reduce(
            (sum, cer) => sum + cer.righe.reduce((suma, r) => suma + (r.netto || 0), 0), 0), 0
        );
        const costoTotaleGiorno = scarichiDelGiorno.reduce((acc, s) => {
          return acc + s.scarico.reduce((sum, cer) => {
            return sum + cer.righe.reduce((suma, r) => {
              const prezzo = r.prezzoAcquisto ?? listini[s.listino]?.[r.materiale] ?? 0;
              return suma + (prezzo * (r.netto || 0));
            }, 0);
          }, 0);
        }, 0);
        totaleGenerale += costoTotaleGiorno;
        const utentiDelGiorno = [...new Set(scarichiDelGiorno.map(s => s.utente))]
          .filter(Boolean)
          .join("; ");
        righeHtml += `<tr>
          <td>${giornoIT}</td>
          <td>${nrScarichi}</td>
          <td>${nrFornitori}</td>
          <td>${pesoTotale.toFixed(2)}</td>
          <td>${costoTotaleGiorno.toFixed(2)}</td>
          ${filtroUtente === "tutti" ? `<td title="${utentiDelGiorno}">${utentiDelGiorno}</td>` : ""}
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
                ${filtroUtente === "tutti" ? "<th>Utente</th>" : ""}
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

  const resetFiltri = () => {
    setFiltroFornitore("tutti");
    setFiltroListino("tutti");
    setFiltroUtente("tutti");
    setTutti(false);
    const today = new Date();
    const primo = new Date(today.getFullYear(), today.getMonth(), 1);
    const minDate = minDataDB ?? primo;
    const maxDate = maxDataDB ?? today;
    setDal(formatDataIT(minDate));
    setAl(formatDataIT(maxDate));
  };

  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
      </div>

      <h2>Gestione Scarichi</h2>

      {/* FILTRI */}
      <div className="filtri">
        <button onClick={resetFiltri} style={{marginLeft:"12px"}}>🔄 Reset filtri</button>

        <label style={{display:"flex",alignItems:"center"}}>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)} />
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
    minDate={dal || minDataDB || new Date(2000,0,1)}
    maxDate={maxDataDB || new Date()}
    dateFormat="dd/MM/yyyy"
    placeholderText="gg/mm/yyyy"
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

        <label style={{marginLeft:"12px"}}>
          Utente:
          <select value={filtroUtente} onChange={e => setFiltroUtente(e.target.value)}>
            <option value="tutti">Tutti</option>
            {utentiDisponibili.map(u => <option key={u}>{u}</option>)}
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
            <th>Utente</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(scarichiPerGiorno)
            .sort((a,b)=>{
              const [ggA,mmA,yyyyA]=a.split("/").map(Number);
              const [ggB,mmB,yyyyB]=b.split("/").map(Number);
              return new Date(yyyyB,mmB-1,ggB)-new Date(yyyyA,mmA-1,ggA);
            })
            .map(giornoIT => {
              const scarichiDelGiorno = scarichiPerGiorno[giornoIT];
              const fornitoriUnici = [...new Set(scarichiDelGiorno.map(s => s.fornitore))];
              const utentiUnici = [...new Set(scarichiDelGiorno.map(s => s.utente))].filter(Boolean);
              const utentiString = utentiUnici.join("; ");

              const pesoTotale = scarichiDelGiorno.reduce(
                (acc, s) => acc + s.scarico.reduce(
                  (sum, cer) => sum + cer.righe.reduce((suma, r) => suma + (r.netto || 0), 0),
                  0
                ),
                0
              );
              const costoTotaleGiorno = scarichiDelGiorno.reduce((acc, s) => {
                return acc + s.scarico.reduce((sum, cer) => {
                  return sum + cer.righe.reduce((suma, r) => {
                    const prezzo = r.prezzoAcquisto ?? listini[s.listino]?.[r.materiale] ?? 0;
                    return suma + (prezzo * (r.netto || 0));
                  }, 0);
                }, 0);
              }, 0);

              return (
                <tr key={giornoIT} onClick={() => setGiornoSelezionato({ giorno: giornoIT })} style={{ cursor: "pointer" }}>
                  <td>{giornoIT}</td>
                  <td>{scarichiDelGiorno.length}</td>
                  <td>{fornitoriUnici.length}</td>
                  <td>{pesoTotale.toFixed(2)}</td>
                  <td>{costoTotaleGiorno.toFixed(2)}</td>
                  <td title={utentiString}>{utentiString}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default GestioneScarichi;