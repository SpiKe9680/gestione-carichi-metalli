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

  const goHome = () => navigate("/admin");

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
  const start = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();

  // 🔴 prendi movimenti già contabilizzati
  const snap = await getDocs(collection(db, "MovimentoFinanziario"));
  const pagati = snap.docs
    .map((d) => d.data())
    .filter((m) => m.anagraficaId === item.id)
    .map((m) =>
      m.data?.toDate
        ? m.data.toDate().toDateString()
        : new Date(m.data).toDateString()
    );

  const occorrenze = [];
  let cursor = new Date(start);

  for (let i = 0; i < 200; i++) {
    if (cursor > oggi) break;

    const key = new Date(cursor).toDateString();

    // 🔥 SOLO NON PAGATI
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
        break;
    }
  }

  // 🔴 se NON c'è nulla → NON aprire popup
  if (occorrenze.length === 0) {
    alert("Nessun movimento da contabilizzare");
    return;
  }

  setContItem(item);
  setOccList(
  occorrenze.sort((a, b) => new Date(a.data) - new Date(b.data))
);
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
  if (!item.dataInizio) return null;

  const limite = getDataLimite(item);

  let cursor = item.dataInizio?.toDate
    ? item.dataInizio.toDate()
    : new Date(item.dataInizio);

  const freq = item.periodicita;

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

  // 🔥 SE abbiamo superato il limite → nessuna prossima occorrenza
  if (cursor > limite) return null;

  return cursor;
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
    <div className="gestione-log-container">
      {/* NAV IDENTICA ALLA TUA */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={goHome}>🏠 Dashboard</button>

        <button onClick={handleLogout}>
          🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </button>
      </div>

      <h2>Anagrafica Movimenti Finanziari</h2>

  {/* FORM */}
 {!uiLocked && (
<div className="filtri-log">

  {/* BAR TOP: AGGIUNGI + FILTRI */}
 <div
  style={{
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
    opacity: uiLocked ? 0.4 : 1,
    pointerEvents: uiLocked ? "none" : "auto",
  }}
>

    {/* AGGIUNGI / ANNULLA */}
    {!showForm ? (
      <button onClick={() => setShowForm(true)}>
        ➕ Aggiungi
      </button>
    ) : (
      <button
        onClick={() => {
          setShowForm(false);

          // reset form
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
    )}

 
  </div>
{!showForm && !uiLocked && (
  <div>
     {/* SEARCH */}
    <input
      placeholder="Cerca Movimento"
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
    />

    {/* TIPO */}
    <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
      <option value="TUTTI">TUTTI</option>
      <option value="ENTRATA">ENTRATA</option>
      <option value="USCITA">USCITA</option>
    </select>

    {/* PERIODICITA */}
    <select value={filterPeriodicita} onChange={(e) => setFilterPeriodicita(e.target.value)}>
      <option value="TUTTE">TUTTE</option>
      <option value="SINGOLO">SINGOLO</option>
      <option value="GIORNALIERO">GIORNALIERO</option>
      <option value="SETTIMANALE">SETTIMANALE</option>
      <option value="MENSILE">MENSILE</option>
      <option value="ANNUALE">ANNUALE</option>
    </select>

  {hasActiveFilters && !uiLocked && (
  <button
    onClick={resetFiltri}
    style={{
      background: "#e74c3c",
      color: "white",
      marginRight: 8,
    }}
  >
    ♻ Reset Filtri
  </button>
)}
{!uiLocked && (
<button onClick={handleStampa}>
  🖨 Stampa
</button>
)}  
</div>
)}
  {/* FORM SOLO SE VISIBILE */}
  {showForm && (
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 400, gap: 8 }}>

      <input
        placeholder="Nome breve"
        value={nomeBreve}
        onChange={(e) => setNomeBreve(e.target.value)}
      />

      <input
        placeholder="Descrizione"
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
      />

      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="ENTRATA">ENTRATA</option>
        <option value="USCITA">USCITA</option>
      </select>

      <select value={periodicita} onChange={(e) => setPeriodicita(e.target.value)}>
        <option value="SINGOLO">SINGOLO</option>
        <option value="GIORNALIERO">GIORNALIERO</option>
        <option value="SETTIMANALE">SETTIMANALE</option>
        <option value="MENSILE">MENSILE</option>
        <option value="ANNUALE">ANNUALE</option>
      </select>

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

      
<div style={{ marginTop: 15 }}>

  <label style={{ fontWeight: "bold" }}>
    Attivo dal:
  </label>

  <div>
    <DatePicker
      selected={dataAttivazione}
      onChange={(date) => setDataAttivazione(date)}
      dateFormat="dd MMM yyyy"
      locale={it}
    />
  </div>

  <div style={{ marginTop: 10 }}>
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
    <div style={{ marginTop: 8 }}>
      <label style={{ fontWeight: "bold" }}>
        Data di disabilitazione:
      </label>

      <div>
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
      <button
        onClick={async () => {
          await salva();
          setShowForm(false);   // 🔥 CHIUSURA AUTOMATICA DOPO SALVATAGGIO
        }}
        disabled={!isFormValid}
      >
        {editMode ? "✏️ Salva modifiche" : "💾 Salva"}
      </button>

    </div>
  )}

</div>
)}
      {/* TABELLA IDENTICA STILE */}
<table className="tabella-log" style={{ marginTop: "16px" }}>
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

    <th>
      Prossima Occorrenza
    </th>

    <th>
      Da Contabilizzare
    </th>

    <th>
      Contabilizzati
    </th>

    <th>
      Stato
    </th>

    <th>
      Azioni
    </th>
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
      const start = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
      const oggi = new Date();

     const next = getNextOccurrence(item);

      // ---- DA CONTABILIZZARE (GREZZO MA COERENTE) ----
      let daContabilizzare = 0;

if (item.periodicita !== "SINGOLO") {
  const next = getNextOccurrence(item);

}

      return (
        <tr
          key={item.id}
          style={{
            background: item.dataDisabilitazione ? "#ddd" : "transparent",
          }}
        >
          <td>{item.nomeBreve}</td>
          <td>{item.tipo}</td>
          <td>{item.periodicita}</td>
          <td>{item.importo}</td>
          <td>
            {next ? next.toLocaleDateString("it-IT") : "-"}
          </td>

          

<td style={{ fontWeight: "bold" }}>
  {(() => {
    const mov = movimentiCache.filter(m => m.anagraficaId === item.id);

    if (item.periodicita === "SINGOLO") {
      return mov.length === 0 ? 1 : 0;
    }

    const start = item.createdAt?.toDate
      ? item.createdAt.toDate()
      : new Date();

    const oggi = getDataLimite(item); // 🔥 FIX

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
<td style={{ fontWeight: "bold" }}>
  {
    movimentiCache.filter(m => m.anagraficaId === item.id).length
  }
</td>
          <td>
            {item.dataDisabilitazione ? (
              <>
                DISABILITATO dal{" "}
                {item.dataDisabilitazione?.toDate
                  ? item.dataDisabilitazione.toDate().toLocaleDateString("it-IT")
                  : ""}
              </>
            ) : (
              <>
                ATTIVO dal{" "}
                {item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleDateString("it-IT")
                  : ""}
              </>
            )}
          </td>

          <td>
            {!item.dataDisabilitazione && (
              <button onClick={() => disabilita(item)}>
                Disabilita
              </button>
            )}

            <button onClick={() => modifica(item)}>
              ✏️ Modifica
            </button>

           <button
  onClick={() => apriContabilizza(item)}
  disabled={
    (() => {
      const mov = movimentiCache.filter(m => m.anagraficaId === item.id);

      if (item.periodicita === "SINGOLO") {
        return mov.length > 0; // già contabilizzato → niente da fare
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

      const daContabilizzare = Math.max(totale - mov.length, 0);

      return daContabilizzare === 0;
    })()
  }
>
  Contabilizza
</button>
<button
  style={{
    marginLeft: 8,
    background: "#f39c12",
    opacity: movimentiCache.filter(m => m.anagraficaId === item.id).length === 0 ? 0.5 : 1,
    pointerEvents: movimentiCache.filter(m => m.anagraficaId === item.id).length === 0 ? "none" : "auto",
  }}
  disabled={movimentiCache.filter(m => m.anagraficaId === item.id).length === 0}
  onClick={() => {
    const movs = movimentiCache.filter(m => m.anagraficaId === item.id);

    if (movs.length === 0) {
      alert("Nessun movimento da stornare");
      return;
    }

    setContItem({
      ...item,
      modalMode: "STORNO"   // 🔥 QUESTO È IL FIX CHIAVE
    });

  setOccList(
  movs
    .map(m => ({
      id: m.id,
      data: m.data?.toDate ? m.data.toDate() : new Date(m.data),
      importo: m.importo
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
                style={{ marginLeft: 8, color: "red" }}
                onClick={() => elimina(item)}
              >
                🗑 Elimina
              </button>
            )}
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
      {showDisabilita && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div style={{ background: "#fff", padding: 20 }}>
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

      <div style={{ marginTop: 10 }}>
        <button onClick={confermaDisabilitazione}>
          Conferma
        </button>

        <button onClick={() => setShowDisabilita(false)}>
          Annulla
        </button>
      </div>
    </div>
  </div>
)}
{showContabilizza && contItem && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#fff",
        padding: 20,
        minWidth: 450,
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >

      {/* HEADER */}
      <h3>{contItem.nomeBreve}</h3>

      <div style={{ marginBottom: 10 }}>
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

      <div style={{ marginBottom: 10 }}>
        Contabilizzati:{" "}
        <b>
          {movimentiCache.filter(m => m.anagraficaId === contItem.id).length}
        </b>
      </div>

      {/* AZIONI GLOBALI */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>

        <button
          onClick={() => {
            setShowContabilizza(false);
            setContItem(null);
            setOccList([]);
          }}
        >
          Chiudi
        </button>

        {/* 🔥 TUTTO */}
       <button
  style={{
    background: contItem.modalMode === "STORNO"
      ? "#f39c12"
      : contItem.tipo === "USCITA"
      ? "#c0392b"
      : "#27ae60",
    color: "white",
    padding: "6px 10px",
    opacity: loadingBulk ? 0.6 : 1,
    pointerEvents: loadingBulk ? "none" : "auto",
  }}
  disabled={loadingBulk}
  onClick={async () => {
    const conferma = window.confirm(
      contItem.modalMode === "STORNO"
        ? "Confermi lo STORNO TOTALE?"
        : contItem.tipo === "USCITA"
        ? "Confermi il pagamento TUTTO?"
        : "Confermi l'incasso TUTTO?"
    );

    if (!conferma) return;

    setLoadingBulk(true);

    try {
      const snap = await getDocs(collection(db, "MovimentoFinanziario"));

      for (const occ of occList) {
        const match = snap.docs.find(d => {
          const m = d.data();
          if (m.anagraficaId !== contItem.id) return false;

          const d1 = m.data?.toDate
            ? m.data.toDate()
            : new Date(m.data);

          return d1.toDateString() === occ.data.toDateString();
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

      setOccList([]);
      setShowContabilizza(false);
      setContItem(null);

      await fetchData();

    } finally {
      setLoadingBulk(false);
    }
  }}
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

      {/* LISTA */}
      {occList.length === 0 && (
        <div>Nessun movimento</div>
      )}

      {occList.map((occ, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>{occ.data.toLocaleDateString("it-IT")}</span>
          <span>{Number(occ.importo).toFixed(2)} €</span>

          <button
            onClick={async () => {

              const conferma = window.confirm(
  contItem.modalMode === "STORNO"
    ? "Confermi lo STORNO?"
    : contItem.tipo === "USCITA"
    ? "Confermi il pagamento?"
    : "Confermi l'incasso?"
);

              if (!conferma) return;

              const snap = await getDocs(collection(db, "MovimentoFinanziario"));

              const match = snap.docs.find(d => {
                const m = d.data();
                if (m.anagraficaId !== contItem.id) return false;

                const d1 = m.data?.toDate
                  ? m.data.toDate()
                  : new Date(m.data);

                return d1.toDateString() === occ.data.toDateString();
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

             setOccList(prev => {
  const nuova = prev.filter(
    x => x.data.toDateString() !== occ.data.toDateString()
  );

  // 🔥 CHIUSURA AUTOMATICA POPUP
  if (nuova.length === 0) {
    setTimeout(() => {
      setShowContabilizza(false);
      setContItem(null);
      setOccList([]);
    }, 0);
  }

  return nuova;
});

fetchData();
            }}
          >
           {contItem.modalMode === "STORNO" ? "STORNA" : contItem.tipo === "USCITA" ? "PAGA" : "INCASSA"}
          </button>

        </div>
      ))}

    </div>
  </div>
)}

{loadingBulk && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 99999,
      color: "white",
      fontSize: 18,
      flexDirection: "column",
    }}
  >
    <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
    Elaborazione movimenti in corso...
  </div>
)}
    </div>
  );
};

export default AnagraficaMovimentoFinanziario;