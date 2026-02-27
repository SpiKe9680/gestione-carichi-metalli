// src/components/GestioneScarichiDettaglio.js
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";

const GestioneScarichiDettaglio = ({ giornoSelezionato, goBack, filtroFornitoreProp = "Tutti", filtroListinoProp = "Tutti" }) => {
  const [righe, setRighe] = useState([]);
  const [listini, setListini] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editor, setEditor] = useState(null);
  const [originalEditor, setOriginalEditor] = useState(null);
  const [errori, setErrori] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);

  const [filtroOra, setFiltroOra] = useState("Tutti");
  const [filtroFornitore, setFiltroFornitore] = useState(filtroFornitoreProp);
  const [filtroCER, setFiltroCER] = useState("Tutti");
  const [filtroListino, setFiltroListino] = useState(filtroListinoProp);

  const navigate = useNavigate();
  const editorRef = useRef(null);

  // -------- NAV
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goHome = () => navigate("/admin");
  const vaiGestioneListini = () => navigate("/gestione-listini");

  // ---------------------------
  // PARSING SICURO DATA gg/mm/yyyy o ISO
  const parseData = val => {
    if(!val) return null;
    if(typeof val === "string" && val.includes("-")) {
      const d = new Date(val);
      return isNaN(d) ? null : d;
    }
    const [gg, mm, yyyy] = val.split("/").map(Number);
    if(!gg || !mm || !yyyy) return null;
    return new Date(yyyy, mm-1, gg);
  };

  const giornoParsed = parseData(giornoSelezionato);
  const dataLabel = giornoParsed ? giornoParsed.toLocaleDateString("it-IT") : "Data non valida";

  // ---------------------------  
  // CARICA LISTINI
  const loadListini = async () => {
    try {
      const snap = await getDocs(collection(db, "listini"));
      const mapListini = {};
      snap.docs.forEach(d => {
        mapListini[d.data().nome] = d.data().prezzi || {};
      });
      setListini(mapListini);
    } catch(e) {
      console.error("Errore load listini:", e);
    }
  };

  // ---------------------------  
  // CARICA SCARICHI
  useEffect(() => {
    const load = async () => {
      await loadListini();
      try {
        if(!giornoParsed) return;

        const start = new Date(giornoParsed); start.setHours(0,0,0,0);
        const end = new Date(giornoParsed); end.setHours(23,59,59,999);

        const snap = await getDocs(collection(db,"scarichi"));
        const rows = [];

        snap.docs.forEach(d => {
          const data = d.data();
          if(!data.data) return;
          const dataScarico = data.data.toDate();
          if(dataScarico < start || dataScarico > end) return;

          if(filtroFornitore !== "Tutti" && data.fornitore !== filtroFornitore) return;
          if(filtroListino !== "Tutti" && data.listino !== filtroListino) return;

          data.scarico.forEach((cer,cerIndex)=>{
            cer.righe.forEach((r,rIndex)=>{
              const prezzo = r.prezzoAcquisto ?? listini[data.listino]?.[r.materiale] ?? 0;
              const costoTot = prezzo * r.netto;

              rows.push({
                docId:d.id,
                cerIndex,
                rIndex,
                scaricoCompleto:data.scarico,
                ora:dataScarico.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}),
                fornitore:data.fornitore,
                cer:cer.cer,
                materiale:r.materiale,
                peso:r.peso,
                calo:r.calo,
                netto:r.netto,
                prezzoKg:prezzo,
                costoTotale:costoTot,
                listino:data.listino
              });
            });
          });
        });

        setRighe(rows);

      } catch(e){
        setErrori([e.message]);
      }
    };
    load();
  }, [giornoSelezionato, listini, filtroFornitore, filtroListino]);

  // ---------------------------  
  // FILTRI DINAMICI
  const valoriOra = ["Tutti", ...Array.from(new Set(righe.map(r => r.ora)))];
  const valoriFornitore = ["Tutti", ...Array.from(new Set(righe.map(r => r.fornitore)))];
  const valoriCER = ["Tutti", ...Array.from(new Set(righe.map(r => r.cer)))];
  const valoriListino = ["Tutti", ...Array.from(new Set(righe.map(r => r.listino)))];

  const righeFiltrate = righe.filter(r => 
    (filtroOra === "Tutti" || r.ora === filtroOra) &&
    (filtroFornitore === "Tutti" || r.fornitore === filtroFornitore) &&
    (filtroCER === "Tutti" || r.cer === filtroCER) &&
    (filtroListino === "Tutti" || r.listino === filtroListino)
  );

  const paginatedRighe = rowsPerPage && rowsPerPage !== "tutte"
    ? righeFiltrate.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage)
    : righeFiltrate;

  const totalPages = rowsPerPage && rowsPerPage !== "tutte" ? Math.ceil(righeFiltrate.length/rowsPerPage) : 1;

  // ---------------------------  
  // SELEZIONE RIGA
  const selezionaRiga = (index) => {
    const r = paginatedRighe[index];
    const realIndex = righeFiltrate.indexOf(r);
    setSelectedIndex(realIndex);

    setEditor({...righe[realIndex], prezzoKg: righe[realIndex].prezzoKg});
    setOriginalEditor({...righe[realIndex], prezzoKg: righe[realIndex].prezzoKg});
  };

  useEffect(() => {
    if(editorRef.current){
      editorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editor]);

  // ---------------------------  
  // AGGIORNA EDITOR
  const updateEditor = (campo, valore) => {
    setEditor(prev => {
      const nuovo = {...prev};
      const numVal = Number(valore) || 0;

      if(campo==="peso"){ 
        nuovo.peso = numVal; 
        nuovo.netto = nuovo.peso - nuovo.calo; 
      }
      else if(campo==="calo"){ 
        nuovo.calo = numVal; 
        nuovo.netto = nuovo.peso - nuovo.calo; 
      }
      else if(campo==="netto"){
        nuovo.netto = numVal;
        if(nuovo.netto <= nuovo.peso) nuovo.calo = nuovo.peso - nuovo.netto;
        else { nuovo.calo = 0; nuovo.peso = nuovo.netto; }
      } 
      else if(campo==="prezzoKg"){ 
        nuovo.prezzoKg = numVal; 
      }

      nuovo.costoTotale = (nuovo.netto || 0) * (nuovo.prezzoKg || 0);
      return nuovo;
    });
  };

  const campoModificato = campo => editor && originalEditor && editor[campo] !== originalEditor[campo];

  const ricalcolaTotaleCer = (cerObj) => {
    cerObj.totaleCer = cerObj.righe.reduce(
      (tot, r) => tot + (Number(r.netto) || 0),
      0
    );
  };

  // ---------------------------  
  // SALVA MODIFICHE
  const salvaModifiche = async () => {
  if (selectedIndex === null) return;
  const rigaOriginale = righe[selectedIndex];
  try {
    const ref = doc(db, "scarichi", rigaOriginale.docId);
    const nuovoScarico = [...rigaOriginale.scaricoCompleto];
    const cerObj = nuovoScarico[rigaOriginale.cerIndex];
    const target = cerObj.righe[rigaOriginale.rIndex];

    // --- Qui salviamo CORRETTAMENTE lo snapshot originale prima di modificare ---
    const datiOriginali = { scarico: JSON.parse(JSON.stringify(rigaOriginale.scaricoCompleto)) };
    // --- Applico modifiche dal editor ---
    target.peso = editor.peso;
    target.calo = editor.calo;
    target.netto = editor.netto;
    target.prezzoAcquisto = Number(editor.prezzoKg);
    target.costoTotale = target.netto * target.prezzoAcquisto;

    ricalcolaTotaleCer(cerObj);

    await updateDoc(ref, { scarico: nuovoScarico });

    // --- Log corretto: dati_originali = riga prima della modifica ---
    await scriviLog({
      pagina: "gestione-scarichi-dettaglio",
      tipo: "MODIFICA_RIGA",
      collezioneRef: "scarichi",
      documentoId: rigaOriginale.docId,
      dati_originali: datiOriginali,
      dati_modificati: { ...target }
    });

    const copia = [...righe];
    copia[selectedIndex] = { ...rigaOriginale, ...target, prezzoKg: editor.prezzoKg };
    setRighe(copia);
    setSelectedIndex(null);
    setEditor(null);
    setOriginalEditor(null);

  } catch (e) {
    setErrori(prev => [...prev, e.message]);
  }
};

  // ---------------------------  
  // ELIMINA RIGA
  const eliminaRiga = async () => {
    if(selectedIndex===null) return;
    if(!window.confirm("Sei sicuro di eliminare questa riga?")) return;

    const rigaOriginale = righe[selectedIndex];
    try{
      const ref = doc(db,"scarichi",rigaOriginale.docId);
      const nuovoScarico = [...rigaOriginale.scaricoCompleto];
      const cerObj = nuovoScarico[rigaOriginale.cerIndex];
      const rigaEliminata = cerObj.righe[rigaOriginale.rIndex];

      cerObj.righe.splice(rigaOriginale.rIndex,1);

      if(cerObj.righe.length === 0){
        nuovoScarico.splice(rigaOriginale.cerIndex,1);
      } else {
        ricalcolaTotaleCer(cerObj);
      }

      if(nuovoScarico.length === 0){
        await deleteDoc(ref);
      } else {
        await updateDoc(ref,{scarico:nuovoScarico});
      }

      await scriviLog({
        pagina: "gestione-scarichi-dettaglio",
        tipo: "CANCELLAZIONE_RIGA",
        collezioneRef: "scarichi",
        documentoId: rigaOriginale.docId,
        dati_originali: { ...rigaOriginale }, // <-- SALVIAMO tutto il documento originale
        dati_modificati: null
      });

      const copia=[...righe]; copia.splice(selectedIndex,1); setRighe(copia);
      setSelectedIndex(null); setEditor(null); setOriginalEditor(null);

    }catch(e){ setErrori(prev=>[...prev,e.message]); }
  };

  const annullaModifiche=()=>{ setSelectedIndex(null); setEditor(null); setOriginalEditor(null); };

// ---------------------------
// STAMPA
const handleStampa = () => {

  const filtri = `
    <div style="margin-bottom:15px;font-size:14px">
      <strong>Filtri applicati:</strong><br/>
      Fornitore: ${filtroFornitore}<br/>
      Ora: ${filtroOra}<br/>
      CER: ${filtroCER}<br/>
      Listino: ${filtroListino}
    </div>
  `;

  const righeHtml = righeFiltrate.map(r => `
    <tr>
      <td>${r.ora}</td>
      <td>${r.fornitore}</td>
      <td>${r.cer}</td>
      <td>${r.materiale}</td>
      <td>${r.peso}</td>
      <td>${r.calo}</td>
      <td>${r.netto}</td>
      <td>${r.prezzoKg}</td>
      <td>${r.costoTotale.toFixed(2)}</td>
      <td>${r.listino}</td>
    </tr>
  `).join("");

 // Calcolo totale
const totaleEuro = righeFiltrate.reduce((sum, r) => sum + (r.costoTotale || 0), 0);

const html = `
  <html>
    <head>
      <title>Stampa Scarichi</title>
      <style>
        body { font-family: Arial; padding:20px; }
        h2 { margin-bottom:10px; }
        table {
          width:100%;
          border-collapse: collapse;
          margin-top:15px;
        }
        th, td {
          border:1px solid #000;
          padding:6px;
          text-align:left;
          font-size:12px;
        }
        th { background:#eee; }
        .totale {
          margin-top:15px;
          font-weight: bold;
          font-size:14px;
        }
      </style>
    </head>
    <body>

      <h2>Scarichi del giorno ${dataLabel}</h2>

      ${filtri}

      <table>
        <thead>
          <tr>
            <th>Ora</th>
            <th>Fornitore</th>
            <th>CER</th>
            <th>Materiale</th>
            <th>Peso</th>
            <th>Calo</th>
            <th>Netto</th>
            <th>Prezzo €/Kg</th>
            <th>Costo Totale €</th>
            <th>Listino</th>
          </tr>
        </thead>
        <tbody>
          ${righeHtml}
        </tbody>
      </table>

      <div class="totale" style="text-align:left;">
        Totale €: ${totaleEuro.toFixed(2)}
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

  // ---------------------------  
  // UI
  return (
    <div className="gestione-scarichi-container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={goHome}>🏠 Dashboard</button>
       <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
          
      </div>

      <div style={{marginBottom: 10}}>
        <button onClick={goBack}>← Torna agli Scarichi</button>
        <button onClick={vaiGestioneListini} style={{marginLeft:10}}>⚙ Gestione Listini</button>
      </div>

  <h2
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  }}
>
  <span>Scarichi del giorno {dataLabel}</span>

  <button
    onClick={handleStampa}
    style={{
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "14px"
    }}
  >
    🖨 Stampa
  </button>
</h2>

      <div style={{margin:"10px 0", display:"flex", gap:"10px"}}>
        <label>
          Ora:
          <select value={filtroOra} onChange={e=>{ setFiltroOra(e.target.value); setCurrentPage(1); }}>
            {valoriOra.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          Fornitore:
          <select value={filtroFornitore} onChange={e=>{ setFiltroFornitore(e.target.value); setCurrentPage(1); }}>
            {valoriFornitore.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          CER:
          <select value={filtroCER} onChange={e=>{ setFiltroCER(e.target.value); setCurrentPage(1); }}>
            {valoriCER.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          Listino:
          <select value={filtroListino} onChange={e=>{ setFiltroListino(e.target.value); setCurrentPage(1); }}>
            {valoriListino.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      <div style={{margin:"10px 0"}}>
        Mostra
        <select value={rowsPerPage} onChange={e=>{
          setRowsPerPage(e.target.value==="tutte"?"tutte":Number(e.target.value));
          setCurrentPage(1);
        }} style={{marginLeft:10}}>
          <option value={6}>6</option>
          <option value={12}>12</option>
          <option value={24}>24</option>
          <option value="tutte">Tutte</option>
        </select> righe
      </div>

      <table className="tabella-scarichi">
        <thead>
          <tr>
            <th>Ora</th>
            <th>Fornitore</th>
            <th>CER</th>
            <th>Materiale</th>
            <th>Peso</th>
            <th>Calo</th>
            <th>Netto</th>
            <th>Prezzo €/Kg</th>
            <th>Costo Totale €</th>
            <th>Listino</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRighe.map((r,i)=>(
            <tr
              key={i}
              onClick={()=>selezionaRiga(i)}
              style={{
                cursor:"pointer",
                background: righe.indexOf(r)===selectedIndex ? "#ffe7a3" : "transparent"
              }}
            >
              <td>{r.ora}</td>
              <td>{r.fornitore}</td>
              <td>{r.cer}</td>
              <td>{r.materiale}</td>
              <td>{r.peso}</td>
              <td>{r.calo}</td>
              <td>{r.netto}</td>
              <td>{r.prezzoKg}</td>
              <td>{r.costoTotale.toFixed(2)}</td>
              <td>{r.listino}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rowsPerPage !== "tutte" && totalPages>1 && (
        <div style={{marginTop:10}}>
          <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)}>◀</button>
          <span style={{margin:"0 10px"}}>{currentPage} / {totalPages}</span>
          <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)}>▶</button>
        </div>
      )}

      {editor && (
        <div ref={editorRef} style={{marginTop:30,borderTop:"2px solid #ccc",paddingTop:20, background:"#f9f9f9", paddingBottom:20}}>
          <h3>Modifica riga selezionata - {editor.fornitore} - {editor.materiale}</h3>
          <button onClick={eliminaRiga} style={{marginBottom:10, backgroundColor:"#f44336", color:"white"}}>Elimina riga</button>
          {["peso","calo","netto","prezzoKg"].map(campo=>(
            <label key={campo} style={{display:"block",marginTop:10}}>
              {campo==="prezzoKg"?"Prezzo €/Kg":campo.toUpperCase()}:
              <input
                type="number"
                step={campo==="prezzoKg"?0.01:1}
                value={editor[campo]}
                onChange={e=>updateEditor(campo,e.target.value)}
                style={{backgroundColor: campoModificato(campo) ? "#fff3a0" : "white", marginLeft:10}}
              />
            </label>
          ))}
          <label style={{display:"block",marginTop:10}}>
            Costo Totale €:
            <input value={editor.costoTotale.toFixed(2)} readOnly style={{marginLeft:10}}/>
          </label>
          <div style={{marginTop:15}}>
            <button onClick={salvaModifiche}>Salva modifiche</button>
            <button onClick={annullaModifiche} style={{marginLeft:10}}>Annulla</button>
          </div>
        </div>
      )}

      {errori.length>0 && (
        <div style={{marginTop:20,color:"red"}}>
          {errori.map((e,i)=><div key={i}>{e}</div>)}
        </div>
      )}
    </div>
  );
};

export default GestioneScarichiDettaglio;
