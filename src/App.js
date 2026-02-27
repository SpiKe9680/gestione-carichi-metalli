import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import Login from "./components/Login";
import Scarichi from "./components/Scarichi";
import AdminDashboard from "./components/AdminDashboard";
import GestioneUtenti from "./components/GestioneUtenti";
import GestioneScarichi from "./components/GestioneScarichi";
import GestioneFornitoriAvanzata from "./components/GestioneFornitoriAvanzata";
import GestioneListini from "./components/GestioneListini";
import GestioneCER from "./components/GestioneCER";
import GestioneLog from "./components/GestioneLog";

// ✅ NUOVA PAGINA DETTAGLI LOG
import DettagliLog from "./components/DettagliLog";

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const docRef = doc(db, "utenti", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setRole(docSnap.data().ruolo);
          } else {
            setRole("operatore");
          }
        } catch (err) {
          console.error("Errore lettura ruolo:", err);
          setRole("operatore");
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  if (loading || (user && role === null)) {
    return <p>Loading...</p>;
  }

  return (
    <Router>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={
            !user ? <Login onLogin={setUser} /> : <Navigate to={role === "admin" ? "/admin" : "/scarichi"} />
          }
        />

        {/* PAGINA SCARICHI */}
        <Route
          path="/scarichi"
          element={user ? <Scarichi user={user} logout={logout} /> : <Navigate to="/login" />}
        />

        {/* DASHBOARD ADMIN */}
        <Route
          path="/admin"
          element={user && role === "admin" ? <AdminDashboard logout={logout} /> : <Navigate to="/scarichi" />}
        />

        {/* GESTIONE UTENTI */}
        <Route
          path="/gestione-utenti"
          element={user && role === "admin" ? <GestioneUtenti logout={logout} /> : <Navigate to="/scarichi" />}
        />

        {/* GESTIONE SCARICHI */}
        <Route
          path="/gestione-scarichi"
          element={user && role === "admin" ? <GestioneScarichi logout={logout} /> : <Navigate to="/scarichi" />}
        />

        {/* GESTIONE LISTINI */}
        <Route
          path="/gestione-listini"
          element={user && role === "admin" ? <GestioneListini logout={logout} /> : <Navigate to="/scarichi" />}
        />

        {/* GESTIONE CER */}
        <Route
          path="/gestione-cer"
          element={user && role === "admin" ? <GestioneCER logout={logout} /> : <Navigate to="/scarichi" />}
        />

        {/* GESTIONE FORNITORI */}
        <Route
          path="/gestione-fornitori"
          element={user && role === "admin" ? <GestioneFornitoriAvanzata /> : <Navigate to="/scarichi" />}
        />

        {/* GESTIONE LOG */}
        <Route
          path="/gestione-log"
          element={user && role === "admin" ? <GestioneLog /> : <Navigate to="/scarichi" />}
        />

        {/* ✅ DETTAGLI LOG */}
        <Route
          path="/dettagli-log"
          element={user && role === "admin" ? <DettagliLog /> : <Navigate to="/scarichi" />}
        />

        {/* FALLBACK */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                user
                  ? role === "admin"
                    ? "/admin"
                    : "/scarichi"
                  : "/login"
              }
            />
          }
        />

      </Routes>
    </Router>
  );
};

export default App;