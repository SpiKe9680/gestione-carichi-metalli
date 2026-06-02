// src/components/AdminDashboard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSignOutAlt,
  FaExchangeAlt,
  FaList,
  FaUsers,
  FaTags,
  FaTruck,
  FaRecycle,
  FaClipboardList,
  FaCog,
  FaCalendarAlt,
  FaMoneyBillWave
} from "react-icons/fa";

const AdminDashboard = ({ logout }) => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato"));
const role = currentUser?.ruolo?.toUpperCase() || "OPERATORE";
  if (!currentUser) return null;

  return (
    <div className="admin-dashboard-container">
      <div className="admin-header">
        <h2>Movimentazione Metalli</h2>

        <button onClick={logout}>
          <FaSignOutAlt style={{ marginRight: "8px" }} />
          Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </button>
      </div>

      <div className="admin-actions">
        <button onClick={() => navigate("/scarichi")}>
          <FaExchangeAlt style={{ marginRight: "8px" }} />
          Inserisci Scarico/Carico
        </button>

        <button onClick={() => navigate("/gestione-scarichi")}>
          <FaList style={{ marginRight: "8px" }} />
          Gestione Scarichi/Carichi
        </button>

       

        

        
        <button onClick={() => navigate("/gestione-cer")}>
          <FaRecycle style={{ marginRight: "8px" }} />
          Materiali
        </button>

        <button onClick={() => navigate("/gestione-listini")}>
          <FaTags style={{ marginRight: "8px" }} />
          Definizione Listini
        </button>

        {role === "ADMIN" && (
  <button
    onClick={() => navigate("/MovimentiFinanziari")}
    style={{ backgroundColor: "#fff703", color: "#4d12ff", marginTop: "10px" }}
  >
    <FaCalendarAlt style={{ marginRight: "8px" }} />
    Calendario Movimenti Finanziari
  </button>
)}

       {role === "ADMIN" && (
  <button onClick={() => navigate("/AnaMovFin")}
    style={{ backgroundColor: "#fff703", color: "#4d12ff", marginTop: "10px" }}
  >
    <FaMoneyBillWave style={{ marginRight: "8px" }} />
    Definizione Movimenti Finanziari
  </button>
)}

    {role === "ADMIN" && (
  <button onClick={() => navigate("/gestione-log")}
    style={{ backgroundColor: "#f36c19", color: "#11ffdb", marginTop: "10px" }}
  >
    <FaClipboardList style={{ marginRight: "8px" }} />
    Log Operazioni
  </button>
)}

       {role === "ADMIN" && (
  <button
    onClick={() => navigate("/configurazioni-generali")}
    style={{ backgroundColor: "#4CAF50", color: "#fff", marginTop: "10px" }}
  >
    <FaCog style={{ marginRight: "8px" }} />
    Configurazione Generale
  </button>
)}

        <button onClick={() => navigate("/fornitori")}>
          <FaTruck style={{ marginRight: "8px" }} />
          Controparti
        </button>


    {role === "ADMIN" && (
  <button onClick={() => navigate("/gestione-utenti")}>
    <FaUsers style={{ marginRight: "8px" }} />
    Utenti
  </button>
)}

      
      </div>
    </div>
  );
};

export default AdminDashboard;