// src/components/MovimentiGiorno.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { collection, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
const MovimentiGiorno = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser =
    JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};

  const [giornoAvviamento, setGiornoAvviamento] = useState(null);

  // --------------------------
  // MOCK DATA (poi Firestore)
  // --------------------------
  const [carichiScarichi, setCarichiScarichi] = useState([]);
const normalizeMovimenti = (docs) => {
  const toDate = (v) => {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    return new Date(v);
  };

  const out = [];

  docs.forEach(d => {

    (d.carico || []).forEach((c, idx) => {
      const data = toDate(c.data ?? d.data);

      if (!data || isNaN(data)) return;

      out.push({
        id: `${d.id}_carico_${idx}`,
        tipo: "carico",
        importo: Number(c.totaleCer ?? c.netto ?? 0),
        data,
        dataPagamento: toDate(c.dataPagamento ?? d.dataPagamento),
        fornitore: c.fornitore ?? "",
        materiale: c.materiale ?? ""
      });
    });

    (d.scarico || []).forEach((s, idx) => {
      const data = toDate(s.data ?? d.data);

      if (!data || isNaN(data)) return;

      out.push({
        id: `${d.id}_scarico_${idx}`,
        tipo: "scarico",
        importo: Number(s.totaleCer ?? s.netto ?? 0),
        data,
        dataPagamento: toDate(s.dataPagamento ?? d.dataPagamento),
        fornitore: s.fornitore ?? "",
        materiale: s.materiale ?? ""
      });
    });

  });

  return out;
};

useEffect(() => {
  const fetchMovimenti = async () => {
  try {
    const snap = await getDocs(collection(db, "movimenti"));
    const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const normalized = normalizeMovimenti(raw);

    setCarichiScarichi(normalized);
    console.log("RAW MOVIMENTI:", raw);
console.log("NORMALIZZATI:", normalizeMovimenti(raw));
  } catch (err) {
    console.error("Errore movimenti:", err);
  }
};

  fetchMovimenti();
}, []);
  // --------------------------
  // CONFIG
  // --------------------------
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));

        if (snap.exists()) {
          const data = snap.data();
          setGiornoAvviamento(
            data.giornoAvviamento ? new Date(data.giornoAvviamento) : null
          );
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchConfig();
  }, []);

  // --------------------------
  // NAVIGATION
  // --------------------------
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const goDashboard = () => navigate("/admin");

const [selectedDate] = useState(
  location.state?.date ? new Date(location.state.date) : new Date()
);
  const toDate = (v) => {
  if (!v) return null;
  if (v.toDate) return v.toDate(); // Firestore timestamp
  return new Date(v);
};

const isSameDay = (a, b) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;

  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};
  const handlePay = async (mov) => {
  const confirm = window.confirm("Confermare pagamento?");
  if (!confirm) return;

  try {
    const ref = doc(db, "movimenti", mov.id);

    await updateDoc(ref, {
      dataPagamento: selectedDate
    });

    setCarichiScarichi(prev =>
      prev.map(m =>
        m.id === mov.id
          ? { ...m, dataPagamento: selectedDate }
          : m
      )
    );
    
  } catch (err) {
    console.error(err);
  }
};
const handleUnpay = async (mov) => {
  const confirm = window.confirm("Rimuovere pagamento?");
  if (!confirm) return;

  try {
    const ref = doc(db, "movimenti", mov.id);

    await updateDoc(ref, {
      dataPagamento: null
    });

    setCarichiScarichi(prev =>
      prev.map(m =>
        m.id === mov.id
          ? { ...m, dataPagamento: null }
          : m
      )
    );
  } catch (err) {
    console.error(err);
  }
};

  const handleAddMovement = (type) => {
    console.log("Aggiungi movimento:", type);
  };

  const handleAddRecurring = (item) => {
    console.log("Aggiungi ricorrente:", item);
  };

const pagati = carichiScarichi.filter(m => {
  if (!m.dataPagamento || !m.data) return false;

  return (
    m.dataPagamento.getFullYear() === selectedDate.getFullYear() &&
    m.dataPagamento.getMonth() === selectedDate.getMonth() &&
    m.dataPagamento.getDate() === selectedDate.getDate()
  );
});
const daPagare = carichiScarichi
  .filter(m => {
    if (m.dataPagamento) return false;
    if (!m.data) return false;

    return m.data.getTime() <= selectedDate.getTime();
  })
  .sort((a, b) => a.data - b.data);
const movimentiGiorno = carichiScarichi.filter(m => {
  if (!m.data) return false;

  return (
    m.data.getFullYear() === selectedDate.getFullYear() &&
    m.data.getMonth() === selectedDate.getMonth() &&
    m.data.getDate() === selectedDate.getDate()
  );
});
const introitiTot = movimentiGiorno
  .filter(m => m.tipo === "carico")
  .reduce((sum, m) => sum + (m.importo || 0), 0);

const speseTot = movimentiGiorno
  .filter(m => m.tipo === "scarico")
  .reduce((sum, m) => sum + (m.importo || 0), 0);

const guadagno = introitiTot - speseTot;
  // --------------------------
  // UI
  // --------------------------
  return (
    <div style={{ padding: 20 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={goDashboard}>🏠 Dashboard</button>

  <button onClick={() => navigate("/MovimentiFinanziari")}>
  🔙 Calendario
</button>

        <button onClick={handleLogout}>
          🚪 Logout ({currentUser.username || currentUser.email})
        </button>
      </div>

      {/* TITLE */}
      <h2>Movimento Giorno</h2>

      <p>
        📅 Giorno:{" "}
        <strong>{new Date(selectedDate).toLocaleDateString("it-IT")}</strong>
      </p>

      {giornoAvviamento && (
        <p>
          ⚠️ Avvio impianto:{" "}
          <strong>{giornoAvviamento.toLocaleDateString("it-IT")}</strong>
        </p>
      )}

      {/* ===================== */}
      {/* SEZIONE 1 */}
      {/* ===================== */}
      <h3>Carichi / Scarichi</h3>

      <div style={{ display: "flex", gap: 20 }}>
        {/* PAGATI */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
          <h4>🟢 Pagati</h4>

          {pagati.map((m, i) => (
  <div
    key={i}
    onClick={() => handleUnpay(m)}
    style={{
      cursor: "pointer",
      padding: "6px",
      marginBottom: "4px",
      background: "#e6ffe6",
      borderRadius: "4px"
    }}
  >
    {m.tipo} - {m.importo}€
  </div>
))}
        </div>

        {/* DA PAGARE */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
          <h4>🔴 Da Consuntivare</h4>

          {daPagare.map((m, i) => (
  <div
    key={i}
    onClick={() => handlePay(m)}
    style={{
      cursor: "pointer",
      padding: "6px",
      marginBottom: "4px",
      background: "#ffe6e6",
      borderRadius: "4px"
    }}
  >
    {m.tipo} - {m.importo}€
  </div>
))}
        </div>
      </div>

      <button onClick={() => handleAddMovement("carico")}>
        ➕ Aggiungi Carico
      </button>

      <button onClick={() => handleAddMovement("scarico")}>
        ➕ Aggiungi Scarico
      </button>

      {/* ===================== */}
      {/* SEZIONE 2 */}
      {/* ===================== */}
      <h3 style={{ marginTop: 40 }}>Altri Movimenti</h3>

      <div style={{ display: "flex", gap: 20 }}>
        {/* CONSUNTIVATI */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
          <h4>🟢 Giorno</h4>

          {movimentiGiorno.map((m, i) => (
            <div key={i}>
              {m.descrizione} - {m.importo}€
            </div>
          ))}
        </div>

        {/* RICORRENTI */}
        <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
          <h4>🟡 Ricorrenti</h4>

          <div onClick={() => handleAddRecurring("affitto")}>
            Affitto
          </div>

          <div onClick={() => handleAddRecurring("stipendi")}>
            Stipendi
          </div>

          <div onClick={() => handleAddRecurring("consulenza")}>
            Consulenze
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: 40 }}>
        <h4>📊 Riepilogo Giorno</h4>
       <p>Introiti: {introitiTot}€</p>
<p>Spese: {speseTot}€</p>
<p>Guadagno: {guadagno}€</p>
      </div>
    </div>
  );
};

export default MovimentiGiorno;