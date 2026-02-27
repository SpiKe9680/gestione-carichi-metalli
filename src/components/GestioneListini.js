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
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editor, setEditor] = useState(null);
  const [originalEditor, setOriginalEditor] = useState(null);

  const [rowsPerPage] = useState(6);
  const [currentPage] = useState(1);
  const [errori, setErrori] = useState([]);

  const [nuovoListino, setNuovoListino] = useState("");
  const [listinoDaCopiare, setListinoDaCopiare] = useState("");
  const [showCreaForm, setShowCreaForm] = useState(false);

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
  // LOAD LISTINI
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

  useEffect(() => { loadListini(); }, []);

  // =============================
  // SELEZIONE
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
      prezzi: {
        ...prev.prezzi,
        [codice]: Number(valore) || 0
      }
    }));
  };

  const campoModificato = codice =>
    editor && originalEditor &&
    editor.prezzi[codice] !== originalEditor.prezzi[codice];

  // =============================
  // SALVA
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

    if (!nuovoListino || !listinoDaCopiare)
      return alert("Compila tutti i campi");

    const origine = listini.find(l => l.id === listinoDaCopiare);
    if (!origine) return alert("Listino origine non trovato");

    const copia = {
      nome: nuovoListino,
      prezzi: { ...origine.prezzi }
    };

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
  // CANCELLA
  // =============================
  const cancellaListino = async () => {

    if (!editor) return;

    try {
      const q = query(
        collection(db, "scarichi"),
        where("listino", "==", editor.nome)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const numeroScarichi = snap.size;

        if (window.confirm(
          `Il listino è usato in ${numeroScarichi} scarichi.\nVisualizzarli?`
        )) {
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

    const rows = codiciCER.map(c => [
      c,
      listino.prezzi?.[c] ?? 0
    ]);

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
        <button onClick={stampaTuttiListini}>
          🖨 Stampa tutti i listini
        </button>

        <button
          onClick={stampaListinoSelezionato}
          disabled={!editor}
        >
          🖨 Stampa listino selezionato
        </button>

        <button onClick={()=>setShowCreaForm(true)}>
          ➕ Crea Nuovo Listino
        </button>
      </div>

      {showCreaForm && (
        <div style={{marginBottom:20}}>
          <input
            type="text"
            placeholder="Nome nuovo listino"
            value={nuovoListino}
            onChange={e=>setNuovoListino(e.target.value)}
          />

          <select
            value={listinoDaCopiare}
            onChange={e=>setListinoDaCopiare(e.target.value)}
            style={{marginLeft:8}}
          >
            {listini.map(l=>(
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>

          <button style={{marginLeft:8}} onClick={creaNuovoListino}>
            ✅ Crea
          </button>
        </div>
      )}

      <table className="tabella-scarichi">
        <thead>
          <tr>
            <th>#</th>
            <th>Nome</th>
            {codiciCER.map(c=><th key={c}>{c}</th>)}
          </tr>
        </thead>

        <tbody>
          {listini.map((l,i)=>(
            <tr key={l.id}
                onClick={()=>selezionaListino(i)}
                style={{
                  cursor:"pointer",
                  background:i===selectedIndex?"#ffe7a3":"transparent"
                }}>
              <td>{i+1}</td>
              <td>{l.nome}</td>
              {codiciCER.map(c=>(
                <td key={c}>{l.prezzi?.[c] ?? 0}</td>
              ))}
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
              <input
                type="number"
                value={editor.prezzi?.[c] ?? 0}
                onChange={e=>updatePrezzo(c,e.target.value)}
                style={{
                  marginLeft:10,
                  background:campoModificato(c)?"#fff3a0":"white"
                }}
              />
            </div>
          ))}

          <div style={{marginTop:15}}>
            <button onClick={salvaListino}>💾 Salva</button>
            <button onClick={cancellaListino} style={{marginLeft:10}}>
              🗑 Cancella
            </button>
          </div>
        </div>
      )}

      {errori.length>0 && (
        <div style={{color:"red"}}>{errori.join("\n")}</div>
      )}

    </div>
  );
};

export default GestioneListini;