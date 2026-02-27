// src/components/Login.js
import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import "./Login.css";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // --- Login ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLogin(userCredential.user);
      setError(""); // reset error
    } catch (err) {
      console.error("AUTH ERROR:", err);
      switch (err.code) {
        case "auth/user-not-found":
          setError("Utente non registrato");
          break;
        case "auth/wrong-password":
          setError("Password errata");
          break;
        case "auth/invalid-email":
          setError("Email non valida");
          break;
        default:
          setError("Errore di accesso: " + err.message);
      }
    }
  };

  // --- Logout ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogin(null); // reset utente loggato
    } catch (err) {
      console.error("Errore logout:", err);
      alert("Errore durante il logout");
    }
  };

  return (
    <div className="login-container">
      <h2>Login Operatore</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {error && <p className="error">{error}</p>}
      </form>

      {/* Pulsante Logout visibile solo se utente loggato */}
      {auth.currentUser && (
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      )}
    </div>
  );
};

export default Login;
