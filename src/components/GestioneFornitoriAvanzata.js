// src/components/GestioneFornitoriAvanzata.js
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { scriviLog } from "../utils/log";

import DatePicker from "react-datepicker"; 
import "react-datepicker/dist/react-datepicker.css";

const GestioneFornitoriAvanzata = () => {
  const navigate = useNavigate();

  const [fornitori, setFornitori] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [errori, setErrori] = useState([]);

  const [dal, setDal] = useState(null);
  const [al, setAl] = useState(null);
  const [tutti, setTutti] = useState(false);

  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);

  // ---------------- LOGOUT / DASHBOARD ----------------
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goDashboard = () => navigate("/admin");

  // ---------------- LOAD DATA ----------------
  const loadData = async () => {
    try {
      const fornSnap = await getDocs(collection(db, "fornitori"));
      setFornitori(fornSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const scarSnap = await getDocs(collection(db, "scarichi"));
      const scarData = scarSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      scarData.sort((a,b) => (a.data?.seconds||0) - (b.data?.seconds||0));
      setScarichi(scarData);

      if (scarData.length) {
        setMinDataDB(scarData[0].data.toDate());
        setMaxDataDB(scarData[scarData.length-1].data.toDate());
      }

    } catch (e) { setErrori([e.message]); }
  };
  useEffect(() => { loadData(); }, []);

  // ---------------- COUNT SCARICHI FILTRATI ----------------
  const countScarichi = (fornitore) => {
    let lista = scarichi.filter(s => s.fornitore === fornitore.nome);
    if (!tutti && dal && al) {
      const inizio = dal;
      const fine = new Date(al);
      fine.setHours(23,59,59,999);
      lista = lista.filter(s => {
        const d = s.data?.toDate();
        return d >= inizio && d <= fine;
      });
    }
    return lista.length;
  };

  // ---------------- COUNT SCARICHI TOTALI ----------------
  const countScarichiTotali = (fornitore) => {
    return scarichi.filter(s => s.fornitore === fornitore.nome).length;
  };

  // ---------------- DATE UTILS ----------------
  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const parseItalianDate = (value, endOfDay=false) => {
    if (!value) return null;
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1],10);
    const month = parseInt(match[2],10)-1;
    const year = parseInt(match[3],10);
    const date = new Date(year, month, day);
    if (endOfDay) date.setHours(23,59,59,999);
    return date;
  };

  useEffect(() => {
    if (minDataDB && maxDataDB) {
      setDal(minDataDB);
      setAl(maxDataDB);
    }
  }, [minDataDB, maxDataDB]);

  // ---------------- AGGIUNGI ----------------
  const aggiungiFornitore = async () => {
    const nome = prompt("Nome fornitore (obbligatorio):");
    if (!nome) return;

    const exists = fornitori.some(f => f.nome.toLowerCase()===nome.toLowerCase());
    if (exists) { alert("Fornitore già esistente"); return; }

    const indirizzo = prompt("Indirizzo (opzionale):") || "";
    const piva_cf = prompt("P.IVA / CF (opzionale):") || "";

    try {
      const ref = await addDoc(collection(db,"fornitori"), { nome, indirizzo, piva_cf });
      await scriviLog({
        pagina: "GestioneFornitori",
        tipo: "CREAZIONE FORNITORE",
        collezioneRef: "fornitori",
        documentoId: ref.id,
        dati_modificati: { nome, indirizzo, piva_cf }
      });
      loadData();
    } catch(e){ setErrori(prev => [...prev,e.message]); }
  };

  // ---------------- MODIFICA ----------------
  const modificaFornitore = async (f) => {
    const indirizzo = prompt(`Modifica indirizzo (${f.nome})`, f.indirizzo || "") || "";
    const piva_cf = prompt(`Modifica P.IVA / CF (${f.nome})`, f.piva_cf || "") || "";
    try {
      const ref = doc(db,"fornitori",f.id);
      await updateDoc(ref, { indirizzo, piva_cf });
      await scriviLog({
        pagina: "GestioneFornitori",
        tipo: "MODIFICA FORNITORE",
        collezioneRef: "fornitori",
        documentoId: f.id,
        dati_originali: { nome: f.nome, indirizzo: f.indirizzo, piva_cf: f.piva_cf },
        dati_modificati: { nome: f.nome, indirizzo, piva_cf }
      });
      loadData();
    } catch(e){ setErrori(prev=>[...prev,e.message]); }
  };

  // ---------------- ELIMINA ----------------
  const eliminaFornitore = async (f) => {
    if (countScarichiTotali(f)>0) { alert("Non eliminabile: esistono scarichi collegati."); return; }
    if (!window.confirm(`Eliminare ${f.nome}?`)) return;
    try {
      await deleteDoc(doc(db,"fornitori",f.id));
      await scriviLog({
        pagina: "GestioneFornitori",
        tipo: "CANCELLAZIONE FORNITORE",
        collezioneRef: "fornitori",
        documentoId: f.id,
        dati_originali: { nome: f.nome, indirizzo: f.indirizzo, piva_cf: f.piva_cf }
      });
      loadData();
    } catch(e){ setErrori(prev=>[...prev,e.message]); }
  };

  // ---------------- RESET FILTRI ----------------
  const resetFiltri = () => {
    setTutti(false);
    if(minDataDB && maxDataDB){
      setDal(minDataDB);
      setAl(maxDataDB);
    }
  };

  // ---------------- STAMPA ----------------
  const handleStampa = () => {
    let righeHtml = "";
    fornitori.forEach(f => {
      const n = countScarichi(f);
      righeHtml += `<tr><td>${f.nome}</td><td>${f.indirizzo||"-"}</td><td>${f.piva_cf||"-"}</td><td>${n}</td></tr>`;
    });
    const html = `
      <html>
        <head><title>Stampa Fornitori</title></head>
        <body>
          <h2>Gestione Fornitori</h2>
          <table border='1' cellpadding='4'>
            <thead><tr><th>Nome</th><th>Indirizzo</th><th>P.IVA / CF</th><th>Scarichi</th></tr></thead>
            <tbody>${righeHtml}</tbody>
          </table>
        </body>
      </html>`;
    const win = window.open("","_blank");
    win.document.write(html); win.document.close(); win.focus(); win.print();
  };

  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goDashboard}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email||"sconosciuto"})</button>
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
      </div>

      <h2>Gestione Fornitori</h2>
      <button onClick={aggiungiFornitore} style={{marginBottom:15}}>➕ Aggiungi Fornitore</button>

      {/* FILTRI */}
      <div style={{marginBottom:15}}>
        <label style={{display:"flex",alignItems:"center"}}>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)}/> Disabilita filtro date
        </label>

        {!tutti && (
          <div style={{display:"flex", gap:"12px", marginTop:"8px"}}>
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
      </div>

      <table className="tabella-scarichi">
        <thead>
          <tr><th>Nome</th><th>Indirizzo</th><th>P.IVA / CF</th><th>Scarichi</th><th>Azioni</th></tr>
        </thead>
        <tbody>
          {fornitori.map(f => {
            const n = countScarichi(f);
            const tot = countScarichiTotali(f);
            return (
              <tr key={f.id}>
                <td><b>{f.nome}</b></td>
                <td>{f.indirizzo||"-"}</td>
                <td>{f.piva_cf||"-"}</td>
                <td>{n}</td>
                <td>
                  <button onClick={()=>modificaFornitore(f)}>Modifica</button>
                  {tot===0 ? <button onClick={()=>eliminaFornitore(f)} style={{marginLeft:5,background:"red",color:"white"}}>Elimina</button> : <button disabled style={{marginLeft:5}}>Non eliminabile</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {errori.length>0 && <div style={{color:"red",marginTop:20}}>{errori.join("\n")}</div>}
    </div>
  );
};

export default GestioneFornitoriAvanzata;