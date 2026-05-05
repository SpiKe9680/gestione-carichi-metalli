// src/components/Login.js
import React, { useState } from "react";
import { db, auth, loginAdminFirebase } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import { useEffect } from "react";
import { getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
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

  const handleLogin = async () => {
    setMessage("");

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

        return (
          (usernameFinal === inputNormalized || emailFinal === inputNormalized) &&
          u.password === inputPassword
        );
      });

      if (!userFound) {
        auth.signOut();
        setMessage("Username o password errati");
        return;
      }

      const usernameFinal =
        userFound.username ||
        (userFound.email ? userFound.email.split("@")[0] : "Sconosciuto");

      sessionStorage.setItem(
        "utenteLoggato",
        JSON.stringify({
          uid: userFound.uid,
          username: usernameFinal,
          ruolo: userFound.ruolo || "operatore",
          email: userFound.email || ""
        })
      );

      navigate(userFound.ruolo === "admin" ? "/admin" : "/scarichi", {
        replace: true
      });

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

    const found = users.find(u =>
      (u.username === oldUser || u.email === oldUser) &&
      u.password === oldPass
    );

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
        d.data().username === newUsername
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

  // =============================
  // CAMBIO PASSWORD
  // =============================
  const handleChangePassword = async () => {
    setMessage("");

    if (newPassword !== confirmPassword) {
      return setMessage("Le password non coincidono");
    }

    try {
      const user = await verifyUser();
      if (!user) return setMessage("Credenziali attuali errate");

      await updateDoc(doc(db, "utenti", user.id), {
        password: newPassword
      });

     await scriviLog({
  pagina: "login",
  azione: "MODIFICA_PASSWORD",
  collezioneRef: "utenti",
  documentoId: user.id,

  dati_originali: { password: "***" },
  dati_modificati: { password: "***" },

  meta: {
    tipo: "AUTH"
  },

  ripristinabile: true
});

      setMessage("Password aggiornata");
      setMode(null);

    } catch (e) {
      setMessage("Errore cambio password");
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "0 auto" }}>
   <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
  <h2 style={{ margin: 0 }}>Login</h2>
  {logoBase64 && (
    <img
      src={`data:image/png;base64,${logoBase64}`}
      alt="logo"
      style={{ height: 190 }}
    />
  )}
</div>

      {message && <p style={{ color: "red" }}>{message}</p>}

      {/* LOGIN */}
      <input
        placeholder="Username o email"
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
            placeholder="Password"
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