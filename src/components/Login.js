// src/components/Login.js
import React, { useState } from "react";
import { db, auth, loginAdminFirebase } from "../firebase";
import {  collection,  query,  where,  getDocs,  addDoc,  updateDoc,  doc,  limit,  getDoc,  Timestamp} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { useEffect } from "react";
import bcrypt from "bcryptjs";
const Login = () => {
  const navigate = useNavigate();
const [logoBase64, setLogoBase64] = useState(null);
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [message, setMessage] = useState("");
const [showUsernameWarning, setShowUsernameWarning] = useState(false);
const [pendingUsernameChange, setPendingUsernameChange] = useState(null);
  // modal state
  const [mode, setMode] = useState(null); // "username" | "password" | null
  const [oldUser, setOldUser] = useState("");
  const [oldPass, setOldPass] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

const buildLogUser = (userFound, input) => {
  const ruolo = userFound?.ruolo || "UNKNOWN";

  const username =
    userFound?.username?.trim() ||
    (userFound?.email ? userFound.email.split("@")[0] : null) ||
    input ||
    "utente_non_identificato";

  return `${ruolo} - ${username}`;
};

const getClientIP = async () => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "UNKNOWN_IP";
  } catch (e) {
    return "UNKNOWN_IP";
  }
};

const formatDateTime = (ts) => {
  if (!ts) return null;

  const date = typeof ts?.toDate === "function"
    ? ts.toDate()
    : new Date(ts);

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

const handleLogin = async () => {
  setMessage("");

  if (!inputUsername || !inputPassword) {
    setMessage("Inserisci username o email e password");
    return;
  }

  try {
    await loginAdminFirebase();

    const clientIP = await getClientIP();

    const snap = await getDocs(collection(db, "utenti"));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const inputNormalized = inputUsername.trim().toLowerCase();

    const userFound = users.find(u => {
      const usernameFinal = u.username
        ? u.username.toLowerCase()
        : (u.email ? u.email.split("@")[0].toLowerCase() : "");

      const emailFinal = u.email ? u.email.toLowerCase() : "";

      return usernameFinal === inputNormalized || emailFinal === inputNormalized;
    });

    const utenteLog = userFound
      ? buildLogUser(userFound, inputUsername)
      : "UTENTE_SCONOSCIUTO";

    // =============================
    // ❌ UTENTE NON TROVATO
    // =============================
    if (!userFound) {
      await scriviLog({
        pagina: "login",
        evento: "LOGIN_KO",
        riferimento: { collezione: "utenti", documentoId: null },
        utente: utenteLog,
        before: {
          ip: clientIP,
          input_digitato: inputUsername
        },
        after: {
          risultato: "UTENTE_NON_TROVATO",
          ip: clientIP
        },
        ripristinabile: false
      });

      auth.signOut();
      setMessage("Username o password errati");
      return;
    }

    // =============================
    // 🔴 UTENTE DISABILITATO
    // =============================
    if (userFound.attivo === false || userFound.stato === "DISABILITATO") {
      await scriviLog({
        pagina: "login",
        evento: "LOGIN_DISABILITATO",
        riferimento: { collezione: "utenti", documentoId: userFound.id },
        utente: utenteLog,
        before: {
          ip: clientIP,
          stato: userFound.stato,
          attivo: userFound.attivo
        },
        after: {
          risultato: "ACCESSO_NEGATO",
          motivo: "UTENTE_DISABILITATO",
          ip: clientIP
        },
        ripristinabile: false
      });

      auth.signOut();
      setMessage("Utente disabilitato. Accesso negato.");
      return;
    }

    // =============================
    // 🔒 BLOCCO
    // =============================
    if (userFound.lock_until) {
      const now = Date.now();

      const lockTime = userFound.lock_until?.toDate
        ? userFound.lock_until.toDate().getTime()
        : userFound.lock_until;

      if (lockTime && lockTime > now) {
        const minuti = Math.ceil((lockTime - now) / 60000);

        await scriviLog({
          pagina: "login",
          evento: "LOGIN_BLOCCATO",
          riferimento: { collezione: "utenti", documentoId: userFound.id },
          utente: utenteLog,
          before: {
            ip: clientIP,
            tentativi: userFound.failed_attempts,
            bloccato_fino: formatDateTime(lockTime)
          },
          after: {
            risultato: "ACCESSO_NEGATO",
            minuti_rimanenti: minuti,
            ip: clientIP
          },
          ripristinabile: false
        });

        setMessage(`Utente bloccato. Riprova tra ${minuti} minuti`);
        return;
      }
    }

    // =============================
    // 🔐 PASSWORD
    // =============================
    let passwordOk = false;

    if (userFound.password_hash) {
      passwordOk = await bcrypt.compare(inputPassword, userFound.password_hash);
    } else {
      passwordOk = inputPassword === userFound.password;
    }

    // =============================
    // ❌ LOGIN FALLITO
    // =============================
    if (!passwordOk) {
      const tentativi = (userFound.failed_attempts || 0) + 1;

      const now = Date.now();

      let lockUntil = null;
      let stato = userFound.stato || "ATTIVO";

      if (tentativi >= 7) {
        lockUntil = now + 86400000;
        stato = "BLOCCATO";
      } else if (tentativi >= 5) {
        lockUntil = now + 3600000;
      } else if (tentativi >= 3) {
        lockUntil = now + 900000;
      }

      await updateDoc(doc(db, "utenti", userFound.id), {
        failed_attempts: tentativi,
        lock_until: lockUntil,
        stato
      });

      await scriviLog({
        pagina: "login",
        evento: "LOGIN_KO",
        riferimento: { collezione: "utenti", documentoId: userFound.id },
        utente: utenteLog,
        before: {
          ip: clientIP,
          tentativi_precedenti: userFound.failed_attempts || 0
        },
        after: {
          risultato: "PASSWORD_ERRATA",
          tentativi_totali: tentativi,
          blocco_fino_a: lockUntil,
          ip: clientIP
        },
        ripristinabile: false
      });

      auth.signOut();
      setMessage("Username o password errati");
      return;
    }

    // =============================
    // 🔥 RESET PASSWORD
    // =============================
    const isDefaultPassword =
      inputPassword === "12345" ||
      userFound.password === "12345";

    if (isDefaultPassword) {
      await scriviLog({
        pagina: "login",
        evento: "LOGIN_RESET_PASSWORD",
        riferimento: { collezione: "utenti", documentoId: userFound.id },
        utente: utenteLog,
        before: {
          ip: clientIP,
          stato_password: "DEFAULT"
        },
        after: {
          risultato: "CAMBIO_PASSWORD_OBBLIGATORIO",
          ip: clientIP
        },
        ripristinabile: false
      });

      auth.signOut();

      setMessage("Cambio password obbligatorio");

      setMode("password");
      setOldUser(inputUsername);
      setOldPass("12345");

      return;
    }

    // =============================
    // ✅ LOGIN OK
    // =============================
    await updateDoc(doc(db, "utenti", userFound.id), {
      failed_attempts: 0,
      lock_until: null,
      stato: "ATTIVO"
    });

    const ruolo = (userFound.ruolo || "OPERATORE").toUpperCase();

    const safeUser = {
      uid: userFound.uid,
      username: userFound.username || userFound.email,
      ruolo,
      email: userFound.email || ""
    };

    sessionStorage.setItem("utenteLoggato", JSON.stringify(safeUser));

    await scriviLog({
      pagina: "login",
      evento: "LOGIN_OK",
      riferimento: { collezione: "utenti", documentoId: userFound.id },
      utente: utenteLog,
      before: {
        ip: clientIP,
        username_digitato: inputUsername
      },
      after: {
        risultato: "ACCESSO_CONCESSO",
        ruolo,
        ip: clientIP
      },
      ripristinabile: false
    });

    if (ruolo === "ADMIN" || ruolo === "MANAGER") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/scarichi", { replace: true });
    }

  } catch (err) {
    await scriviLog({
      pagina: "login",
      evento: "LOGIN_KO",
      utente: inputUsername || "UTENTE_SCONOSCIUTO",
      before: { ip: await getClientIP() },
      after: { risultato: "ERRORE_INTERNO" },
      ripristinabile: false
    });

    setMessage("Errore login DB");
  }
};

  // =============================
  // CONTROLLO UTENTE
  // =============================
 const verifyUser = async () => {
  await loginAdminFirebase();

  const snap = await getDocs(collection(db, "utenti"));

  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const inputNormalized = oldUser.trim().toLowerCase();

  const found = users.find(u => {
    const usernameFinal = u.username
      ? u.username.toLowerCase()
      : (u.email ? u.email.split("@")[0].toLowerCase() : "");

    const emailFinal = u.email ? u.email.toLowerCase() : "";

    const usernameMatch =
      usernameFinal === inputNormalized ||
      emailFinal === inputNormalized;

    const passMatch = u.password_hash
      ? bcrypt.compareSync(oldPass, u.password_hash)
      : u.password === oldPass;

    return usernameMatch && passMatch;
  });

  return found || null;
};

const loadConfigAzienda = async () => {
  await loginAdminFirebase(); // 👈 STESSO IDENTICO PASSAGGIO

  const docRef = doc(db, "configurazioni", "datiAzienda");
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  return snap.data();
};

useEffect(() => {
  const loadLogo = async () => {
    try {
      console.log("🚀 Carico config azienda...");

      const data = await loadConfigAzienda();

      console.log("✅ CONFIG:", data);

      if (data?.logoBase64) {
        setLogoBase64(data.logoBase64);
      }

    } catch (e) {
      console.error("💥 errore logo:", e);
    }
  };

  loadLogo();
}, []);
const handleChangeUsername = async () => {
  setMessage("");

  try {
    const user = await verifyUser();
    if (!user) return setMessage("Credenziali attuali errate");

    const normalized = newUsername.trim().toLowerCase();

    if (!normalized) {
      return setMessage("Username non valido");
    }

    await loginAdminFirebase();

    // 🔥 1. BLOCCO 1 MESE
    const lastChangeRaw = user.dataUltimoCambioUsername;
    const lastChange = lastChangeRaw?.toDate
      ? lastChangeRaw.toDate()
      : lastChangeRaw ? new Date(lastChangeRaw) : null;

    const now = new Date();

    if (lastChange) {
      const diffMs = now - lastChange;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < 30) {
        const remaining = Math.ceil(30 - diffDays);

        await scriviLog({
          pagina: "login",
          evento: "MODIFICA_USERNAME_BLOCCATA",
          utente: `${user.ruolo || "OPERATORE"} - ${user.username}`,
          riferimento: {
            collezione: "utenti",
            documentoId: user.id
          },
          before: {
            username: user.username,
            tentativo: normalized,
            motivo: "Username già modificato negli ultimi 30 giorni"
          },
          after: {
            risultato: "BLOCCATO",
            giorni_rimanenti: remaining
          },
          ripristinabile: false
        });

        return setMessage(`Puoi cambiare username solo 1 volta al mese. Riprova tra ${remaining} giorni.`);
      }
    }

    // 🔥 2. CHECK DUPLICATI (UTENTI ATTIVI + STORICO)
    const snap = await getDocs(collection(db, "utenti"));

    const exists = snap.docs.some((d) => {
      const data = d.data();

      return (
        data.username_lower === normalized &&
        d.id !== user.id
      );
    });

    if (exists) {
      return setMessage("Username già esistente");
    }

    // 🧠 PREPARA CONFERMA
    setPendingUsernameChange({
      userId: user.id,
      oldUsername: user.username,
      newUsername: newUsername.trim(),
      normalized
    });

    setShowUsernameWarning(true);

  } catch (e) {
    console.error(e);
    setMessage("Errore cambio username");
  }
};

const confirmUsernameChange = async () => {
  if (!pendingUsernameChange) return;

  const { userId, oldUsername, newUsername, normalized } = pendingUsernameChange;

  const now = new Date();

  try {
    await loginAdminFirebase();

    // =============================
    // 🔎 1. CERCO STORICO UTENTE (OTTIMIZZATO)
    // =============================
    const historyRef = collection(db, "username_history");

    const qUserHistory = query(
      historyRef,
      where("userId", "==", userId),
      limit(1)
    );

    const historySnap = await getDocs(qUserHistory);

    const hasHistory = !historySnap.empty;

    // =============================
    // 📅 2. CARICO DATA AVVIAMENTO (solo se serve)
    // =============================
    let giornoAvviamento = null;

    if (!hasHistory) {
      const configRef = doc(db, "configurazioni", "datiAzienda");
      const configSnap = await getDoc(configRef);

      giornoAvviamento = configSnap.data()?.giornoAvviamento;
    }

    // =============================
    // 🔒 3. CHIUDO EVENTUALE RECORD ATTIVO
    // =============================
    const qActive = query(
      historyRef,
      where("userId", "==", userId),
      where("endAt", "==", null),
      limit(1)
    );

    const activeSnap = await getDocs(qActive);

    if (!activeSnap.empty) {
      const activeDoc = activeSnap.docs[0];

      await updateDoc(doc(db, "username_history", activeDoc.id), {
        endAt: Timestamp.fromDate(now)
      });
    }

    // =============================
    // 🧠 4. BOOTSTRAP (SE NON ESISTE STORICO)
    // =============================
    if (!hasHistory) {
      await addDoc(historyRef, {
        userId,
        username: oldUsername,
        username_lower: (oldUsername || "").toLowerCase(),
        startAt: Timestamp.fromDate(new Date(giornoAvviamento)),
        endAt: Timestamp.fromDate(now),
        source: "Avviamento"
      });
    }

    // =============================
// 🚫 CONTROLLO USERNAME GIÀ USATO DA ALTRI (STORICO)
// =============================
const qUsernameUsed = query(
  historyRef,
  where("username_lower", "==", normalized)
);

const usernameSnap = await getDocs(qUsernameUsed);

const usedByAnother = usernameSnap.docs.some(d => {
  const data = d.data();
  return data.userId !== userId;
});

if (usedByAnother) {
  setMessage("IMPOSSIBILE CONTINUARE: Username già utilizzato in passato da un altro utente");
  return;
}

 await updateDoc(doc(db, "utenti", userId), {
  username: newUsername,
  username_lower: normalized,
  dataUltimoCambioUsername: Timestamp.fromDate(now)
});

    // =============================
    // ➕ 6. NUOVO RECORD STORICO
    // =============================
    await addDoc(historyRef, {
      userId,
      username: newUsername,
      username_lower: normalized,
      startAt: Timestamp.fromDate(now),
      endAt: null,
      source: "CambioNomeUtente"
    });

    // =============================
    // 🧾 7. LOG
    // =============================
    await scriviLog({
      pagina: "login",
      evento: "MODIFICA_USERNAME",
      riferimento: {
        collezione: "utenti",
        documentoId: userId
      },
      before: {
        username: oldUsername
      },
      after: {
        username: newUsername,
        bootstrap: !hasHistory
      },
      utente: `${oldUsername} → ${newUsername}`,
      ripristinabile: true
    });

    // =============================
    // ✅ UI
    // =============================
    setMessage("Username aggiornato");
    setMode(null);
    setShowUsernameWarning(false);
    setPendingUsernameChange(null);

  } catch (e) {
    console.error(e);
    setMessage("Errore aggiornamento username");
  }
};

const handleChangePassword = async () => {
  console.log("🚀 START cambio password");

  setMessage("");

  const utenteFallback = oldUser || "UTENTE_SCONOSCIUTO";
  console.log("👤 utenteFallback:", utenteFallback);

  // =========================
  // CHECK PASSWORD MATCH
  // =========================
  if (newPassword !== confirmPassword) {
    console.log("❌ PASSWORD NON COINCIDONO");

    const logPayload = {
      pagina: "login",
      evento: "MODIFICA_PASSWORD",
      utente: utenteFallback,
      before: {
        username: oldUser,
        esito: "PASSWORD_MISMATCH"
      },
      after: {
        risultato: "BLOCCATO"
      },
      meta: { tipo: "AUTH" },
      ripristinabile: false
    };

    console.log("🧾 LOG PASSWORD_MISMATCH:", logPayload);
    await scriviLog(logPayload);

    return setMessage("Le password non coincidono");
  }

  try {
    console.log("🔍 verifyUser() START");
    const user = await verifyUser();
    console.log("👤 USER TROVATO:", user);

    const utenteLog = user
      ? `${user.ruolo || "OPERATORE"} - ${user.username || user.email}`
      : utenteFallback;

    console.log("🧾 utenteLog:", utenteLog);

    // =========================
    // UTENTE NON TROVATO
    // =========================
    if (!user) {
      console.log("❌ UTENTE NON TROVATO");

      const logPayload = {
        pagina: "login",
        evento: "MODIFICA_PASSWORD",
        utente: utenteLog,
        riferimento: {
          collezione: "utenti",
          documentoId: null
        },
        before: {
          username: oldUser,
          esito: "UTENTE_NON_TROVATO"
        },
        after: {
          risultato: "RIFIUTATO"
        },
        meta: { tipo: "AUTH" },
        ripristinabile: false
      };

      console.log("🧾 LOG UTENTE NON TROVATO:", logPayload);
      await scriviLog(logPayload);

      return setMessage("Credenziali attuali errate");
    }

    // =========================
    // PASSWORD CHECK
    // =========================
    console.log("🔐 CHECK PASSWORD");

    let passwordOk = true;

    if (user.password_hash) {
      passwordOk = await bcrypt.compare(oldPass, user.password_hash);
      console.log("🧪 bcrypt compare:", passwordOk);
    } else {
      passwordOk = user.password === oldPass;
      console.log("🧪 plaintext compare:", passwordOk);
    }

    // =========================
    // PASSWORD ERRATA
    // =========================
    if (!passwordOk) {
      console.log("❌ PASSWORD ERRATA");

      const logPayload = {
        pagina: "login",
        evento: "MODIFICA_PASSWORD",
        utente: utenteLog,
        riferimento: {
          collezione: "utenti",
          documentoId: user.id
        },
        before: {
          username: oldUser,
          esito: "PASSWORD_ERRATA"
        },
        after: {
          risultato: "NEGATO"
        },
        meta: { tipo: "AUTH" },
        ripristinabile: false
      };

      console.log("🧾 LOG PASSWORD ERRATA:", logPayload);
      await scriviLog(logPayload);

      return setMessage("Credenziali attuali errate");
    }

    // =========================
    // HASH PASSWORD
    // =========================
    console.log("🆕 GENERO HASH");

    const hashed = await bcrypt.hash(newPassword, 10);
    console.log("🔐 HASH OK");

    // =========================
    // UPDATE FIRESTORE
    // =========================
    console.log("💾 UPDATE FIRESTORE");

    await updateDoc(doc(db, "utenti", user.id), {
      password_hash: hashed,
      password: null
    });

    console.log("💾 UPDATE OK");

    // =========================
    // SUCCESS
    // =========================
    const logPayload = {
      pagina: "login",
      evento: "MODIFICA_PASSWORD",
      utente: utenteLog,
      riferimento: {
        collezione: "utenti",
        documentoId: user.id
      },
      before: {
        username: user.username || user.email
      },
      after: {
        risultato: "PASSWORD_AGGIORNATA"
      },
      meta: { tipo: "AUTH" },
      ripristinabile: true
    };

    console.log("🧾 LOG SUCCESS:", logPayload);
    await scriviLog(logPayload);

    console.log("✅ COMPLETATO");

    setMessage("Password aggiornata");
    setMode(null);

  } catch (e) {
    console.error("💥 ERRORE:", e);

    const logPayload = {
      pagina: "login",
      evento: "MODIFICA_PASSWORD",
      utente: utenteFallback,
      riferimento: {
        collezione: "utenti",
        documentoId: null
      },
      before: {
        username: oldUser,
        errore: e?.message || "UNKNOWN"
      },
      after: {
        risultato: "ERRORE"
      },
      meta: { tipo: "AUTH" },
      ripristinabile: false
    };

    console.log("🧾 LOG ERRORE:", logPayload);
    await scriviLog(logPayload);

    setMessage("Errore cambio password");
  }
};
  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "0 auto" }}>
   <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
  
  {logoBase64 && (
    <img
      src={`data:image/png;base64,${logoBase64}`}
      alt="logo"
      style={{ height: 160 }}
    />
  )}<h2 style={{ margin: 0 }}>Accesso Utente</h2>
</div>

      {message && <p style={{ color: "red" }}>{message}</p>}

     <input
  placeholder="Nome utente o email"
  value={inputUsername}
  onChange={e => setInputUsername(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") handleLogin();
  }}
  style={{ width: "100%", marginBottom: 10, padding: 8 }}
/>

<input
  type="password"
  placeholder="Password"
  value={inputPassword}
  onChange={e => setInputPassword(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") handleLogin();
  }}
  style={{ width: "100%", marginBottom: 10, padding: 8 }}
/>

      <button onClick={handleLogin} style={{ width: "100%", padding: 10 }}>
        Accedi
      </button>

      {/* AZIONI EXTRA */}
    
        <button onClick={() => setMode("username")} style={{ width: "100%", padding: 10 }}>
          Cambia Username
        </button>

        <button onClick={() => setMode("password")} style={{ width: "100%", padding: 10 }}> 
          Cambia Password
        </button>
    {showUsernameWarning && (
  <div style={{
    marginTop: 15,
    padding: 10,
    background: "#ffdddd",
    border: "1px solid red",
    color: "#b30000"
  }}>
    <b>ATTENZIONE</b>
    <p>
      Cambiando username, tutto ciò che è stato fatto con il vecchio username resterà invariato.
      Da questo momento verrà usato il nuovo username.
    </p>

    <p>
      <b>{pendingUsernameChange?.oldUsername}</b> → <b>{pendingUsernameChange?.newUsername}</b>
    </p>

    <button onClick={confirmUsernameChange}>
      Conferma cambio
    </button>

    <button onClick={() => {
      setShowUsernameWarning(false);
      setPendingUsernameChange(null);
    }}>
      Annulla
    </button>
  </div>
)}
      {/* MODIFICA USERNAME */}
      {mode === "username" && (
        <div style={{ marginTop: 20 }}>
          <h4>Cambio Username</h4>

          <input
            placeholder="Username attuale"
            value={oldUser}
            onChange={e => setOldUser(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password attuale"
            value={oldPass}
            onChange={e => setOldPass(e.target.value)}
          />

          <input
            placeholder="Nuovo username"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
          />

          <button onClick={handleChangeUsername}>
            Conferma
          </button>
        </div>
      )}

      {/* MODIFICA PASSWORD */}
      {mode === "password" && (
        <div style={{ marginTop: 20 }}>
          <h4>Cambio Password</h4>

          <input
            placeholder="Username o email"
            value={oldUser}
            onChange={e => setOldUser(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password attuale"
            value={oldPass}
            onChange={e => setOldPass(e.target.value)}
          />

          <input
            type="password"
            placeholder="Nuova Password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Conferma password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />

          <button onClick={handleChangePassword}>
            Conferma
          </button>
        </div>
      )}
    </div>
  );
};

export default Login;