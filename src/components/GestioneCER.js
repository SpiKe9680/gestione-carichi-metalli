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

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const GestioneCER = () => {
  const navigate = useNavigate();

  const [materiali, setMateriali] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [listini, setListini] = useState([]);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [codiceCER, setCodiceCER] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const [filtroMateriale, setFiltroMateriale] = useState("Tutti");
  const [filtroCER, setFiltroCER] = useState("Tutti");

  const [dal, setDal] = useState(null);
  const [al, setAl] = useState(null);
  const [tutti, setTutti] = useState(false);

  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);

  const [sortField, setSortField] = useState("nome");
  const [sortAsc, setSortAsc] = useState(true);

  const [expandedRows, setExpandedRows] = useState({});

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
    dati.sort((a,b) => (a.data?.seconds || 0) - (b.data?.seconds || 0));
    setScarichi(dati);

    if(dati.length){
      const dates = dati.map(s => s.data?.toDate()).filter(Boolean);
      setMinDataDB(new Date(Math.min(...dates)));
      setMaxDataDB(new Date(Math.max(...dates)));
      setDal(new Date(Math.min(...dates)));
      setAl(new Date(Math.max(...dates)));
    }
  };

  // ---------------- FETCH LISTINI ----------------
  const fetchListini = async () => {
    const snap = await getDocs(collection(db, "listini"));
    const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setListini(dati);
  };

  useEffect(() => {
    fetchMateriali();
    fetchScarichi();
    fetchListini();
  }, []);

  // ---------------- DATE UTILS ----------------
  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  // ---------------- NAV / LOGOUT ----------------
  const goHome = () => navigate("/admin");
  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  // ---------------- RESET FORM ----------------
  const resetForm = () => { setNome(""); setCategoria(""); setCodiceCER(""); setDescrizione(""); setEditingId(null); };

  // ---------------- SAVE / EDIT ----------------
  const handleSave = async () => {
    if (!nome || !codiceCER) { setMessage("Nome e CER obbligatori"); return; }
    try {
      const newData = { nome, categoria, codiceCER, descrizione };

      if(editingId){
        const originale = materiali.find(m => m.idDoc === editingId);
        await updateDoc(doc(db,"materiali",editingId), newData);
        await scriviLog({
          pagina: "Gestione Codici CER",
          tipo: "MODIFICA MATERIALE",
          collezioneRef: "materiali",
          documentoId: editingId,
          dati_originali: originale,
          dati_modificati: newData
        });
        setMessage("Materiale aggiornato!");
      } else {
        const ref = await addDoc(collection(db,"materiali"), newData);
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

    } catch(err){
      console.error(err);
      setMessage("Errore salvataggio");
    }
  };

  // ---------------- EDIT + SCROLL ----------------
  const handleEdit = (m) => {
    setNome(m.nome);
    setCategoria(m.categoria);
    setCodiceCER(m.codiceCER);
    setDescrizione(m.descrizione);
    setEditingId(m.idDoc);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------- TOGGLE DETTAGLI ----------------
  const toggleDettagli = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ---------------- PREPARO MAPPA LISTINI ----------------
  const listiniMap = Object.fromEntries(listini.map(l => [l.nome, l]));

  // ---------------- FILTRAGGIO ----------------
  const materialiFiltrati = materiali
    .filter(m => (filtroMateriale==="Tutti" || m.nome===filtroMateriale) && (filtroCER==="Tutti" || m.codiceCER===filtroCER))
    .map(m => {
      const start = dal;
      const end = al ? new Date(al) : null;
      if(end) end.setHours(23,59,59,999);

      let scarichiPeriodo = scarichi.filter(s => s.data?.toDate);
      scarichiPeriodo = scarichiPeriodo.filter(s => (!tutti && start && end ? s.data.toDate()>=start && s.data.toDate()<=end : true));

      // FILTRAGGIO E CALCOLO DETTAGLIO
      const scarichiMateriale = scarichiPeriodo.flatMap(s =>
        s.scarico.flatMap(blocco =>
          blocco.righe
            .filter(r => r.materiale === m.nome)
            .map(r => ({
              ...r,
              data: s.data,
              listino: s.listino,
              fornitore: s.fornitore,
              prezzoKg: listiniMap[s.listino]?.prezzi[r.materiale] || 0,
              prezzoTotale: (r.peso || 0) * (listiniMap[s.listino]?.prezzi[r.materiale] || 0)
            }))
        )
      );

      scarichiMateriale.sort((a,b) => (a.data?.toDate?.() || new Date(0)) - (b.data?.toDate?.() || new Date(0)));

      return {
        ...m,
        nrScarichi: scarichiMateriale.length,
        dataPrimoScarico: scarichiMateriale.length ? formatDataIT(scarichiMateriale[0].data.toDate()) : "",
        dataUltimoScarico: scarichiMateriale.length ? formatDataIT(scarichiMateriale[scarichiMateriale.length-1].data.toDate()) : "",
        scarichiDettaglio: scarichiMateriale
      };
    })
    .sort((a,b) => {
      const v1 = a[sortField] || "";
      const v2 = b[sortField] || "";
      return sortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });

  const materialiDropdown = filtroCER==="Tutti"
    ? ["Tutti", ...new Set(materiali.map(m=>m.nome))]
    : ["Tutti", ...new Set(materiali.filter(m=>m.codiceCER===filtroCER).map(m=>m.nome))];

  const cerDropdown = filtroMateriale==="Tutti"
    ? ["Tutti", ...new Set(materiali.map(m=>m.codiceCER))]
    : ["Tutti", ...new Set(materiali.filter(m=>m.nome===filtroMateriale).map(m=>m.codiceCER))];

  const handleSort = (field) => {
    if(field===sortField) setSortAsc(!sortAsc);
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
      <div style={{marginBottom:15}}>
        <button onClick={()=>window.print()}>🖨️ Stampa</button>
      </div>
      {message && <p style={{color:"green"}}>{message}</p>}

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

      <div style={{margin:"20px 0", display:"flex", gap:"12px", alignItems:"center"}}>
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
            <label>
              Dal:
              <DatePicker
                selected={dal}
                onChange={setDal}
                minDate={minDataDB || null}
                maxDate={al || maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>

            <label>
              Al:
              <DatePicker
                selected={al}
                onChange={setAl}
                minDate={dal || minDataDB || null}
                maxDate={maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>
          </>
        )}
      </div>

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
            <React.Fragment key={m.idDoc}>
              <tr>
                <td>{m.nome}</td>
                <td>{m.categoria}</td>
                <td>{m.codiceCER}</td>
                <td>{m.descrizione}</td>
                <td>{m.nrScarichi}</td>
                <td>{m.dataPrimoScarico}</td>
                <td>{m.dataUltimoScarico}</td>
                <td>
                  <button onClick={()=>handleEdit(m)}>Modifica</button>
                  {m.nrScarichi>0 && (
                    <button style={{marginLeft:5}} onClick={()=>toggleDettagli(m.idDoc)}>
                      {expandedRows[m.idDoc] ? "Chiudi" : "Dettagli"}
                    </button>
                  )}
                </td>
              </tr>

              {expandedRows[m.idDoc] && (
                <tr>
                  <td colSpan={8}>
                    <table style={{width:"100%", marginTop:5, marginBottom:10, border:"1px solid #ccc"}}>
                      <thead>
                        <tr>
                          <th>Data / Ora</th>
                          <th>Fornitore</th>
                          <th>Listino</th>
                          <th>Prezzo/kg</th>
                          <th>Peso Totale</th>
                          <th>Prezzo Totale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.scarichiDettaglio.map((r, idx) => (
                          <tr key={idx}>
                            <td>{r.data?.toDate().toLocaleString("it-IT")}</td>
                            <td>{r.fornitore}</td>
                            <td>{r.listino}</td>
                            <td>{r.prezzoKg.toFixed(2)}</td>
                            <td>{r.peso}</td>
                            <td>{r.prezzoTotale.toFixed(2)}</td>
                          </tr>
                        ))}

                        <tr style={{fontWeight:"bold"}}>
                          <td colSpan={4}>Totale</td>
                          <td>{m.scarichiDettaglio.reduce((sum,r)=>sum+(r.peso||0),0)}</td>
                          <td>{m.scarichiDettaglio.reduce((sum,r)=>sum+(r.prezzoTotale||0),0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GestioneCER;