// src/components/AdminDashboard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
const AdminDashboard = ({ logout }) => {
  const navigate = useNavigate();

  return (
    <div className="admin-dashboard-container">
      <div className="admin-header">
        <h2>Strumenti di Amministrazione</h2> 
        <button onClick={logout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
      </div>

      <div className="admin-actions">
        <button onClick={() => navigate("/scarichi")}>
          Nuovo Scarico / Carico
        </button>

        <button onClick={() => navigate("/gestione-scarichi")}>
          Gestione Scarichi con Prezzi
        </button>

        <button onClick={() => navigate("/gestione-utenti")}>
          Gestione Utenti
        </button>

        <button onClick={() => navigate("/gestione-listini")}>
          Gestione Listini
        </button>

        <button onClick={() => navigate("/gestione-fornitori")}>
          Gestione Fornitori
        </button>

        <button onClick={() => navigate("/gestione-cer")}>
          Gestione Codici C.E.R.
        </button>

        {/* ✅ NUOVO PULSANTE LOG */}
        <button onClick={() => navigate("/gestione-log")}>
          Gestione Log Operazioni
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
