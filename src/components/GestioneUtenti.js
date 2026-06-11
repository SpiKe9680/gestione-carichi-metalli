// src/components/GestioneUtenti.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc, updateDoc, addDoc, query, where, limit, Timestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { ripristinaUtente } from "../utils/utenti";
import bcrypt from "bcryptjs";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
const GestioneUtenti = () => {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operatore");
  const [message, setMessage] = useState("");
const [adminEmail, setAdminEmail] = useState(""); // mail di recupero globale
  const navigate = useNavigate();
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const [searchTerm, setSearchTerm] = useState("");
const [historyIndex, setHistoryIndex] = useState({});
const [username, setUsername] = useState("");
const [selectedUser, setSelectedUser] = useState(null);
const [showHistoryModal, setShowHistoryModal] = useState(false);
const [usernameHistory, setUsernameHistory] = useState([]);
const [isDirty, setIsDirty] = useState(false);
const [confirmPassword, setConfirmPassword] = useState("");
  // -------- FETCH UTENTI --------
  useEffect(() => { fetchUsers(); }, []);
const [initialUsername, setInitialUsername] = useState("");
const fetchUsers = async () => {
  const [usersSnap, historySnap] = await Promise.all([
    getDocs(collection(db, "utenti")),
    getDocs(collection(db, "username_history"))
  ]);

  const index = {};

  historySnap.docs.forEach(d => {
    const data = d.data();
    if (!data.userId) return;

    if (!index[data.userId]) index[data.userId] = [];

    if (data.username) {
      index[data.userId].push(data.username.toLowerCase());
    }
  });

  setHistoryIndex(index);

  const data = usersSnap.docs.map(d => {
    const u = { id: d.id, ...d.data() };

    const isBlocked =
      u.lock_until && u.lock_until > Date.now();

    const isDisabled = u.attivo === false;

    return {
      ...u,
      hasHistory: !!index[u.id]?.length,
      stato: isDisabled
        ? "DISABILITATO"
        : (isBlocked ? "BLOCCATO" : "ABILITATO")
    };
  });

  setUsers(data);
};
const handleStampaUtenti = async () => {
  if (!usersOrdinati || usersOrdinati.length === 0) {
    alert("Nessun utente da stampare");
    return;
  }

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();

  let y = startY + 10;

  pdf.setFontSize(16);
  pdf.text("Gestione Utenti", 14, y);
  y += 10;

  const formatHistory = (userId, currentUsername) => {
    const history = historyIndex[userId] || [];

    const filtered = history.filter(
      u => u && u.toLowerCase() !== (currentUsername || "").toLowerCase()
    );

    return filtered.length ? filtered.join(", ") : "-";
  };

  const getChangeCount = (userId, currentUsername) => {
    const history = historyIndex[userId] || [];

    const filtered = history.filter(
      u => u && u.toLowerCase() !== (currentUsername || "").toLowerCase()
    );

    return filtered.length; // 🔥 MIGLIORIA 4
  };

  const body = usersOrdinati.map(u => [
    u.username || (u.email ? u.email.split("@")[0] : "-"),
    u.email || "-",
    u.ruolo || "OPERATORE",
    u.stato || "-",
    formatHistory(u.id, u.username),
    getChangeCount(u.id, u.username) // 🔥 CAMBI USERNAME
  ]);

  autoTable(pdf, {
    startY: y,
    head: [[
      "Username",
      "Email",
      "Ruolo",
      "Stato",
      "Storico Username",
      "Cambi"
    ]],
    body,
    theme: "grid",
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  });

  await salvaESharePdfCapacitor(pdf, "gestione_utenti.pdf");
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
const [mode, setMode] = useState(null); 
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
 const handleLogout = async () => {
  await signOut(auth);
  sessionStorage.clear();
  navigate("/login", { replace: true });
};

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
  setMode("edit");
  setSelectedUser(u);

  const usernameFinale = u.username
    ? u.username
    : (u.email ? u.email.split("@")[0] : "");

  setUsername(usernameFinale);
setInitialUsername(usernameFinale);
  setPassword("");
  setConfirmPassword("");

  setEmail(u.email || "");
  setRole(u.ruolo || "OPERATORE");

  setIsDirty(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

useEffect(() => {
  if (!selectedUser) return;

  const origEmail = (selectedUser.email || "").trim().toLowerCase();
  const origRole = selectedUser.ruolo || "OPERATORE";

  const dirty =
    username !== initialUsername ||   // 🔥 QUI FIX
    email.trim().toLowerCase() !== origEmail ||
    role !== origRole ||
    password.length > 0;

  setIsDirty(dirty);

}, [username, password, email, role, selectedUser, initialUsername]);
// -------- ANNULLA --------
const handleAnnulla = () => {
  resetForm();
  setMessage("");
};
const resetForm = () => {
  setSelectedUser(null);
  setUsername("");
  setPassword("");
  setEmail("");
  setRole("OPERATORE");
  setConfirmPassword("");
  setIsDirty(false);
  setMode(null);
};
const buildUsernameTooltip = (userId, currentUsername) => {
  const history = historyIndex[userId] || [];

  if (!history.length) return "";

  const currentLower = (currentUsername || "").toLowerCase();

  const filtered = history.filter(
    u => u && u.toLowerCase() !== currentLower
  );

  if (!filtered.length) return "";

  if (filtered.length === 1) {
    return `Username usati: ${filtered[0]}`;
  }

  const last = filtered[filtered.length - 1];
  const others = filtered.slice(0, -1);

  return `Username usati: ${others.join(", ")} e ${last}`;
};

const handleUpdateUser = async () => {
  if (!selectedUser) return;

  if (password && password !== confirmPassword) {
    setMessage("Le password non coincidono");
    return;
  }

  try {
    const orig = selectedUser;

    const emailFinale = email || adminEmail || null;
    const normalized = (username || "").trim().toLowerCase();
    const origNormalized = (orig.username || "").trim().toLowerCase();

    if (!normalized) {
      setMessage("Username non valido");
      return;
    }

    // 🔥 0. SE NON CAMBIA NULLA -> ESCI SUBITO
    const nothingChanged =
      normalized === origNormalized &&
      emailFinale === (orig.email || null) &&
      role === (orig.ruolo || "OPERATORE") &&
      !password;

    if (nothingChanged) {
      setMessage("Nessuna modifica rilevata");
      return;
    }

    const historyRef = collection(db, "username_history");

    // =============================
    // 🔴 1. CONTROLLO STORICO GLOBALE
    // =============================
    const q = query(
      historyRef,
      where("username_lower", "==", normalized),
      limit(1)
    );

    const snapCheck = await getDocs(q);

    if (!snapCheck.empty) {
      const found = snapCheck.docs[0].data();

      if (found.userId !== selectedUser.id) {
        setMessage("Username già usato da un altro utente");
        return;
      }
    }

    const now = new Date();

    // =============================
    // 🔁 2. CHIUDI USERNAME ATTUALE (SOLO SE CAMBIA)
    // =============================
    if (normalized !== origNormalized) {
      const snapActive = await getDocs(historyRef);

      const active = snapActive.docs.find(d => {
        const x = d.data();
        return x.userId === selectedUser.id && x.endAt === null;
      });

      if (active) {
        await updateDoc(doc(db, "username_history", active.id), {
          endAt: Timestamp.fromDate(now)
        });
      }

      // 🆕 NUOVO STORICO SOLO SE CAMBIA USERNAME
      await addDoc(historyRef, {
        userId: selectedUser.id,
        username,
        username_lower: normalized,
        startAt: Timestamp.fromDate(now),
        endAt: null,
        source: "CambioNomeUtente"
      });
    }

    // =============================
    // 💾 3. UPDATE UTENTE (SOLO CAMPI REALMENTE CAMBIATI)
    // =============================
    const updated = {
      ...orig,
      ruolo: role
    };

    if (normalized !== origNormalized) {
      updated.username = username;
      updated.username_lower = normalized;
    }

    if (emailFinale !== orig.email) {
      updated.email = emailFinale;
    }

    if (password && password.trim() !== "") {
      updated.password_hash = await bcrypt.hash(password, 10);
      delete updated.password;
    }

    await setDoc(doc(db, "utenti", selectedUser.id), updated);

    // =============================
    // 🧾 LOG
    // =============================
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
        ruolo: updated.ruolo || "OPERATORE",
        storico: normalized !== origNormalized ? "username_history_aggiornato" : "invariato"
      },
      meta: {
        tipo: "UTENTE",
        ip: clientIP
      },
      ripristinabile: true
    });

    setMessage(
      normalized !== origNormalized
        ? `Username aggiornato: ${username}`
        : `Utente aggiornato senza cambio username`
    );

    fetchUsers();
    resetForm();

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
  if (mode === null) {
    setSelectedUser(null);
  }
}, [mode]);

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

const loadUsernameHistory = async (userId) => {
  try {
    const historyRef = collection(db, "username_history");

    const q = query(
      historyRef,
      where("userId", "==", userId)
    );

    const snap = await getDocs(q);

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    data.sort((a, b) =>
      (b.startAt?.toMillis?.() || 0) - (a.startAt?.toMillis?.() || 0)
    );

    setUsernameHistory(data);
    setShowHistoryModal(true);

  } catch (err) {
    console.error(err);
  }
};

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
resetForm();
  } catch (error) {
    console.error(error);
    setMessage("Errore nella creazione utente");
  }
};
const handleEnableUser = async (utente) => {
  if (!window.confirm("Riabilitare questo utente?")) return;

  try {
    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await updateDoc(doc(db, "utenti", utente.id), {
      attivo: true,
      disabilitatoAt: null
    });

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "ABILITAZIONE_UTENTE",
      riferimento: {
        collezione: "utenti",
        documentoId: utente.id
      },
      utente: buildLogUser(currentUser, "ADMIN"),
      before: {
        stato: "DISABILITATO"
      },
      after: {
        stato: "ABILITATO",
        attivo: true
      },
      meta: {
        tipo: "UTENTE",
        ip: clientIP
      },
      ripristinabile: true
    });

    setMessage(`Utente ${utente.username || utente.email} riabilitato`);
    fetchUsers();

  } catch (err) {
    console.error(err);
    setMessage("Errore riabilitazione utente");
  }
};
const handleDisableUser = async (utente) => {
 if (utente.id === currentUser.uid) {
    alert("Non puoi modificare il tuo utente!");
    return;
  }

  if (!window.confirm("Disabilitare questo utente?")) return;

  try {
    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await updateDoc(doc(db, "utenti", utente.id), {
      attivo: false,
      disabilitatoAt: Timestamp.now()
    });

    await scriviLog({
      pagina: "gestione-utenti",
      evento: "DISABILITAZIONE_UTENTE",
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
        stato: "DISABILITATO",
        attivo: false
      },
      meta: {
        tipo: "UTENTE",
        ip: clientIP
      },
      ripristinabile: true
    });

    setMessage(`Utente ${utente.username || utente.email} disabilitato`);
    fetchUsers();

  } catch (err) {
    console.error(err);
    setMessage("Errore disabilitazione utente");
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
let usersFiltrati = users.filter(u => {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return true;

  const current = (u.username || u.email || "").toLowerCase();

  const history = (historyIndex[u.id] || []).join(" ");

  return (
    current.includes(term) ||
    history.includes(term)
  );
});

let usersOrdinati = [...usersFiltrati];

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

const formatDateIT = (ts) => {
  if (!ts) return "-";

  const date = ts?.toDate ? ts.toDate() : new Date(ts);

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

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
<div style={{ marginBottom: 15 }}>
  {mode === null && (
    <button
      onClick={() => {
        setMode("add");
        setSelectedUser(null);
        setUsername("");
        setPassword("");
        setEmail("");
        setRole("OPERATORE");
        setConfirmPassword("");
        setIsDirty(false);
      }}
      style={{ background: "#4caf50", color: "white" }}
    >
      ➕ Nuovo Utente
    </button>
  )}
</div>
{/* FORM COMPATTO UTENTI (MOBILE FRIENDLY) */}

{mode !== null && (
<div style={{ marginBottom: 20, padding: 10, border: "1px solid #ddd" }}>

  <div className="filter-item">

    <input
      placeholder="Username"
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
      placeholder="Conferma"
      value={confirmPassword}
      onChange={e => setConfirmPassword(e.target.value)}
    />

    <select value={role} onChange={e => setRole(e.target.value)}>
      <option value="OPERATORE">Operatore</option>
      <option value="MANAGER">Manager</option>
      <option value="ADMIN">Admin</option>
    </select>

    <input
      type="email"
      placeholder="Mail recupero"
      value={email}
      onChange={e => setEmail(e.target.value)}
      style={{ minWidth: 250 }}
    />
  </div>

  <div style={{ marginTop: 10, display: "flex", gap: "10px" }}>
{mode === "add" && (
  <button
    onClick={handleAddUser}
    disabled={
      !username ||
      !password ||
      password !== confirmPassword
    }
  >
    ➕ Aggiungi Utente
  </button>
)}

{mode === "edit" && (
  <button
    onClick={handleUpdateUser}
    disabled={
      !username ||
      password !== confirmPassword
    }
  >
    💾 Modifica Utente
  </button>
)}

    <button onClick={handleAnnulla} style={{ background: "#ccc" }}>
      Annulla
    </button>

  </div>
</div>
)}
<div style={{ marginBottom: 15 }}>
  <input
    type="text"
    placeholder="🔎 Cerca username (anche storico)..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    style={{
      padding: "8px",
      width: "100%",
      maxWidth: "400px"
    }}
  />
</div>
<button onClick={handleStampaUtenti} style={{ marginBottom: 10 }}>
  🖨️ Stampa Utenti
</button>
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
  onClick={() => handleSelectUser(u)}
  style={{
    borderBottom: "1px solid #eee",
    cursor: "pointer",
    backgroundColor:
      selectedUser?.id === u.id ? "#e3f2fd" : "transparent"
  }}
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
{u.attivo !== false ? (
  <button
    onClick={e => { e.stopPropagation(); handleDisableUser(u); }}
   disabled={u.id === currentUser.uid}
    style={{ backgroundColor: "#f44336", color: "white" }}
  >
    Disabilita
  </button>
) : (
  <button
    onClick={e => { e.stopPropagation(); handleEnableUser(u); }}
    style={{ backgroundColor: "#4caf50", color: "white" }}
  >
    Abilita
  </button>
)}

  <button
    onClick={e => { e.stopPropagation(); handleResetPassword(u); }}
    style={{ backgroundColor: "#ff9800", color: "white" }}
  >
    Reset Password
  </button>
{(u.hasHistory) && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      loadUsernameHistory(u.id);
    }}
    style={{ backgroundColor: "#6c757d", color: "white" }}
    title={buildUsernameTooltip(u.id, u.username)}
  >
    📜 Storico Nome Utente
  </button>
)}
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
{showHistoryModal && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    }}
    onClick={() => setShowHistoryModal(false)}
  >
    <div
      style={{
        width: "90%",
        maxWidth: "900px",
        background: "white",
        borderRadius: "10px",
        padding: "20px",
        maxHeight: "80vh",
        overflowY: "auto"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3>📜 Storico Username</h3>

        <button
          onClick={() => setShowHistoryModal(false)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "20px",
            cursor: "pointer"
          }}
        >
          ✖
        </button>
      </div>

      {/* BODY */}
      {usernameHistory.length === 0 ? (
        <div>Nessuno storico disponibile</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Dal</th>
              <th>Al</th>
              <th>Origine</th>
            </tr>
          </thead>

          <tbody>
            {usernameHistory.map(item => (
              <tr key={item.id}>
                <td>{item.username}</td>
                <td>{formatDateIT(item.startAt)}</td>
<td>
  {item.endAt ? formatDateIT(item.endAt) : "ATTUALE"}
</td>
                <td>{item.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* FOOTER BUTTON CHIUDI */}
<div style={{ marginTop: 15, display: "flex", justifyContent: "flex-end" }}>
  <button
    onClick={() => setShowHistoryModal(false)}
    style={{
      background: "#6c757d",
      color: "white",
      border: "none",
      padding: "8px 14px",
      borderRadius: "6px",
      cursor: "pointer"
    }}
  >
    Chiudi
  </button>
</div>
    </div>
  </div>
)}
    </div>
  );
};

export default GestioneUtenti;