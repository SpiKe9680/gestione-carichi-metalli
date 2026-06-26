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
import MovimentiFinanziari from "./components/MovimentiFinanziari";
import MovimentiGiorno from "./components/MovimentiGiorno";
import AnaMovFin from "./components/AnagraficaMovimentoFinanziario"
import DDT from "./components/ddt"
import ConfiguratoreDocs from "./components/ConfiguratoreDocs";


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



const PrivateRoute = ({ children }) => {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

const AdminRoute = ({ children }) => {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;

  const ruolo = (user.ruolo || "").toUpperCase();

  if (!["ADMIN", "MANAGER"].includes(ruolo)) {
    return <Navigate to="/scarichi" replace />;
  }

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
    : <Navigate to={(getUser().ruolo || "").toUpperCase() === "ADMIN" ? "/admin" : "/scarichi"} replace />
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
          element={<PrivateRoute><GestioneUtenti logout={logout} /></PrivateRoute>} />

       <Route path="/ddt" element={<PrivateRoute><DDT logout={logout} /></PrivateRoute>} />



<Route path="/configuratore-docs"
          element={<PrivateRoute><ConfiguratoreDocs logout={logout} /></PrivateRoute>} />

        <Route path="/gestione-scarichi"
          element={<PrivateRoute><GestioneScarichi logout={logout} /></PrivateRoute>} />

        <Route path="/gestione-listini"
          element={<PrivateRoute><GestioneListini logout={logout} /></PrivateRoute>} />

        <Route path="/gestione-cer"
          element={<PrivateRoute><GestioneCER logout={logout} /></PrivateRoute>} />

        <Route path="/gestione-log"
          element={<PrivateRoute><GestioneLog /></PrivateRoute>} />

        <Route path="/dettagli-log"
          element={<PrivateRoute><DettagliLog /></PrivateRoute>} />

        <Route path="/configurazioni-generali"
          element={<PrivateRoute><ConfigurazioniGenerali /></PrivateRoute>} />
<Route
  path="/MovimentiFinanziari"
  element={
    <ProtectedRoute>
      <MovimentiFinanziari />
    </ProtectedRoute>
  }
/>

<Route path="/movimenti-giorno"
          element={<PrivateRoute><MovimentiGiorno /></PrivateRoute>} />
<Route path="/AnaMovFin"
          element={<PrivateRoute><AnaMovFin /></PrivateRoute>} />

        {/* FALLBACK */}
        <Route
          path="*"
          element={
            <Navigate
              to={getUser() ? ((getUser()?.ruolo || "").toUpperCase() === "ADMIN" ? "/admin" : "/scarichi") : "/login"}
              replace
            />
          }
        />

      </Routes>
    </Router>
  );
};

export default App;