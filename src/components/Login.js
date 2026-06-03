// src/components/Login.js
import React, { useState } from "react";
import { db, auth, loginAdminFirebase } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { useEffect } from "react";
import { getDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
const Login = () => {
  const navigate = useNavigate();
const [logoBase64, setLogoBase64] = useState(null);
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [message, setMessage] = useState("");

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

const handleLogin = async () => {
  setMessage("");

  const userAgent = navigator.userAgent || "UNKNOWN_DEVICE";

  if (!inputUsername || !inputPassword) {
    setMessage("Inserisci username o email e password");
    return;
  }

  try {
    await loginAdminFirebase();

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

    const ip = await getClientIP();

    const baseMeta = {
      tipo: "AUTH",
      ip,
      device: userAgent
    };

    const utenteLog = (base) => `${base} +IP: ${ip}`;

    // ❌ USER NOT FOUND
    if (!userFound) {
      auth.signOut();

      await scriviLog({
        pagina: "login",
        evento: "LOGIN_FAIL_USER_NOT_FOUND",
        riferimento: {
          collezione: "utenti",
          documentoId: null
        },
        utente: utenteLog(inputNormalized),
        meta: baseMeta,
        ripristinabile: false
      });

      setMessage("Username o password errati");
      return;
    }

    // 🔒 ACCOUNT BLOCCATO
    if (userFound.lock_until && userFound.lock_until > Date.now()) {
      auth.signOut();

      await scriviLog({
        pagina: "login",
        evento: "LOGIN_BLOCKED",
        riferimento: {
          collezione: "utenti",
          documentoId: userFound.id
        },
        utente: utenteLog(inputNormalized),
        meta: baseMeta,
        ripristinabile: false
      });

      setMessage("Account temporaneamente bloccato");
      return;
    }

    // 🔐 PASSWORD CHECK
    let passwordOk = false;

    if (userFound.password_hash) {
      passwordOk = await bcrypt.compare(inputPassword, userFound.password_hash);
    } else if (userFound.password) {
      passwordOk = inputPassword === userFound.password;
    }

    // ❌ PASSWORD SBAGLIATA
    if (!passwordOk) {
      const failedAttempts = (userFound.failed_attempts || 0) + 1;

      let lockMinutes = 0;
      if (failedAttempts >= 7) lockMinutes = 24 * 60;
      else if (failedAttempts >= 5) lockMinutes = 60;
      else if (failedAttempts >= 3) lockMinutes = 15;

      const updateData = { failed_attempts: failedAttempts };

      if (lockMinutes > 0) {
        updateData.lock_until = Date.now() + lockMinutes * 60000;
      }

      await updateDoc(doc(db, "utenti", userFound.id), updateData);

      auth.signOut();

      await scriviLog({
        pagina: "login",
        evento: "LOGIN_FAIL_WRONG_PASSWORD",
        riferimento: {
          collezione: "utenti",
          documentoId: userFound.id
        },
        utente: utenteLog(inputNormalized),
        meta: baseMeta,
        ripristinabile: false
      });

      setMessage("Username o password errati");
      return;
    }

    // 🚨 DEFAULT PASSWORD CHECK
    let isDefaultPassword = false;

    if (userFound.password_hash) {
      isDefaultPassword = await bcrypt.compare("12345", userFound.password_hash);
    } else {
      isDefaultPassword = userFound.password === "12345";
    }

    if (isDefaultPassword) {
      await scriviLog({
        pagina: "login",
        evento: "LOGIN_DEFAULT_PASSWORD",
        riferimento: {
          collezione: "utenti",
          documentoId: userFound.id
        },
        utente: utenteLog(inputNormalized),
        meta: baseMeta,
        ripristinabile: false
      });

      alert("Password di default: devi cambiarla");

      setMode("password");
      setOldUser(userFound.username || userFound.email || "");
      setOldPass("12345");

      return;
    }

    // ✅ RESET TENTATIVI
    await updateDoc(doc(db, "utenti", userFound.id), {
      failed_attempts: 0,
      lock_until: null
    });

    const ruolo = (userFound.ruolo || "OPERATORE").toUpperCase();

    const usernameFinal =
      userFound.username ||
      (userFound.email ? userFound.email.split("@")[0] : "Sconosciuto");

    const safeUser = {
      uid: userFound.uid,
      username: usernameFinal,
      ruolo,
      email: userFound.email || ""
    };

    sessionStorage.setItem("utenteLoggato", JSON.stringify(safeUser));

    // 🎯 LOGIN OK (pulito + consistente)
    await scriviLog({
      pagina: "login",
      evento: "LOGIN_OK",
      riferimento: {
        collezione: "utenti",
        documentoId: userFound.id
      },
      before: null,
      after: null,
      utente: utenteLog(buildLogUser(userFound, inputNormalized)),
      meta: baseMeta,
      ripristinabile: false
    });

    if (ruolo === "ADMIN" || ruolo === "MANAGER") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/scarichi", { replace: true });
    }

  } catch (err) {
    console.error(err);
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
  // =============================
  // CAMBIO USERNAME
  // =============================
  const handleChangeUsername = async () => {
    setMessage("");

    try {
      const user = await verifyUser();
      if (!user) return setMessage("Credenziali attuali errate");

      const snap = await getDocs(collection(db, "utenti"));
    const exists = snap.docs.some(d =>
  d.data().username?.toLowerCase() === newUsername.toLowerCase()
);

      if (exists) return setMessage("Username già esistente");

      await updateDoc(doc(db, "utenti", user.id), {
        username: newUsername
      });

      await scriviLog({
  pagina: "login",
  azione: "MODIFICA_USERNAME",
  collezioneRef: "utenti",
  documentoId: user.id,

  dati_originali: { username: user.username },
  dati_modificati: { username: newUsername },

  meta: {
    tipo: "AUTH"
  },

  ripristinabile: true
});

      setMessage("Username aggiornato");
      setMode(null);

    } catch (e) {
      setMessage("Errore cambio username");
    }
  };

const handleChangePassword = async () => {
  console.log("🚀 START cambio password");

  setMessage("");

  if (newPassword !== confirmPassword) {
    console.log("❌ password non coincidono");
    return setMessage("Le password non coincidono");
  }

  try {
    console.log("🔍 verifico utente...");
    const user = await verifyUser();

    console.log("👤 risultato verifyUser:", user);

    if (!user) {
      console.log("❌ utente NON trovato o password errata");
      return setMessage("Credenziali attuali errate");
    }

    console.log("🔐 password attuale inserita:", oldPass);
    console.log("🔐 hash salvato:", user.password_hash);

    if (user.password_hash) {
      const compareTest = await bcrypt.compare(oldPass, user.password_hash);
      console.log("🧪 test bcrypt compare:", compareTest);
    } else {
      console.log("⚠️ utente ha password in chiaro");
    }

    console.log("🆕 nuova password:", newPassword);

    const hashed = await bcrypt.hash(newPassword, 10);

    console.log("🔐 nuovo hash generato:", hashed);

    await updateDoc(doc(db, "utenti", user.id), {
      password_hash: hashed,
      password: null
    });

    console.log("💾 password salvata su DB");

    await scriviLog({
      pagina: "login",
      azione: "MODIFICA_PASSWORD",
      collezioneRef: "utenti",
      documentoId: user.id,
      dati_originali: { password: "***" },
      dati_modificati: { password: "***" },
      meta: { tipo: "AUTH" },
      ripristinabile: true
    });

    console.log("🧾 log scritto");

    setMessage("Password aggiornata");
    setMode(null);

  } catch (e) {
    console.error("💥 ERRORE cambio password:", e);
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

      {/* LOGIN */}
      <input
        placeholder="Nome utente o email"
        value={inputUsername}
        onChange={e => setInputUsername(e.target.value)}
        style={{ width: "100%", marginBottom: 10, padding: 8 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={inputPassword}
        onChange={e => setInputPassword(e.target.value)}
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