
 // src/components/MovimentiFinanziari.js
import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
import ActionButton from "./ui/ActionButton";
import "./MovimentiFinanziari.css";
import PageLayout from "./layout/PageLayout";
import { loadConfigAzienda } from "../utils/dateUtils";
const MovimentiFinanziari = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
  const [giornoAvviamento, setGiornoAvviamento] = useState(null);

  const location = useLocation();

  const [currentDate, setCurrentDate] = useState(
    location.state?.date ? new Date(location.state.date) : new Date()
  );

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [movimenti, setMovimenti] = useState([]);

  useEffect(() => {
    const fetchMovimenti = async () => {
      try {
        const snap = await getDocs(collection(db, "MovimentoFinanziario"));

        const data = snap.docs.map(d => {
          const m = d.data();

          let data = null;

          if (m.data) {
            const raw = m.data.toDate
              ? m.data.toDate()
              : new Date(m.data);

            data = new Date(
              raw.getFullYear(),
              raw.getMonth(),
              raw.getDate()
            );
          }

          return {
            id: d.id,
            ...m,
            data
          };
        });

        setMovimenti(data);
      } catch (err) {
        console.error("Errore caricamento movimenti:", err);
      }
    };

    fetchMovimenti();
  }, []);
const [configAzienda, setConfigAzienda] = useState(null);

useEffect(() => {
  const load = async () => {
    const config = await loadConfigAzienda();
    setConfigAzienda(config);
  };

  load();
}, []);
  const toDayKey = (date) => {
    if (!date) return null;

    const d = new Date(date);

    // NORMALIZZAZIONE UTC → giorno puro
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatDateIT = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);

    // BLOCCO LIMITE
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

  // LOGOUT
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const formatAvvio = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("it-IT");
  };

  // DASHBOARD
  const goHome = () => navigate("/admin");

  const formatEuro = (value) => {
    return new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  };

  // CALCOLO SETTIMANA
  const getWeek = (date) => {
    const start = new Date(date);

    if (giornoAvviamento && start < giornoAvviamento) {
      start.setTime(giornoAvviamento.getTime());
    }

    const day = start.getDay() || 7;
    if (day !== 1) start.setDate(start.getDate() - (day - 1));

    const week = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const key = toDayKey(d);

      let spese = 0;
      let introiti = 0;
      let totaleSpese = 0;
      let totaleIntroiti = 0;

      movimenti.forEach(m => {
        if (!m.data) return;

        const pagKey = toDayKey(m.data);

        if (pagKey !== key) return;

        const importo = Number(m.importo) || 0;
        const tipo = (m.tipo || "").toUpperCase();

        const isSpesa =
          tipo === "USCITA" ||
          tipo === "PROSPETTIFATTURA" ||
          tipo === "PRIVATI";

        const isIntroito =
          tipo === "ENTRATA" ||
          tipo === "FATTURECARICHI";

        if (isSpesa) {
          spese++;
          totaleSpese += importo;
        }

        if (isIntroito) {
          introiti++;
          totaleIntroiti += importo;
        }
      });

      week.push({
        date: d,
        giorno: d.toLocaleDateString("it-IT", { weekday: "long" }),
        dataString: d.toLocaleDateString("it-IT"),
        spese,
        introiti,
        totaleSpese,
        totaleIntroiti
      });
    }

    setWeekDays(week);
  };

  useEffect(() => {
    getWeek(currentDate);
  }, [currentDate, movimenti]);

  // NAVIGAZIONE SETTIMANA
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

  const handlePrintPDF = async () => {
    const input = document.getElementById("area-stampa");
    if (!input) return;

    const canvas = await html2canvas(input, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    await salvaESharePdfCapacitor(
      pdf,
      `Movimenti_Settimana_${new Date().toLocaleDateString("it-IT")}.pdf`
    );
  };


  return (
    <PageLayout
      title="Movimenti Finanziari"
      logoBase64={configAzienda?.logoBase64}
      maxWidth={1600}
      headerActions={
        <>
          <ActionButton compact onClick={goHome}>
            🏠 Dashboard
          </ActionButton>

          <ActionButton compact onClick={handlePrintPDF}>
            🖨️ Stampa
          </ActionButton>

          <ActionButton variant="danger" compact onClick={handleLogout}>
            🚪 Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
          </ActionButton>
        </>
      }
    >
      <div className="mf-financial-content">
        <div id="area-stampa">
          <h2 className="mf-financial-print-title">Movimenti Finanziari</h2>

          {giornoAvviamento && (
            <div className="mf-financial-start-notice">
              ⚠️ Avvio impianto: {formatAvvio(giornoAvviamento)}
            </div>
          )}

          <section className="mf-financial-filters">
            <label className="mf-financial-date-label">
              <span>Seleziona data</span>
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
                className="big-datepicker"
              />
            </label>

            <div className="mf-financial-week-navigation">
              <ActionButton
                compact
                onClick={prevWeek}
                title="Settimana Precedente"
              >
                ⬅️ Settimana precedente
              </ActionButton>

              <ActionButton
                compact
                onClick={nextWeek}
                title="Settimana Successiva"
              >
                Settimana successiva ➡️
              </ActionButton>
            </div>
          </section>

          <div className="mf-financial-table-wrapper">
            <table className="mf-financial-table">
              <thead>
                <tr>
                  <th>Giorno</th>
                  <th>Data</th>
                  <th># Spese</th>
                  <th># Introiti</th>
                  <th>Tot Spese</th>
                  <th>Tot Introiti</th>
                  <th>Utile</th>
                </tr>
              </thead>

              <tbody>
                {weekDays.map((d, i) => {
                  const guadagno = d.totaleIntroiti - d.totaleSpese;

                  const rowClass =
                    guadagno > 0
                      ? "mf-financial-row-positive"
                      : guadagno < 0
                        ? "mf-financial-row-negative"
                        : "mf-financial-row-neutral";

                  return (
                    <tr
                      key={i}
                      onClick={() => goToDetail(d)}
                      className={`mf-financial-row ${rowClass}`}
                    >
                      <td className="mf-financial-day">{d.giorno}</td>
                      <td>{d.dataString}</td>
                      <td className="mf-financial-count">{d.spese}</td>
                      <td className="mf-financial-count">{d.introiti}</td>
                      <td className="mf-financial-amount">
                        {formatEuro(d.totaleSpese)} €
                      </td>
                      <td className="mf-financial-amount">
                        {formatEuro(d.totaleIntroiti)} €
                      </td>
                      <td className="mf-financial-amount mf-financial-profit">
                        {formatEuro(guadagno)} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="mf-financial-summary">
            {(() => {
              let totSpese = 0;
              let totIntroiti = 0;

              weekDays.forEach(d => {
                totSpese += Number(d.totaleSpese) || 0;
                totIntroiti += Number(d.totaleIntroiti) || 0;
              });

              const guadagno = totIntroiti - totSpese;

              return (
                <div className="mf-financial-summary-grid">
                  <div className="mf-financial-summary-item mf-financial-expenses">
                    <span>📉 Spese settimana</span>
                    <strong>{formatEuro(totSpese)} €</strong>
                  </div>

                  <div className="mf-financial-summary-item mf-financial-income">
                    <span>📈 Incassi settimana</span>
                    <strong>{formatEuro(totIntroiti)} €</strong>
                  </div>

                  <div className="mf-financial-summary-item mf-financial-total">
                    <span>💰 Utile</span>
                    <strong>{formatEuro(guadagno)} €</strong>
                  </div>
                </div>
              );
            })()}
          </section>
        </div>
      </div>
    </PageLayout>
  );

};

export default MovimentiFinanziari;
