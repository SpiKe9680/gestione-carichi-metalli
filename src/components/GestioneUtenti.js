// src/components/GestioneUtenti.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { ripristinaUtente } from "../utils/utenti";

const GestioneUtenti = () => {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operatore");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  // -------- FETCH UTENTI --------
  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "utenti"));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // -------- LOGOUT --------
  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  // -------- DASHBOARD --------
  const goHome = () => navigate("/admin");

  // -------- AGGIUNGI UTENTE --------
  const handleAddUser = async () => {
    if (!email || !password) { setMessage("Compila email e password"); return; }
    if (users.some(u => u.email === email)) { setMessage("Email già presente!"); return; }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "utenti", uid), { email, ruolo: role, uid, password });

      // Log aggiunta
      await scriviLog({
        pagina: "gestione-utenti",
        tipo: "AGGIUNTA_UTENTE",
        collezioneRef: "utenti",
        documentoId: uid,
        dati_originali: null,
        dati_modificati: { email, ruolo: role, uid, password }
      });

      setMessage(`Utente ${email} creato con successo!`);
      setEmail(""); setPassword(""); setRole("operatore");
      fetchUsers();

    } catch (error) {
      console.error(error);
      setMessage("Errore nella creazione utente");
    }
  };

  // -------- ELIMINA UTENTE --------
  const handleDeleteUser = async (utente) => {
    if (utente.uid === auth.currentUser?.uid) { alert("Non puoi eliminare l'utente loggato!"); return; }
    if (!window.confirm("Sei sicuro di eliminare questo utente?")) return;

    try {
      // Log con password in chiaro per eventuale ripristino
      await scriviLog({
        pagina: "gestione-utenti",
        tipo: "CANCELLAZIONE_UTENTE",
        collezioneRef: "utenti",
        documentoId: utente.uid,
        dati_originali: { ...utente }, // include password
        dati_modificati: null
      });

      await deleteDoc(doc(db, "utenti", utente.uid));
      setMessage(`Utente ${utente.email} eliminato!`);
      fetchUsers();

    } catch (err) {
      console.error(err);
      setMessage("Errore eliminazione utente");
    }
  };

  // -------- RIPRISTINA UTENTE --------
  const handleRipristina = async (log) => {
    try {
      await ripristinaUtente(log);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setMessage("Errore ripristino utente");
    }
  };

  return (
    <div className="gestione-utenti-container" style={{ padding: "20px" }}>
      {/* NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>🚪 Logout ({auth.currentUser?.email || "sconosciuto"})</button>
      </div>

      <h2>Gestione Utenti</h2>
      {message && <p style={{ color: "green" }}>{message}</p>}

      {/* FORM AGGIUNGI */}
      <div className="form" style={{ marginBottom: 20, display: "flex", gap: "10px" }}>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="operatore">Operatore</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleAddUser}>Aggiungi Utente</button>
      </div>

      {/* TABELLA UTENTI */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ccc" }}>
            <th style={{ textAlign: "left" }}>Email</th>
            <th style={{ textAlign: "left" }}>Ruolo</th>
            <th style={{ textAlign: "left" }}>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{u.email}</td>
              <td>{u.ruolo}</td>
              <td style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => handleDeleteUser(u)}
                  disabled={u.id === auth.currentUser?.uid}
                  style={{ backgroundColor: "#f44336", color: "white" }}
                >
                  Elimina
                </button>

                {/* Bottone Ripristina dai log, se log disponibile */}
                <button
                  onClick={() => handleRipristina(u.log)}
                  style={{ backgroundColor: "#4caf50", color: "white" }}
                >
                  Ripristina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GestioneUtenti;