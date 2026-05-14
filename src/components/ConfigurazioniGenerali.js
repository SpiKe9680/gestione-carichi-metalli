// src/components/ConfigurazioniGenerali.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from "date-fns/locale";

const ConfigurazioniGenerali = ({ logout }) => {
  const navigate = useNavigate();

  const [logoBase64, setLogoBase64] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [capCitta, setCapCitta] = useState("");
  const [piva, setPiva] = useState("");
  const [guadagnoMinKg, setGuadagnoMinKg] = useState(0.2);
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [mailRecupero, setMailRecupero] = useState("");

  // 🔥 FIX: ora è una Date vera
  const [giornoAvviamento, setGiornoAvviamento] = useState(null);

  const currentUser =
    JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};

  // -------- LOAD CONFIG --------
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "configurazioni", "datiAzienda");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();

          setRagioneSociale(data.ragioneSociale || "");
          setIndirizzo(data.indirizzo || "");
          setCapCitta(data.capCitta || "");
          setPiva(data.piva || "");
          setLogoBase64(data.logoBase64 || "");
          setGuadagnoMinKg(
            data.guadagnoMinKg !== undefined ? data.guadagnoMinKg : 0.2
          );
          setMailRecupero(data.mailRecupero || "");

          // 🔥 FIX: parsing ISO -> Date
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

  // -------- LOGO --------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      setLogoBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // -------- SAVE --------
  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "configurazioni", "datiAzienda"), {
        logoBase64,
        ragioneSociale,
        indirizzo,
        capCitta,
        piva,
        guadagnoMinKg,
        mailRecupero,

        // 🔥 FIX: salva ISO standard
        giornoAvviamento: giornoAvviamento
          ? giornoAvviamento.toISOString()
          : null,

        updatedAt: new Date(),
      });

      setMessaggio("Configurazione salvata con successo ✅");
    } catch (err) {
      console.error(err);
      setMessaggio("Errore durante il salvataggio ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2>Configurazioni Generali Azienda</h2>

        <div>
          <button
            onClick={() => navigate("/admin")}
            style={{ marginRight: 10 }}
          >
            🏠 Dashboard
          </button>

          <button onClick={logout}>
            🚪 Logout ({currentUser.email || currentUser.username})
          </button>
        </div>
      </div>

      {/* LOGO */}
      <div style={{ marginBottom: 15 }}>
        <label>Logo Azienda:</label>
        <br />
        {logoBase64 && (
          <img
            src={`data:image/png;base64,${logoBase64}`}
            alt="Logo"
            style={{
              maxWidth: 150,
              marginBottom: 10,
              border: "1px solid #ccc",
            }}
          />
        )}
        <input type="file" accept="image/*" onChange={handleFileChange} />
      </div>

      {/* CAMPI */}
      <div style={{ marginBottom: 10 }}>
        <label>Ragione Sociale:</label>
        <br />
        <input
          type="text"
          value={ragioneSociale}
          onChange={(e) => setRagioneSociale(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Indirizzo:</label>
        <br />
        <input
          type="text"
          value={indirizzo}
          onChange={(e) => setIndirizzo(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>CAP e Città:</label>
        <br />
        <input
          type="text"
          value={capCitta}
          onChange={(e) => setCapCitta(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>P.IVA:</label>
        <br />
        <input
          type="text"
          value={piva}
          onChange={(e) => setPiva(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Guadagno minimo €/kg:</label>
        <br />
        <input
          type="number"
          step="0.01"
          value={guadagnoMinKg}
          onChange={(e) =>
            setGuadagnoMinKg(parseFloat(e.target.value) || 0.2)
          }
          style={{ width: "100px" }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Mail recupero password:</label>
        <br />
        <input
          type="email"
          value={mailRecupero}
          onChange={(e) => setMailRecupero(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>

      {/* 🔥 GIORNO AVVIAMENTO FIXATO */}
      <div style={{ marginBottom: 20 }}>
        <label>Giorno di avviamento gestionale:</label>
        <br />

       <DatePicker
  selected={
    giornoAvviamento && !isNaN(new Date(giornoAvviamento).getTime())
      ? new Date(giornoAvviamento)
      : null
  }
  onChange={(date) => setGiornoAvviamento(date)}
  dateFormat="dd MMM yyyy"
  locale={it}
  placeholderText="Seleziona data avvio"
  isClearable
/>
      </div>

      {/* SAVE */}
      <button onClick={handleSave} disabled={loading}>
        {loading ? "Salvando..." : "Salva Configurazione"}
      </button>

      {messaggio && <div style={{ marginTop: 15 }}>{messaggio}</div>}
    </div>
  );
};

export default ConfigurazioniGenerali;