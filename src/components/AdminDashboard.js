// src/components/AdminDashboard.js
import React, { useState, useEffect } from "react";
import { loadConfigAzienda } from "../utils/dateUtils";
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
  FaMoneyBillWave,
  FaWarehouse
} from "react-icons/fa";
import PageLayout from "./layout/PageLayout";
import ActionButton from "./ui/ActionButton";

const AdminDashboard = ({ logout }) => {
  const navigate = useNavigate();

  const [configAzienda, setConfigAzienda] = useState(null);

  useEffect(() => {
    const load = async () => {
      const config = await loadConfigAzienda();
      setConfigAzienda(config);
    };

    load();
  }, []);

  const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato"));
  const role = currentUser?.ruolo?.toUpperCase() || "OPERATORE";

  console.log("METALFLOW - ruolo dashboard:", role, currentUser);

  if (!currentUser) return null;

  return (
    <PageLayout
      title="METALFLOW - Menù"
      logoBase64={configAzienda?.logoBase64}
      headerActions={
        <ActionButton variant="danger" compact onClick={logout}>
          <FaSignOutAlt />
          Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </ActionButton>
      }
    >
      <div className="mf-actions">
        {/* FUNZIONI OPERATIVE: BLU */}

        <ActionButton onClick={() => navigate("/scarichi")}>
          <FaExchangeAlt />
          <span>Aggiungi Scarico/Carico</span>
        </ActionButton>

        <ActionButton onClick={() => navigate("/gestione-scarichi")}>
          <FaList />
          <span>Gestione Scarichi/Carichi</span>
        </ActionButton>

        <ActionButton onClick={() => navigate("/gestione-cer")}>
          <FaRecycle />
          <span>Materiali</span>
        </ActionButton>

        <ActionButton onClick={() => navigate("/gestione-listini")}>
          <FaTags />
          <span>Definizione Listini</span>
        </ActionButton>

        <ActionButton onClick={() => navigate("/fornitori")}>
          <FaTruck />
          <span>Controparti</span>
        </ActionButton>

        {["MANAGER", "ADMIN"].includes(role) && (
          <ActionButton onClick={() => navigate("/magazzino-mps")}>
            <FaWarehouse />
            <span>Magazzino MPS</span>
          </ActionButton>
        )}

        {/* FUNZIONI AMMINISTRATIVE: GRIGIO ANTRACITE */}

        {role === "ADMIN" && (
          <>
            <ActionButton variant="admin" onClick={() => navigate("/MovimentiFinanziari")}>
              <FaCalendarAlt />
              <span>Calendario Movimenti Finanziari</span>
            </ActionButton>

            <ActionButton variant="admin" onClick={() => navigate("/AnaMovFin")}>
              <FaMoneyBillWave />
              <span>Definizione Movimenti Finanziari</span>
            </ActionButton>

            <ActionButton variant="admin" onClick={() => navigate("/gestione-log")}>
              <FaClipboardList />
              <span>Log Operazioni</span>
            </ActionButton>

            <ActionButton variant="admin" onClick={() => navigate("/configurazioni-generali")}>
              <FaCog />
              <span>Configurazione Generale</span>
            </ActionButton>

            <ActionButton variant="admin" onClick={() => navigate("/gestione-utenti")}>
              <FaUsers />
              <span>Utenti</span>
            </ActionButton>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default AdminDashboard;
