// src/pages/GestioneCER.js
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { deleteDoc } from "firebase/firestore";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { scriviLog } from "../utils/log";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
    const formatDataSafe = (d) => {
  if (!d) return "";
  if (typeof d.toDate === "function") return d.toDate().toLocaleString("it-IT");
  if (d instanceof Date) return d.toLocaleString("it-IT");
  return new Date(d).toLocaleString("it-IT");
};
const GestioneCER = () => {
  const navigate = useNavigate();
const [filtroTipoMovimento, setFiltroTipoMovimento] = useState("TUTTI"); // SCARICO | CARICO | TUTTI
  const [materiali, setMateriali] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [listini, setListini] = useState([]);
const [mergeMode, setMergeMode] = useState(false);
const [mergeCER, setMergeCER] = useState("");
const [mergeMatSX, setMergeMatSX] = useState("");
const [mergeMatDX, setMergeMatDX] = useState("");
const [prezzoDefault, setPrezzoDefault] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [codiceCER, setCodiceCER] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
const [carichi, setCarichi] = useState([]);
  const [filtroMateriale, setFiltroMateriale] = useState("Tutti");
  const [filtroCER, setFiltroCER] = useState("Tutti");
const [buttonLabel, setButtonLabel] = useState("Aggiungi Materiale"); // testo del pulsante
const [initialFormState, setInitialFormState] = useState({}); // stato iniziale per controllo modifiche
  const [dal, setDal] = useState(null);
  const [al, setAl] = useState(null);
  const [tutti, setTutti] = useState(false);
const [formVisible, setFormVisible] = useState(false);
  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
const getUtenteReact = () => {
  return (
    currentUser.username || currentUser.email 
  );
};
  const [sortField, setSortField] = useState("nome");
  const [sortAsc, setSortAsc] = useState(true);

  const [expandedRows, setExpandedRows] = useState({});

  // ---------------- FETCH MATERIALI ----------------
  const fetchMateriali = async () => {
    const snap = await getDocs(collection(db, "materiali"));
    const data = snap.docs.map(d => ({ idDoc: d.id, ...d.data() }));
    setMateriali(data);
  };

  // ---------------- FETCH SCARICHI ----------------
  const fetchScarichi = async () => {
    const snap = await getDocs(collection(db, "scarichi"));
    const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dati.sort((a,b) => (a.data?.seconds || 0) - (b.data?.seconds || 0));
    setScarichi(dati);

    if(dati.length){

const dates = dati
  .map(s => safeDate(s.data))
  .filter(d => d instanceof Date && !isNaN(d));
      setMinDataDB(new Date(Math.min(...dates)));
      setMaxDataDB(new Date(Math.max(...dates)));
      setDal(new Date(Math.min(...dates)));
      setAl(new Date(Math.max(...dates)));
    }
  };

  const fetchCarichi = async () => {
  const snap = await getDocs(collection(db, "carichi"));
  const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  dati.sort((a,b) => (a.data?.seconds || 0) - (b.data?.seconds || 0));
  setCarichi(dati);
};

  // ---------------- FETCH LISTINI ----------------
  const fetchListini = async () => {
    const snap = await getDocs(collection(db, "listini"));
    const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setListini(dati);
  };

  useEffect(() => {
    fetchMateriali();
    fetchScarichi();
    fetchCarichi();
    fetchListini();
  }, []);

  // ---------------- DATE UTILS ----------------
  const formatDataIT = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  // ---------------- NAV / LOGOUT ----------------
  const goHome = () => navigate("/admin");
  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  // ---------------- RESET FORM ----------------
  const resetForm = () => {
  setNome("");
  setCategoria("");
  setCodiceCER("");
  setDescrizione("");
  setPrezzoDefault("");
  setEditingId(null);  // importante, cosi il bottone torna ad Aggiungi
};


const handleSave = async () => {
  if (!nome || !codiceCER) {
    setMessage("Nome e CER obbligatori");
    return;
  }

  try {
    const acquisto = parseFloat(String(prezzoDefault || "").replace(",", ".")) || 0;

    const configSnap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
    const guadagnoMinKg = configSnap.exists()
      ? (configSnap.data().guadagnoMinKg || 0.2)
      : 0.2;

    let vendita = Number((acquisto + guadagnoMinKg).toFixed(4));

    const newData = { 
      nome, 
      categoria, 
      codiceCER, 
      descrizione,
      prezzoAcquistoDefault: acquisto,
      prezzoVenditaDefault: vendita
    };

    if (editingId) {
      // 🔴 BEFORE
      const ref = doc(db, "materiali", editingId);
      const snap = await getDoc(ref);
      const before = snap.exists() ? snap.data() : null;

      // 🟢 UPDATE
      await updateDoc(ref, newData);

      // 🟢 AFTER
      const after = { ...before, ...newData };

      // 🧠 LOG BLOCCO
      await scriviLog({
        pagina: "GestioneCER",
        evento: "UPDATE_MATERIALE",
        riferimento: {
          collezione: "materiali",
          documentoId: editingId
        },
        before,
        after,
        utente : getUtenteReact(),
        ripristinabile: true
      });

      setMessage("Materiale aggiornato con prezzo corretto!");
    } else {
      // 🟢 CREATE
      const docRef = await addDoc(collection(db, "materiali"), newData);

      // 🧠 LOG BLOCCO
      await scriviLog({
        pagina: "GestioneCER",
        evento: "CREATE_MATERIALE",
        riferimento: {
          collezione: "materiali",
          documentoId: docRef.id
        },
        before: null,
        after: newData,
        utente : getUtenteReact(),
        ripristinabile: true
      });

      setMessage("Materiale aggiunto con prezzo corretto!");
    }

    resetForm();
    fetchMateriali();

    setEditingId(null);
    setFormVisible(false);
    setButtonLabel("Aggiungi Materiale");
    setInitialFormState({});
  } catch (err) {
    console.error(err);
    setMessage("Errore salvataggio");
  }
};

useEffect(() => {
  if (!formVisible) return;

  const hasDataChanged = () => (
    nome !== initialFormState.nome ||
    categoria !== initialFormState.categoria ||
    codiceCER !== initialFormState.codiceCER ||
    descrizione !== initialFormState.descrizione ||
    prezzoDefault !== initialFormState.prezzoDefault
  );

  if ((editingId && hasDataChanged()) || (!editingId && nome && codiceCER)) {
    setButtonLabel("Salva");
  } else {
    setButtonLabel("Annulla");
  }
}, [nome, categoria, codiceCER, descrizione, prezzoDefault, formVisible, editingId, initialFormState]);


const syncListiniConMateriali = async () => {
  try {
    const normalize = (name = "") =>
      name.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const materialiSnap = await getDocs(collection(db, "materiali"));
    const listiniSnap = await getDocs(collection(db, "listini"));

    const materialiList = materialiSnap.docs.map(d => d.data());
    const listini = listiniSnap.docs;

    let materialiAggiuntiTotali = 0;

    for (const l of listini) {
      const listino = l.data();
      const ref = doc(db, "listini", l.id);

      const prezzi = listino.prezzi || {};

      const esistentiNormalizzati = new Set(
        Object.keys(prezzi).map(normalize)
      );

      let aggiuntiInQuestoListino = 0;

      for (const m of materialiList) {
        const key = normalize(m.nome);

        if (!esistentiNormalizzati.has(key)) {
          prezzi[m.nome] = {
            acquisto: m.prezzoAcquistoDefault || 0,
            vendita: m.prezzoVenditaDefault || 0
          };

          esistentiNormalizzati.add(key);
          aggiuntiInQuestoListino++;
        }
      }

      if (aggiuntiInQuestoListino > 0) {
        materialiAggiuntiTotali += aggiuntiInQuestoListino;
        await updateDoc(ref, { prezzi });
      }
    }

    let msg = "";

    if (materialiAggiuntiTotali === 0) {
      msg = "Nessun listino aggiornato, tutti i materiali sono già presenti.";
    } else {
      msg = `${materialiAggiuntiTotali} materiali aggiunti nei listini.`;
    }

    const conferma = window.confirm(
      msg + "\n\nVuoi procedere con la pulizia dei listini?"
    );

    if (!conferma) {
      setMessage(msg + " (pulizia annullata)");
      return;
    }

    // 🧹 PULIZIA LISTINI
    let totalMerge = 0;

    for (const l of listiniSnap.docs) {
      const listino = l.data();
      const ref = doc(db, "listini", l.id);

      const prezzi = listino.prezzi || {};
      const mapNormalizzati = new Map();

      for (const [nome, valori] of Object.entries(prezzi)) {
        const key = normalize(nome);

        if (!mapNormalizzati.has(key)) {
          mapNormalizzati.set(key, {
            nomeOriginale: nome,
            data: valori
          });
        } else {
          totalMerge++;
        }
      }

      const cleaned = {};
      for (const [, v] of mapNormalizzati.entries()) {
        cleaned[v.nomeOriginale] = v.data;
      }

      await updateDoc(ref, { prezzi: cleaned });
    }

    alert(
      msg +
      "\n\nPulizia completata: " +
      totalMerge +
      " duplicati gestiti."
    );

    setMessage("Sync + pulizia listini completati");

  } catch (err) {
    console.error(err);
    setMessage("Errore sync/pulizia listini");
  }
};
const puliziaListini = async () => {
  try {
    const listiniSnap = await getDocs(collection(db, "listini"));

    const normalize = (name = "") =>
      name.toUpperCase().replace(/[^A-Z0-9]/g, "");

    let totalMerge = 0;

    for (const l of listiniSnap.docs) {
      const listino = l.data();
      const ref = doc(db, "listini", l.id);

      const prezzi = listino.prezzi || {};

      const mapNormalizzati = new Map();

      // 🔁 1. COSTRUISCO MAPPA NORMALIZZATA (MERGE DUPLICATI)
      for (const [nome, valori] of Object.entries(prezzi)) {
        const key = normalize(nome);

        if (!mapNormalizzati.has(key)) {
          mapNormalizzati.set(key, {
            nomeOriginale: nome,
            data: valori
          });
        } else {
          // se duplicato → tengo il primo ma posso decidere merge intelligente
          totalMerge++;
        }
      }

      // 🔁 2. RICOSTRUISCO OGGETTO PULITO
      const cleanedPrezzi = {};
      for (const [, value] of mapNormalizzati.entries()) {
        cleanedPrezzi[value.nomeOriginale] = value.data;
      }

      await updateDoc(ref, {
        prezzi: cleanedPrezzi
      });
    }

    if (totalMerge === 0) {
      alert("Nessun duplicato trovato. Listini già puliti.");
      setMessage("Listini già normalizzati");
    } else {
      alert(`Pulizia completata. Rimossi/accorpati ${totalMerge} duplicati.`);
      setMessage("Pulizia listini completata");
    }

  } catch (err) {
    console.error(err);
    setMessage("Errore pulizia listini");
  }
};

const safeDate = (d) => {
  if (!d) return null;

  if (typeof d.toDate === "function") {
    return d.toDate();
  }

  const formatDataSafe = (d) => {
  if (!d) return "";
  if (typeof d.toDate === "function") return d.toDate().toLocaleString("it-IT");
  if (d instanceof Date) return d.toLocaleString("it-IT");
  return new Date(d).toLocaleString("it-IT");
};

  if (d instanceof Date) {
    return d;
  }

  return new Date(d);
};
const handlePulsantePrincipale = () => {
  if (!formVisible) {
    // Apri il form per aggiungere
    resetForm();
    setFormVisible(true);
    setButtonLabel("Annulla");
    setInitialFormState({
      nome: "",
      categoria: "",
      codiceCER: "",
      descrizione: "",
      prezzoDefault: ""
    });
  } else {
    if (buttonLabel === "Salva") {
      handleSave();
    } else {
      // Annulla
      resetForm();
      setFormVisible(false);
      setButtonLabel("Aggiungi Materiale");
    }
  }
};

const getCountMateriale = (nome, cer) => {
  const check = (v) => String(v || "").trim().toUpperCase();
  let count = 0;

  scarichi.forEach(s => {
    if (s.codiceCER !== cer) return;

    (s.scarico || []).forEach(b => {
      (b.righe || []).forEach(r => {
        if (check(r.materiale) === check(nome)) count++;
      });
    });
  });

  carichi.forEach(c => {
    if (c.codiceCER !== cer) return;

    (c.carico || []).forEach(b => {
      (b.righe || []).forEach(r => {
        if (check(r.materiale) === check(nome)) count++;
      });
    });
  });

  return count;
};
  // ---------------- EDIT + SCROLL ----------------
// EDIT
const handleEdit = (m) => {
  setNome(m.nome);
  setCategoria(m.categoria);
  setCodiceCER(m.codiceCER);
  setDescrizione(m.descrizione);
  setPrezzoDefault(m.prezzoAcquistoDefault ?? "");
  setEditingId(m.idDoc);

  setInitialFormState({
    nome: m.nome,
    categoria: m.categoria,
    codiceCER: m.codiceCER,
    descrizione: m.descrizione,
    prezzoDefault: m.prezzoAcquistoDefault ?? ""
  });

  setButtonLabel("Annulla");  // inizialmente Annulla
  setFormVisible(true);        // apre il form
  window.scrollTo({ top: 0, behavior: "smooth" });
};
const countMovimentiDX = (materialeDX, cer) => {
  const norm = (v) => String(v || "").trim().toUpperCase();

  let count = 0;

  // SCARICHI
  scarichi.forEach((s) => {
    (s.scarico || []).forEach((blocco) => {
      if (norm(blocco.cer) !== norm(cer)) return;

      (blocco.righe || []).forEach((r) => {
        if (norm(r.materiale) === norm(materialeDX)) {
          count++;
        }
      });
    });
  });

  // CARICHI
  carichi.forEach((c) => {
    (c.carico || []).forEach((blocco) => {
      if (norm(blocco.cer) !== norm(cer)) return;

      (blocco.righe || []).forEach((r) => {
        if (norm(r.materiale) === norm(materialeDX)) {
          count++;
        }
      });
    });
  });

  return count;
};
const handleMergeMateriali = async () => {
  if (!mergeMatSX || !mergeMatDX || mergeMatSX === mergeMatDX) {
    alert("Selezioni non valide");
    return;
  }

  try {
    // 🔎 PREVIEW CONTEGGIO
   let count = countMovimentiDX(mergeMatDX, mergeCER);

    const checkMatch = (nome) =>
      String(nome || "").trim().toUpperCase();
  
    const conferma = window.confirm(
      `Verranno modificati ${count} movimenti.\n\nContinuare?`
    );

    if (!conferma) return;

    // 🔁 UPDATE SCARICHI
    for (const s of scarichi) {
      let modified = false;

      const nuoviBlocchi = (s.scarico || []).map(b => {
        const nuoveRighe = (b.righe || []).map(r => {
          if (checkMatch(r.materiale) === checkMatch(mergeMatDX)) {
            modified = true;
            return { ...r, materiale: mergeMatSX };
          }
          return r;
        });
        return { ...b, righe: nuoveRighe };
      });

      if (modified) {
        await updateDoc(doc(db, "scarichi", s.id), {
          scarico: nuoviBlocchi
        });
      }
    }

    // 🔁 UPDATE CARICHI
    for (const c of carichi) {
      let modified = false;

      const nuoviBlocchi = (c.carico || []).map(b => {
        const nuoveRighe = (b.righe || []).map(r => {
          if (checkMatch(r.materiale) === checkMatch(mergeMatDX)) {
            modified = true;
            return { ...r, materiale: mergeMatSX };
          }
          return r;
        });
        return { ...b, righe: nuoveRighe };
      });

      if (modified) {
        await updateDoc(doc(db, "carichi", c.id), {
          carico: nuoviBlocchi
        });
      }
    }

    const matDX = materiali.find(m => m.nome === mergeMatDX);

if (matDX) {
  await updateDoc(doc(db, "materiali", matDX.idDoc), {
    attivo: false
  });

  // 🔥 RIMOZIONE COMPLETA DAL DATABASE LOGICA (opzionale ma consigliata)
  // se vuoi proprio eliminarlo:
  await deleteDoc(doc(db, "materiali", matDX.idDoc));
}

    alert("Merge completato");

    await fetchMateriali();
    await fetchScarichi();
    await fetchCarichi();

    setMergeMatSX("");
    setMergeMatDX("");

  } catch (err) {
    console.error(err);
    alert("Errore merge");
  }
};
  // ---------------- TOGGLE DETTAGLI ----------------
  const toggleDettagli = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };



const materialiFiltrati = materiali
  .filter(m =>
    (filtroMateriale === "Tutti" || m.nome === filtroMateriale) &&
    (filtroCER === "Tutti" || m.codiceCER === filtroCER)
  )
  .map(m => {
    const start = dal;
    const end = al ? new Date(al) : null;
    if (end) end.setHours(23, 59, 59, 999);

    const movimentiBase = [
  ...scarichi.map(s => ({ ...s, tipo: "scarico" })),
  ...carichi.map(c => ({ ...c, tipo: "carico" }))
];

const movimenti = movimentiBase.filter(mov => {
  const data = safeDate(mov.data);
  if (!data) return false;

  if (tutti) return true;
  if (!start || !end) return true;

  return data >= start && data <= end;
});

    // 🔥 ESTRAZIONE DETTAGLI COMPLETA (FIX DEFINITIVO)
    const movimentiMateriale = movimenti.flatMap(mov => {
const blocchi =
  mov.tipo === "carico"
    ? (Array.isArray(mov.carico) ? mov.carico : [])
    : (Array.isArray(mov.scarico) ? mov.scarico : []);
      return blocchi.flatMap(blocco => {
        const righe = blocco.righe || [];

        return righe
          .filter(r => {
            const norm = s => String(s || "").trim().toUpperCase();

            const cerMatch =
              norm(blocco.cer) === norm(m.codiceCER);

            const nomeMatch =
              norm(r.materiale || r.nome) === norm(m.nome);

            return cerMatch && nomeMatch;
          })
          .map(r => {
            const isCarico = mov.tipo === "carico";

            const prezzoKg = isCarico
              ? (r.prezzoVendita ?? r.prezzoAcquisto ?? 0)
              : (r.prezzoAcquisto ?? 0);

            const peso = r.peso || 0;

            return {
              ...r,
              data: mov.data,
              listino: mov.listino,
              fornitore: mov.fornitore,
              tipo: mov.tipo,
              prezzoKg,
              prezzoTotale: prezzoKg * peso,
              peso
            };
          });
      });
    });
console.log("MATERIALE:", m.nome);
console.log("SCARICHI:", movimentiMateriale.filter(r => r.tipo === "scarico").length);
console.log("CARICHI:", movimentiMateriale.filter(r => r.tipo === "carico").length);
    // 🔥 ORDINE CORRETTO
    movimentiMateriale.sort(
      (a, b) =>
        (safeDate(a.data)?.getTime?.() || 0) -
        (safeDate(b.data)?.getTime?.() || 0)
    );

    // 🔥 CONTEGGI REALI
   // 🔥 SCARICHI (lasciamo invariato)
const nrScarichi = movimentiMateriale.filter(r => r.tipo === "scarico").length;
const nrCarichi = movimentiMateriale.filter(r => r.tipo === "carico").length;
const nrMovimenti = movimentiMateriale.length;
    const dataPrimoMovimento = nrMovimenti
      ? formatDataIT(safeDate(movimentiMateriale[0].data))
      : "";

    const dataUltimoMovimento = nrMovimenti
      ? formatDataIT(safeDate(movimentiMateriale[nrMovimenti - 1].data))
      : "";

    const dataPrimoScarico = movimentiMateriale.find(r => r.tipo === "scarico")
      ? formatDataIT(safeDate(movimentiMateriale.find(r => r.tipo === "scarico").data))
      : "";

    const dataUltimoScarico = [...movimentiMateriale]
      .reverse()
      .find(r => r.tipo === "scarico")
      ? formatDataIT(
          safeDate([...movimentiMateriale].reverse().find(r => r.tipo === "scarico").data)
        )
      : "";

    const dataPrimoCarico = movimentiMateriale.find(r => r.tipo === "carico")
      ? formatDataIT(safeDate(movimentiMateriale.find(r => r.tipo === "carico").data))
      : "";

    const dataUltimoCarico = [...movimentiMateriale]
      .reverse()
      .find(r => r.tipo === "carico")
      ? formatDataIT(
          safeDate([...movimentiMateriale].reverse().find(r => r.tipo === "carico").data)
        )
      : "";

    return {
      ...m,
      nrScarichi,
      nrCarichi,
      nrMovimenti,
      dataPrimoScarico,
      dataUltimoScarico,
      dataPrimoCarico,
      dataUltimoCarico,
      dataPrimoMovimento,
      dataUltimoMovimento,
      scarichiDettaglio: movimentiMateriale
    };
  })
  .sort((a, b) => {
    const v1 = a[sortField] || "";
    const v2 = b[sortField] || "";
    return sortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
  });

// ---------------- INTESTAZIONI DINAMICHE ----------------
const intestazioni = () => {
  switch(filtroTipoMovimento) {
    case "SCARICO":
      return ["Nome","Categoria","CER","Descrizione","Nr Scarichi","Primo Scarico","Ultimo Scarico","Azioni"];
    case "CARICO":
      return ["Nome","Categoria","CER","Descrizione","Nr Carichi","Primo Carico","Ultimo Carico","Azioni"];
    case "TUTTI":
    default:
      return ["Nome","Categoria","CER","Descrizione","Nr Movimenti","Primo Movimento","Ultimo Movimento","Azioni"];
  }
};



const handleStampa = async () => {
  if (!materialiFiltrati || materialiFiltrati.length === 0) {
    alert("Nessun dato da stampare");
    return;
  }

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();

  let y = startY + 10;

  pdf.setFontSize(16);
  pdf.text("Gestione Codici CER", 14, y);
  y += 10;

  const formatData = (d) => {
    if (!d) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  if (!tutti) {
    pdf.setFontSize(11);
    pdf.text(
      `Dal ${formatData(dal) || "..."} al ${formatData(al) || "..."}`,
      14,
      y
    );
    y += 7;
  }

  pdf.text(`Tipo Movimento: ${filtroTipoMovimento}`, 14, y);
  y += 10;

  materialiFiltrati.forEach((m, index) => {
    const movimenti = (m.scarichiDettaglio || []).filter((r) => {
      if (filtroTipoMovimento === "TUTTI") return true;
      return r.tipo.toUpperCase() === filtroTipoMovimento;
    });

    // 🔴 TITOLO MATERIALE
    pdf.setFontSize(12);
    pdf.text(
      `${m.nome} | ${m.categoria} | CER: ${m.codiceCER}`,
      14,
      y
    );
    y += 6;

    if (movimenti.length === 0) {
      pdf.setFontSize(9);
      pdf.text("Nessun movimento", 14, y);
      y += 8;
      return;
    }

    const body = movimenti.map((r) => [
      r.tipo,
      formatDataIT(safeDate(r.data)),
      r.fornitore || "-",
      r.listino || "-",
      (r.prezzoKg || 0).toFixed(2),
      r.peso || 0,
      (r.prezzoTotale || 0).toFixed(2)
    ]);

    autoTable(pdf, {
      startY: y,
      head: [[
        "Tipo",
        "Data",
        "Controparte",
        "Listino",
        "€/kg",
        "Kg",
        "Totale €"
      ]],
      body,
      theme: "grid",
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    y = pdf.lastAutoTable.finalY + 10;

    // 🔴 spazio tra materiali + gestione pagina
    if (y > 270 && index < materialiFiltrati.length - 1) {
      pdf.addPage();
      y = 20;
    }
  });

  pdf.save("gestione_cer.pdf");
};
const materialiDropdown = [
  "Tutti",
  ...Array.from(new Set(
    materiali
      .filter(m => filtroCER === "Tutti" || m.codiceCER === filtroCER)
      .map(m => m.nome)
  )).sort((a, b) => a.localeCompare(b, "it"))
];

const cerDropdown = [
  "Tutti",
  ...Array.from(new Set(
    materiali
      .filter(m => filtroMateriale === "Tutti" || m.nome === filtroMateriale)
      .map(m => m.codiceCER)
  )).sort((a, b) => a.localeCompare(b, "it"))
];

  const handleSort = (field) => {
    if(field===sortField) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };
const selectStyle = {
  control: (base) => ({ ...base, minWidth: 200 }),
  menu: (base) => ({ ...base, zIndex: 9999 })
};
  // ---------------- UI ----------------
  return (
    <div className="gestione-utenti-container">
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button onClick={goHome}>🏠 Dashboard</button>
        <button onClick={handleLogout}>
  🚪Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
</button>  </div>

      <h2>Gestione Codici CER</h2>
      
      <div style={{marginBottom:15}}>
        <button onClick={handleStampa}>🖨️ Stampa PDF</button>
        <button onClick={syncListiniConMateriali}>
  🔄 Aggiorna listini con nuovi materiali
</button>
      </div>
      {message && <p style={{color:"green"}}>{message}</p>}

{formVisible && (
  <div className="form" style={{ marginBottom: "15px", transition: "all 0.3s" }}>
    <input placeholder="Nome materiale" value={nome} onChange={e=>setNome(e.target.value)} />
    <select value={categoria} onChange={e=>setCategoria(e.target.value)}>
      <option value="">Categoria</option>
      {[...new Set(materiali.map(m=>m.categoria).filter(Boolean))].map(c=> <option key={c}>{c}</option>)}
    </select>
    <input placeholder="Codice CER" value={codiceCER} onChange={e=>setCodiceCER(e.target.value)} />
    <input placeholder="Descrizione" value={descrizione} onChange={e=>setDescrizione(e.target.value)} />
    <input
      placeholder="Prezzo default"
      type="text"
      value={prezzoDefault !== "" ? String(prezzoDefault).replace(".", ",") : ""}
      onChange={e => {
        let val = e.target.value.replace(",", ".");
        setPrezzoDefault(val);
      }}
    />

    {/* Rimuovi questo dal form */}
{/* <button onClick={handleSave} style={{ marginTop: "10px" }}>
      {editingId ? "Salva" : "Aggiungi"}
</button> */}
  </div>
)}
<div style={{ marginBottom: 15 }}>
  <button onClick={handlePulsantePrincipale}>
    {buttonLabel}
  </button>

<button onClick={() => setMergeMode(!mergeMode)}>
  🔀 Merge Materiali
</button></div>{mergeMode && (
  <div style={{ marginBottom: 20, padding: 10, border: "1px solid #ccc" }}>
    
    {/* CER */}
<div style={{ marginBottom: 10 }}>
  <label style={{ display: "block", marginBottom: 5 }}>
    📦 Seleziona CER
  </label>

  <Select
    styles={selectStyle}
    value={mergeCER ? { value: mergeCER, label: mergeCER } : null}
    onChange={(opt) => {
      setMergeCER(opt?.value || "");
      setMergeMatSX("");
      setMergeMatDX("");
    }}
    options={[
      { value: "", label: "Seleziona CER" },
      ...Array.from(new Set(materiali.map(m => m.codiceCER)))
        .sort()
        .map(c => ({ value: c, label: c }))
    ]}
  />
</div>

    {/* MATERIALI */}
<div style={{ marginBottom: 10 }}>
  <label style={{ display: "block", marginBottom: 5 }}>
    🎯 Materiale finale (SX)
  </label>

  <Select
    isDisabled={!mergeCER}
    styles={selectStyle}
    value={mergeMatSX ? { value: mergeMatSX, label: mergeMatSX } : null}
    onChange={(opt) => setMergeMatSX(opt?.value || "")}
    options={materiali
      .filter(m => m.codiceCER === mergeCER)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(m => ({ value: m.nome, label: m.nome }))
    }
  />
</div>

<div style={{ marginBottom: 10 }}>
  <label style={{ display: "block", marginBottom: 5 }}>
    🔥 Materiale da fondere (DX)
  </label>

  <Select
    isDisabled={!mergeCER}
    styles={selectStyle}
    value={mergeMatDX ? { value: mergeMatDX, label: mergeMatDX } : null}
    onChange={(opt) => setMergeMatDX(opt?.value || "")}
    options={materiali
      .filter(m => m.codiceCER === mergeCER)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(m => ({ value: m.nome, label: m.nome }))
    }
  />
</div>

    {/* BOTTONE */}
    <button
      disabled={!mergeMatSX || !mergeMatDX || mergeMatSX === mergeMatDX}
      onClick={handleMergeMateriali}
      style={{ marginLeft: 10 }}
    >
      ✅ Conferma Merge
    </button>

  </div>
)}


      <div style={{margin:"20px 0", display:"flex", gap:"12px", alignItems:"center"}}>
        <label>
          Materiale:
<Select
  styles={selectStyle}
  value={{ value: filtroMateriale, label: filtroMateriale }}
  onChange={(opt) => setFiltroMateriale(opt.value)}
  options={materialiDropdown.map(m => ({ value: m, label: m }))}
/>
        </label>

        <label>
          Codice CER:
<Select
  styles={selectStyle}
  value={{ value: filtroCER, label: filtroCER }}
  onChange={(opt) => setFiltroCER(opt.value)}
  options={cerDropdown.map(c => ({ value: c, label: c }))}
/>
        </label>

        <label>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)} /> Disabilita filtro date
        </label>

        {!tutti && (
          <>
            <label>
              Dal:
              <DatePicker
                selected={dal}
                onChange={setDal}
                minDate={minDataDB || null}
                maxDate={al || maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>

            <label>
              Al:
              <DatePicker
                selected={al}
                onChange={setAl}
                minDate={dal || minDataDB || null}
                maxDate={maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>
            <label>
  Tipo Movimento:
  <select value={filtroTipoMovimento} onChange={e => setFiltroTipoMovimento(e.target.value)}>
    <option value="TUTTI">TUTTI</option>
    <option value="SCARICO">SCARICO</option>
    <option value="CARICO">CARICO</option>
  </select>
</label>
          </>
        )}
      </div>

      <table>
      <thead>
  <tr>
    {intestazioni().map((h, idx) => (
      <th
        key={idx}
        onClick={() => {
          if (["Nome","Categoria","CER"].includes(h)) {
            const fieldMap = { "Nome":"nome","Categoria":"categoria","CER":"codiceCER" };
            handleSort(fieldMap[h]);
          }
        }}
      >
        {h}
      </th>
    ))}
  </tr>
</thead>
        <tbody>
          {materialiFiltrati.map(m => (
            <React.Fragment key={m.idDoc}>
              <tr>
                <td>{m.nome}</td>
                <td>{m.categoria}</td>
                <td>{m.codiceCER}</td>
                <td>{m.descrizione}</td>
                <td>
  {filtroTipoMovimento === "SCARICO"
    ? m.nrScarichi
    : filtroTipoMovimento === "CARICO"
    ? m.nrCarichi
    : m.nrMovimenti}
</td>

<td>
  {filtroTipoMovimento === "SCARICO"
    ? m.dataPrimoScarico
    : filtroTipoMovimento === "CARICO"
    ? m.dataPrimoCarico
    : m.dataPrimoMovimento}
</td>

<td>
  {filtroTipoMovimento === "SCARICO"
    ? m.dataUltimoScarico
    : filtroTipoMovimento === "CARICO"
    ? m.dataUltimoCarico
    : m.dataUltimoMovimento}
</td>
                <td>
                  <button onClick={()=>handleEdit(m)}>Modifica</button>
                {(
  (filtroTipoMovimento === "SCARICO" && m.nrScarichi > 0) ||
  (filtroTipoMovimento === "CARICO" && m.nrCarichi > 0) ||
  (filtroTipoMovimento === "TUTTI" && m.nrMovimenti > 0)
) && (
  <button
    style={{ marginLeft: 5 }}
    onClick={() => toggleDettagli(m.idDoc)}
  >
    {expandedRows[m.idDoc] ? "Chiudi" : "Dettagli"}
  </button>
)}
                </td>
              </tr>

            {expandedRows[m.idDoc] && (
  <tr>
    <td colSpan={8}>
      {filtroTipoMovimento === "TUTTI" ? (
        <>
          <h4>SCARICHI</h4>
          <TableMovimenti dati={m.scarichiDettaglio.filter(r => r.tipo === "scarico")} tipo="SCARICO" />

          <h4>CARICHI</h4>
          <TableMovimenti dati={m.scarichiDettaglio.filter(r => r.tipo === "carico")} tipo="CARICO" />

          <h4>Totale / Margine</h4>
          <TableTotaleMargine dati={m.scarichiDettaglio} />
        </>
      ) : (
        <TableMovimenti dati={m.scarichiDettaglio.filter(r => r.tipo.toUpperCase() === filtroTipoMovimento)} tipo={filtroTipoMovimento} />
      )}
    </td>
  </tr>
)}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GestioneCER;

const TableMovimenti = ({ dati, tipo }) => (
  <table style={{ width: "100%", marginTop:5, marginBottom:10, border:"1px solid #ccc" }}>
    <thead>
      <tr>
        <th>Data / Ora</th>
        <th>Fornitore</th>
        <th>Listino</th>
        <th>{tipo === "SCARICO" ? "Prezzo/kg" : "Prezzo/kg"}</th>
        <th>Peso Totale</th>
        <th>{tipo === "SCARICO" ? "Costo Totale €" : "Ricavo Totale €"}</th>
      </tr>
    </thead>
    <tbody>
      {dati.map((r, idx) => (
        <tr key={idx}>
          <td>{formatDataSafe(r.data)}</td>
          <td>{r.fornitore}</td>
          <td>{r.listino}</td>
          <td>{r.prezzoKg.toFixed(2)}</td>
          <td>{r.peso}</td>
          <td>{r.prezzoTotale.toFixed(2)}</td>
        </tr>
      ))}
      <tr style={{ fontWeight:"bold" }}>
        <td colSpan={4}>Totale</td>
        <td>{dati.reduce((sum,r)=>sum+(r.peso||0),0)}</td>
        <td>{dati.reduce((sum,r)=>sum+(r.prezzoTotale||0),0).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
);

const TableTotaleMargine = ({ dati }) => {
  const scarico = dati.filter(r => r.tipo === "scarico");
  const carico = dati.filter(r => r.tipo === "carico");

  const pesoMagazzino = scarico.reduce((sum,r)=>sum+(r.peso||0),0) - carico.reduce((sum,r)=>sum+(r.peso||0),0);
  const costoTotale = scarico.reduce((sum,r)=>sum+(r.prezzoTotale||0),0);
  const ricavoTotale = carico.reduce((sum,r)=>sum+(r.prezzoTotale||0),0);
  const margineKg = pesoMagazzino ? (ricavoTotale - costoTotale) / pesoMagazzino : 0;
  const utile = ricavoTotale - costoTotale;

  return (
    <table style={{ width: "100%", marginTop:5, marginBottom:10, border:"1px solid #ccc" }}>
      <thead>
        <tr>
          <th>Materiale</th>
          <th>Giacenza Kg</th>
          <th>Margine/kg</th>
          <th>Utile €</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ fontWeight:"bold" }}>
          <td>Totale</td>
          <td>{pesoMagazzino}</td>
          <td>{margineKg.toFixed(2)}</td>
          <td>{utile.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
};