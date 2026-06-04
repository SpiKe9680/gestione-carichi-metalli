// src/components/GestioneUtenti.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, setDoc, doc, deleteDoc,getDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { ripristinaUtente } from "../utils/utenti";
import bcrypt from "bcryptjs";

const GestioneUtenti = () => {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operatore");
  const [message, setMessage] = useState("");
const [adminEmail, setAdminEmail] = useState(""); // mail di recupero globale
  const navigate = useNavigate();
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
  // stato
const [username, setUsername] = useState("");

const [selectedUser, setSelectedUser] = useState(null);
const [isDirty, setIsDirty] = useState(false);
const [confirmPassword, setConfirmPassword] = useState("");
  // -------- FETCH UTENTI --------
  useEffect(() => { fetchUsers(); }, []);

const fetchUsers = async () => {
  const snap = await getDocs(collection(db, "utenti"));

  const data = snap.docs.map(d => {
    const u = { id: d.id, ...d.data() };

    const isBlocked =
      u.lock_until && u.lock_until > Date.now();

    return {
      ...u,
      stato: isBlocked ? "BLOCCATO" : "ABILITATO"
    };
  });

  setUsers(data);
};

const handleUnlockUser = async (u) => {
  if (!window.confirm(`Sbloccare ${u.username || u.email}?`)) return;

  try {
    await updateDoc(doc(db, "utenti", u.id), {
      lock_until: null,
      failed_attempts: 0
    });

    await scriviLog({
      pagina: "gestione-utenti",
      azione: "SBLOCCA_UTENTE",
      collezioneRef: "utenti",
      documentoId: u.id,
      dati_originali: {
        lock_until: u.lock_until,
        failed_attempts: u.failed_attempts
      },
      dati_modificati: {
        lock_until: null,
        failed_attempts: 0
      },
      meta: { tipo: "UTENTE" },
      ripristinabile: true
    });

    setMessage(`Utente ${u.username || u.email} sbloccato`);

    fetchUsers();

  } catch (err) {
    console.error(err);
    setMessage("Errore sblocco utente");
  }
};

  // -------- LOGOUT --------
  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  // -------- DASHBOARD --------
  const goHome = () => navigate("/admin");
const [sortConfig, setSortConfig] = useState({
  key: null,
  direction: "asc",
});

const requestSort = (key) => {
  let direction = "asc";

  if (sortConfig.key === key && sortConfig.direction === "asc") {
    direction = "desc";
  }

  setSortConfig({ key, direction });
};

const handleSelectUser = (u) => {
  setSelectedUser(u);

  const usernameFinale = u.username
    ? u.username
    : (u.email ? u.email.split("@")[0] : "");

  setUsername(usernameFinale);
  setPassword(u.password || "");
setConfirmPassword(u.password || "");
  // email sempre dal DB oppure fallback admin
  setEmail(u.email || adminEmail || "");

  // 🔥 AGGIUNGI QUI
  setRole(u.ruolo || "operatore");

  setIsDirty(false);
  setMessage("");
};

useEffect(() => {
  if (!selectedUser) return;

  const origUsername = selectedUser.username
    ? selectedUser.username
    : (selectedUser.email ? selectedUser.email.split("@")[0] : "");

  const origEmail = selectedUser.email || "";
  const origRole = selectedUser.ruolo || "operatore";

  const dirty =
    username !== origUsername ||
    password !== (selectedUser.password || "") ||
    (email || "") !== origEmail ||
    role !== origRole;

  setIsDirty(dirty);

}, [username, password, email, role, selectedUser]);
// -------- ANNULLA --------
const handleAnnulla = () => {
  setSelectedUser(null);
  setUsername("");
  setPassword("");
  setEmail("");
  setRole("OPERATORE");
  setIsDirty(false);
  setMessage("");
  setConfirmPassword("");
};
const handleUpdateUser = async () => {
  if (!selectedUser) return;

  if (password !== confirmPassword) {
    setMessage("Le password non coincidono");
    return;
  }

  try {
    const orig = { ...selectedUser };

    const emailFinale = email || adminEmail || null;

    // =============================
    // COSTRUZIONE UTENTE AGGIORNATO
    // =============================
    const updated = {
      ...selectedUser,
      username: username,
      email: emailFinale,
      ruolo: role
    };

    // =============================
    // PASSWORD MANAGEMENT
    // =============================
    if (password && password.trim() !== "") {
      updated.password_hash = await bcrypt.hash(password, 10);
      delete updated.password;
    }

    await setDoc(doc(db, "utenti", selectedUser.uid), updated);

    await scriviLog({
      pagina: "gestione-utenti",
      azione: "MODIFICA",
      collezioneRef: "utenti",
      documentoId: selectedUser.uid,

      dati_originali: orig,
      dati_modificati: updated,

      meta: {
        tipo: "UTENTE"
      },

      ripristinabile: true
    });

    setMessage(`Utente ${username} modificato!`);

    setSelectedUser(null);
    setUsername("");
    setPassword("");
    setEmail("");
    setConfirmPassword("");

    fetchUsers();

  } catch (err) {
    console.error(err);
    setMessage("Errore modifica utente");
  }
};

const handleResetPassword = async (u) => {
  if (!window.confirm(`Reset password per ${u.username || u.email}?`)) return;

  try {
    const updatedUser = {
      ...u,
      password_hash: await bcrypt.hash("12345", 10)
    };

    delete updatedUser.password;

    await setDoc(doc(db, "utenti", u.uid), updatedUser);

    await scriviLog({
      pagina: "gestione-utenti",
      azione: "RESET_PASSWORD",
      collezioneRef: "utenti",
      documentoId: u.uid,

      dati_originali: { password: "***" },
      dati_modificati: { password: "***" },

      meta: { tipo: "UTENTE" },
      ripristinabile: true
    });

    setMessage(`Password di ${u.username || u.email} resettata a 12345`);
    fetchUsers();

  } catch (err) {
    console.error(err);
    setMessage("Errore reset password");
  }
};

useEffect(() => {
  const fetchAdminEmail = async () => {
    try {
      const docRef = doc(db, "configurazioni", "datiAzienda");
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();

        // 🔥 CAMPO CORRETTO
        setAdminEmail(data.mailRecupero || "");
      }

    } catch (err) {
      console.error("Errore caricamento email amministratore:", err);
    }
  };

  fetchAdminEmail();
}, []);

  // -------- AGGIUNGI UTENTE --------
const handleAddUser = async () => {
  if (username.length < 4 || username.length > 10) {
    setMessage("Username 4-10 caratteri");
    return;
  }

  if (!password) {
    setMessage("Inserisci password");
    return;
  }

  if (users.some(u => u.username === username)) {
    setMessage("Username già presente!");
    return;
  }

  if (password !== confirmPassword) {
    setMessage("Le password non coincidono");
    return;
  }

  try {
    const uid = crypto.randomUUID();

    const emailFinale = email && email.trim() !== ""
      ? email
      : adminEmail;

    if (!emailFinale) {
      setMessage("Email admin non configurata!");
      return;
    }

    const newUser = {
      username,
      email: emailFinale,
      ruolo: role,
      uid,
      attivo: true,
      failed_attempts: 0,
      lock_until: null,
      password_hash: await bcrypt.hash(password, 10)
    };

    await setDoc(doc(db, "utenti", uid), newUser);

    await scriviLog({
      pagina: "gestione-utenti",
      azione: "CREAZIONE",
      collezioneRef: "utenti",
      documentoId: uid,

      dati_originali: null,
      dati_modificati: newUser,

      meta: {
        tipo: "UTENTE"
      },

      ripristinabile: true
    });

    setMessage(`Utente ${username} creato con successo!`);

    setUsername("");
    setPassword("");
    setEmail("");
    setConfirmPassword("");

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
  azione: "CANCELLAZIONE",
  collezioneRef: "utenti",
  documentoId: utente.uid,

  dati_originali: utente,
  dati_modificati: null,

  meta: {
    tipo: "UTENTE"
  },

  ripristinabile: true
});

      await deleteDoc(doc(db, "utenti", utente.uid));
      const usernameFinale = utente.username
  ? utente.username
  : (utente.email ? utente.email.split("@")[0] : "Sconosciuto");

setMessage(`Utente ${usernameFinale} eliminato!`);
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
let usersOrdinati = [...users];

if (sortConfig.key) {
  usersOrdinati.sort((a, b) => {
    let aVal = "";
    let bVal = "";

    switch (sortConfig.key) {
      case "username":
        aVal = a.username || (a.email ? a.email.split("@")[0] : "") || "";
        bVal = b.username || (b.email ? b.email.split("@")[0] : "") || "";
        break;

      case "email":
        aVal = a.email || "";
        bVal = b.email || "";
        break;

      case "ruolo":
        aVal = a.ruolo || "operatore";
        bVal = b.ruolo || "operatore";
        break;

      default:
        return 0;
    }

    const comparison = aVal.localeCompare(bVal, "it", { numeric: true });

    return sortConfig.direction === "asc" ? comparison : -comparison;
  });
}
  return (
    <div className="gestione-utenti-container" style={{ padding: "20px" }}>
      {/* NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>
      </div>

      <h2>Gestione Utenti</h2>
      {message && <p style={{ color: "green" }}>{message}</p>}

      {/* FORM AGGIUNGI */}
      <div className="form" style={{ marginBottom: 20, display: "flex", gap: "10px" }}>
  <input
    placeholder="Username (4-10)"
    value={username}
    onChange={e => setUsername(e.target.value)}
  />
  <input
    type="password"
    placeholder="Password"
    value={password}
    onChange={e => setPassword(e.target.value)}
  />
  <input
  type="password"
  placeholder="Conferma Password"
  value={confirmPassword}
  onChange={e => setConfirmPassword(e.target.value)}
/>
 <input
  type="email"
  placeholder="Mail recupero (opzionale)"
  value={email}
  onChange={e => setEmail(e.target.value)}
/>
<select
  value={role}
  onChange={e => setRole(e.target.value)}
>
  <option value="OPERATORE">Operatore</option>
  <option value="MANAGER">Manager</option>
  <option value="ADMIN">Admin</option>
</select>
{selectedUser ? (
  <>
    <button onClick={handleUpdateUser} disabled={!isDirty}>
      Modifica
    </button>
    <button onClick={handleAnnulla} style={{ backgroundColor: "#ccc" }}>
      Annulla
    </button>
  </>
) : (
  <button onClick={handleAddUser}>Aggiungi Utente</button>
)}
</div>

      {/* TABELLA UTENTI */}
{/* TABELLA UTENTI */}
{/* TABELLA UTENTI */}
<table style={{ width: "100%", borderCollapse: "collapse" }}>
<thead>
  <tr style={{ borderBottom: "2px solid #ccc" }}>
    <th onClick={() => requestSort("username")} style={{ cursor: "pointer", textAlign: "left" }}>
      Nome Utente{" "}
      {sortConfig.key === "username"
        ? sortConfig.direction === "asc"
          ? "⬆️"
          : "⬇️"
        : ""}
    </th>

    <th onClick={() => requestSort("email")} style={{ cursor: "pointer", textAlign: "left" }}>
      Email Recupero{" "}
      {sortConfig.key === "email"
        ? sortConfig.direction === "asc"
          ? "⬆️"
          : "⬇️"
        : ""}
    </th>

    <th onClick={() => requestSort("ruolo")} style={{ cursor: "pointer", textAlign: "left" }}>
      Ruolo{" "}
      {sortConfig.key === "ruolo"
        ? sortConfig.direction === "asc"
          ? "⬆️"
          : "⬇️"
        : ""}
    </th>
<th style={{ textAlign: "left" }}>Stato</th>
    <th style={{ textAlign: "left" }}>Azioni</th>
  </tr>
</thead>
<tbody>
  {usersOrdinati.map(u => (
    <tr
      key={u.id}
      style={{ borderBottom: "1px solid #eee", cursor: "pointer" }}
      onClick={() => handleSelectUser(u)}
    >
      {/* NOME UTENTE */}
      <td>{u.username ? u.username : (u.email ? u.email.split("@")[0] : "-")}</td>

      {/* EMAIL RECUPERO */}
      <td>{u.email || "-"}</td>
      <td>{u.ruolo || "operatore"}</td>
      <td>
  <span
    style={{
      color: u.stato === "BLOCCATO" ? "red" : "green",
      fontWeight: "bold"
    }}
  >
    {u.stato}
  </span>
</td>
      {/* AZIONI */}
<td style={{ display: "flex", gap: "10px" }}>
  <button
    onClick={e => { e.stopPropagation(); handleDeleteUser(u); }}
    disabled={u.id === auth.currentUser?.uid}
    style={{ backgroundColor: "#f44336", color: "white" }}
  >
    Elimina
  </button>

  <button
    onClick={e => { e.stopPropagation(); handleResetPassword(u); }}
    style={{ backgroundColor: "#ff9800", color: "white" }}
  >
    Reset Password
  </button>

  {/* 🔥 NUOVO: SBLOCCA SOLO SE BLOCCATO */}
  {u.stato === "BLOCCATO" && (
    <button
      onClick={e => { e.stopPropagation(); handleUnlockUser(u); }}
      style={{ backgroundColor: "#4caf50", color: "white" }}
    >
      Sblocca
    </button>
  )}
</td>
    </tr>
  ))}
</tbody>
</table>
    </div>
  );
};

export default GestioneUtenti;