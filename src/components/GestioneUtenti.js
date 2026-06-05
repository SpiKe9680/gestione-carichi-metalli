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

const getClientIP = async () => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "NON_DISPONIBILE";
  } catch (e) {
    return "NON_DISPONIBILE";
  }
};
const buildLogUser = (user, fallback = "ADMIN") => {
  const ruolo = user?.ruolo || fallback;

  const username =
    user?.username?.trim() ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "UTENTE_SCONOSCIUTO";

  return `${ruolo} - ${username}`;
};


const handleUnlockUser = async (u) => {
  if (!window.confirm(`Sbloccare ${u.username || u.email}?`)) return;

  try {
    await updateDoc(doc(db, "utenti", u.id), {
      lock_until: null,
      failed_attempts: 0
    });

    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "SBLOCCO_UTENTE",
      riferimento: {
        collezione: "utenti",
        documentoId: u.id
      },
     utente: buildLogUser(currentUser, "ADMIN"),
      before: {
        stato: "BLOCCATO",
        lock_until: u.lock_until
          ? new Date(u.lock_until).toLocaleString("it-IT")
          : null,
        tentativi_falliti: u.failed_attempts || 0
      },

      after: {
        stato: "ABILITATO",
        lock_until: null,
        tentativi_falliti: 0
      },

      meta: {
        tipo: "UTENTE",
        ip: clientIP
      },

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

    const updated = {
      ...selectedUser,
      username,
      email: emailFinale,
      ruolo: role
    };

    if (password && password.trim() !== "") {
      updated.password_hash = await bcrypt.hash(password, 10);
      delete updated.password;
    }

    await setDoc(doc(db, "utenti", selectedUser.id), updated);

    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "MODIFICA_UTENTE",

      riferimento: {
        collezione: "utenti",
        documentoId: selectedUser.id
      },

      utente: buildLogUser(currentUser, "ADMIN"),

      before: {
        username: orig.username || "-",
        email: orig.email || "-",
        ruolo: orig.ruolo || "OPERATORE"
      },

      after: {
        username: updated.username || "-",
        email: updated.email || "-",
        ruolo: updated.ruolo || "OPERATORE"
      },

      meta: {
        tipo: "UTENTE",
        ip: clientIP
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
    const hashed = await bcrypt.hash("12345", 10);

    await updateDoc(doc(db, "utenti", u.id), {
      password_hash: hashed,
      password: null
    });

    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "RESET_PASSWORD",

      riferimento: {
        collezione: "utenti",
        documentoId: u.id
      },

      utente: buildLogUser(u, currentUser),

      before: {
        username: u.username || (u.email ? u.email.split("@")[0] : "-")
      },

      after: {
        risultato: "PASSWORD_RESET",
        nuova_password: "12345"
      },

      meta: {
        tipo: "UTENTE",
        ip: clientIP
      },

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

    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "CREAZIONE_UTENTE",
      riferimento: {
        collezione: "utenti",
        documentoId: uid
      },

      utente: buildLogUser(currentUser, "ADMIN"),

      before: null,

      after: {
        username,
        email: emailFinale,
        ruolo: role,
        stato: "ATTIVO",
        tentativi_falliti: 0
      },

      meta: {
        tipo: "UTENTE",
        ip: clientIP
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
  if (utente.uid === auth.currentUser?.uid) {
    alert("Non puoi eliminare l'utente loggato!");
    return;
  }

  if (!window.confirm("Sei sicuro di eliminare questo utente?")) return;

  try {
    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "ELIMINAZIONE_UTENTE",

      riferimento: {
        collezione: "utenti",
        documentoId: utente.id
      },

      utente: buildLogUser(currentUser, "ADMIN"),

      before: {
        username: utente.username || "-",
        email: utente.email || "-",
        ruolo: utente.ruolo || "OPERATORE"
      },

      after: {
        stato: "ELIMINATO"
      },

      meta: {
        tipo: "UTENTE",
        ip: clientIP
      },

      ripristinabile: false
    });

    await deleteDoc(doc(db, "utenti", utente.id));

    const usernameFinale = utente.username
      ? utente.username
      : (utente.email ? utente.email.split("@")[0] : "UTENTE");

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