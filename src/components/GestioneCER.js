// src/pages/GestioneCER.js
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";

const GestioneCER = () => {
  const navigate = useNavigate();

  // ---------------- STATE ----------------
  const [materiali, setMateriali] = useState([]);
  const [scarichi, setScarichi] = useState([]);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [codiceCER, setCodiceCER] = useState("");
  const [descrizione, setDescrizione] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  // filtri dropdown
  const [filtroMateriale, setFiltroMateriale] = useState("Tutti");
  const [filtroCER, setFiltroCER] = useState("Tutti");

  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [tutti, setTutti] = useState(false);

  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);

  const [sortField, setSortField] = useState("nome");
  const [sortAsc, setSortAsc] = useState(true);

  // ---------------- FETCH MATERIALI ----------------
  const fetchMateriali = async () => {
    const snap = await getDocs(collection(db, "materiali"));
    const data = snap.docs.map(d => ({ idDoc: d.id, ...d.data() }));
    setMateriali(data);
  };

  // ---------------- FETCH SCARICHI ----------------
  const fetchScarichi = async () => {
    const snap = await getDocs(collection(db, "scarichi"));
    const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setScarichi(dati);
  };

  useEffect(() => {
    fetchMateriali();
    fetchScarichi();
  }, []);

  // ---------------- DATE UTILS ----------------
  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const parseItalianDate = (value, endOfDay=false) => {
    if (!value) return null;
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1],10);
    const month = parseInt(match[2],10)-1;
    const year = parseInt(match[3],10);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    if (endOfDay) date.setHours(23,59,59,999);
    return date;
  };

  // ---------------- INIT DATE RANGE ----------------
  useEffect(() => {
    if (materiali.length) {
      const today = new Date();
      setDal(formatDataIT(today));
      setAl(formatDataIT(today));
    }
  }, [materiali]);

  // ---------------- NAV / LOGOUT ----------------
  const goHome = () => navigate("/admin");
  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  // ---------------- RESET FORM ----------------
  const resetForm = () => { setNome(""); setCategoria(""); setCodiceCER(""); setDescrizione(""); setEditingId(null); };

  // ---------------- SAVE / EDIT ----------------
  const handleSave = async () => {
  if (!nome || !codiceCER) {
    setMessage("Nome e CER obbligatori");
    return;
  }

  try {

    const newData = {
      nome,
      categoria,
      codiceCER,
      descrizione
    };

    // =========================
    // MODIFICA
    // =========================
    if (editingId) {

      // recupero dati ORIGINALI per audit trail
      const originale = materiali.find(m => m.idDoc === editingId);

      await updateDoc(doc(db, "materiali", editingId), newData);

      await scriviLog({
        pagina: "Gestione Codici CER",
        tipo: "MODIFICA MATERIALE",
        collezioneRef: "materiali",
        documentoId: editingId,
        dati_originali: originale,
        dati_modificati: newData
      });

      setMessage("Materiale aggiornato!");
    }

    // =========================
    // CREAZIONE
    // =========================
    else {

      const ref = await addDoc(collection(db, "materiali"), newData);

      await scriviLog({
        pagina: "Gestione Codici CER",
        tipo: "CREAZIONE MATERIALE",
        collezioneRef: "materiali",
        documentoId: ref.id,
        dati_originali: null,
        dati_modificati: newData
      });

      setMessage("Materiale aggiunto!");
    }

    resetForm();
    fetchMateriali();

  } catch (err) {
    console.error(err);
    setMessage("Errore salvataggio");
  }
};

  const handleEdit = (m) => { setNome(m.nome); setCategoria(m.categoria); setCodiceCER(m.codiceCER); setDescrizione(m.descrizione); setEditingId(m.idDoc); };

  // ---------------- FILTRAGGIO MATERIALI CON FILTRI CONNESSI ----------------
  const materialiFiltrati = materiali
    .filter(m => {
      // Filtro materiale
      if(filtroMateriale!=="Tutti" && m.nome!==filtroMateriale) return false;
      // Filtro CER
      if(filtroCER!=="Tutti" && m.codiceCER!==filtroCER) return false;
      return true;
    })
    .map(m => {
      const start = parseItalianDate(dal);
      const end = parseItalianDate(al, true);
      let scarichiPeriodo = scarichi.filter(s => s.data?.toDate);
      scarichiPeriodo = scarichiPeriodo.filter(s => (!tutti && start && end ? s.data.toDate()>=start && s.data.toDate()<=end : true));

      const scarichiMateriale = scarichiPeriodo.filter(s =>
        s.scarico.some(c => c.righe?.some(r => r.materiale === m.nome))
      );

      scarichiMateriale.sort((a,b) => (a.data?.toDate?.() || new Date(0)) - (b.data?.toDate?.() || new Date(0)));

      return {
        ...m,
        nrScarichi: scarichiMateriale.length,
        dataPrimoScarico: scarichiMateriale.length ? formatDataIT(scarichiMateriale[0].data.toDate()) : "",
        dataUltimoScarico: scarichiMateriale.length ? formatDataIT(scarichiMateriale[scarichiMateriale.length-1].data.toDate()) : ""
      };
    })
    .sort((a,b) => {
      const v1 = a[sortField] || "";
      const v2 = b[sortField] || "";
      return sortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });

  // --- LISTE FILTRI INCROCIATI ---
  const materialiDropdown = filtroCER==="Tutti"
    ? ["Tutti", ...new Set(materiali.map(m=>m.nome))]
    : ["Tutti", ...new Set(materiali.filter(m=>m.codiceCER===filtroCER).map(m=>m.nome))];

  const cerDropdown = filtroMateriale==="Tutti"
    ? ["Tutti", ...new Set(materiali.map(m=>m.codiceCER))]
    : ["Tutti", ...new Set(materiali.filter(m=>m.nome===filtroMateriale).map(m=>m.codiceCER))];

  // ---------------- SORT ----------------
  const handleSort = (field) => {
    if (field === sortField) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  // ---------------- UI ----------------
  return (
    <div className="gestione-utenti-container">
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email||"sconosciuto"})</button>
      </div>

      <h2>Gestione Codici CER</h2>
      {message && <p style={{color:"green"}}>{message}</p>}

      {/* FORM */}
      <div className="form">
        <input placeholder="Nome materiale" value={nome} onChange={e=>setNome(e.target.value)} />
        <select value={categoria} onChange={e=>setCategoria(e.target.value)}>
          <option value="">Categoria</option>
          {[...new Set(materiali.map(m=>m.categoria).filter(Boolean))].map(c=> <option key={c}>{c}</option>)}
        </select>

        <input placeholder="Codice CER" value={codiceCER} onChange={e=>setCodiceCER(e.target.value)} />
        <input placeholder="Descrizione" value={descrizione} onChange={e=>setDescrizione(e.target.value)} />
        <button onClick={handleSave}>{editingId ? "Aggiorna" : "Aggiungi"}</button>
      </div>

      {/* FILTRI */}
      <div style={{margin:"20px 0", display:"flex", gap:"12px"}}>
        <label>
          Materiale:
          <select value={filtroMateriale} onChange={e=>setFiltroMateriale(e.target.value)}>
            {materialiDropdown.map(m=> <option key={m}>{m}</option>)}
          </select>
        </label>

        <label>
          Codice CER:
          <select value={filtroCER} onChange={e=>setFiltroCER(e.target.value)}>
            {cerDropdown.map(c=> <option key={c}>{c}</option>)}
          </select>
        </label>

        <label>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)} /> Disabilita filtro date
        </label>

        {!tutti && (
          <>
            Dal: <input type="text" value={dal} onChange={e=>setDal(e.target.value)} style={{width:"100px"}} />
            Al: <input type="text" value={al} onChange={e=>setAl(e.target.value)} style={{width:"100px"}} />
          </>
        )}
      </div>

      {/* TABELLA */}
      <table>
        <thead>
          <tr>
            <th onClick={()=>handleSort("nome")}>Nome</th>
            <th onClick={()=>handleSort("categoria")}>Categoria</th>
            <th onClick={()=>handleSort("codiceCER")}>CER</th>
            <th>Descrizione</th>
            <th>Nr Scarichi</th>
            <th>Primo Scarico</th>
            <th>Ultimo Scarico</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {materialiFiltrati.map(m => (
            <tr key={m.idDoc}>
              <td>{m.nome}</td>
              <td>{m.categoria}</td>
              <td>{m.codiceCER}</td>
              <td>{m.descrizione}</td>
              <td>{m.nrScarichi}</td>
              <td>{m.dataPrimoScarico}</td>
              <td>{m.dataUltimoScarico}</td>
              <td>
                <button onClick={()=>handleEdit(m)}>Modifica</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GestioneCER;