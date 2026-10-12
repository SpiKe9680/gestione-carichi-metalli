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

const [showMergeUI, setShowMergeUI] = useState(false);
const [merge1, setMerge1] = useState("");
const [merge2, setMerge2] = useState("");

const mergeInvalid = !merge1 || !merge2 || merge1 === merge2;
const safeDate = (d) => {
  if (!d) return null;

  if (typeof d.toDate === "function") return d.toDate(); // Firestore Timestamp
  if (d instanceof Date) return d; // già JS Date

  return null;
};
const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
  const [fornitori, setFornitori] = useState([]);
  const [modalControparte, setModalControparte] = useState({
  aperta: false,
  modalita: null,
  id: null
});

const [formControparte, setFormControparte] = useState({
  nome: "",
  indirizzo: "",
  numeroCivico: "",
  cap: "",
  comune: "",
  provincia: "",
  nazione: "IT",
  telefono: "",
  email: "",
  piva: "",
  codiceFiscale: "",
  codiceDestinatario: "",
  pec: ""
});
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

// ---------------- COUNT CARICHI TOTALI ----------------
const countCarichiTotali = (fornitore) => {
  return carichi.filter(c => c.fornitore === fornitore.nome).length;
};
  const countScarichiTotali = (fornitore) => {
    return scarichi.filter(s => s.fornitore === fornitore.nome).length;
  };
  useEffect(() => {
    if (minDataDB && maxDataDB) {
      setDal(minDataDB);
      setAl(maxDataDB);
    }
  }, [minDataDB, maxDataDB]);

const handleApriFormNuovoFornitore = () => {
  setFormControparte({
    nome: "",
    indirizzo: "",
    numeroCivico: "",
    cap: "",
    comune: "",
    provincia: "",
    nazione: "IT",
    telefono: "",
    email: "",
    piva: "",
    codiceFiscale: "",
    codiceDestinatario: "",
    pec: ""
  });

  setModalControparte({
    aperta: true,
    modalita: "nuova",
    id: null
  });
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
 const modificaFornitore = (f) => {
  setFormControparte({
    nome: f.nome || "",
    indirizzo: f.indirizzo || "",
    numeroCivico: f.numeroCivico || "",
    cap: f.cap || "",
    comune: f.comune || "",
    provincia: f.provincia || "",
    nazione: f.nazione || "IT",
    telefono: f.telefono || "",
    email: f.email || "",
    piva: f.piva || "",
    codiceFiscale: f.codiceFiscale || "",
    codiceDestinatario:
      f.codiceDestinatario ||
      f["Cod.destinatario"] ||
      "",
    pec: f.pec || ""
  });

  setModalControparte({
    aperta: true,
    modalita: "modifica",
    id: f.id
  });
};
const visualizzaControparte = (f) => {
  setFormControparte({
    nome: f.nome || "",
    indirizzo: f.indirizzo || "",
    numeroCivico: f.numeroCivico || "",
    cap: f.cap || "",
    comune: f.comune || "",
    provincia: f.provincia || "",
    nazione: f.nazione || "IT",
    telefono: f.telefono || "",
    email: f.email || "",
    piva: f.piva || "",
    codiceFiscale: f.codiceFiscale || "",
    codiceDestinatario:
      f.codiceDestinatario ||
      f["Cod.destinatario"] ||
      "",
    pec: f.pec || ""
  });

  setModalControparte({
    aperta: true,
    modalita: "visualizza",
    id: f.id
  });
};const salvaControparte = async () => {
  try {
    const nome = formControparte.nome.trim();

    if (!nome) {
      alert("❌ Il nome della controparte è obbligatorio");
      return;
    }

    const nomeKey = nome.toLowerCase();

    const duplicato = fornitori.find(
      (f) =>
        f.id !== modalControparte.id &&
        (f.nome || "").trim().toLowerCase() === nomeKey
    );

    if (duplicato) {
      alert(
        "⚠️ Esiste già una controparte con questo nome"
      );
      return;
    }

    const dati = {
      nome,

      indirizzo:
        formControparte.indirizzo.trim(),

      numeroCivico:
        formControparte.numeroCivico.trim(),

      cap:
        formControparte.cap.trim(),

      comune:
        formControparte.comune.trim(),

      provincia:
        formControparte.provincia
          .trim()
          .toUpperCase(),

      nazione:
        (
          formControparte.nazione ||
          "IT"
        )
          .trim()
          .toUpperCase(),

      telefono:
        formControparte.telefono.trim(),

      email:
        formControparte.email.trim(),

      piva:
        formControparte.piva
          .trim()
          .toUpperCase(),

      codiceFiscale:
        formControparte.codiceFiscale
          .trim()
          .toUpperCase(),

      codiceDestinatario:
        formControparte.codiceDestinatario
          .trim()
          .toUpperCase(),

      pec:
        formControparte.pec.trim(),

      /*
       * Manteniamo il vecchio campo per
       * compatibilità con il gestionale.
       */
      piva_cf:
        formControparte.piva.trim() ||
        formControparte.codiceFiscale.trim()
    };

    let refId = modalControparte.id;
    let before = null;

    if (modalControparte.modalita === "modifica") {
      const f = fornitori.find(
        (x) => x.id === modalControparte.id
      );

      before = f || null;

      await updateDoc(
        doc(
          db,
          "fornitori",
          modalControparte.id
        ),
        dati
      );

      await scriviLog({
        operationId: createOperationId(),
        pagina: "GestioneControparti",
        evento: "CONTROPARTE_UPDATE",
        tipo: "UPDATE",
        collezioneRef: "fornitori",
        documentoId: modalControparte.id,
        before,
        after: dati,
        utente: getUtenteReact(),
        ripristinabile: true
      });

    } else {
      const ref = await addDoc(
        collection(db, "fornitori"),
        dati
      );

      refId = ref.id;

      await scriviLog({
        operationId: createOperationId(),
        pagina: "GestioneControparti",
        evento: "CONTROPARTE_CREATE",
        tipo: "CREATE",
        collezioneRef: "fornitori",
        documentoId: refId,
        before: null,
        after: dati,
        utente: getUtenteReact(),
        ripristinabile: true
      });
    }

    await loadData();

    const returnPage =
      localStorage.getItem(
        "scaricoReturnPage"
      );

    localStorage.setItem(
      "nuovoFornitore",
      nome
    );

    setModalControparte({
      aperta: false,
      modalita: null,
      id: null
    });

    if (returnPage === "/scarichi") {
      localStorage.removeItem(
        "scaricoReturnPage"
      );

      window.location.href =
        `/scarichi?newFornitore=${encodeURIComponent(nome)}`;

      return;
    }

    alert(
      `✅ Controparte "${nome}" salvata correttamente`
    );

  } catch (e) {
    console.error(
      "❌ ERRORE SALVATAGGIO CONTROPARTE:",
      e
    );

    setErrori((prev) => [
      ...prev,
      e.message || String(e)
    ]);

    alert(
      "❌ Errore durante il salvataggio della controparte"
    );
  }
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

  // ---------------- STAMPA ----------------
const handleStampa = async () => {
  if (!fornitori || fornitori.length === 0)
    return alert("Nessuna controparte da stampare");

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../utils/dateUtils");

  const { pdf, startY } = await PdfHeader();

  let y = startY + 10;

  pdf.setFontSize(16);
  pdf.text("Movimenti Controparti (Scarichi/Carichi)", 14, y);
  y += 10;

  // 🔥 FIX: stampa SEMPRE se filtro NON disabilitato
  if (!tutti) {
    const formatData = (d) => {
      if (!d) return "";
      return `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`;
    };

    const dalTxt = formatData(dal);
    const alTxt = formatData(al);

    if (dalTxt || alTxt) {
      const label = `Dal ${dalTxt || "..."} Al ${alTxt || "..."}`;
      pdf.setFontSize(11);
      pdf.text(label, 14, y);
      y += 8;
    }
  }

  const righe = fornitori.map((f) => {
    const scarichi = countScarichi(f);
    const carichi = countCarichi(f);



    return [
      f.nome || "",
      f.indirizzo || "-",
      f.piva_cf || "-",
      scarichi,
      carichi,
    ];
  });

  autoTable(pdf, {
    startY: y,
    head: [["Nome", "Indirizzo", "P.IVA / CF", "Scarichi", "Carichi"]],
    body: righe,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [230, 230, 230] },
  });

  
   await salvaESharePdfCapacitor(pdf, "controparti.pdf");
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
     <button onClick={aggiungiFornitore} style={{marginBottom:15}}>➕ Aggiungi Controparte</button>
      
      <button onClick={() => setShowMergeUI(!showMergeUI)} style={{marginLeft:10}}>
  🔀 Fusione Societaria
</button>

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

    <th>Azioni</th>
  </tr>
</thead>
<tbody>
  {fornitoriOrdinati.map(f => {
    const n = countScarichi(f);
    const nc = countCarichi(f);
    const tot = countScarichiTotali(f) + countCarichiTotali(f);

    return (
      <tr key={f.id}>
        <td><b>{f.nome}</b></td>
        <td>
  {[
    f.indirizzo,
    f.numeroCivico,
    f.cap,
    f.comune,
    f.provincia
  ]
    .filter(Boolean)
    .join(" ") || "-"}
</td>
     <td>
  {f.piva ||
    f.codiceFiscale ||
    f.piva_cf ||
    "-"}
</td>

        <td style={{ color: n > 0 ? "red" : "inherit" }}>
          {n}
        </td>

        <td style={{ color: nc > 0 ? "green" : "inherit" }}>
          {nc}
        </td>

   <td>
  <button
    onClick={() => visualizzaControparte(f)}
  >
    👁️ Dati
  </button>

  <button
    onClick={() => safeRenameControparte(f)}
  >
    ✏️ Rename
  </button>

  <button
    onClick={() => modificaFornitore(f)}
  >
    Modifica
  </button>

  ...
</td>
      </tr>
    );
  })}
</tbody>
      </table>

      {errori.length>0 && <div style={{color:"red",marginTop:20}}>{errori.join("\n")}</div>}

{modalControparte.aperta && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 99999
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "white",
        padding: 20,
        borderRadius: 10,
        width: "700px",
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
      }}
    >
      <h2>
        {modalControparte.modalita === "nuova"
          ? "➕ Nuova Controparte"
          : modalControparte.modalita === "modifica"
          ? "✏️ Modifica Controparte"
          : "👁️ Dati Controparte"}
      </h2>

      <h3>Dati anagrafici</h3>

      <div style={{ marginBottom: 10 }}>
        <label>Nome / Ragione Sociale:</label>
        <br />
        <input
          type="text"
          value={formControparte.nome}
          readOnly={
            modalControparte.modalita === "visualizza"
          }
          onChange={(e) =>
            setFormControparte((prev) => ({
              ...prev,
              nome: e.target.value
            }))
          }
          style={{ width: "100%" }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 180px",
          gap: 10,
          marginBottom: 10
        }}
      >
        <div>
          <label>Indirizzo:</label>
          <br />
          <input
            type="text"
            value={formControparte.indirizzo}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                indirizzo: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Numero civico:</label>
          <br />
          <input
            type="text"
            value={formControparte.numeroCivico}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                numeroCivico: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "120px 1fr 100px 100px",
          gap: 10,
          marginBottom: 10
        }}
      >
        <div>
          <label>CAP:</label>
          <br />
          <input
            type="text"
            value={formControparte.cap}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                cap: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Comune:</label>
          <br />
          <input
            type="text"
            value={formControparte.comune}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                comune: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Provincia:</label>
          <br />
          <input
            type="text"
            value={formControparte.provincia}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                provincia: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Nazione:</label>
          <br />
          <input
            type="text"
            value={formControparte.nazione}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                nazione: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 20
        }}
      >
        <div>
          <label>Telefono:</label>
          <br />
          <input
            type="text"
            value={formControparte.telefono}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                telefono: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>E-mail:</label>
          <br />
          <input
            type="email"
            value={formControparte.email}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                email: e.target.value
              }))
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <h3>Dati fiscali / SDI</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 10
        }}
      >
        <div>
          <label>Partita IVA:</label>
          <br />
          <input
            type="text"
            value={formControparte.piva}
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                piva:
                  e.target.value.toUpperCase()
              }))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Codice fiscale:</label>
          <br />
          <input
            type="text"
            value={
              formControparte.codiceFiscale
            }
            readOnly={
              modalControparte.modalita === "visualizza"
            }
            onChange={(e) =>
              setFormControparte((prev) => ({
                ...prev,
                codiceFiscale:
                  e.target.value.toUpperCase()
              }))
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Codice destinatario:</label>
        <br />
        <input
          type="text"
          value={
            formControparte.codiceDestinatario
          }
          readOnly={
            modalControparte.modalita === "visualizza"
          }
          onChange={(e) =>
            setFormControparte((prev) => ({
              ...prev,
              codiceDestinatario:
                e.target.value.toUpperCase()
            }))
          }
          maxLength={7}
          style={{
            width: "250px",
            textTransform: "uppercase"
          }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>PEC:</label>
        <br />
        <input
          type="email"
          value={formControparte.pec}
          readOnly={
            modalControparte.modalita === "visualizza"
          }
          onChange={(e) =>
            setFormControparte((prev) => ({
              ...prev,
              pec: e.target.value
            }))
          }
          style={{ width: "100%" }}
        />
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          gap: 10
        }}
      >
        {modalControparte.modalita !==
          "visualizza" && (
          <button onClick={salvaControparte}>
            💾 Salva
          </button>
        )}

        <button
          onClick={() =>
            setModalControparte({
              aperta: false,
              modalita: null,
              id: null
            })
          }
        >
          ❌ Chiudi
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default GestioneContropartiAvanzata;