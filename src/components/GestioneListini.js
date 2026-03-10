// src/components/GestioneListini.js
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GestioneListini = () => {

  const [listini, setListini] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editor, setEditor] = useState(null);
  const [originalEditor, setOriginalEditor] = useState(null);

  const [nuovoListino, setNuovoListino] = useState("");
  const [listinoDaCopiare, setListinoDaCopiare] = useState("");
  const [showCreaForm, setShowCreaForm] = useState(false);
  const [errori, setErrori] = useState([]);
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState({}); // map listinoId -> fornitoreId

  const navigate = useNavigate();

  const codiciCER = [
    "CALDAIETTE","CARTER MEC.","CARTER MIS.","CAVI CAB.","CAVI RESA",
    "CERCHI","GRAN.98%","INOX","OTTONE G.","OTTONE M.","PIOMBO",
    "PROFILO M.","PROFILO P.","RAD.AL.CU.M.","RAD.AL.CU.P.",
    "RAME I","RAME II","RAME III","SEMIDOLCE","STAGNATO","VASELLAME"
  ];

  // =============================
  // NAV
  // =============================
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goHome = () => navigate("/admin");

  // =============================
  // LOAD LISTINI E FORNITORI
  // =============================
  const loadListini = async () => {
    try {
      const snap = await getDocs(collection(db, "listini"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setListini(dati);

      if (dati.length && !listinoDaCopiare)
        setListinoDaCopiare(dati[0].id);

    } catch (e) {
      setErrori([e.message]);
    }
  };

  const loadFornitori = async () => {
    try {
      const snap = await getDocs(collection(db, "fornitori"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFornitori(dati);
    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  useEffect(() => { 
    loadListini();
    loadFornitori();
  }, []);

  // =============================
  // SELEZIONE LISTINO
  // =============================
  const selezionaListino = (index) => {
    const l = listini[index];
    setSelectedIndex(index);
    setEditor({ ...l, prezzi: { ...l.prezzi } });
    setOriginalEditor(JSON.parse(JSON.stringify(l)));
  };

  // =============================
  // UPDATE PREZZO
  // =============================
  const updatePrezzo = (codice, valore) => {
    setEditor(prev => ({
      ...prev,
      prezzi: { ...prev.prezzi, [codice]: Number(valore) || 0 }
    }));
  };

  const campoModificato = codice =>
    editor && originalEditor &&
    editor.prezzi[codice] !== originalEditor.prezzi[codice];

  // =============================
  // ASSOCIA FORNITORE
  // =============================
  // =============================
// ASSOCIA FORNITORE (corretto)
// =============================
const associaFornitore = async (listinoId, fornitoreId) => {
  const listino = listini.find(l => l.id === listinoId);
  const fornitore = fornitori.find(f => f.id === fornitoreId);
  if (!listino || !fornitore) return;

  try {
    const datiOriginali = { listinoId, fornitoreId, predefListinoVecchio: fornitore.predefListino || null };

    // 1. Aggiorna fornitore con nuovo listino predefinito
    await updateDoc(doc(db, "fornitori", fornitoreId), { predefListino: listinoId });

    // 2. Rimuovi fornitore da altri listini in cui era predefinito
    for (const l of listini) {
      if ((l.predefFornitori || []).includes(fornitoreId) && l.id !== listinoId) {
        const nuoviFornitori = l.predefFornitori.filter(fid => fid !== fornitoreId);
        await updateDoc(doc(db, "listini", l.id), { predefFornitori: nuoviFornitori });
      }
    }

    // 3. Aggiungi fornitore al listino corrente se non presente
    const predefFornitori = listino.predefFornitori || [];
    if (!predefFornitori.includes(fornitoreId)) {
      await updateDoc(doc(db,"listini",listinoId), { predefFornitori: [...predefFornitori, fornitoreId] });
    }

    // 4. Log
    await scriviLog({
      pagina: "gestione-listini",
      tipo: "ASSOCIA_FORNITORE",
      dati_originali: datiOriginali,
      dati_modificati: { listinoId, fornitoreId }
    });

    // 5. Reset dropdown e ricarica
    setFornitoreSelezionato(prev => ({ ...prev, [listinoId]: "" }));
    loadListini();
    loadFornitori();

  } catch(e) {
    setErrori(prev => [...prev, e.message]);
  }
};

  // =============================
  // SALVA LISTINO
  // =============================
  const salvaListino = async () => {
    if (!editor) return;

    try {
      const ref = doc(db, "listini", editor.id);

      await updateDoc(ref, {
        prezzi: editor.prezzi,
        nome: editor.nome
      });

      await scriviLog({
        pagina: "gestione-listini",
        tipo: "MODIFICA_LISTINO",
        dati_originali: originalEditor,
        dati_modificati: editor
      });

      setEditor(null);
      setSelectedIndex(null);
      setOriginalEditor(null);

      loadListini();

    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // =============================
  // CREA LISTINO
  // =============================
  const creaNuovoListino = async () => {
    if (!nuovoListino || !listinoDaCopiare) return alert("Compila tutti i campi");

    const origine = listini.find(l => l.id === listinoDaCopiare);
    if (!origine) return alert("Listino origine non trovato");

    const copia = { nome: nuovoListino, prezzi: { ...origine.prezzi }, predefFornitori: [] };

    try {
      const docRef = await addDoc(collection(db, "listini"), copia);

      await scriviLog({
        pagina: "gestione-listini",
        tipo: "CREAZIONE_LISTINO",
        dati_originali: null,
        dati_modificati: { id: docRef.id, ...copia }
      });

      setShowCreaForm(false);
      setNuovoListino("");
      loadListini();
      alert("Listino creato con successo");

    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // =============================
  // CANCELLA LISTINO
  // =============================
  const cancellaListino = async () => {
    if (!editor) return;

    try {
      const q = query(collection(db, "scarichi"), where("listino", "==", editor.nome));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const numeroScarichi = snap.size;
        if (window.confirm(`Il listino è usato in ${numeroScarichi} scarichi.\nVisualizzarli?`)) {
          navigate(`/gestione-scarichi?listino=${encodeURIComponent(editor.nome)}`);
        }
        return;
      }

      if (!window.confirm(`Cancellare "${editor.nome}"?`)) return;

      const datiOriginali = { ...editor };
      await deleteDoc(doc(db, "listini", editor.id));

      await scriviLog({
        pagina: "gestione-listini",
        tipo: "CANCELLAZIONE_LISTINO",
        dati_originali: datiOriginali,
        dati_modificati: null
      });

      setEditor(null);
      setSelectedIndex(null);
      loadListini();

    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // =============================
  // PDF
  // =============================
  const generaPDFListino = (listino, pdf) => {
    pdf.setFontSize(16);
    pdf.text(`Listino: ${listino.nome}`, 14, 15);

    const rows = codiciCER.map(c => [c, listino.prezzi?.[c] ?? 0]);

    autoTable(pdf, {
      startY: 25,
      head: [["Materiale", "Prezzo"]],
      body: rows,
      styles: { fontSize: 9 },
      theme: "grid"
    });
  };

  const stampaListinoSelezionato = () => {
    if (!editor) return;
    const pdf = new jsPDF("p","mm","a4");
    generaPDFListino(editor, pdf);
    pdf.save(`listino_${editor.nome}.pdf`);
  };

  const stampaTuttiListini = () => {
    const pdf = new jsPDF("p","mm","a4");
    listini.forEach((l, i) => {
      if (i !== 0) pdf.addPage();
      generaPDFListino(l, pdf);
    });
    pdf.save("tutti_listini.pdf");
  };

  // =============================
  // UI
  // =============================
  return (
    <div className="gestione-scarichi-container" style={{minHeight:"100vh",padding:"20px"}}>

      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
      </div>

      <h2>Gestione Listini</h2>

      <div style={{display:"flex",gap:"10px",marginBottom:"15px"}}>
        <button onClick={stampaTuttiListini}>🖨 Stampa tutti i listini</button>
        <button onClick={stampaListinoSelezionato} disabled={!editor}>🖨 Stampa listino selezionato</button>
        <button onClick={()=>setShowCreaForm(true)}>➕ Crea Nuovo Listino</button>
      </div>

      {showCreaForm && (
        <div style={{marginBottom:20}}>
          <input type="text" placeholder="Nome nuovo listino" value={nuovoListino} onChange={e=>setNuovoListino(e.target.value)} />
          <select value={listinoDaCopiare} onChange={e=>setListinoDaCopiare(e.target.value)} style={{marginLeft:8}}>
            {listini.map(l=> <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <button style={{marginLeft:8}} onClick={creaNuovoListino}>✅ Crea</button>
        </div>
      )}

      <table className="tabella-scarichi">
        <thead>
          <tr>
            <th>#</th>
            <th>Nome</th>
            {codiciCER.map(c=><th key={c}>{c}</th>)}
            <th>Fornitori associati</th>
            <th>Associa fornitore</th>
          </tr>
        </thead>
        <tbody>
          {listini.map((l,i)=>(
            <tr key={l.id} onClick={()=>selezionaListino(i)} style={{ cursor:"pointer", background:i===selectedIndex?"#ffe7a3":"transparent" }}>
              <td>{i+1}</td>
              <td>{l.nome}</td>
              {codiciCER.map(c=><td key={c}>{l.prezzi?.[c] ?? 0}</td>)}
              <td>
                {(l.predefFornitori || []).map(fid=>{
                  const f = fornitori.find(f=>f.id===fid);
                  return f?.nome || f?.id;
                }).join("; ")}
              </td>
              <td>
                <select style={{marginRight:8}}
                  value={fornitoreSelezionato[l.id] || ""}
                  onChange={e=>setFornitoreSelezionato(prev => ({ ...prev, [l.id]: e.target.value }))}
                >
                  <option value="">--Seleziona--</option>
                  {fornitori.filter(f => !(l.predefFornitori || []).includes(f.id))
                    .map(f=> <option key={f.id} value={f.id}>{f.nome || f.id}</option>)}
                </select>
                <button onClick={()=>associaFornitore(l.id, fornitoreSelezionato[l.id])} disabled={!fornitoreSelezionato[l.id]}>O Associa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editor && (
        <div style={{marginTop:30}}>
          <h3>Modifica {editor.nome}</h3>
          {codiciCER.map(c=>(
            <div key={c}>
              {c}:
              <input type="number" value={editor.prezzi?.[c] ?? 0} onChange={e=>updatePrezzo(c,e.target.value)}
                     style={{marginLeft:10, background:campoModificato(c)?"#fff3a0":"white"}} />
            </div>
          ))}
          <div style={{marginTop:15}}>
            <button onClick={salvaListino}>💾 Salva</button>
            <button onClick={cancellaListino} style={{marginLeft:10}}>🗑 Cancella</button>
          </div>
        </div>
      )}

      {errori.length>0 && <div style={{color:"red"}}>{errori.join("\n")}</div>}

    </div>
  );
};

export default GestioneListini;