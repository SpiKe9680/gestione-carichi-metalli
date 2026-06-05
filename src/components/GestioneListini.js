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
  where,
  getDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
import { loadConfigAzienda, getDataOraStampa, PdfHeader } from "../utils/dateUtils";

const GestioneListini = () => {
let currentUser = {};

try {
   const raw = sessionStorage.getItem("utenteLoggato");

  if (!raw || raw === "undefined" || raw === "null") {
    currentUser = {};
  } else {
    currentUser = JSON.parse(raw);
  }
} catch (e) {
  console.warn("⚠️ utenteLoggato non valido:", sessionStorage.getItem("utenteLoggato"));
  currentUser = {};
}
const [propagaModificaGlobale, setPropagaModificaGlobale] = useState(false);
  const [listini, setListini] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  //const [configAzienda, setConfigAzienda] = useState(null);
const [propagaPrezzi, setPropagaPrezzi] = useState({});
  const [editor, setEditor] = useState(null);
  const [originalEditor, setOriginalEditor] = useState(null);
const [sortConfig, setSortConfig] = useState({
  key: null,
  direction: "asc",
});
const requestSort = (key) => {
  setSortConfig(prev => {
    if (prev.key === key && prev.direction === "asc") {
      return { key, direction: "desc" };
    }
    return { key, direction: "asc" };
  });
};
const getUtenteReact = () => {
  return (
    currentUser.username || currentUser.email 
  );
};
  const [nuovoListino, setNuovoListino] = useState("");
  const [listinoDaCopiare, setListinoDaCopiare] = useState("");
  const [nuovoTipoListino, setNuovoTipoListino] = useState("SCARICO");
  const [showCreaForm, setShowCreaForm] = useState(false);
  const [errori, setErrori] = useState([]);
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState({}); // map listinoId -> fornitoreId
const [modificaPercentuale, setModificaPercentuale] = useState(0);
const [modificaAzione, setModificaAzione] = useState("AUMENTA");
  const navigate = useNavigate();
const [tipoFiltroListino, setTipoFiltroListino] = useState("SCARICO");
 
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
const materialiDinamici = React.useMemo(() => {
  const set = new Set();

  listini.forEach(l => {
    Object.keys(l.prezzi || {}).forEach(k => {
      if (k && k.trim()) {
        set.add(k.trim());
      }
    });
  });

  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, "it", { numeric: true })
  );
}, [listini]);
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
  loadConfigAzienda();
}, []);

  // =============================
  // SELEZIONE LISTINO
  // =============================
const normalizzaPrezzi = (prezzi = {}) => {
  const out = {};

  Object.entries(prezzi).forEach(([k, v]) => {
    if (typeof v === "object" && v !== null) {
      out[k] = {
        vendita: Number(v.vendita ?? v.acquisto ?? 0),
        acquisto: Number(v.acquisto ?? v.vendita ?? 0)
      };
    } else {
      out[k] = {
        vendita: Number(v) || 0,
        acquisto: Number(v) || 0
      };
    }
  });

  return out;
};
const selezionaListino = (listinoId) => {
  const l = listini.find(x => x.id === listinoId);
  if (!l) return;

  const listinoFix = {
    ...l,
    prezzi: normalizzaPrezzi(l.prezzi || {}),
    tipoListino: l.tipoListino || "SCARICO"
  };

  setEditor(listinoFix);
  setOriginalEditor(JSON.parse(JSON.stringify(listinoFix)));
};
  // =============================
  // UPDATE PREZZO
  // =============================
const updatePrezzo = (codice, valore) => {
  const num = Number(valore) || 0;

  setEditor(prev => {
    const vecchio = originalEditor?.prezzi?.[codice];

    const vecchioVal = prev?.tipoListino === "CARICO"
      ? vecchio?.vendita ?? 0
      : vecchio?.acquisto ?? 0;

    const changed = num !== Number(vecchioVal);

    return {
      ...prev,
      prezzi: {
        ...prev.prezzi,
        [codice]: {
          ...(prev.prezzi?.[codice] || {}),
          vendita: num,
          acquisto: num
        }
      }
    };
  });

  // toggle checkbox dinamica
  setPropagaPrezzi(prev => {
    const nuovo = { ...prev };
    if (Number(valore) === Number(originalEditor?.prezzi?.[codice]?.vendita ?? 0)) {
      delete nuovo[codice];
    } else {
      nuovo[codice] = true;
    }
    return nuovo;
  });
};

const campoModificato = (codice) => {
  if (!editor || !originalEditor) return false;

  const nuovo = editor.prezzi?.[codice];
  const vecchio = originalEditor.prezzi?.[codice];

  const nuovoVal = editor.tipoListino === "CARICO"
    ? nuovo?.vendita ?? 0
    : nuovo?.acquisto ?? 0;

  const vecchioVal = originalEditor.tipoListino === "CARICO"
    ? vecchio?.vendita ?? 0
    : vecchio?.acquisto ?? 0;

  return Number(nuovoVal) !== Number(vecchioVal);
};

const associaFornitore = async (listinoId, fornitoreId) => {
  const listino = listini.find(l => l.id === listinoId);
  const fornitore = fornitori.find(f => f.id === fornitoreId);
  if (!listino || !fornitore) return;

  try {
    const datiOriginali = {
      listinoId,
      fornitoreId,
      predefListinoVecchio: fornitore.predefListino || null
    };

    await updateDoc(doc(db, "fornitori", fornitoreId), {
      predefListino: listinoId
    });

    for (const l of listini) {
      if ((l.predefFornitori || []).includes(fornitoreId) && l.id !== listinoId) {
        const nuoviFornitori = l.predefFornitori.filter(fid => fid !== fornitoreId);
        await updateDoc(doc(db, "listini", l.id), {
          predefFornitori: nuoviFornitori
        });
      }
    }

    const predefFornitori = listino.predefFornitori || [];
    if (!predefFornitori.includes(fornitoreId)) {
      await updateDoc(doc(db, "listini", listinoId), {
        predefFornitori: [...predefFornitori, fornitoreId]
      });
    }

    await scriviLog({
      pagina: "gestione-listini",
      evento: "ASSOCIA_FORNITORE",
      riferimento: {
        collezione: "listini",
        documentoId: listinoId
      },
      before: datiOriginali,
      after: { listinoId, fornitoreId },
      utente: getUtenteReact(),
      ripristinabile: true
    });

    setFornitoreSelezionato(prev => ({ ...prev, [listinoId]: "" }));
    loadListini();
    loadFornitori();

  } catch (e) {
    setErrori(prev => [...prev, e.message]);
  }
};

const generaPDFListinoConHeader = async (listino) => {
  const { pdf, startY } = await PdfHeader();
  pdf.setFontSize(16);
  const { data, ora } = getDataOraStampa();

  pdf.setFontSize(16);
  pdf.text(`Listino: ${listino.nome} - Stampato il ${data} alle ${ora}`, 14, 65);

  pdf.setFontSize(12);
pdf.text(`Tipo Listino: ${listino.tipoListino || "SCARICO"}`, 14, 75);  // <--- nuova riga

  // Tabella prezzi
  const materiali = Object.keys(listino.prezzi || {}).sort();
const rows = materiali.map(c => [
  c,
  listino.tipoListino === "CARICO"
    ? listino.prezzi?.[c]?.vendita ?? 0
    : listino.prezzi?.[c]?.acquisto ?? 0
]);
  autoTable(pdf, {
    startY: startY,
    head: [["Materiale", "Prezzo"]],
    body: rows,
    styles: { fontSize: 9 },
    theme: "grid"
  });


  await salvaESharePdfCapacitor(pdf, `listino_${listino.nome}.pdf`);
};
const salvaListino = async () => {
  if (!editor) return;

  try {
    const ref = doc(db, "listini", editor.id);

    await updateDoc(ref, {
      prezzi: editor.prezzi,
      nome: editor.nome,
      tipoListino: editor.tipoListino
    });

    const altriListini = listini.filter(
      l => l.id !== editor.id &&
      (l.tipoListino || "SCARICO") === editor.tipoListino
    );

    for (const l of altriListini) {
      let updated = false;
      const nuoviPrezzi = { ...(l.prezzi || {}) };

      Object.keys(propagaPrezzi).forEach(codice => {
        if (!propagaPrezzi[codice]) return;

        const valore = editor.prezzi?.[codice];
        if (!valore) return;

        nuoviPrezzi[codice] = {
          vendita: valore.vendita,
          acquisto: valore.acquisto
        };

        updated = true;
      });

      if (updated) {
        await updateDoc(doc(db, "listini", l.id), {
          prezzi: nuoviPrezzi
        });
      }
    }

    await scriviLog({
      pagina: "gestione-listini",
      evento: "MODIFICA_LISTINO",
      riferimento: {
        collezione: "listini",
        documentoId: editor.id
      },
      before: originalEditor,
      after: editor,
      utente: getUtenteReact(),
      ripristinabile: true
    });

    setEditor(null);
    setOriginalEditor(null);
    setPropagaPrezzi({});
    loadListini();

  } catch (e) {
    setErrori(prev => [...prev, e.message]);
  }
};

const creaNuovoListino = async () => {
  try {
    if (!nuovoListino || !listinoDaCopiare) {
      alert("Compila tutti i campi");
      return;
    }

    const nomePulito = nuovoListino.trim().toLowerCase();

    const esiste = listini.some(l =>
      (l.nome || "").trim().toLowerCase() === nomePulito
    );

    if (esiste) {
      alert("Esiste già un listino con questo nome");
      return;
    }

    const origine = listini.find(l => l.id === listinoDaCopiare);
    if (!origine) {
      alert("Listino origine non trovato");
      return;
    }

    const prezziModificati = {};

    Object.entries(origine.prezzi || {}).forEach(([codice, valore]) => {
      const vendita = Number(valore?.vendita) || 0;
      const acquisto = Number(valore?.acquisto) || 0;

      let nuovaVendita = vendita;
      let nuovoAcquisto = acquisto;

      if (modificaPercentuale > 0) {
        const factor = modificaAzione === "AUMENTA"
          ? (1 + modificaPercentuale / 100)
          : (1 - modificaPercentuale / 100);

        nuovaVendita *= factor;
        nuovoAcquisto *= factor;
      }

      prezziModificati[codice] = {
        vendita: parseFloat(nuovaVendita.toFixed(2)),
        acquisto: parseFloat(nuovoAcquisto.toFixed(2))
      };
    });

    const copia = {
      nome: nuovoListino,
      prezzi: prezziModificati,
      predefFornitori: [],
      tipoListino: nuovoTipoListino || "SCARICO"
    };

    const docRef = await addDoc(collection(db, "listini"), copia);

    await scriviLog({
      pagina: "gestione-listini",
      evento: "CREAZIONE_LISTINO",
      riferimento: {
        collezione: "listini",
        documentoId: docRef.id
      },
      before: null,
      after: { id: docRef.id, ...copia },
      utente: getUtenteReact(),
      ripristinabile: true
    });

    setShowCreaForm(false);
    setNuovoListino("");
    setModificaPercentuale(0);

    await loadListini();

    alert("Listino creato con successo");

  } catch (e) {
    alert("Errore: " + e.message);
  }
};

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

      if (window.confirm(`Listino usato in ${numeroScarichi} scarichi.\nVisualizzarli?`)) {
        navigate(`/gestione-scarichi?listino=${encodeURIComponent(editor.nome)}`);
      }
      return;
    }

    if (!window.confirm(`Cancellare "${editor.nome}"?`)) return;

    const datiOriginali = { ...editor };

    await deleteDoc(doc(db, "listini", editor.id));

    await scriviLog({
      pagina: "gestione-listini",
      evento: "CANCELLAZIONE_LISTINO",
      riferimento: {
        collezione: "listini",
        documentoId: editor.id
      },
      before: datiOriginali,
      after: null,
      utente: getUtenteReact(),
      ripristinabile: false
    });

    setEditor(null);
    loadListini();

  } catch (e) {
    setErrori(prev => [...prev, e.message]);
  }
};


 
  // =============================
  // PDF
  // =============================


  const stampaListinoSelezionato = async () => {
  if (!editor) return;
  await generaPDFListinoConHeader(editor);
};

const stampaTuttiListini = async () => {
  const pdf = new jsPDF("p", "mm", "a4");

  for (let i = 0; i < listini.length; i++) {
    const l = listini[i];

    if (i !== 0) pdf.addPage();

    await generaPDFListinoConHeader(l, pdf);
  }

  await salvaESharePdfCapacitor(pdf, "tutti_listini.pdf");
};


let listiniOrdinati = [...listini].filter(
  l => (l.tipoListino || "SCARICO") === tipoFiltroListino
);

if (sortConfig.key) {
  listiniOrdinati.sort((a, b) => {
    let aVal = "";
    let bVal = "";

    switch (sortConfig.key) {
      case "nome":
        aVal = a.nome || "";
        bVal = b.nome || "";
        break;

      case "tipo":
        aVal = a.tipoListino || "SCARICO";
        bVal = b.tipoListino || "SCARICO";
        break;

      case "fornitori":
        aVal = (a.predefFornitori || []).length;
        bVal = (b.predefFornitori || []).length;
        break;

      case "index":
        aVal = listini.indexOf(a);
        bVal = listini.indexOf(b);
        break;

      default:
        return 0;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortConfig.direction === "asc"
        ? aVal - bVal
        : bVal - aVal;
    }

    return sortConfig.direction === "asc"
      ? String(aVal).localeCompare(String(bVal), "it", { numeric: true })
      : String(bVal).localeCompare(String(aVal), "it", { numeric: true });
  });
}
  // =============================
  // UI
  // =============================
  return (
    <div className="gestione-scarichi-container" style={{minHeight:"100vh",padding:"20px"}}>

      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})</button>
      </div>

      <h2>Gestione Listini</h2>

      <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"15px"}}>
  <label>Tipo Listino:</label>
 <select value={tipoFiltroListino} onChange={e => { setTipoFiltroListino(e.target.value);  }}>
    <option value="SCARICO">Scarico (ingresso)</option>
    <option value="CARICO">Carico (uscita)</option>
  </select>
</div>

      <div style={{display:"flex",gap:"10px",marginBottom:"15px"}}>
        <button onClick={stampaTuttiListini}>🖨 Stampa tutti i listini</button>
        <button onClick={stampaListinoSelezionato} disabled={!editor}>🖨 Stampa listino selezionato</button>
        <button onClick={()=>setShowCreaForm(true)}>➕ Crea Nuovo Listino</button>
      </div>

      {showCreaForm && (
        <div style={{marginBottom:20}}>
          <input type="text" placeholder="Nome nuovo listino" value={nuovoListino} onChange={e=>setNuovoListino(e.target.value)} />
          <select value={listinoDaCopiare} onChange={e=>setListinoDaCopiare(e.target.value)} style={{marginLeft:8}}>
            {listiniOrdinati.map((l, i) =>  <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <select value={nuovoTipoListino} onChange={e=>setNuovoTipoListino(e.target.value)} style={{marginLeft:8}}>
  <option value="SCARICO">Scarico (ingresso)</option>
  <option value="CARICO">Carico (uscita)</option>
</select>
<div style={{display:"inline-flex", alignItems:"center", gap:4, marginLeft:8}}>
  <div style={{display:"flex", alignItems:"center", gap:"4px", marginLeft:8}}>
  <select value={modificaAzione} onChange={e => setModificaAzione(e.target.value)}>
    <option value="AUMENTA">Aumenta Prezzi</option>
    <option value="DIMINUISCI">Diminuisci Prezzi</option>
  </select>
  <input 
    type="number" 
    value={modificaPercentuale} 
    onChange={e => setModificaPercentuale(Number(e.target.value))}
    min={0} max={99} style={{width:60}} 
  />%
</div>
</div>
          <button style={{marginLeft:8}} onClick={creaNuovoListino}>✅ Crea</button>
        </div>
      )}
<table className="tabella-scarichi">
  <thead>
    <tr>
      <th onClick={() => requestSort("index")} style={{ cursor: "pointer" }}>
        #
      </th>

      <th onClick={() => requestSort("nome")} style={{ cursor: "pointer" }}>
        Nome {sortConfig.key === "nome" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>

      <th onClick={() => requestSort("tipo")} style={{ cursor: "pointer" }}>
        Tipo {sortConfig.key === "tipo" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>

      {materialiDinamici.map((c) => (
        <th key={c}>{c}</th>
      ))}

      <th onClick={() => requestSort("fornitori")} style={{ cursor: "pointer" }}>
        Fornitori {sortConfig.key === "fornitori" ? (sortConfig.direction === "asc" ? "⬆️" : "⬇️") : ""}
      </th>

      <th>Associa fornitore</th>
    </tr>
  </thead>

  <tbody>
    {listiniOrdinati.map((l, i) => (
      <tr
        key={l.id}
        onClick={() => selezionaListino(l.id)}
        style={{
          cursor: "pointer",
          background:
           editor?.id === l.id ? "#ffe7a3" : "transparent"
        }}
      >
        {/* # */}
        <td>{i + 1}</td>

        {/* NOME */}
        <td>{l.nome}</td>

        {/* TIPO (🔥 QUESTO RISOLVE LO SHIFT) */}
        <td>{l.tipoListino || "SCARICO"}</td>

        {/* MATERIALI */}
        {materialiDinamici.map((c) => (
          <td key={c}>
            {l.tipoListino === "CARICO"
              ? (l.prezzi?.[c]?.vendita ?? l.prezzi?.[c]?.acquisto ?? 0)
              : (l.prezzi?.[c]?.acquisto ?? 0)}
          </td>
        ))}

        {/* FORNITORI */}
        <td>
          {(l.predefFornitori || [])
            .map((fid) => fornitori.find((f) => f.id === fid))
            .filter(Boolean)
            .map((f) => f.nome || f.id)
            .join("; ")}
        </td>

        {/* ASSOCIA FORNITORE */}
        <td>
          <select
            style={{ marginRight: 8 }}
            value={fornitoreSelezionato[l.id] || ""}
            onChange={(e) =>
              setFornitoreSelezionato((prev) => ({
                ...prev,
                [l.id]: e.target.value
              }))
            }
          >
            <option value="">--Seleziona--</option>

            {fornitori
              .filter((f) => !(l.predefFornitori || []).includes(f.id))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome || f.id}
                </option>
              ))}
          </select>

          <button
            onClick={() =>
              associaFornitore(l.id, fornitoreSelezionato[l.id])
            }
            disabled={!fornitoreSelezionato[l.id]}
          >
            Associa
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>

      {editor && (
        <div style={{marginTop:30}}>
          <h3>Modifica {editor.nome}</h3>
          <div style={{marginBottom:15}}>
  <label>Tipo Listino:</label>
  <select 
    value={editor.tipoListino || "SCARICO"} 
    onChange={e => setEditor(prev => ({ ...prev, tipoListino: e.target.value }))}
    style={{marginLeft:8}}
  >
    <option value="SCARICO">Scarico (ingresso)</option>
    <option value="CARICO">Carico (uscita)</option>
  </select>
</div>
{materialiDinamici.map(c => (
  <div key={c} style={{ marginBottom: 6 }}>
    {c}:

    <input
      type="number"
      value={
        editor.tipoListino === "CARICO"
          ? editor.prezzi?.[c]?.vendita ?? 0
          : editor.prezzi?.[c]?.acquisto ?? 0
      }
      onChange={e => updatePrezzo(c, e.target.value)}
      style={{
        marginLeft: 10,
        background: campoModificato(c) ? "#fff3a0" : "white"
      }}
    />

    {/* CHECKBOX DINAMICA */}
    {campoModificato(c) && (
      <label style={{ marginLeft: 10, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={!!propagaPrezzi[c]}
          onChange={(e) =>
            setPropagaPrezzi(prev => ({
              ...prev,
              [c]: e.target.checked
            }))
          }
        />
        applica a tutti i listini ({editor.tipoListino})
      </label>
    )}
  </div>
))}
          <div style={{ marginTop: 10, marginBottom: 10 }}>
  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input
      type="checkbox"
      checked={propagaModificaGlobale}
      onChange={(e) => setPropagaModificaGlobale(e.target.checked)}
    />
    Applicare questa modifica a tutti i listini
    ({editor.tipoListino === "CARICO" ? "CARICO" : "SCARICO"})
  </label>
</div>
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