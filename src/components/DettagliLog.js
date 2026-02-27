
// src/components/DettagliLog.js
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DettagliLog = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const log = state?.log;

  if (!log) {
    return (
      <div style={{ padding: 20 }}>
        <p>Log non trovato.</p>
        <button onClick={() => navigate(-1)}>← Torna indietro</button>
      </div>
    );
  }

  const formattaData = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT");
  };

  return (
    <div style={{ padding: 25, maxWidth: 900, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}>← Torna indietro</button>
      <h2>Dettaglio Operazione</h2>

      <p><b>Tipo:</b> {log.tipo || "NON DEFINITO"}</p>
      <p><b>Pagina:</b> {log.pagina || "sconosciuta"}</p>
      <p><b>Utente:</b> {log.utente || "sconosciuto"}</p>
      <p><b>Data:</b> {formattaData(log.timestamp)}</p>

      <hr />

      {log.dati_originali && (
        <>
          <h3>Dati Originali</h3>
          <pre>{JSON.stringify(log.dati_originali, null, 2)}</pre>
        </>
      )}

      {log.dati_modificati && (
        <>
          <h3>Dati Modificati / Inseriti</h3>
          <pre>{JSON.stringify(log.dati_modificati, null, 2)}</pre>
        </>
      )}
    </div>
  );
};

export default DettagliLog;