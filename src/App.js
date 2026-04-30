// src/App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

import Login from "./components/Login";
import Scarichi from "./components/Scarichi";
import AdminDashboard from "./components/AdminDashboard";
import GestioneUtenti from "./components/GestioneUtenti";
import GestioneScarichi from "./components/GestioneScarichi";
import GestioneFornitoriAvanzata from "./components/GestioneFornitoriAvanzata";
import GestioneListini from "./components/GestioneListini";
import GestioneCER from "./components/GestioneCER";
import GestioneLog from "./components/GestioneLog";
import DettagliLog from "./components/DettagliLog";
import ConfigurazioniGenerali from "./components/ConfigurazioniGenerali";

const getUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem("utenteLoggato"));
  } catch {
    return null;
  }
};

const ProtectedRoute = ({ children, roleRequired }) => {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;
  if (roleRequired && user.ruolo !== roleRequired) return <Navigate to="/scarichi" replace />;

  return children;
};

const AdminRoute = ({ children }) => {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;
  if (user.ruolo !== "admin") return <Navigate to="/scarichi" replace />;

  return children;
};

const App = () => {

  const logout = async () => {
    await signOut(auth);
    sessionStorage.removeItem("utenteLoggato");
    window.location.href = "/login";
  };

  return (
    <Router>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={
            !getUser()
              ? <Login />
              : <Navigate to={getUser().ruolo === "admin" ? "/admin" : "/scarichi"} replace />
          }
        />

        {/* SCARICHI */}
        <Route
          path="/scarichi"
          element={
            <ProtectedRoute>
              <Scarichi logout={logout} role={getUser()?.ruolo} user={getUser()} />
            </ProtectedRoute>
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard logout={logout} />
            </AdminRoute>
          }
        />

        {/* ALTRE */}
        <Route path="/fornitori" element={<ProtectedRoute><GestioneFornitoriAvanzata /></ProtectedRoute>} />

        <Route path="/gestione-utenti"
          element={<AdminRoute><GestioneUtenti logout={logout} /></AdminRoute>} />

        <Route path="/gestione-scarichi"
          element={<AdminRoute><GestioneScarichi logout={logout} /></AdminRoute>} />

        <Route path="/gestione-listini"
          element={<AdminRoute><GestioneListini logout={logout} /></AdminRoute>} />

        <Route path="/gestione-cer"
          element={<AdminRoute><GestioneCER logout={logout} /></AdminRoute>} />

        <Route path="/gestione-log"
          element={<AdminRoute><GestioneLog /></AdminRoute>} />

        <Route path="/dettagli-log"
          element={<AdminRoute><DettagliLog /></AdminRoute>} />

        <Route path="/configurazioni-generali"
          element={<AdminRoute><ConfigurazioniGenerali /></AdminRoute>} />

        {/* FALLBACK */}
        <Route
          path="*"
          element={
            <Navigate
              to={getUser() ? (getUser().ruolo === "admin" ? "/admin" : "/scarichi") : "/login"}
              replace
            />
          }
        />

      </Routes>
    </Router>
  );
};

export default App;