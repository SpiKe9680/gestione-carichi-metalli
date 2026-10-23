// src/components/AnagraficaMovimentoFinanziario.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
   deleteDoc,
  Timestamp,
} from "firebase/firestore";
import PageLayout from "./layout/PageLayout";
import ActionButton from "./ui/ActionButton";
import { loadConfigAzienda } from "../utils/dateUtils";
import "./AnagraficaMovimentoFinanziario.css";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log"; // o dove ce l'hai
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from "date-fns/locale";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
const AnagraficaMovimentoFinanziario = () => {
  const [lista, setLista] = useState([]);
const [showDisabilita, setShowDisabilita] = useState(false);
const [itemSelezionato, setItemSelezionato] = useState(null);
const [dataDisabilitazione, setDataDisabilitazione] = useState("");
const [showForm, setShowForm] = useState(false);
const [uiBusy, setUiBusy] = useState(false);
const [searchText, setSearchText] = useState("");
const [filterTipo, setFilterTipo] = useState("TUTTI");
const [filterPeriodicita, setFilterPeriodicita] = useState("TUTTE");
  const [nomeBreve, setNomeBreve] = useState("");
  const [disableChecked, setDisableChecked] = useState(true);
const [dataDisForm, setDataDisForm] = useState(new Date());
  const [movimentiCache, setMovimentiCache] = useState([]);
  const [descrizione, setDescrizione] = useState("");
  const [tipo, setTipo] = useState("USCITA");
  const [periodicita, setPeriodicita] = useState("SINGOLO");
  const [importo, setImporto] = useState(0);
  const [uiLocked, setUiLocked] = useState(false);
  const hasActiveFilters =
  searchText ||
  filterTipo !== "TUTTI" ||
  filterPeriodicita !== "TUTTE";
  const [dataAttivazione, setDataAttivazione] = useState(new Date());
  const [loadingBulk, setLoadingBulk] = useState(false);
const [showContabilizza, setShowContabilizza] = useState(false);
const [contItem, setContItem] = useState(null);
const [occList, setOccList] = useState([]);
const [editMode, setEditMode] = useState(false);
const [editId, setEditId] = useState(null);
const [sortConfig, setSortConfig] = useState({
  key: "nomeBreve",
  direction: "asc"
});
  const currentUser =
    JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const [deletableMap, setDeletableMap] = useState({});
  const navigate = useNavigate();

  // NAV (IDENTICO)
  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };
const normalizeMovimentoDate = (m) => {
  const raw = m.dataDocumento || m.data || m.createdAt;

  const date = raw?.toDate ? raw.toDate() : new Date(raw || null);

  return isNaN(date.getTime()) ? null : date;
};
  const goHome = () => navigate("/admin");
const handleBulkMovimenti = async () => {
  const conferma = window.confirm(
    contItem.modalMode === "STORNO"
      ? "Confermi lo STORNO?"
      : contItem.tipo === "USCITA"
      ? "Confermi PAGAMENTO?"
      : "Confermi INCASSO?"
  );

  if (!conferma) return;

  setLoadingBulk(true);

  try {
    const snap = await getDocs(collection(db, "MovimentoFinanziario"));

    const movimenti = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        anagraficaId: data.anagraficaId,
       key: getKey(data.dataDocumento || data.data || data.createdAt),
      };
    });

    for (const occ of occList) {
      const occKey = getKey(occ.data);

    const match = movimenti.find((m) => {
  const sameAnag = m.anagraficaId === contItem.id;

  const sameDate =
    m.key === occKey ||
    getKey(m.dataDocumento) === occKey ||
    getKey(m.data) === occKey;

  return sameAnag && sameDate;
});

      if (contItem.modalMode === "STORNO") {
        if (match) {
          await deleteDoc(doc(db, "MovimentoFinanziario", match.id));
        }
      } else {
        if (!match) {
          await addDoc(collection(db, "MovimentoFinanziario"), {
            anagraficaId: contItem.id,
            data: Timestamp.fromDate(occ.data),
            importo: occ.importo,
            tipo: contItem.tipo,
          });
        }
      }
    }

    await fetchData();

    setOccList([]);
    setShowContabilizza(false);
    setContItem(null);

  } finally {
    setLoadingBulk(false);
  }
};
  const fetchData = async () => {
  try {
    const snap = await getDocs(
      collection(db, "AnagraficaMovimentoFinanziario")
    );

    const dati = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setLista(dati);

    // 🔥 MOVIMENTI FINANZIARI
    const movSnap = await getDocs(collection(db, "MovimentoFinanziario"));
    const movimenti = movSnap.docs.map((d) => d.data());
setMovimentiCache(movimenti);
    // 🔥 MAP ELIMINAZIONE
    const map = {};
    dati.forEach((item) => {
      map[item.id] = movimenti.every(
  (m) => m.anagraficaId !== item.id
);
    });

    setDeletableMap(map);

  } catch (err) {
    console.error("Errore caricamento:", err);
  }
};

  useEffect(() => {
    fetchData();
  }, []);

 const canDelete = async (anagraficaId) => {
  const snap = await getDocs(collection(db, "MovimentoFinanziario"));

  return snap.docs.every(
    (d) => d.data().anagraficaId !== anagraficaId
  );
};
const [configAzienda, setConfigAzienda] = useState(null);

useEffect(() => {
  const load = async () => {
    const config = await loadConfigAzienda();
    setConfigAzienda(config);
  };

  load();
}, []);

const getKey = (date) => {
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().split("T")[0];
};

const aggiornaMovimentiConsuntivati = async (anagraficaId, nuoviDati, before) => {
  const snap = await getDocs(collection(db, "MovimentoFinanziario"));

  const movs = snap.docs.filter(
    (d) => d.data().anagraficaId === anagraficaId
  );

  if (movs.length === 0) return;

  const cambiato =
    before.tipo !== nuoviDati.tipo ||
    before.importo !== nuoviDati.importo ||
    before.nomeBreve !== nuoviDati.nomeBreve;

  if (!cambiato) return;

  const conferma = window.confirm(
    `Esistono ${movs.length} movimenti già contabilizzati.\n\nVuoi aggiornare anche quelli?`
  );

  if (!conferma) return;

  for (const d of movs) {
    const ref = doc(db, "MovimentoFinanziario", d.id);

    await updateDoc(ref, {
      tipo: nuoviDati.tipo,
      importo: nuoviDati.importo,
      nomeBreve: nuoviDati.nomeBreve || "",
      updatedAt: Timestamp.now(),
    });
  }

  await scriviLog({
    pagina: "anagrafica-movimenti-finanziari",
    evento: "ALLINEAMENTO_MOVIMENTI",
    riferimento: {
      collezione: "MovimentoFinanziario",
      documentoId: anagraficaId,
    },
    before,
    after: nuoviDati,
    utente: currentUser?.username || currentUser?.email,
    ripristinabile: false,
  });
};

const salva = async () => {
  try {
    setUiBusy(true); // 👈 BLOCCA FILTRI / STAMPA

    const payload = {
      nomeBreve,
      descrizione,
      tipo,
      periodicita,
      importo: Number(importo),
      createdAt:
        dataAttivazione instanceof Date
          ? Timestamp.fromDate(dataAttivazione)
          : Timestamp.now(),
      dataDisabilitazione: disableChecked
  ? Timestamp.fromDate(dataDisForm)
  : null,
    };

    if (!editMode) {
      const docRef = await addDoc(
        collection(db, "AnagraficaMovimentoFinanziario"),
        payload
      );

      await scriviLog({
        pagina: "anagrafica-movimenti-finanziari",
        evento: "CREA",
        riferimento: {
          collezione: "AnagraficaMovimentoFinanziario",
          documentoId: docRef.id,
        },
        before: null,
        after: payload,
        utente: currentUser?.username || currentUser?.email,
        ripristinabile: false,
      });
    }  else {
  const ref = doc(db, "AnagraficaMovimentoFinanziario", editId);
  const before = lista.find((x) => x.id === editId);

  await updateDoc(ref, payload);

  // 🔥 NUOVA LOGICA
  await aggiornaMovimentiConsuntivati(editId, payload, before);

  await scriviLog({
    pagina: "anagrafica-movimenti-finanziari",
    evento: "MODIFICA",
    riferimento: {
      collezione: "AnagraficaMovimentoFinanziario",
      documentoId: editId,
    },
    before,
    after: payload,
    utente: currentUser?.username || currentUser?.email,
    ripristinabile: true,
  });
}

    // reset
    setNomeBreve("");
    setDescrizione("");
    setTipo("USCITA");
    setPeriodicita("SINGOLO");
    setImporto(0);
    setDataAttivazione(new Date());
setDisableChecked(true);
setDataDisForm(new Date());
    setShowForm(false);
    setEditMode(false);
    setEditId(null);

    await fetchData();
  } catch (err) {
    console.error(err);
  } finally {
    setUiBusy(false); // 👈 SBLOCCA TUTTO
  }
};
const resetFiltri = () => {
  setSearchText("");
  setFilterTipo("TUTTI");
  setFilterPeriodicita("TUTTE");
};

  const disabilita = (item) => {
  setItemSelezionato(item);
  setDataDisabilitazione("");
  setShowDisabilita(true);
};
const sortData = (data) => {
  const sorted = [...data];

  sorted.sort((a, b) => {
    const key = sortConfig.key;

    let valA = a[key];
    let valB = b[key];

    // gestione numeri
    if (key === "importo") {
      valA = Number(valA);
      valB = Number(valB);
    }

    // gestione date (createdAt)
    if (key === "createdAt") {
      valA = valA?.toDate ? valA.toDate() : new Date(valA || 0);
      valB = valB?.toDate ? valB.toDate() : new Date(valB || 0);
    }

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
};

const handleSort = (key) => {
  setSortConfig(prev => ({
    key,
    direction:
      prev.key === key && prev.direction === "asc"
        ? "desc"
        : "asc"
  }));
};
const getSortIcon = (key) => {
  if (sortConfig.key !== key) return "↕";

  return sortConfig.direction === "asc" ? "↑" : "↓";
};

function getDataLimite(item) {
  const oggiReale = new Date();

  const dataFine = item.dataDisabilitazione?.toDate
    ? item.dataDisabilitazione.toDate()
    : null;

  return (dataFine && dataFine < oggiReale)
    ? dataFine
    : oggiReale;
}


const apriContabilizza = async (item) => {
  const oggi = getDataLimite(item);

  const start = item.createdAt?.toDate
    ? item.createdAt.toDate()
    : new Date(item.createdAt);

  const snap = await getDocs(collection(db, "MovimentoFinanziario"));

  const movs = snap.docs.map(d => d.data());

  const pagati = movs
    .filter(m =>
      m.anagraficaId === item.id &&
      m.tipo === item.tipo
    )
    .map(m => {
      const date = normalizeMovimentoDate(m);
      return date ? date.toDateString() : null;
    })
    .filter(Boolean);

  const occorrenze = [];
  let cursor = new Date(start);

  for (let i = 0; i < 500; i++) {
    if (cursor > oggi) break;

    const key = cursor.toDateString();

    if (!pagati.includes(key)) {
      occorrenze.push({
        data: new Date(cursor),
        importo: item.importo,
      });
    }

    switch (item.periodicita) {
      case "GIORNALIERO":
        cursor.setDate(cursor.getDate() + 1);
        break;
      case "SETTIMANALE":
        cursor.setDate(cursor.getDate() + 7);
        break;
      case "MENSILE":
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      case "ANNUALE":
        cursor.setFullYear(cursor.getFullYear() + 1);
        break;
      default:
        i = 999;
    }
  }

  if (!occorrenze.length) {
    alert("Nessun movimento da contabilizzare");
    return;
  }

  setContItem(item);
  setOccList(occorrenze.sort((a, b) => a.data - b.data));
  setShowContabilizza(true);
};


const confermaDisabilitazione = async () => {
  if (!dataDisabilitazione || !itemSelezionato) return;

  const dataCreazione = itemSelezionato.createdAt?.toDate();

  const scelta = new Date(dataDisabilitazione);

  if (dataCreazione && scelta < dataCreazione) {
    alert("Data non valida");
    return;
  }

  const ref = doc(
    db,
    "AnagraficaMovimentoFinanziario",
    itemSelezionato.id
  );

  const before = itemSelezionato;

  const updatePayload = {
    dataDisabilitazione: Timestamp.fromDate(scelta),
  };

  await updateDoc(ref, updatePayload);

  await scriviLog({
    pagina: "anagrafica-movimenti-finanziari",
    evento: "DISABILITA",
    riferimento: {
      collezione: "AnagraficaMovimentoFinanziario",
      documentoId: itemSelezionato.id,
    },
    before,
    after: updatePayload,
    utente: currentUser?.username || currentUser?.email,
    ripristinabile: true,
  });

  setShowDisabilita(false);
  setItemSelezionato(null);
  setDataDisabilitazione("");

  fetchData();
};


const modifica = (item) => {
  setEditMode(true);
  setEditId(item.id);

  setNomeBreve(item.nomeBreve);
  setDescrizione(item.descrizione);
  setTipo(item.tipo);
  setPeriodicita(item.periodicita);
  setImporto(item.importo);

  setDataAttivazione(
    item.createdAt?.toDate
      ? item.createdAt.toDate()
      : new Date()
  );

  const dataDis = item.dataDisabilitazione?.toDate
  ? item.dataDisabilitazione.toDate()
  : null;

if (dataDis) {
  setDisableChecked(true);
  setDataDisForm(dataDis);
} else {
  setDisableChecked(false);
  setDataDisForm(new Date());
}

  setShowForm(true);
};
const elimina = async (item) => {
  const conferma = window.confirm(
    `Sei sicuro di voler eliminare definitivamente "${item.nomeBreve}"?`
  );

  if (!conferma) return;

  if (!deletableMap[item.id]) {
    alert("Non puoi eliminare: esistono movimenti collegati");
    return;
  }

  try {
    await deleteDoc(doc(db, "AnagraficaMovimentoFinanziario", item.id));

    await scriviLog({
      pagina: "anagrafica-movimenti-finanziari",
      evento: "ELIMINA_DEFINITIVO",
      riferimento: {
        collezione: "AnagraficaMovimentoFinanziario",
        documentoId: item.id,
      },
      before: item,
      after: null,
      utente: currentUser?.username || currentUser?.email,
      ripristinabile: false,
    });

    fetchData();

  } catch (err) {
    console.error("Errore eliminazione:", err);
    alert("Errore durante eliminazione");
  }
};
const importoNum = Number(importo);

const isFormValid =
  nomeBreve?.trim().length > 0 &&
  !isNaN(importoNum) &&
  importoNum > 0;

function getNextOccurrence(item) {
  const limite = getDataLimite(item);

  let cursor = item.createdAt?.toDate
    ? item.createdAt.toDate()
    : new Date(item.createdAt);

  const freq = item.periodicita;

  if (!freq) return null;

  while (cursor <= limite) {
    switch (freq) {
      case "GIORNALIERO":
        cursor.setDate(cursor.getDate() + 1);
        break;
      case "SETTIMANALE":
        cursor.setDate(cursor.getDate() + 7);
        break;
      case "MENSILE":
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      case "ANNUALE":
        cursor.setFullYear(cursor.getFullYear() + 1);
        break;
      default:
        return null;
    }
  }

  return cursor > limite ? null : cursor;
}

const handleStampa = async () => {
  try {
    const movimentiFiltrati = sortData(
      lista.filter((item) => {
        const matchText =
          item.nomeBreve?.toLowerCase().includes(searchText.toLowerCase()) ||
          item.descrizione?.toLowerCase().includes(searchText.toLowerCase());

        const matchTipo =
          filterTipo === "TUTTI" || item.tipo === filterTipo;

        const matchPeriodicita =
          filterPeriodicita === "TUTTE" ||
          item.periodicita === filterPeriodicita;

        return matchText && matchTipo && matchPeriodicita;
      })
    );

    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { PdfHeader } = await import("../utils/dateUtils");

    const { pdf, startY } = await PdfHeader();
    let y = startY - 20;

    pdf.setFontSize(14);
    pdf.text("Movimenti Finanziari", 14, y);
    y += 8;

    const formatDate = (date) => {
      const d =
        date instanceof Date
          ? date
          : date?.toDate
          ? date.toDate()
          : new Date(date || null);

      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("it-IT");
    };

    const getMovimenti = (id) =>
      movimentiCache.filter((m) => m.anagraficaId === id);

   const getStato = (m) => {
  const dataEvento = m.dataDisabilitazione
    ? formatDate(m.dataDisabilitazione)
    : formatDate(m.dataInizio || m.createdAt);

  return m.dataDisabilitazione
    ? `DISABILITATO dal ${dataEvento}`
    : `ATTIVO dal ${dataEvento}`;
};

    autoTable(pdf, {
      startY: y,
      head: [[
        "Nome",
        "Descrizione",
        "Tipo",
        "Periodicità",
        "Importo",
        "Da Cont.",
        "Cont.",
        "Stato"
      ]],
      body: movimentiFiltrati.map((m) => {
        const mov = getMovimenti(m.id);

        let totale = 0;

        if (m.periodicita === "SINGOLO") {
          totale = mov.length === 0 ? 1 : 0;
        } else {
          const start = m.dataInizio?.toDate
            ? m.dataInizio.toDate()
            : new Date(m.dataInizio);

          const oggi = getDataLimite(m); // 🔥 FIX VERO

          let cursor = new Date(start);

          for (let i = 0; i < 500; i++) {
            if (cursor > oggi) break;

            totale++;

            switch (m.periodicita) {
              case "GIORNALIERO":
                cursor.setDate(cursor.getDate() + 1);
                break;
              case "SETTIMANALE":
                cursor.setDate(cursor.getDate() + 7);
                break;
              case "MENSILE":
                cursor.setMonth(cursor.getMonth() + 1);
                break;
              case "ANNUALE":
                cursor.setFullYear(cursor.getFullYear() + 1);
                break;
              default:
                i = 999;
            }
          }

          totale = Math.max(totale - mov.length, 0);
        }

        return [
          m.nomeBreve,
          m.descrizione || "-",
          m.tipo,
          m.periodicita,
          Number(m.importo).toFixed(2),
          totale,
          mov.length,
          getStato(m), // 🔥 QUI LA MAGIA
        ];
      }),
      theme: "grid",
      styles: { fontSize: 8 },

    didParseCell: function (data) {
  const isStatoColumn = data.column.index === 7;

  if (!isStatoColumn) return;

  const value = data.cell.text?.[0] || "";

  // SOLO CELLE BODY (NON HEADER)
  if (data.section !== "body") return;

  if (value.startsWith("ATTIVO")) {
    data.cell.styles.textColor = [0, 120, 0]; // verde scuro
  } else if (value.startsWith("DISABILITATO")) {
    data.cell.styles.textColor = [180, 0, 0]; // rosso
  }
}
    });

    pdf.save("anagrafica-movimenti.pdf");
  } catch (err) {
    console.error("Errore stampa:", err);
  }
};



return (
  <PageLayout
    title="Anagrafica Movimenti Finanziari"
    logoBase64={configAzienda?.logoBase64}
    maxWidth={1600}
    headerActions={
      <>
        <ActionButton
          variant="admin"
          compact
          onClick={goHome}
        >
          🏠 Dashboard
        </ActionButton>

        <ActionButton
          variant="danger"
          compact
          onClick={handleLogout}
        >
          🚪 Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </ActionButton>
      </>
    }
  >
    <div className="gestione-log-container mf-anagrafica">
      {/* FORM E FILTRI */}
      {!uiLocked && (
        <div className="filtri-log mf-anagrafica-toolbar">
          <div className="mf-anagrafica-azioni-principali">
            {!showForm && (
              <button
                className="mf-anagrafica-btn-conferma"
                onClick={() => setShowForm(true)}
              >
                ➕ Aggiungi
              </button>
            )}
          </div>

          {/* FILTRI */}
          {!showForm && (
            <div className="toolbar-filtri mf-anagrafica-filtri">
              <input
                className="filter-item"
                placeholder="Cerca Movimento"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />

              <select
                className="filter-item"
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
              >
                <option value="TUTTI">TUTTI</option>
                <option value="ENTRATA">ENTRATA</option>
                <option value="USCITA">USCITA</option>
              </select>

              <select
                className="filter-item"
                value={filterPeriodicita}
                onChange={(e) => setFilterPeriodicita(e.target.value)}
              >
                <option value="TUTTE">TUTTE</option>
                <option value="SINGOLO">SINGOLO</option>
                <option value="GIORNALIERO">GIORNALIERO</option>
                <option value="SETTIMANALE">SETTIMANALE</option>
                <option value="MENSILE">MENSILE</option>
                <option value="ANNUALE">ANNUALE</option>
              </select>

              {hasActiveFilters && (
                <button
                  className="filter-item mf-anagrafica-reset"
                  onClick={resetFiltri}
                >
                  ♻ Reset Filtri
                </button>
              )}

              <button
                className="filter-item mf-anagrafica-stampa"
                onClick={handleStampa}
              >
                🖨 Stampa
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODALE INSERIMENTO / MODIFICA */}
      {showForm && !uiLocked && (
        <div className="mf-anagrafica-overlay">
          <div
            className="mf-anagrafica-modale"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mf-anagrafica-form-titolo"
          >
            <h3 id="mf-anagrafica-form-titolo">
              {editMode
                ? "Modifica movimento finanziario"
                : "Nuovo movimento finanziario"}
            </h3>

            <div className="mf-anagrafica-form">
              <label>Nome breve</label>
              <input
                placeholder="Nome breve"
                value={nomeBreve}
                onChange={(e) => setNomeBreve(e.target.value)}
              />

              <label>Descrizione</label>
              <input
                placeholder="Descrizione"
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
              />

              <label>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="ENTRATA">ENTRATA</option>
                <option value="USCITA">USCITA</option>
              </select>

              <label>Periodicità</label>
              <select
                value={periodicita}
                onChange={(e) => setPeriodicita(e.target.value)}
              >
                <option value="SINGOLO">SINGOLO</option>
                <option value="GIORNALIERO">GIORNALIERO</option>
                <option value="SETTIMANALE">SETTIMANALE</option>
                <option value="MENSILE">MENSILE</option>
                <option value="ANNUALE">ANNUALE</option>
              </select>

              <label>Importo</label>
              <input
                placeholder="Importo"
                value={importo}
                onChange={(e) => {
                  let val = e.target.value;
                  val = val.replace(",", ".");
                  val = val.replace(/[^0-9.]/g, "");
                  setImporto(val);
                }}
              />

              <div className="mf-anagrafica-date-section">
                <label>Attivo dal:</label>

                <div className="mf-anagrafica-date-picker">
                  <DatePicker
                    selected={dataAttivazione}
                    onChange={(date) => setDataAttivazione(date)}
                    dateFormat="dd MMM yyyy"
                    locale={it}
                  />
                </div>

                <div className="mf-anagrafica-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={disableChecked}
                      onChange={(e) => setDisableChecked(e.target.checked)}
                    />
                    {" "}Disabilita
                  </label>
                </div>

                {disableChecked && (
                  <div className="mf-anagrafica-date-disabilitazione">
                    <label>Data di disabilitazione:</label>

                    <div className="mf-anagrafica-date-picker">
                      <DatePicker
                        selected={dataDisForm}
                        onChange={(date) => setDataDisForm(date)}
                        dateFormat="dd MMM yyyy"
                        locale={it}
                        minDate={
                          new Date(dataAttivazione.getTime() + 86400000)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mf-anagrafica-modale-azioni">
                <button
                  className="mf-anagrafica-btn-conferma mf-anagrafica-salva"
                  onClick={async () => {
                    await salva();
                    setShowForm(false);
                  }}
                  disabled={!isFormValid}
                >
                  {editMode ? "✏️ Salva modifiche" : "💾 Salva"}
                </button>

                <button
                  onClick={() => {
                    setShowForm(false);
                    setNomeBreve("");
                    setDescrizione("");
                    setTipo("USCITA");
                    setPeriodicita("SINGOLO");
                    setImporto(0);
                    setDataAttivazione(new Date());
                    setEditMode(false);
                    setEditId(null);
                    setDisableChecked(true);
                    setDataDisForm(new Date());
                  }}
                >
                  ❌ Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABELLA ANAGRAFICA */}
      <div className="mf-anagrafica-tabella-wrapper">
        <table className="tabella-log mf-anagrafica-tabella">
          <thead>
            <tr>
              <th onClick={() => handleSort("nomeBreve")} style={{ cursor: "pointer" }}>
                Nome {getSortIcon("nomeBreve")}
              </th>
              <th onClick={() => handleSort("tipo")} style={{ cursor: "pointer" }}>
                Tipo {getSortIcon("tipo")}
              </th>
              <th onClick={() => handleSort("periodicita")} style={{ cursor: "pointer" }}>
                Periodicità {getSortIcon("periodicita")}
              </th>
              <th onClick={() => handleSort("importo")} style={{ cursor: "pointer" }}>
                Importo {getSortIcon("importo")}
              </th>
              <th>Prossimo evento</th>
              <th>Da Contabilizzare</th>
              <th>Contabilizzati</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {sortData(
              lista.filter((item) => {
                const matchText =
                  item.nomeBreve?.toLowerCase().includes(searchText.toLowerCase()) ||
                  item.descrizione?.toLowerCase().includes(searchText.toLowerCase());

                const matchTipo =
                  filterTipo === "TUTTI" || item.tipo === filterTipo;

                const matchPeriodicita =
                  filterPeriodicita === "TUTTE" ||
                  item.periodicita === filterPeriodicita;

                return matchText && matchTipo && matchPeriodicita;
              })
            ).map((item) => {
              const start = item.createdAt?.toDate
                ? item.createdAt.toDate()
                : new Date();
              const oggi = new Date();
              const next = getNextOccurrence(item);

              let daContabilizzare = 0;

              if (item.periodicita !== "SINGOLO") {
                const next = getNextOccurrence(item);
              }

              return (
                <tr
                  key={item.id}
                  className={
                    item.dataDisabilitazione
                      ? "mf-anagrafica-riga-disabilitata"
                      : ""
                  }
                >
                  <td>{item.nomeBreve}</td>

                  <td>
                    <span
                      className={
                        item.tipo === "ENTRATA"
                          ? "mf-anagrafica-tipo-entrata"
                          : "mf-anagrafica-tipo-uscita"
                      }
                    >
                      {item.tipo}
                    </span>
                  </td>

                  <td>{item.periodicita}</td>
                  <td>{item.importo}</td>
                  <td>{next ? next.toLocaleDateString("it-IT") : "-"}</td>

                  <td className="mf-anagrafica-numero">
                    {(() => {
                      const mov = movimentiCache.filter(
                        (m) => m.anagraficaId === item.id
                      );

                      if (item.periodicita === "SINGOLO") {
                        return mov.length === 0 ? 1 : 0;
                      }

                      const start = item.createdAt?.toDate
                        ? item.createdAt.toDate()
                        : new Date();

                      const oggi = getDataLimite(item);
                      let cursor = new Date(start);
                      let totale = 0;

                      for (let i = 0; i < 500; i++) {
                        if (cursor > oggi) break;
                        totale++;

                        switch (item.periodicita) {
                          case "GIORNALIERO":
                            cursor.setDate(cursor.getDate() + 1);
                            break;
                          case "SETTIMANALE":
                            cursor.setDate(cursor.getDate() + 7);
                            break;
                          case "MENSILE":
                            cursor.setMonth(cursor.getMonth() + 1);
                            break;
                          case "ANNUALE":
                            cursor.setFullYear(cursor.getFullYear() + 1);
                            break;
                          default:
                            i = 999;
                        }
                      }

                      return Math.max(totale - mov.length, 0);
                    })()}
                  </td>

                  <td className="mf-anagrafica-numero">
                    {
                      movimentiCache.filter(
                        (m) => m.anagraficaId === item.id
                      ).length
                    }
                  </td>

                  <td>
                    {item.dataDisabilitazione ? (
                      <span className="mf-anagrafica-stato-disabilitato">
                        DISABILITATO dal{" "}
                        {item.dataDisabilitazione?.toDate
                          ? item.dataDisabilitazione.toDate().toLocaleDateString("it-IT")
                          : ""}
                      </span>
                    ) : (
                      <span className="mf-anagrafica-stato-attivo">
                        ATTIVO dal{" "}
                        {item.createdAt?.toDate
                          ? item.createdAt.toDate().toLocaleDateString("it-IT")
                          : ""}
                      </span>
                    )}
                  </td>

                  <td>
                    <div className="mf-anagrafica-azioni">
                      {!item.dataDisabilitazione && (
                        <button
                          className="mf-anagrafica-btn-disabilita"
                          onClick={() => disabilita(item)}
                        >
                          Disabilita
                        </button>
                      )}

                      <button
                        className="mf-anagrafica-btn-modifica"
                        onClick={() => modifica(item)}
                      >
                        ✏️ Modifica
                      </button>

                      <button
                        className="mf-anagrafica-btn-contabilizza"
                        onClick={() => apriContabilizza(item)}
                        disabled={
                          (() => {
                            const mov = movimentiCache.filter(
                              (m) => m.anagraficaId === item.id
                            );

                            if (item.periodicita === "SINGOLO") {
                              return mov.length > 0;
                            }

                            const start = item.createdAt?.toDate
                              ? item.createdAt.toDate()
                              : new Date();

                            const oggi = getDataLimite(item);
                            let cursor = new Date(start);
                            let totale = 0;

                            for (let i = 0; i < 500; i++) {
                              if (cursor > oggi) break;
                              totale++;

                              switch (item.periodicita) {
                                case "GIORNALIERO":
                                  cursor.setDate(cursor.getDate() + 1);
                                  break;
                                case "SETTIMANALE":
                                  cursor.setDate(cursor.getDate() + 7);
                                  break;
                                case "MENSILE":
                                  cursor.setMonth(cursor.getMonth() + 1);
                                  break;
                                case "ANNUALE":
                                  cursor.setFullYear(cursor.getFullYear() + 1);
                                  break;
                                default:
                                  i = 999;
                              }
                            }

                            const daContabilizzare = Math.max(
                              totale - mov.length,
                              0
                            );

                            return daContabilizzare === 0;
                          })()
                        }
                      >
                        Contabilizza
                      </button>

                      <button
                        className="mf-anagrafica-btn-storno"
                        style={{
                          opacity:
                            movimentiCache.filter(
                              (m) => m.anagraficaId === item.id
                            ).length === 0 ? 0.5 : 1,
                          pointerEvents:
                            movimentiCache.filter(
                              (m) => m.anagraficaId === item.id
                            ).length === 0 ? "none" : "auto",
                        }}
                        disabled={
                          movimentiCache.filter(
                            (m) => m.anagraficaId === item.id
                          ).length === 0
                        }
                        onClick={() => {
                          const movs = movimentiCache.filter(
                            (m) => m.anagraficaId === item.id
                          );

                          if (movs.length === 0) {
                            alert("Nessun movimento da stornare");
                            return;
                          }

                          setContItem({
                            ...item,
                            modalMode: "STORNO",
                          });

                          setOccList(
                            movs
                              .map((m) => ({
                                id: m.id,
                                data: m.data?.toDate
                                  ? m.data.toDate()
                                  : new Date(m.data),
                                importo: m.importo,
                              }))
                              .sort((a, b) => new Date(a.data) - new Date(b.data))
                          );

                          setShowContabilizza(true);
                        }}
                      >
                        🔄 Storno
                      </button>

                      {deletableMap[item.id] === true && (
                        <button
                          className="mf-anagrafica-btn-elimina"
                          onClick={() => elimina(item)}
                        >
                          🗑 Elimina
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALE DISABILITAZIONE */}
      {showDisabilita && (
        <div className="mf-anagrafica-overlay">
          <div className="mf-anagrafica-modale">
            <h3>Data disabilitazione</h3>

            <input
              type="date"
              value={dataDisabilitazione}
              min={
                itemSelezionato?.createdAt
                  ?.toDate()
                  .toISOString()
                  .split("T")[0]
              }
              onChange={(e) => setDataDisabilitazione(e.target.value)}
            />

            <div className="mf-anagrafica-modale-azioni">
              <button
                className="mf-anagrafica-btn-conferma"
                onClick={confermaDisabilitazione}
              >
                Conferma
              </button>

              <button onClick={() => setShowDisabilita(false)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONTABILIZZAZIONE / STORNO */}
      {showContabilizza && contItem && (
        <div className="mf-anagrafica-overlay mf-anagrafica-overlay-top">
          <div className="mf-anagrafica-modale mf-anagrafica-modale-contabilizza">
            <h3>{contItem.nomeBreve}</h3>

            <div className="mf-anagrafica-modale-intestazione">
              <strong>
                {contItem.modalMode === "STORNO"
                  ? "🔄 STORNO MOVIMENTI"
                  : contItem.tipo === "USCITA"
                  ? "💸 Spese"
                  : "💰 Entrate"}
              </strong>
              {" — "} Elementi: <b>{occList.length}</b>
              {contItem.modalMode === "STORNO" && " (stornabili)"}
            </div>

            <div className="mf-anagrafica-contabilizzati">
              Contabilizzati:{" "}
              <b>
                {
                  movimentiCache.filter(
                    (m) => m.anagraficaId === contItem.id
                  ).length
                }
              </b>
            </div>

            <div className="mf-anagrafica-modale-azioni">
              <button
                onClick={() => {
                  setShowContabilizza(false);
                  setContItem(null);
                  setOccList([]);
                }}
              >
                Chiudi
              </button>

              <button
                className={
                  contItem.modalMode === "STORNO"
                    ? "mf-anagrafica-btn-storno"
                    : contItem.tipo === "USCITA"
                    ? "mf-anagrafica-btn-elimina"
                    : "mf-anagrafica-btn-conferma"
                }
                style={{
                  opacity: loadingBulk ? 0.6 : 1,
                  pointerEvents: loadingBulk ? "none" : "auto",
                }}
                disabled={loadingBulk}
                onClick={handleBulkMovimenti}
              >
                {loadingBulk
                  ? "⏳ Elaborazione..."
                  : contItem.modalMode === "STORNO"
                  ? "🔄 STORNA TUTTO"
                  : contItem.tipo === "USCITA"
                  ? "💸 PAGA TUTTO"
                  : "💰 INCASSA TUTTO"}
              </button>
            </div>

            {occList.length === 0 && (
              <div className="mf-anagrafica-nessun-movimento">
                Nessun movimento
              </div>
            )}

            {occList.map((occ, idx) => (
              <div
                key={idx}
                className="mf-anagrafica-occorrenza"
              >
                <span>{occ.data.toLocaleDateString("it-IT")}</span>

                <span className="mf-anagrafica-importo">
                  {Number(occ.importo).toFixed(2)} €
                </span>

                <button
                  className={
                    contItem.modalMode === "STORNO"
                      ? "mf-anagrafica-btn-storno"
                      : contItem.tipo === "USCITA"
                      ? "mf-anagrafica-btn-elimina"
                      : "mf-anagrafica-btn-conferma"
                  }
                  onClick={handleBulkMovimenti}
                >
                  {contItem.modalMode === "STORNO"
                    ? "STORNA"
                    : contItem.tipo === "USCITA"
                    ? "PAGA"
                    : "INCASSA"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OVERLAY ELABORAZIONE */}
      {loadingBulk && (
        <div className="mf-anagrafica-overlay mf-anagrafica-loading">
          <div className="mf-anagrafica-loading-icon">⏳</div>
          Elaborazione movimenti in corso...
        </div>
      )}
    </div>
  </PageLayout>
);



};

export default AnagraficaMovimentoFinanziario;