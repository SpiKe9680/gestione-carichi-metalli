// src/components/GestioneUtenti.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, setDoc, doc, deleteDoc,getDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { ripristinaUtente } from "../utils/utenti";
import bcrypt from "bcryptjs";
import PageLayout from "./layout/PageLayout";
import ActionButton from "./ui/ActionButton";
import { FaSignOutAlt } from "react-icons/fa";
import "./GestioneUtenti.css";
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
const [logoBase64, setLogoBase64] = useState("");

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
  setPassword("");
  setConfirmPassword("");

  setEmail(u.email || "");
  setRole(u.ruolo || "OPERATORE");

  setIsDirty(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
};


useEffect(() => {
  if (!selectedUser) return;

  const origUsername = selectedUser.username
    ? selectedUser.username
    : (selectedUser.email ? selectedUser.email.split("@")[0] : "");

  const origEmail = selectedUser.email || "";
  const origRole = selectedUser.ruolo || "OPERATORE";

  const dirty =
    username !== origUsername ||
    email !== origEmail ||
    role !== origRole ||
    password.length > 0;

  setIsDirty(dirty);

}, [username, password, email, role, selectedUser]);
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
const handleUpdateUser = async () => {
  if (!selectedUser) return;

  if (password && password !== confirmPassword) {
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
        setLogoBase64(data.logoBase64 || "");
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
resetForm();
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
  <PageLayout
    title="Gestione Utenti"
    logoBase64={logoBase64}
    maxWidth={1400}
    headerActions={
      <>
        <ActionButton variant="admin" compact onClick={goHome}>
          🏠 Dashboard
        </ActionButton>

        <ActionButton
          variant="danger"
          compact
          onClick={handleLogout}
        >
          <FaSignOutAlt />
          Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </ActionButton>
      </>
    }
  >
    <div className="mf-users-content">
      <div className="mf-users-toolbar">
        <h2>Gestione Utenti</h2>

        <ActionButton
          onClick={() => {
            setMode("add");
            setSelectedUser(null);
            setUsername("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setRole("OPERATORE");
            setIsDirty(false);
            setMessage("");
          }}
        >
          + Nuovo Utente
        </ActionButton>
      </div>

      {message && (
        <div className="mf-users-message" role="status">
          {message}
        </div>
      )}

      {(mode === "add" || mode === "edit") && (
        <section className="mf-users-section">
          <h3>
            {mode === "edit" ? "Modifica utente" : "Nuovo utente"}
          </h3>

          <div className="mf-users-grid">
            <div className="mf-users-field">
              <label htmlFor="mf-user-username">Username</label>
              <input
                id="mf-user-username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setIsDirty(true);
                }}
                autoComplete="username"
              />
            </div>

            <div className="mf-users-field">
              <label htmlFor="mf-user-email">Email</label>
              <input
                id="mf-user-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setIsDirty(true);
                }}
                autoComplete="email"
              />
            </div>

            <div className="mf-users-field">
              <label htmlFor="mf-user-password">
                {mode === "edit"
                  ? "Nuova password (facoltativa)"
                  : "Password"}
              </label>
              <input
                id="mf-user-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setIsDirty(true);
                }}
                autoComplete={
                  mode === "edit" ? "new-password" : "new-password"
                }
              />
            </div>

            <div className="mf-users-field">
              <label htmlFor="mf-user-confirm-password">
                Conferma password
              </label>
              <input
                id="mf-user-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setIsDirty(true);
                }}
                autoComplete="new-password"
              />
            </div>

            <div className="mf-users-field">
              <label htmlFor="mf-user-role">Ruolo</label>
              <select
                id="mf-user-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setIsDirty(true);
                }}
              >
                <option value="OPERATORE">OPERATORE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>

          <div className="mf-users-actions">
            <ActionButton
              disabled={
                !username ||
                password !== confirmPassword ||
                (mode === "add" && !password)
              }
              onClick={() =>
                mode === "edit"
                  ? handleUpdateUser()
                  : handleAddUser()
              }
            >
              {mode === "edit" ? "Salva modifiche" : "Crea utente"}
            </ActionButton>

            <ActionButton variant="admin" onClick={handleAnnulla}>
              Annulla
            </ActionButton>
          </div>
        </section>
      )}

      <section className="mf-users-section">
        <h3>Utenti registrati</h3>

        <div className="mf-users-table-wrap">
          <table className="mf-users-table">
            <thead>
              <tr>
                <th
                  className="is-sortable"
                  onClick={() => requestSort("username")}
                >
                  Username{" "}
                  {sortConfig.key === "username" &&
                    (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>

                <th
                  className="is-sortable"
                  onClick={() => requestSort("email")}
                >
                  Email{" "}
                  {sortConfig.key === "email" &&
                    (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>

                <th
                  className="is-sortable"
                  onClick={() => requestSort("ruolo")}
                >
                  Ruolo{" "}
                  {sortConfig.key === "ruolo" &&
                    (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>

                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {usersOrdinati.length === 0 ? (
                <tr>
                  <td colSpan={5} className="mf-users-empty">
                    Nessun utente presente.
                  </td>
                </tr>
              ) : (
                usersOrdinati.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    title="Clicca per modificare l'utente"
                  >
                    <td>{u.username || u.email?.split("@")[0] || "-"}</td>
                    <td>{u.email || "-"}</td>
                    <td>{u.ruolo || "OPERATORE"}</td>

                    <td>
                      <span
                        className={`mf-users-status ${
                          u.stato === "BLOCCATO"
                            ? "mf-users-status--blocked"
                            : "mf-users-status--enabled"
                        }`}
                      >
                        {u.stato || "ABILITATO"}
                      </span>
                    </td>

                    <td>
                      <div className="mf-users-row-actions">
                        <ActionButton
                          variant="danger"
                          compact
                          disabled={u.id === auth.currentUser?.uid}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(u);
                          }}
                        >
                          Elimina
                        </ActionButton>

                        <ActionButton
                          variant="admin"
                          compact
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetPassword(u);
                          }}
                        >
                          Reset password
                        </ActionButton>

                        {u.stato === "BLOCCATO" && (
                          <ActionButton
                            compact
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlockUser(u);
                            }}
                          >
                            Sblocca
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </PageLayout>
);

};

export default GestioneUtenti;