// src/components/GestioneContropartiAvanzata.js

import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc, writeBatch, query, where
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { scriviLog } from "../utils/log";
import Select from "react-select";
import DatePicker from "react-datepicker"; 
import "react-datepicker/dist/react-datepicker.css";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
const createOperationId = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const GestioneContropartiAvanzata = () => {
  const navigate = useNavigate();
const [sortConfig, setSortConfig] = useState({
  key: null,
  direction: "asc"
});
const requestSort = (key) => {
  setSortConfig(prev => {
    if (prev.key === key && prev.direction === "asc") {
      return { key, direction: "desc" };
    }
    return { key, direction: "asc" };
  });
};
const [escludiPrivato, setEscludiPrivato] = useState(false);
const [showMergeUI, setShowMergeUI] = useState(false);
const [merge1, setMerge1] = useState("");
const [merge2, setMerge2] = useState("");
const [fattureCarichi, setFattureCarichi] = useState([]);
const [prospettiFattura, setProspettiFattura] = useState([]);
const [filtroFornitori, setFiltroFornitori] = useState("TUTTI");
const mergeInvalid = !merge1 || !merge2 || merge1 === merge2;
const safeDate = (d) => {
  if (!d) return null;

  // Firestore Timestamp
  if (typeof d.toDate === "function") return d.toDate();

  // Oggetto Firestore con seconds
  if (typeof d === "object" && d.seconds) {
    return new Date(d.seconds * 1000);
  }

  // Stringa ISO
  if (typeof d === "string") {
    const parsed = new Date(d);
    return isNaN(parsed) ? null : parsed;
  }

  // JS Date
  if (d instanceof Date) return d;

  return null;
};
const [filtroStato, setFiltroStato] = useState("TUTTI");

const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
  const [fornitori, setFornitori] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [carichi, setCarichi] = useState([]);
  const [errori, setErrori] = useState([]);
const getUtenteReact = () => {
  return (
    currentUser.username || currentUser.email 
  );
};


const safeRenameControparte = async (fornitore) => {
  try {
    const nuovoNomeRaw = prompt(
      `Nuovo nome per "${fornitore.nome}":`,
      fornitore.nome
    );

    if (!nuovoNomeRaw) return;

    const nuovoNome = nuovoNomeRaw.trim();
    if (!nuovoNome) return;

    const oldNome = fornitore.nome;

    // 🔥 1. CHECK DUPLICATO
    const dup = fornitori.find(
      f => f.nome?.toLowerCase().trim() === nuovoNome.toLowerCase().trim()
    );

    if (dup && dup.id !== fornitore.id) {
      alert("⚠️ Esiste già una controparte con questo nome");
      return;
    }

    const confirm = window.confirm(
      `Confermi cambio nome?\n\n${oldNome} ➜ ${nuovoNome}\n\nVerranno aggiornati carichi e scarichi.`
    );

    if (!confirm) return;

    const batch = writeBatch(db);

    let updatedCarichi = 0;
    let updatedScarichi = 0;

    // 🔥 2. UPDATE FORNITORE
    batch.update(doc(db, "fornitori", fornitore.id), {
      nome: nuovoNome
    });

    // 🔥 3. CARICHI
    const carSnap = await getDocs(
      query(collection(db, "carichi"), where("fornitore", "==", oldNome))
    );

    carSnap.forEach(docu => {
      batch.update(doc(db, "carichi", docu.id), {
        fornitore: nuovoNome
      });
      updatedCarichi++;
    });

    // 🔥 4. SCARICHI
    const scarSnap = await getDocs(
      query(collection(db, "scarichi"), where("fornitore", "==", oldNome))
    );

    scarSnap.forEach(docu => {
      batch.update(doc(db, "scarichi", docu.id), {
        fornitore: nuovoNome
      });
      updatedScarichi++;
    });

    // 🔥 5. COMMIT ATOMICO
    await batch.commit();

    // 🔥 6. LOG
    const operationId = createOperationId();

    await scriviLog({
      operationId,
      pagina: "GestioneControparti",
      evento: "RENAME_CONTROPARTE",
      tipo: "UPDATE",
      collezioneRef: "fornitori",
      documentoId: fornitore.id,
      before: { nome: oldNome },
      after: { nome: nuovoNome },
      extra: {
        carichiAggiornati: updatedCarichi,
        scarichiAggiornati: updatedScarichi
      },
      utente: getUtenteReact(),
      ripristinabile: true
    });

    alert(
      `✅ Rename completato!\n\nCarichi aggiornati: ${updatedCarichi}\nScarichi aggiornati: ${updatedScarichi}`
    );

    await loadData();

  } catch (e) {
    console.error("❌ RENAME FAILED", e);
    alert("❌ Operazione fallita, nessuna modifica applicata");
  }
};

const eseguiFusioneControparti = async (tipo) => {
  try {
    if (!merge1 || !merge2) {
      alert("Seleziona entrambe le controparti");
      return;
    }

    if (merge1 === merge2) {
       alert("❌ Hai selezionato la stessa controparte");
      return;
    }

    let nomeFinale = "";

    // 🔥 SCELTA NOME FINALE
    if (tipo === 1) nomeFinale = merge1;
    if (tipo === 2) nomeFinale = merge2;

    if (tipo === 3) {
      const nuovoNomeRaw = prompt("Inserisci il nuovo nome:");
      if (!nuovoNomeRaw) return;

      nomeFinale = nuovoNomeRaw.trim();
      if (!nomeFinale) return;

      // 🔥 CHECK ESISTENZA
      const snap = await getDocs(collection(db, "fornitori"));
      const exists = snap.docs.find(
        d => (d.data().nome || "").toLowerCase().trim() === nomeFinale.toLowerCase()
      );

      if (exists) {
        alert("❌ Nome già esistente");
        return;
      }

      // 🔥 CREA NUOVA CONTROPARTE
      await addDoc(collection(db, "fornitori"), {
        nome: nomeFinale,
        indirizzo: "",
        piva_cf: ""
      });
    }

    const confirm = window.confirm(
      `Fusione:\n\n${merge1} + ${merge2} ➜ ${nomeFinale}\n\nProcedere?`
    );

    if (!confirm) return;

    const operationId = createOperationId();

    let updatedCarichi = 0;
    let updatedScarichi = 0;
    let deleted = 0;

    const batch = writeBatch(db);

    // 🔥 CARICHI (merge1)
    const car1 = await getDocs(
      query(collection(db, "carichi"), where("fornitore", "==", merge1))
    );

    car1.forEach(d => {
      batch.update(doc(db, "carichi", d.id), { fornitore: nomeFinale });
      updatedCarichi++;
    });

    // 🔥 CARICHI (merge2)
    const car2 = await getDocs(
      query(collection(db, "carichi"), where("fornitore", "==", merge2))
    );

    car2.forEach(d => {
      batch.update(doc(db, "carichi", d.id), { fornitore: nomeFinale });
      updatedCarichi++;
    });

    // 🔥 SCARICHI (merge1)
    const scar1 = await getDocs(
      query(collection(db, "scarichi"), where("fornitore", "==", merge1))
    );

    scar1.forEach(d => {
      batch.update(doc(db, "scarichi", d.id), { fornitore: nomeFinale });
      updatedScarichi++;
    });

    // 🔥 SCARICHI (merge2)
    const scar2 = await getDocs(
      query(collection(db, "scarichi"), where("fornitore", "==", merge2))
    );

    scar2.forEach(d => {
      batch.update(doc(db, "scarichi", d.id), { fornitore: nomeFinale });
      updatedScarichi++;
    });

    // 🔥 CANCELLA VECCHIE CONTROPARTI
    const fornSnap = await getDocs(collection(db, "fornitori"));

    fornSnap.forEach(f => {
      const nome = f.data().nome;

      if (nome === merge1 || nome === merge2) {
        // NON cancellare se è il nome finale
        if (nome !== nomeFinale) {
          batch.delete(doc(db, "fornitori", f.id));
          deleted++;
        }
      }
    });

    await batch.commit();

    // 🔥 LOG
    await scriviLog({
      operationId,
      pagina: "GestioneControparti",
      evento: "MERGE_CONTROPARTI",
      tipo: "UPDATE",
      collezioneRef: "fornitori",
      documentoId: "merge",
      before: { merge1, merge2 },
      after: { nomeFinale },
      extra: {
        carichiAggiornati: updatedCarichi,
        scarichiAggiornati: updatedScarichi,
        eliminati: deleted
      },
      utente: getUtenteReact(),
      ripristinabile: false
    });

    alert(`✅ Fusione completata`);

    setMerge1("");
    setMerge2("");
    setShowMergeUI(false);

    await loadData();

  } catch (e) {
    console.error(e);
    alert("❌ Errore fusione");
  }
};

  const [dal, setDal] = useState(null);
  const [al, setAl] = useState(null);
  const [tutti, setTutti] = useState(false);
const [movimenti, setMovimenti] = useState([]);

  const [minDataDB, setMinDataDB] = useState(null);
  const [maxDataDB, setMaxDataDB] = useState(null);

  // ---------------- LOGOUT / DASHBOARD ----------------
  const handleLogout = async () => { await auth.signOut(); navigate("/login"); };
  const goDashboard = () => navigate("/admin");

  // ---------------- LOAD DATA ----------------
  const loadData = async () => {
    try {
      const fornSnap = await getDocs(collection(db, "fornitori"));
      setFornitori(fornSnap.docs.map(d => ({ id: d.id, ...d.data() })));
const movSnap = await getDocs(collection(db, "MovimentoFinanziario"));
setMovimenti(movSnap.docs.map(d => ({ id: d.id, ...d.data() })));
const snapFatt = await getDocs(collection(db, "fattureCarichi"));
setFattureCarichi(snapFatt.docs.map(d => ({ id: d.id, ...d.data() })));

const snapProsp = await getDocs(collection(db, "prospettiFattura"));
setProspettiFattura(snapProsp.docs.map(d => ({ id: d.id, ...d.data() })));

      const scarSnap = await getDocs(collection(db, "scarichi"));
      const carSnap = await getDocs(collection(db, "carichi"));
      const carData = carSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCarichi(carData);
      const scarData = scarSnap.docs.map(d => ({ id: d.id, ...d.data() }));
     
      setScarichi(scarData);
 const validScarichi = scarData.filter(s => s.data?.toDate);

validScarichi.sort(
  (a, b) => (a.data?.seconds || 0) - (b.data?.seconds || 0)
);

const oggi = new Date();
oggi.setHours(23, 59, 59, 999);

if (validScarichi.length) {
  const min = safeDate(validScarichi[0].data);

  setMinDataDB(min);
  setMaxDataDB(oggi); // 🔥 FORZATO A OGGI SEMPRE
} else {
  setMinDataDB(null);
  setMaxDataDB(oggi); // 🔥 comunque oggi, mai sporco
}
    } catch (e) { setErrori([e.message]); }
  };

  // ---------------- LOAD DATA + gestione openNew ----------------
  useEffect(() => { 
  const fetchData = async () => {
    await loadData();
    const params = new URLSearchParams(window.location.search);
    const openNew = params.get("openNew") === "true";

    if (openNew) {
      // pulisce la URL per evitare che il form si riapra
      window.history.replaceState({}, "", "/fornitori");

      handleApriFormNuovoFornitore();
    }
  };

  fetchData();

  

}, []);

  // ---------------- COUNT SCARICHI FILTRATI ----------------
  const countScarichi = (fornitore) => {
    let lista = scarichi.filter(s => s.fornitore === fornitore.nome);
    if (!tutti && dal && al) {
      const inizio = dal;
      const fine = new Date(al);
      fine.setHours(23,59,59,999);
      lista = lista.filter(s => {
       const d = safeDate(s.data);
        if (!d) return false;
        return d >= inizio && d <= fine;
      });
    }
    return lista.length;
  };

  // ---------------- COUNT SCARICHI TOTALI ----------------
const countCarichi = (fornitore) => {
  let lista = carichi.filter(c => c.fornitore === fornitore.nome);

  if (!tutti && dal && al) {
    const inizio = dal;
    const fine = new Date(al);
    fine.setHours(23,59,59,999);

    lista = lista.filter(c => {
      const d = safeDate(c.data);
      return d && d >= inizio && d <= fine;
    });
  }

  return lista.length;
};
const passaFiltroFornitoriBase = (f) => {
  const scarTot = countScarichiTot(f);
  const carTot = countCarichiTot(f);

  switch (filtroFornitori) {
    case "CON_MOV": return scarTot > 0 || carTot > 0;
    case "SENZA_MOV": return scarTot === 0 && carTot === 0;
    case "CON_CARICHI": return carTot > 0;
    case "SENZA_CARICHI": return carTot === 0;
    case "CON_SCARICHI": return scarTot > 0;
    case "SENZA_SCARICHI": return scarTot === 0;
    default: return true;
  }
};
const passaFiltroFornitori = (f) => {
  if (escludiPrivato && f.nome === "FORNITORE PRIVATO") return false;

  // 🔥 Filtro Stato
  const scarTot = countScarichiTot(f);
  const scarCont = countScarichiCont(f);
  const carTot = countCarichiTot(f);
  const carCont = countCarichiCont(f);

  if (filtroStato === "DA_CONT") {
    if (!(scarTot > scarCont || carTot > carCont)) return false;
  }

  if (filtroStato === "CONT") {
    if (!(scarTot === scarCont && carTot === carCont)) return false;
  }

  // 🔥 Filtro movimenti
  return passaFiltroFornitoriBase(f);
};




// ---------------- COUNT CARICHI TOTALI ----------------
const countCarichiTotali = (fornitore) => {
  return carichi.filter(c => c.fornitore === fornitore.nome).length;
};
  const countScarichiTotali = (fornitore) => {
    return scarichi.filter(s => s.fornitore === fornitore.nome).length;
  };
const filtraPerData = (data) => {
  if (tutti) return true;

  // Se dal o al non sono ancora pronti → NON filtrare
  if (!dal || !al) return true;

  const d = safeDate(data);
  if (!d) return false;

  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dalNorm = new Date(dal.getFullYear(), dal.getMonth(), dal.getDate());
  const alNorm = new Date(al.getFullYear(), al.getMonth(), al.getDate(), 23, 59, 59, 999);

  return dd >= dalNorm && dd <= alNorm;
};


const countScarichiTot = (f) =>
  scarichi.filter(s =>
    s.fornitore === f.nome &&
    filtraPerData(s.data)
  ).length;
const countScarichiCont = (f) =>
  scarichi.filter(s =>
    s.fornitore === f.nome &&
    filtraPerData(s.data) &&
    s.movimentoFinanziarioId &&
    String(s.movimentoFinanziarioId).trim() !== ""
  ).length;
const countCarichiTot = (f) =>
  carichi.filter(c =>
    c.fornitore === f.nome &&
    filtraPerData(c.data)
  ).length;
const countCarichiCont = (f) =>
  carichi.filter(c =>
    c.fornitore === f.nome &&
    filtraPerData(c.data) &&
    c.movimentoFinanziarioId &&
    String(c.movimentoFinanziarioId).trim() !== ""
  ).length;



const calcolaUtileContabilizzato = (f) => {
  // ENTRATE: fatture carichi
  const entrate = fattureCarichi
    .filter(fc => fc.cliente === f.nome)
    .filter(fc => filtraPerData(fc.dataCreazione))
    .reduce((tot, fc) => tot + Number(fc.totale || 0), 0);

  // USCITE: prospetti fattura
  const uscite = prospettiFattura
    .filter(pf => pf.cliente === f.nome)
    .filter(pf => filtraPerData(pf.dataCreazione))
    .reduce((tot, pf) => tot + Number(pf.totale || 0), 0);

  return entrate - uscite;
};



const calcolaUtilePotenziale = (f) => {
  // 🔵 RICAVI POTENZIALI (CARICHI)
  const ricavi = carichi
    .filter(c => c.fornitore === f.nome)
    .filter(c => filtraPerData(c.data))
    .reduce((tot, c) => {
      if (!Array.isArray(c.carico)) return tot;

      return tot + c.carico.reduce((sumVoce, voce) => {
        if (!Array.isArray(voce.righe)) return sumVoce;

        return sumVoce + voce.righe.reduce((sumRiga, r) => {
          const prezzoVendita = Number(r.prezzoVendita || r.prezzo || 0);
          const netto = Number(r.netto || 0);
          return sumRiga + prezzoVendita * netto;
        }, 0);
      }, 0);
    }, 0);

  // 🔴 COSTI POTENZIALI (SCARICHI)
  const costi = scarichi
    .filter(s => s.fornitore === f.nome)
    .filter(s => filtraPerData(s.data))
    .reduce((tot, s) => {
      if (!Array.isArray(s.scarico)) return tot;

      return tot + s.scarico.reduce((sumVoce, voce) => {
        if (!Array.isArray(voce.righe)) return sumVoce;

        return sumVoce + voce.righe.reduce((sumRiga, r) => {
          const prezzoAcq = Number(r.prezzoAcquisto || 0);
          const netto = Number(r.netto || 0);
          return sumRiga + prezzoAcq * netto;
        }, 0);
      }, 0);
    }, 0);

  // 🎯 UTILE POTENZIALE = RICAVI - COSTI
  return ricavi - costi;
};






  useEffect(() => {
    if (minDataDB && maxDataDB) {
      setDal(minDataDB);
      setAl(maxDataDB);
    }
  }, [minDataDB, maxDataDB]);

  // ---------------- AGGIUNGI ----------------
  // ---------------- AGGIUNGI ----------------
const handleApriFormNuovoFornitore = async () => {
  try {
    const returnPage = localStorage.getItem("scaricoReturnPage");

    const nomeRaw = prompt("Nome controparte (obbligatorio):");
    if (!nomeRaw) if (returnPage === "/scarichi") {
      localStorage.removeItem("scaricoReturnPage");
      window.location.href = `/scarichi`; 
     } else return;

    const nome = nomeRaw.trim();
    if (!nome) if (returnPage === "/scarichi") {
      localStorage.removeItem("scaricoReturnPage");
      window.location.href = `/scarich`; 
     } else return;

    const indirizzo = prompt("Indirizzo (opzionale):") || "";
    const piva_cf = prompt("P.IVA / CF (opzionale):") || "";

    const nomeKey = nome.toLowerCase().trim();

    // 🔥 CHECK VERO SU FIRESTORE
    const snap = await getDocs(collection(db, "fornitori"));

    const existing = snap.docs.find(d =>
      (d.data().nome || "").toLowerCase().trim() === nomeKey
    );

    let refId;

    if (existing) {
      refId = existing.id;

      await updateDoc(doc(db, "fornitori", refId), {
        nome,
        indirizzo,
        piva_cf
      });

      await scriviLog({
        operationId: createOperationId(),
        pagina: "GestioneControparti",
        evento: "FORNITORE_UPDATE",
        tipo: "UPDATE",
        collezioneRef: "fornitori",
        documentoId: refId,
        before: existing.data(),
        after: { nome, indirizzo, piva_cf },
        utente: getUtenteReact(),
        ripristinabile: true
      });

    } else {
      const ref = await addDoc(collection(db, "fornitori"), {
        nome,
        indirizzo,
        piva_cf
      });

      refId = ref.id;

      await scriviLog({
        operationId: createOperationId(),
        pagina: "GestioneControparti",
        evento: "FORNITORE_CREATE",
        tipo: "CREATE",
        collezioneRef: "fornitori",
        documentoId: refId,
        before: null,
        after: { nome, indirizzo, piva_cf },
        utente: getUtenteReact(),
        ripristinabile: true
      });
    }

    await loadData();

    localStorage.setItem("nuovoFornitore", nome);

    // 🔥 NAVIGAZIONE PULITA
    if (returnPage === "/scarichi") {
      localStorage.removeItem("scaricoReturnPage");
      window.location.href = `/scarichi?newFornitore=${encodeURIComponent(nome)}`;
    } else {
      localStorage.removeItem("scaricoReturnPage");
      alert(`Controparte "${nome}" salvata correttamente`);
    }

  } catch (e) {
    setErrori(prev => [...prev, e.message || e]);
  }
};
  const aggiungiFornitore = () => handleApriFormNuovoFornitore();
const fornitoriOptions = [...fornitori]
  .sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "it", { sensitivity: "base" })
  )
  .map(f => ({
    value: f.nome,
    label: f.nome
  }));
  // ---------------- MODIFICA ----------------
  const modificaFornitore = async (f) => {
    const indirizzo = prompt(`Modifica indirizzo controparte (${f.nome})`, f.indirizzo || "") || "";
    const piva_cf = prompt(`Modifica P.IVA / CF (${f.nome})`, f.piva_cf || "") || "";
    try {
      const ref = doc(db,"fornitori",f.id);
      await updateDoc(ref, { indirizzo, piva_cf });
     const operationId = createOperationId();

await scriviLog({
  operationId,
  pagina: "GestioneControparti",
  evento: "CONTROPARTE_UPDATE",
  tipo: "UPDATE",
  collezioneRef: "fornitori",
  documentoId: f.id,
  before: {
    nome: f.nome,
    indirizzo: f.indirizzo,
    piva_cf: f.piva_cf
  },
  after: { indirizzo, piva_cf },
  utente: getUtenteReact(),
  ripristinabile: true
});
      loadData();
    } catch(e){ setErrori(prev=>[...prev,e.message]); }
  };

  // ---------------- ELIMINA ----------------
  const eliminaFornitore = async (f) => {
    if (countScarichiTotali(f)>0 || countCarichiTotali(f)>0) { alert("Non eliminabile: esistono movimenti collegati (carichi o scarichi)."); return; }
    if (!window.confirm(`Eliminare ${f.nome}?`)) return;
    try {
      await deleteDoc(doc(db,"fornitori",f.id));
      const operationId = createOperationId();

await scriviLog({
  operationId,
  pagina: "GestioneControparti",
  evento: "ELIMINA_CONTROPARTE",
  tipo: "DELETE",
  collezioneRef: "fornitori",
  documentoId: f.id,
  before: {
    nome: f.nome,
    indirizzo: f.indirizzo,
    piva_cf: f.piva_cf
  },
  after: null,
  utente: getUtenteReact(),
  ripristinabile: true
});
      loadData();
    } catch(e){ setErrori(prev=>[...prev,e.message]); }
  };

  // ---------------- RESET FILTRI ----------------
  const resetFiltri = () => {
    setTutti(false);
    if(minDataDB && maxDataDB){
      setDal(minDataDB);
      setAl(maxDataDB);
    }
  };


const renderContabilizzazione = (tot, cont) => {
  // Caso 1: 0 / 0 → nero
  if (tot === 0 && cont === 0) {
    return (
      <span style={{ color: "black" }}>
        {tot} / {cont}
      </span>
    );
  }

  // Caso 2: tutto contabilizzato → verde
  if (tot === cont) {
    return (
      <span style={{ color: "green", fontWeight: "bold" }}>
        {tot} / {cont}
      </span>
    );
  }

  // Caso 3: differenza → rosso
  return (
    <span style={{ color: "red", fontWeight: "bold" }}>
      {tot} / {cont}
    </span>
  );
};







let fornitoriOrdinati = [...fornitori];

if (sortConfig.key) {
  fornitoriOrdinati.sort((a, b) => {
    let aVal = "";
    let bVal = "";

    switch (sortConfig.key) {
      case "nome":
        aVal = a.nome || "";
        bVal = b.nome || "";
        break;

      case "indirizzo":
        aVal = a.indirizzo || "";
        bVal = b.indirizzo || "";
        break;

      case "piva":
        aVal = a.piva_cf || "";
        bVal = b.piva_cf || "";
        break;

      case "scarichi":
        aVal = countScarichiTotali(a);
        bVal = countScarichiTotali(b);
        break;

      case "carichi":
        aVal = countCarichiTotali(a);
        bVal = countCarichiTotali(b);
        break;
      
      case "utilePot":
  aVal = calcolaUtilePotenziale(a);
  bVal = calcolaUtilePotenziale(b);
  break;

case "utileCont":
  aVal = calcolaUtileContabilizzato(a);
  bVal = calcolaUtileContabilizzato(b);
  break;


      default:
        return 0;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortConfig.direction === "asc"
        ? aVal - bVal
        : bVal - aVal;
    }

    return sortConfig.direction === "asc"
      ? String(aVal).localeCompare(String(bVal), "it", { numeric: true })
      : String(bVal).localeCompare(String(aVal), "it", { numeric: true });
  });
}

const fornitoriFiltrati = fornitoriOrdinati.filter(f => {
  const scarTot = countScarichiTot(f);
  const carTot = countCarichiTot(f);

  if (escludiPrivato && f.nome === "FORNITORE PRIVATO") return false;

  // Usa SOLO il filtro fornitori (CON_MOV, SENZA_MOV, ecc.)
  if (!passaFiltroFornitori(f)) return false;

  return true;
});


const totalePot = fornitoriFiltrati.reduce(
  (s, f) => s + calcolaUtilePotenziale(f),
  0
);

const totaleCont = fornitoriFiltrati.reduce(
  (s, f) => s + calcolaUtileContabilizzato(f),
  0
);
const handleStampa = async () => {
  if (!fornitoriOrdinati || fornitoriOrdinati.length === 0) {
    alert("Nessuna controparte da stampare");
    return;
  }

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();
  let y = startY + 10;

  pdf.setFontSize(16);
  pdf.text("Movimenti Controparti (Utile Potenziale / Contabilizzato)", 14, y);
  y += 10;

  // 🔵 LEGENDA
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text("Legenda:", 14, y);
  y += 6;

  pdf.setTextColor(0, 128, 0);
  pdf.text("[VERDE]  Contabilizzati (tot = cont)", 14, y);
  y += 6;

  pdf.setTextColor(200, 0, 0);
  pdf.text("[ROSSO]  Da contabilizzare (tot > cont)", 14, y);
  y += 6;

  pdf.setTextColor(0, 0, 0);
  pdf.text("[NERO]   Nessun movimento (0 / 0)", 14, y);
  y += 10;

  // 🔥 FILTRI ATTIVI
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);

  if (!tutti && dal && al) {
    const formatData = d =>
      `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`;

    pdf.text(
      `Periodo: Dal ${formatData(dal)} Al ${formatData(al)}`,
      14,
      y
    );
    y += 8;
  }

  if (escludiPrivato) {
    pdf.setTextColor(150, 0, 0);
    pdf.text("Filtro attivo: Escludi fornitori privati", 14, y);
    y += 8;
  }

  if (filtroStato === "DA_CONT") {
    pdf.setTextColor(150, 0, 0);
    pdf.text("Filtro attivo: Solo da contabilizzare", 14, y);
    y += 8;
  }

  if (filtroStato === "CONT") {
    pdf.setTextColor(0, 120, 0);
    pdf.text("Filtro attivo: Solo contabilizzati", 14, y);
    y += 8;
  }

  pdf.setTextColor(0, 0, 0);

 // 🔥 Filtro movimenti leggibile
const descrMov = {
  "TUTTI": null,
  "CON_MOV": "Solo controparti con movimenti",
  "SENZA_MOV": "Solo controparti senza movimenti",
  "CON_CARICHI": "Solo controparti con carichi",
  "SENZA_CARICHI": "Solo controparti senza carichi",
  "CON_SCARICHI": "Solo controparti con scarichi",
  "SENZA_SCARICHI": "Solo controparti senza scarichi"
};

if (descrMov[filtroFornitori]) {
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Filtro movimenti: ${descrMov[filtroFornitori]}`, 14, y);
  y += 8;
}


  y += 5;

  // 🔥 RIGHE DELLA TABELLA (STESSI FILTRI DELLA UI)
const righe = fornitoriOrdinati
  .filter(f => passaFiltroFornitori(f))   // 🔥 gli stessi della UI
  .map(f => {
    const scarTot = countScarichiTot(f);
    const scarCont = countScarichiCont(f);
    const carTot = countCarichiTot(f);
    const carCont = countCarichiCont(f);
    const utilePot = calcolaUtilePotenziale(f);
    const utileCont = calcolaUtileContabilizzato(f);

    return [
      f.nome,
      f.indirizzo || "-",
      f.piva_cf || "-",
      `${scarTot} / ${scarCont}`,
      `${carTot} / ${carCont}`,
      utilePot.toLocaleString("it-IT", { minimumFractionDigits: 2 }),
      utileCont.toLocaleString("it-IT", { minimumFractionDigits: 2 })
    ];
  })

  // 🔥 TABELLA PDF
  autoTable(pdf, {
    startY: y,
    head: [[
      "Nome",
      "Indirizzo",
      "P.IVA / CF",
      "Scarichi (cont.)",
      "Carichi (cont.)",
      "Utile Potenziale",
      "Utile Contabilizzato"
    ]],
    body: righe,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [230, 230, 230] }
  });

  let yFinal = pdf.lastAutoTable.finalY + 10;

  // 🔥 TOTALI FINALI
  const totalePot = fornitoriOrdinati
    .filter(f => passaFiltroFornitori(f))
    .reduce((s, f) => s + calcolaUtilePotenziale(f), 0);

  const totaleCont = fornitoriOrdinati
    .filter(f => passaFiltroFornitori(f))
    .reduce((s, f) => s + calcolaUtileContabilizzato(f), 0);

  pdf.setFontSize(12);
  pdf.setTextColor(totalePot >= 0 ? 0 : 200, totalePot >= 0 ? 128 : 0, 0);
  pdf.text(
    `Totale Utile Potenziale: ${totalePot.toLocaleString("it-IT", {
      minimumFractionDigits: 2
    })} €`,
    14,
    yFinal
  );

  yFinal += 8;

  pdf.setTextColor(totaleCont >= 0 ? 0 : 200, totaleCont >= 0 ? 128 : 0, 0);
  pdf.text(
    `Totale Utile Contabilizzato: ${totaleCont.toLocaleString("it-IT", {
      minimumFractionDigits: 2
    })} €`,
    14,
    yFinal
  );

  await salvaESharePdfCapacitor(pdf, "controparti.pdf");
};

  return (
    <div className="gestione-scarichi-container">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={goDashboard}>🏠 Dashboard</button>
      <button onClick={handleLogout}>
  🚪Logout ({getUtenteReact()})
</button>
        <button onClick={handleStampa} style={{marginLeft:10}}>🖨️ Stampa</button>
      </div>

     <h2>Gestione Controparti</h2>
     <div style={{
  display: "flex",
  alignItems: "center",
  gap: "20px",
  marginBottom: 15
}}>
  
  <button onClick={aggiungiFornitore}>➕ Aggiungi Controparte</button>

  <button onClick={() => setShowMergeUI(!showMergeUI)}>
    🔀 Fusione Societaria
  </button>

  <div style={{ display: "flex", flexDirection: "column", marginLeft: "20px" }}>
    <span style={{ color: "red", fontWeight: "bold" }}>🔴 Da Contabilizzare</span>
    <span style={{ color: "green", fontWeight: "bold" }}>🟢 Contabilizzati</span>
  </div>

</div>


{showMergeUI && (
  <div style={{border:"1px solid #ccc", padding:15, marginTop:15}}>
    
    <h4>Fusione Controparti</h4>

<Select
  value={fornitoriOptions.find(o => o.value === merge1) || null}
  onChange={(opt) => setMerge1(opt?.value || "")}
  options={fornitoriOptions}
  placeholder="Seleziona Controparte 1"
/>

<div style={{ marginTop: 10 }}>
  <Select
    value={fornitoriOptions.find(o => o.value === merge2) || null}
    onChange={(opt) => setMerge2(opt?.value || "")}
    options={fornitoriOptions}
    placeholder="Seleziona Controparte 2"
/>
</div>
{merge1 && merge2 && merge1 === merge2 && (
  <div style={{color:"red", marginTop:5}}>
    ⚠️ Hai selezionato la stessa controparte
  </div>
)}
    <div style={{marginTop:10}}>
      <button 
  onClick={() => eseguiFusioneControparti(1)}
  disabled={mergeInvalid}
>
  Fondi mantenendo nome 1
</button>

<button 
  onClick={() => eseguiFusioneControparti(2)} 
  style={{marginLeft:5}}
  disabled={mergeInvalid}
>
  Fondi mantenendo nome 2
</button>

<button 
  onClick={() => eseguiFusioneControparti(3)} 
  style={{marginLeft:5}}
  disabled={mergeInvalid}
>
  Nuovo nome
</button>
    </div>

  </div>
)}
      
      {/* FILTRI */}
      <div style={{marginBottom:15}}>
        <label style={{display:"flex",alignItems:"center"}}>
          <input type="checkbox" checked={tutti} onChange={e=>setTutti(e.target.checked)}/> Disabilita filtro date
        </label>
{/* 🔥 NUOVO FILTRO FORNITORI */}
  <label>
    Filtro Fornitori:
    <select
      value={filtroFornitori}
      onChange={(e) => setFiltroFornitori(e.target.value)}
      style={{ marginLeft: 8 }}
    >
      <option value="TUTTI">TUTTI</option>
      <option value="CON_MOV">CON MOVIMENTI</option>
      <option value="SENZA_MOV">SENZA MOVIMENTI</option>
      <option value="CON_CARICHI">CON CARICHI</option>
      <option value="SENZA_CARICHI">SENZA CARICHI</option>
      <option value="CON_SCARICHI">CON SCARICHI</option>
      <option value="SENZA_SCARICHI">SENZA SCARICHI</option>
    </select>
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
  <input
    type="checkbox"
    checked={escludiPrivato}
    onChange={(e) => setEscludiPrivato(e.target.checked)}
  />
  Escludi FORNITORE PRIVATO
</label>

  </label>
  <label style={{ marginLeft: 20 }}>
  Stato:
  <select
    value={filtroStato}
    onChange={(e) => setFiltroStato(e.target.value)}
    style={{ marginLeft: 8 }}
  >
    <option value="TUTTI">Tutti</option>
    <option value="DA_CONT">Da contabilizzare</option>
    <option value="CONT">Contabilizzati</option>
  </select>
</label>

        {!tutti && (
          <div style={{display:"flex", gap:"12px", marginTop:"8px"}}>
            <label>
              Dal:
              <DatePicker
                selected={dal}
                onChange={(date) => setDal(date)}
                minDate={minDataDB || new Date(2000,0,1)}
                maxDate={al || maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>

            <label>
              Al:
              <DatePicker
                selected={al}
                onChange={(date) => setAl(date)}
                minDate={dal || minDataDB || new Date(2000,0,1)}
                maxDate={maxDataDB || new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/yyyy"
              />
            </label>
          </div>
        )}


      </div>

      <table className="tabella-scarichi">
        <thead>
  <tr>
    <th onClick={() => requestSort("nome")} style={{cursor:"pointer"}}>
      Nome {sortConfig.key==="nome" ? (sortConfig.direction==="asc"?"⬆️":"⬇️") : ""}
    </th>

    <th onClick={() => requestSort("indirizzo")} style={{cursor:"pointer"}}>
      Indirizzo {sortConfig.key==="indirizzo" ? (sortConfig.direction==="asc"?"⬆️":"⬇️") : ""}
    </th>

    <th onClick={() => requestSort("piva")} style={{cursor:"pointer"}}>
      P.IVA / CF {sortConfig.key==="piva" ? (sortConfig.direction==="asc"?"⬆️":"⬇️") : ""}
    </th>

    <th onClick={() => requestSort("scarichi")} style={{cursor:"pointer"}}>
      Scarichi {sortConfig.key==="scarichi" ? (sortConfig.direction==="asc"?"⬆️":"⬇️") : ""}
    </th>

    <th onClick={() => requestSort("carichi")} style={{cursor:"pointer"}}>
      Carichi {sortConfig.key==="carichi" ? (sortConfig.direction==="asc"?"⬆️":"⬇️") : ""}
    </th>
<th onClick={() => requestSort("utilePot")} style={{cursor:"pointer"}}>
  Utile Potenziale
</th>

<th onClick={() => requestSort("utileCont")} style={{cursor:"pointer"}}>
  Utile Contabilizzato
</th>

    <th>Azioni</th>
  </tr>
</thead>
<tbody>
 {fornitoriOrdinati
  .filter(f => passaFiltroFornitori(f))
  .map(f => {
const scarTot = countScarichiTot(f);
const scarCont = countScarichiCont(f);

const carTot = countCarichiTot(f);
const carCont = countCarichiCont(f);

    const tot = countScarichiTotali(f) + countCarichiTotali(f);
const utilePot = calcolaUtilePotenziale(f);
const utileCont = calcolaUtileContabilizzato(f);

    return (
      <tr key={f.id}>
        <td><b>{f.nome}</b></td>
        <td>{f.indirizzo || "-"}</td>
        <td>{f.piva_cf || "-"}</td>

      <td>{renderContabilizzazione(scarTot, scarCont)}</td>
<td>{renderContabilizzazione(carTot, carCont)}</td>


<td style={{ color: utilePot >= 0 ? "green" : "red" }}>
  {utilePot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
</td>

<td style={{ color: utileCont >= 0 ? "green" : "red" }}>
  {utileCont.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
</td>

        <td>
        <button onClick={() => safeRenameControparte(f)}>
  ✏️ Rename
</button>
          <button onClick={() => modificaFornitore(f)}>
            Modifica
          </button>

          {tot === 0 ? (
            <button
              onClick={() => eliminaFornitore(f)}
              style={{ marginLeft: 5, background: "red", color: "white" }}
            >
              Elimina
            </button>
          ) : (
            <button disabled style={{ marginLeft: 5 }}>
              Non eliminabile
            </button>
          )}

          {/* <button onClick={() => debugControparte(f)}>DEBUG</button>
<button onClick={() => debugCarichiCompleti(f)}>DEBUG CARICHI</button>
<button onClick={debugMovimenti}>DEBUG MOVIMENTI</button> */}

        </td>
      </tr>
    );
  })}
</tbody>
      </table>
<div style={{ marginTop: 20, fontSize: "1.2rem" }}>
  <b>Totale utile potenziale:</b>{" "}
  <span style={{ color: totalePot >= 0 ? "green" : "red" }}>
    {totalePot.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
  </span>
</div>

<div style={{ marginTop: 10, fontSize: "1.2rem" }}>
  <b>Totale utile contabilizzato:</b>{" "}
  <span style={{ color: totaleCont >= 0 ? "green" : "red" }}>
    {totaleCont.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
  </span>
</div>


      {errori.length>0 && <div style={{color:"red",marginTop:20}}>{errori.join("\n")}</div>}
    </div>
  );
};

export default GestioneContropartiAvanzata;