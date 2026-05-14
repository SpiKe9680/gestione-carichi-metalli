// src/components/MovimentiFinanziari.js
import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from "date-fns/locale";
import { collection, getDocs } from "firebase/firestore";

const MovimentiFinanziari = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const [giornoAvviamento, setGiornoAvviamento] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState("");
const [movimenti, setMovimenti] = useState([]);
useEffect(() => {
  const fetchMovimenti = async () => {
    try {
      const snap = await getDocs(collection(db, "movimenti"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMovimenti(data);
    } catch (err) {
      console.error("Errore caricamento movimenti:", err);
    }
  };

  fetchMovimenti();
}, []);
const formatDateIT = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("it-IT");
};
const prevWeek = () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() - 7);

  // 🔥 BLOCCO LIMITE
  if (giornoAvviamento && d < giornoAvviamento) return;

  setCurrentDate(d);
};
const nextWeek = () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + 7);
  setCurrentDate(d);
};
  const [weekDays, setWeekDays] = useState([]);
useEffect(() => {
  const fetchConfig = async () => {
    try {
      const docRef = doc(db, "configurazioni", "datiAzienda");
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();

        setGiornoAvviamento(
          data.giornoAvviamento
            ? new Date(data.giornoAvviamento)
            : null
        );
      }
    } catch (err) {
      console.error("Errore config:", err);
    }
  };

  fetchConfig();
}, []);
  // -------- LOGOUT --------
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };
const formatAvvio = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("it-IT");
};
  // -------- DASHBOARD --------
  const goHome = () => navigate("/admin");

  // -------- CALCOLO SETTIMANA --------
  const getWeek = (date) => {
    const start = new Date(date);

  // se settimana prima del limite → correggi
  if (giornoAvviamento && start < giornoAvviamento) {
    start.setTime(giornoAvviamento.getTime());
  }
const getWeek = (date) => {
  const start = new Date(date);

  if (giornoAvviamento && start < giornoAvviamento) {
    start.setTime(giornoAvviamento.getTime());
  }

  const day = start.getDay() || 7;
  if (day !== 1) start.setHours(-24 * (day - 1));

  const week = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const key = d.toISOString().split("T")[0];

    let spese = 0;
    let introiti = 0;
    let totaleSpese = 0;
    let totaleIntroiti = 0;

    movimenti.forEach(m => {
      if (!m.dataPagamento) return;

      const pag = m.dataPagamento.toDate
        ? m.dataPagamento.toDate()
        : new Date(m.dataPagamento);

      const pagKey = pag.toISOString().split("T")[0];

      if (pagKey !== key) return;

      if (m.tipo === "scarico") {
        spese++;
        totaleSpese += Number(m.importo || 0);
      }

      if (m.tipo === "carico") {
        introiti++;
        totaleIntroiti += Number(m.importo || 0);
      }
    });

    week.push({
      date: d,
      giorno: d.toLocaleDateString("it-IT", { weekday: "long" }),
      dataString: d.toLocaleDateString("it-IT"),
      spese,
      introiti,
      totaleSpese,
      totaleIntroiti,
    });
  }

  setWeekDays(week);
};
    const day = start.getDay() || 7;
    if (day !== 1) start.setHours(-24 * (day - 1));

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      week.push({
        date: d,
        giorno: d.toLocaleDateString("it-IT", { weekday: "long" }),
        dataString: d.toLocaleDateString("it-IT"),
        spese: 0,
        introiti: 0,
        totaleSpese: 0,
        totaleIntroiti: 0,
      });
    }

    setWeekDays(week);
  };

  useEffect(() => {
    getWeek(currentDate);
  }, [currentDate]);

  // -------- NAVIGAZIONE SETTIMANA --------


const handleDateChange = (value) => {
  setSelectedDate(value);

  if (!value) return;

  const selected = new Date(value);

  if (giornoAvviamento && selected < giornoAvviamento) {
    alert("Data precedente al giorno di avviamento aziendale");
    return;
  }

  setCurrentDate(selected);
};

const goToDetail = (day) => {
  navigate("/movimenti-giorno", {
    state: {
      date: day.date.toISOString()
    }
  });
};

  return (
    <div style={{ padding: "20px" }}>
      {/* NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>
          🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </button>
      </div>

      <h2>Movimenti Finanziari</h2>
{giornoAvviamento && (
  <div
    style={{
      marginBottom: 15,
      padding: "8px 12px",
      background: "#5506ff",
      border: "1px solid #ffeeba",
      color: "#fdfdfd",
      borderRadius: 6,
      fontWeight: 500
    }}
  >
    ⚠️ Avvio impianto: {formatAvvio(giornoAvviamento)}
  </div>
)}
      {/* FILTRO DATA */}
      <div style={{ marginBottom: 20, display: "flex", gap: "10px" }}>
       <DatePicker
  selected={selectedDate}
  onChange={(date) => {
    if (!date) return;

    if (giornoAvviamento && date < giornoAvviamento) return;

    setSelectedDate(date);
    setCurrentDate(date);
  }}
  dateFormat="dd/MM/yyyy"
  locale={it}
  minDate={giornoAvviamento || undefined}
  placeholderText="Seleziona data"
/>
        
      </div>

      {/* NAV SETTIMANA */}
      <div style={{ display: "flex", gap: "10px", marginBottom: 20 }}>
        <button onClick={prevWeek}>⬅️</button>
        <button onClick={nextWeek}>➡️</button>
      </div>

      {/* TABELLA */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ccc" }}>
            <th>Giorno</th>
            <th>Data</th>
            <th># Spese</th>
            <th># Introiti</th>
            <th>Tot Spese</th>
            <th>Tot Introiti</th>
            <th>Guadagno</th>
          </tr>
        </thead>

        <tbody>
          {weekDays.map((d, i) => {
            const guadagno = d.totaleIntroiti - d.totaleSpese;

            return (
              <tr
                key={i}
                onClick={() => goToDetail(d)}
                style={{ borderBottom: "1px solid #eee", cursor: "pointer" }}
              >
                <td>{d.giorno}</td>
                <td>{d.dataString}</td>
                <td>{d.spese}</td>
                <td>{d.introiti}</td>
                <td>{d.totaleSpese}€</td>
                <td>{d.totaleIntroiti}€</td>
                <td>{guadagno}€</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MovimentiFinanziari;