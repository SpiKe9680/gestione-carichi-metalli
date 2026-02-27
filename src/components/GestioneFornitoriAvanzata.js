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

const GestioneFornitoriAvanzata = () => {

  const navigate = useNavigate();

  const [fornitori, setFornitori] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [errori, setErrori] = useState([]);

  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");

  // ---------------- LOGOUT / DASHBOARD ----------------
  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  const goDashboard = () => navigate("/admin");

  // ---------------- LOAD DATA ----------------
  const loadData = async () => {
    try {
      const fornSnap = await getDocs(collection(db, "fornitori"));
      setFornitori(fornSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const scarSnap = await getDocs(collection(db, "scarichi"));
      setScarichi(scarSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setErrori([e.message]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------------- COUNT SCARICHI ----------------
  const countScarichi = (fornitore) => {
    let lista = scarichi.filter(
      s => s.fornitore === fornitore.nome
    );

    if (dateFilterEnabled && dataInizio && dataFine) {
      const inizio = new Date(dataInizio);
      const fine = new Date(dataFine);

      lista = lista.filter(s => {
        const d = s.data?.toDate ? s.data.toDate() : new Date(s.data);
        return d >= inizio && d <= fine;
      });
    }

    return lista.length;
  };

  // ---------------- AGGIUNGI ----------------
  const aggiungiFornitore = async () => {
    const nome = prompt("Nome fornitore (obbligatorio):");
    if (!nome) return;

    const exists = fornitori.some(
      f => f.nome.toLowerCase() === nome.toLowerCase()
    );

    if (exists) {
      alert("Fornitore già esistente");
      return;
    }

    const indirizzo = prompt("Indirizzo (opzionale):") || "";
    const piva_cf = prompt("P.IVA / CF (opzionale):") || "";

    try {
      await addDoc(collection(db, "fornitori"), {
        nome,
        indirizzo,
        piva_cf
      });

      loadData();
    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // ---------------- MODIFICA (NO NOME!) ----------------
  const modificaFornitore = async (f) => {

    const indirizzo = prompt(
      `Modifica indirizzo (${f.nome})`,
      f.indirizzo || ""
    ) || "";

    const piva_cf = prompt(
      `Modifica P.IVA / CF (${f.nome})`,
      f.piva_cf || ""
    ) || "";

    try {
      const ref = doc(db, "fornitori", f.id);

      await updateDoc(ref, {
        indirizzo,
        piva_cf
      });

      loadData();
    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // ---------------- ELIMINA ----------------
  const eliminaFornitore = async (f) => {

    if (countScarichi(f) > 0) {
      alert("Non eliminabile: esistono scarichi collegati.");
      return;
    }

    if (!window.confirm(`Eliminare ${f.nome}?`)) return;

    try {
      await deleteDoc(doc(db, "fornitori", f.id));
      loadData();
    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // ---------------- DATE VALIDATION ----------------
  const changeDataInizio = (v) => {
    setDataInizio(v);
    if (dataFine && v > dataFine) setDataFine(v);
  };

  const changeDataFine = (v) => {
    setDataFine(v);
    if (dataInizio && v < dataInizio) setDataInizio(v);
  };

  // ---------------- UI ----------------
  return (
    <div className="gestione-scarichi-container">

      {/* HEADER STANDARD */}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goDashboard}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
      </div>

      <h2>Gestione Fornitori</h2>

      <button onClick={aggiungiFornitore} style={{marginBottom:15}}>
        ➕ Aggiungi Fornitore
      </button>

      {/* FILTRO DATE */}
      <div style={{marginBottom:15}}>
        <label>
          <input
            type="checkbox"
            checked={dateFilterEnabled}
            onChange={e=>setDateFilterEnabled(e.target.checked)}
          />
          {" "}Filtro per data
        </label>

        {dateFilterEnabled && (
          <>
            <span style={{marginLeft:10}}>Dal:</span>
            <input
              type="date"
              value={dataInizio}
              onChange={e=>changeDataInizio(e.target.value)}
            />

            <span style={{marginLeft:10}}>Al:</span>
            <input
              type="date"
              value={dataFine}
              onChange={e=>changeDataFine(e.target.value)}
            />
          </>
        )}
      </div>

      {/* TABELLA */}
      <table className="tabella-scarichi">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Indirizzo</th>
            <th>P.IVA / CF</th>
            <th>Scarichi</th>
            <th>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {fornitori.map(f => {
            const n = countScarichi(f);

            return (
              <tr key={f.id}>
                <td><b>{f.nome}</b></td>
                <td>{f.indirizzo || "-"}</td>
                <td>{f.piva_cf || "-"}</td>
                <td>{n}</td>
                <td>
                  <button onClick={()=>modificaFornitore(f)}>
                    Modifica
                  </button>

                  {n === 0 ? (
                    <button
                      onClick={()=>eliminaFornitore(f)}
                      style={{marginLeft:5, background:"red", color:"white"}}
                    >
                      Elimina
                    </button>
                  ) : (
                    <button disabled style={{marginLeft:5}}>
                      Non eliminabile
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {errori.length>0 && (
        <div style={{color:"red",marginTop:20}}>
          {errori.join("\n")}
        </div>
      )}

    </div>
  );
};

export default GestioneFornitoriAvanzata;
