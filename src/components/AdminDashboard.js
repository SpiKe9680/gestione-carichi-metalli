// src/components/AdminDashboard.js
import React from "react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = ({ logout }) => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato"));


if (!currentUser) return null;
  return (
    <div className="admin-dashboard-container">
      <div className="admin-header">
        <h2>Gestione Carico Scarico Metalli</h2> 
        
        {/* 🔹 Mostra username o email, mai auth.currentUser */}
        <button onClick={logout}>
          🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </button>
      </div>

      <div className="admin-actions">
        <button onClick={() => navigate("/scarichi")}>
          Inserisci Scarico/Carico
        </button>

        <button onClick={() => navigate("/gestione-scarichi")}>
          Gestione Scarichi/Carichi 
        </button>

        <button onClick={() => navigate("/gestione-utenti")}>
          Gestione Utenti
        </button>

        <button onClick={() => navigate("/gestione-listini")}>
          Gestione Listini
        </button>

        <button onClick={() => navigate("/fornitori")}>
          Gestione Controparti
        </button>

        <button onClick={() => navigate("/gestione-cer")}>
          Gestione Codici C.E.R.
        </button>

        <button onClick={() => navigate("/gestione-log")}>
          Gestione Log Operazioni
        </button>

        <button 
          onClick={() => navigate("/configurazioni-generali")}
          style={{ backgroundColor: "#4CAF50", color: "#fff", marginTop: "10px" }}
        >
          Configurazione Generale
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;