
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const GestioneCER = () => {
  const navigate = useNavigate();

  // ---------------- STATE ----------------
  const [materiali, setMateriali] = useState([]);
  const [categorie, setCategorie] = useState([]);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [codiceCER, setCodiceCER] = useState("");
  const [descrizione, setDescrizione] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  // filtri
  const [filterCER, setFilterCER] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterText, setFilterText] = useState("");

  // sorting
  const [sortField, setSortField] = useState("nome");
  const [sortAsc, setSortAsc] = useState(true);

  // autocomplete CER
  const [cerSuggestions, setCerSuggestions] = useState([]);

  // ---------------- FETCH ----------------
  useEffect(() => {
    fetchMateriali();
  }, []);

  const fetchMateriali = async () => {
    const snap = await getDocs(collection(db, "materiali"));
    const data = snap.docs.map(d => ({ idDoc: d.id, ...d.data() }));
    setMateriali(data);

    const uniqueCategorie = [...new Set(data.map(m => m.categoria).filter(Boolean))];
    setCategorie(uniqueCategorie);
  };

  // ---------------- DEBOUNCE SEARCH ----------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ---------------- AUTOCOMPLETE CER ----------------
  useEffect(() => {
    if (!codiceCER) return setCerSuggestions([]);
    const suggestions = [...new Set(materiali.map(m => m.codiceCER).filter(c => c?.startsWith(codiceCER)))].slice(0,5);
    setCerSuggestions(suggestions);
  }, [codiceCER, materiali]);

  // ---------------- NAV ----------------
  const goHome = () => navigate("/admin");

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ---------------- RESET ----------------
  const resetForm = () => {
    setNome(""); setCategoria(""); setCodiceCER(""); setDescrizione(""); setEditingId(null);
  };

  // ---------------- LOG ----------------
  const logOperazione = async ({tipo, docId="", datiVecchi=null, datiNuovi=null}) => {
    const userEmail = auth.currentUser?.email || "sconosciuto";
    const campiModificati = [];

    if (tipo === "modifica" && datiVecchi && datiNuovi) {
      for (let key of ["nome","categoria","codiceCER","descrizione"]) {
        if ((datiVecchi[key] || "") !== (datiNuovi[key] || "")) {
          campiModificati.push(`${key} orig.= ${datiVecchi[key] || ""}`);
          campiModificati.push(`${key} mod.= ${datiNuovi[key] || ""}`);
        }
      }
    }

    await addDoc(collection(db,"log_operazioni"),{
      utente: userEmail,
      timestamp: serverTimestamp(),
      tipoOperazione: tipo,
      pagina: "CodiceCER",
      docId,
      campiModificati,
      cer: datiNuovi?.codiceCER || datiVecchi?.codiceCER || "",
      materiale: datiNuovi?.nome || datiVecchi?.nome || "",
    });
  };

  // ---------------- SAVE ----------------
  const handleSave = async () => {
    if (!nome || !codiceCER) {
      setMessage("Nome e CER obbligatori");
      return;
    }

    try {
      if (editingId) {
        const oldData = materiali.find(m => m.idDoc === editingId);
        const newData = { nome, categoria, codiceCER, descrizione };
        await updateDoc(doc(db, "materiali", editingId), newData);
        await logOperazione({tipo:"modifica", docId:editingId, datiVecchi:oldData, datiNuovi:newData});
        setMessage("Materiale aggiornato!");
      } else {
        const docRef = await addDoc(collection(db,"materiali"), {nome, categoria, codiceCER, descrizione});
        await logOperazione({tipo:"aggiunta", docId:docRef.id, datiNuovi:{nome,categoria,codiceCER,descrizione}});
        setMessage("Materiale aggiunto!");
      }
      resetForm();
      fetchMateriali();
    } catch(err) {
      console.error(err);
      setMessage("Errore salvataggio");
    }
  };

  // ---------------- EDIT ----------------
  const handleEdit = (m) => {
    setNome(m.nome); setCategoria(m.categoria); setCodiceCER(m.codiceCER); setDescrizione(m.descrizione);
    setEditingId(m.idDoc);
  };

  // ---------------- DELETE ----------------
  const handleDelete = async (id) => {
    const m = materiali.find(m=>m.idDoc===id);
    if (!m || !window.confirm("Eliminare materiale?")) return;
    try {
      await deleteDoc(doc(db,"materiali",id));
      await logOperazione({tipo:"elimina", docId:id, datiVecchi:m});
      fetchMateriali();
    } catch(err){ console.error(err); }
  };

  // ---------------- SORT ----------------
  const handleSort = (field) => {
    if (field===sortField) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  // ---------------- FILTER + SORT ----------------
  const materialiFiltrati = materiali
    .filter(m => m.codiceCER?.includes(filterCER) && m.nome?.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a,b) => {
      const v1 = a[sortField] || "";
      const v2 = b[sortField] || "";
      return sortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });

  // ---------------- UI ----------------
  return (
    <div className="gestione-utenti-container">

      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
      </div>

      <h2>Gestione Codici CER</h2>
      {message && <p style={{color:"green"}}>{message}</p>}

      {/* FORM */}
      <div className="form">
        <input placeholder="Nome materiale" value={nome} onChange={e=>setNome(e.target.value)} />
        <select value={categoria} onChange={e=>setCategoria(e.target.value)}>
          <option value="">Categoria</option>
          {categorie.map(c=> <option key={c}>{c}</option>)}
        </select>

        <div style={{position:"relative"}}>
          <input placeholder="Codice CER" value={codiceCER} onChange={e=>setCodiceCER(e.target.value)} />
          {cerSuggestions.length>0 && (
            <div className="autocomplete">
              {cerSuggestions.map(s=>(
                <div key={s} onClick={()=>setCodiceCER(s)} className="autocomplete-item">{s}</div>
              ))}
            </div>
          )}
        </div>

        <input placeholder="Descrizione" value={descrizione} onChange={e=>setDescrizione(e.target.value)} />
        <button onClick={handleSave}>{editingId ? "Aggiorna" : "Aggiungi"}</button>
      </div>

      {/* FILTRI */}
      <div style={{margin:"20px 0"}}>
        <input placeholder="Filtro CER" value={filterCER} onChange={e=>setFilterCER(e.target.value)} />
        <input placeholder="Cerca materiale..." value={searchText} onChange={e=>setSearchText(e.target.value)} />
      </div>

      {/* TABELLA */}
      <table>
        <thead>
          <tr>
            <th onClick={()=>handleSort("nome")}>Nome</th>
            <th onClick={()=>handleSort("categoria")}>Categoria</th>
            <th onClick={()=>handleSort("codiceCER")}>CER</th>
            <th>Descrizione</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {materialiFiltrati.map(m=>(
            <tr key={m.idDoc}>
              <td>{m.nome}</td>
              <td>{m.categoria}</td>
              <td>{m.codiceCER}</td>
              <td>{m.descrizione}</td>
              <td>
                <button onClick={()=>handleEdit(m)}>Modifica</button>
                <button className="elimina" onClick={()=>handleDelete(m.idDoc)}>Elimina</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
};

export default GestioneCER;

