// src/components/DettagliLog.js
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DettagliLog = () => {
const navigate = useNavigate();
const log = useLocation().state?.log;

  if (!log) {
    return (
      <div style={{ padding: 20 }}>
        <p>Log non trovato.</p>
        <button onClick={() => navigate(-1)}>← Torna indietro</button>
      </div>
    );
  }

const formattaData = (ts) => {
  if (!ts) return "";

  let d = null;

  // ✅ Firestore Timestamp reale
  if (typeof ts.toDate === "function") {
    d = ts.toDate();
  }

  // ✅ Timestamp serializzato
  else if (ts.seconds) {
    d = new Date(ts.seconds * 1000);
  }

  // ✅ fallback
  else {
    d = new Date(ts);
  }

  if (!d || isNaN(d)) return "";

  return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT");
};

  // 🔁 compatibilità vecchio/nuovo sistema
  const before = log.before ?? log.dati_originali ?? null;
  const after = log.after ?? log.dati_modificati ?? null;

 const tipo =
  log.evento ||
  (log.azione ? `${log.azione}_${log.tipo || ""}`.trim() : null) ||
  log.tipo ||
  "NON DEFINITO";

  return (
    <div style={{ padding: 25, maxWidth: 900, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}>← Torna indietro</button>

      <h2>Dettaglio Operazione</h2>

      <p><b>Tipo:</b> {tipo}</p>
      <p><b>Pagina:</b> {log.pagina || "sconosciuta"}</p>
      <p><b>Utente:</b> {log.utente || "sconosciuto"}</p>
      <p><b>Data:</b> {formattaData(log.timestamp)}</p>

      <hr />

      {before && (
        <>
          <h3>Before / Dati Originali</h3>
          <pre style={{ background: "#f5f5f5", padding: 10 }}>
            {JSON.stringify(before, null, 2)}
          </pre>
        </>
      )}

      {after && (
        <>
          <h3>After / Dati Modificati</h3>
          <pre style={{ background: "#f5f5f5", padding: 10 }}>
            {JSON.stringify(after, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
};

export default DettagliLog;

