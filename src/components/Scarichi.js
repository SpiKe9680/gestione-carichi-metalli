// src/components/Scarichi.js

import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { scriviLog } from "../utils/log";
import "./Scarichi.css";
import { useNavigate } from "react-router-dom";
import DatePicker, { registerLocale } from "react-datepicker";
import { it } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {  PdfHeader } from "../utils/dateUtils";
registerLocale("it", it);
const mesiItaliani = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];


const Scarichi = ({ logout, role, goToDashboard }) => {
const [activeUser, setactiveUser] = useState(() => {
  return JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
});
const [isEditing, setIsEditing] = useState(false);
const handleGoToDashboard = () => {
  if (goToDashboard) goToDashboard();
  else navigate("/admin");
};
const [snapshotIniziale, setSnapshotIniziale] = useState(null);
  const [firExists, setFirExists] = useState(false);
const [firCheckLoading, setFirCheckLoading] = useState(false);
 const [tipoMovimento, setTipoMovimento] = useState("scarico");
  const navigate = useNavigate();
  const getLogUser = () => {
  const u =
    activeUser?.username ||
    authUser?.username ||
    JSON.parse(sessionStorage.getItem("utenteLoggato"))?.username;

  return u || authUser?.email || "Sconosciuto";
};
  const [fornitori, setFornitori] = useState([]);
  const [listini, setListini] = useState([]);
  const [materiali, setMateriali] = useState([]);
  const [firCer, setFirCer] = useState("");
  const [selectedFornitore, setSelectedFornitore] = useState("");
  const [selectedListino, setSelectedListino] = useState("");
  const [selectedCer, setSelectedCer] = useState("");
  const [selectedMateriale, setSelectedMateriale] = useState("");
  const [peso, setPeso] = useState("");
  const [calo, setCalo] = useState("");
const [authUser, setAuthUser] = useState(null);
const [scarico, setScarico] = useState([]);
const [fotoFile, setFotoFile] = useState([]);
const removeFoto = (index) => {
  setPreviewFoto(prev => prev.filter((_, i) => i !== index));
  setFotoFile(prev => prev.filter((_, i) => i !== index));

  setDirty(true); // 🔥 FIX: abilita autosave e salvataggio
};
const utenteLoggato = getLogUser() || activeUser?.email;
const [previewFoto, setPreviewFoto] = useState([]);
const [lockDraftSync, setLockDraftSync] = useState(false);
const [activeUserRole, setactiveUserRole] = useState(null);
const [docIdOriginale, setDocIdOriginale] = useState(null);
  const [usaOra, setUsaOra] = useState(true);
  const [dataScaricoStr, setDataScaricoStr] = useState("");
  const [oraStr, setOraStr] = useState("");

  const [userEmail, setUserEmail] = useState(null);

  const formattaDataItaliana = (date) => {
    const gg = String(date.getDate()).padStart(2, "0");
    const mese = mesiItaliani[date.getMonth()];
    const yyyy = date.getFullYear();
    return `${gg} ${mese} ${yyyy}`;
  };

  const formattaOra24 = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

 const inizializzatoRef = React.useRef(false);
const [listinoValid, setListinoValid] = useState(true);
useEffect(() => {
  if (inizializzatoRef.current) return;

  if (!dataScaricoStr && !oraStr && usaOra) {
    const now = new Date();
    setDataScaricoStr(formattaDataItaliana(now));
    setOraStr(formattaOra24(now));
  }

  inizializzatoRef.current = true;
}, [usaOra, dataScaricoStr, oraStr]);
useEffect(() => {
  console.log("Ruolo utente corrente: ", activeUserRole);
}, [activeUserRole]);

useEffect(() => {
  const syncQueue = async () => {
    try {
      const snap = await getDocs(collection(db, "scarichi_images_queue"));

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        if (data.uploaded) continue;

        try {
          // riconversione base64 → file
          const res = await fetch(data.fileData);
          const blob = await res.blob();

          const file = new File([blob], data.fileName, {
            type: data.fileType
          });

          const url = await uploadSistema3Parti(file);

          // aggiorna scarico collegato (OPZIONALE)
          await setDoc(doc(db, "scarichi", data.docTempId), {
            fotoURL: arrayUnion(url)
          }, { merge: true });

          await setDoc(doc(db, "scarichi_images_queue", docSnap.id), {
            uploaded: true,
            url
          }, { merge: true });

        } catch (err) {
          console.warn("Retry upload fallito", err);
        }
      }
    } catch (e) {
      console.error("Queue sync error", e);
    }
  };

  const interval = setInterval(syncQueue, 30000); // ogni 30 sec
  syncQueue();

  return () => clearInterval(interval);
}, []);
useEffect(() => {
  if (isEditing) {
    setFirExists(false);
    return;
  }

  if (!firCer || firCer.trim() === "") {
    setFirExists(false);
    return;
  }

const timeout = setTimeout(async () => {
  try {
    setFirCheckLoading(true);

    const fir = firCer.trim().toUpperCase();
    const normalize = (v) => (v || "").toString().trim().toUpperCase();

    let exists = false;

    const checkDocs = (docs) => {
      for (const snap of docs) {
        const data = snap.data();

        if (data.inModifica) continue;

        const blocchi = data.scarico || data.carico || [];

        for (const c of blocchi) {
          if (normalize(c.fir) !== fir) continue;

          // 🔥 UNICA ECCEZIONE: documento corrente
         if (docIdOriginale && snap.id === docIdOriginale) continue;

          exists = true;
          return;
        }
      }
    };

    const [scarichiSnap, carichiSnap] = await Promise.all([
      getDocs(collection(db, "scarichi")),
      getDocs(collection(db, "carichi")),
    ]);

    checkDocs(scarichiSnap.docs);
    if (!exists) checkDocs(carichiSnap.docs);

    setFirExists(exists);

  } catch (err) {
    console.error("Errore check FIR:", err);
  } finally {
    setFirCheckLoading(false);
  }
}, 300);

  return () => clearTimeout(timeout);
}, [firCer, docIdOriginale, isEditing]);

useEffect(() => {
  console.log("🟡 EDIT MODE:", {
    isEditing,
    docIdOriginale,
    selectedCer,
    firCer
  });
}, [isEditing, docIdOriginale, selectedCer, firCer]);
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (!user) {
      setAuthUser(null);
      setUserEmail(null);
      return;
    }

    setAuthUser({
      email: user.email,
      uid: user.uid,
    });

    setUserEmail(user.email);
  });

  return () => unsubscribe();
}, []);


useEffect(() => {
  if (!activeUser?.email && !getLogUser()) {
    setactiveUserRole("operatore");
    return;
  }

  setactiveUserRole(activeUser?.ruolo || "operatore");
}, [activeUser]);

useEffect(() => {
  if (isEditing) return;

  if (!selectedCer) return;

  const cerEsistente = scarico.find(
    c => c.cer === selectedCer
  );

  if (cerEsistente?.fir && !firCer) {
    setFirCer(cerEsistente.fir);
  }
}, [selectedCer]);
const prevImgRef = React.useRef({
  files: 0,
  preview: 0
});

useEffect(() => {
  // evita trigger iniziale inutile
  if (isEditing && !docIdOriginale) return;

  const fLen = fotoFile?.length || 0;
  const pLen = previewFoto?.length || 0;

  const prev = prevImgRef.current;

  if (prev.files !== fLen || prev.preview !== pLen) {
    setDirty(true);
  }

  prevImgRef.current = {
    files: fLen,
    preview: pLen
  };
}, [fotoFile, previewFoto]);
  const handleUsaOraChange = (e) => {
    const checked = e.target.checked;
    setUsaOra(checked);
    const now = new Date();
    if (checked) {
      setDataScaricoStr(formattaDataItaliana(now));
      setOraStr(formattaOra24(now));
    } else {
      setDataScaricoStr("");
      setOraStr("");
    }
    setDirty(true); // 🔥 FIX: modifica data/ora = modifica reale
  };


const parseDataOra = (dataStr, oraStr) => {
  if (!dataStr) return null;

  const [gg, meseStr, yyyy] = dataStr.split(" ");
  const mm = mesiItaliani.indexOf(meseStr);
  if (mm < 0) return null;

  const d = new Date(Number(yyyy), mm, Number(gg));

  if (oraStr) {
    const [hh, min] = oraStr.split(":").map(Number);
    if (!isNaN(hh) && !isNaN(min)) {
      d.setHours(hh, min, 0, 0);
    }
  }

  return d;
};
const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
// --- AUTOSAVE BOZZA SCARICO ---
const salvaBozza = async () => {
  try {
    const utenteId = getLogUser();
    if (!utenteId) return;

    const draftRef = doc(db, "scarichi_draft", utenteId);

    await setDoc(draftRef, {
      carico: tipoMovimento === "carico" ? scarico : [],
      scarico: tipoMovimento === "scarico" ? scarico : [],
      fornitore: selectedFornitore || "",
      listino: selectedListino || "",
      tipoMovimento,
      firCer: firCer || "",
      selectedCer: selectedCer || "",
      utente: utenteLoggato,
      dataScaricoStr,
      oraStr,
      data: dataScaricoStr && oraStr ? parseDataOra(dataScaricoStr, oraStr) : null,

      // ❌ FIX IMPORTANTE: NON salvare blob preview
      fotoURL: [],

      inModifica: true,
      updatedAt: serverTimestamp(),
      originalFir: firCer || "",
      originalDocId: docIdOriginale || null
    }, { merge: true });

  } catch (e) {
    console.error("Errore salvaBozza:", e);
  }
};
const [uploadingImages, setUploadingImages] = useState(false);
useEffect(() => {
  if (!activeUser && !authUser) return;

  const fetchData = async () => {
    if (isEditing && docIdOriginale) return;
    try {
      const [fornSnap, listSnap, matSnap] = await Promise.all([
        getDocs(collection(db, "fornitori")),
        getDocs(collection(db, "listini")),
        getDocs(collection(db, "materiali")),
      ]);

      setFornitori(fornSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setListini(listSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMateriali(matSnap.docs.map(d => ({ id: d.id, ...d.data() })));
console.log(
  "LISTINI NORMALIZZATI:",
  listSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }))
);
      const utenteId = getLogUser();
      if (!utenteId) return;

     const draftRef = doc(db, "scarichi_draft", utenteId);
const draftSnap = await getDoc(draftRef);

// 🔥 BLOCCO TOTALE DRAFT IN MODIFICA
if (isEditing || docIdOriginale) {
  console.log("⛔ Draft ignorato in modalità modifica");
  return;
}

if (!draftSnap.exists()) return;

const d = draftSnap.data();
      console.log("📦 DRAFT CARICATO:", {
  inModifica: d.inModifica,
  docIdOriginale: d.docIdOriginale,
  docId: d.docId,
  firCer: d.firCer,
  scarico: d.scarico?.length,
  carico: d.carico?.length
});

      // =========================
      // TIPO MOVIMENTO (UNICO FALLBACK)
      // =========================
      const tipo =
        d.tipoMovimento ||
        (d.carico ? "carico" : "scarico");

      if (!lockDraftSync) {
  setTipoMovimento(tipo);
}

      // =========================
      // FORNITORE / LISTINO
      // =========================
      setSelectedFornitore(d.fornitore || "");
      setSelectedListino(prev => prev || d.listino || "");

      // =========================
      // FIR / CER
      // =========================
     if (!isEditing && !docIdOriginale) {
  setFirCer(d.firCer || "");
}
      setSelectedCer(d.selectedCer || "");

      // =========================
      // BLOCCO MOVIMENTO (ROBUSTO)
      // =========================
      let blocchi = [];

      if (Array.isArray(d.scarico) && tipo === "scarico") {
        blocchi = d.scarico;
      } else if (Array.isArray(d.carico) && tipo === "carico") {
        blocchi = d.carico;
      } else if (Array.isArray(d.scarico)) {
        blocchi = d.scarico;
      } else if (Array.isArray(d.carico)) {
        blocchi = d.carico;
      }

   if (!isEditing || !docIdOriginale) {
  setScarico(
    blocchi.map(c => ({
      cer: c.cer || "",
      fir: c.fir || "",
      righe: Array.isArray(c.righe)
        ? c.righe.map(r => ({
            materiale: r.materiale || "",
            peso: Number(r.peso || 0),
            calo: Number(r.calo || 0),
            netto: Number(r.netto || 0),
            prezzoVendita: Number(r.prezzoVendita || 0),
            prezzoAcquisto: Number(r.prezzoAcquisto || 0),
          }))
        : [],
      totaleCer: Number(c.totaleCer || 0),
    }))
  );
}

      // =========================
      // DATA / ORA
      // =========================
      if (d.data) {
  const dateObj = d.data.toDate();

  setDataScaricoStr(formattaDataItaliana(dateObj));
  setOraStr(formattaOra24(dateObj));
  setUsaOra(false);
} else {
  setDataScaricoStr(d.dataScaricoStr || "");
  setOraStr(d.oraStr || "");
  setLockDraftSync(false);
}

// FOTO
const foto = Array.isArray(d.fotoURL)
  ? d.fotoURL
  : d.fotoURL
    ? [d.fotoURL]
    : [];

// 🔥 FIX: NON sovrascrivere se sei in editing con nuove foto locali
setPreviewFoto(prev => {
  // se stai già aggiungendo foto nuove, NON sovrascrivere
  if (fotoFile.length > 0 || prev.some(p => p.startsWith("blob:"))) {
    return prev;
  }
  return foto;
});

// 🔥 NON azzerare mai fotoFile in edit attivo
setFotoFile(prev => {
  if (prev.length > 0) return prev;
  return [];
});

      // =========================
      // USER
      // =========================
      setactiveUser(prev => ({
        ...prev,
        username: d.utente || prev.username
      }));

      // =========================
      // DOC ID
      // =========================
      setDocIdOriginale(d.docIdOriginale || d.docId || null);
if (!isEditing && !docIdOriginale) {
  setFirCer(d.firCer || "");
}      // =========================
      // SNAPSHOT STABILE
      // =========================
      const frozen = {
        fornitore: d.fornitore || "",
        listino: d.listino || "",
        tipo,

        scarico: blocchi.map(c => ({
          cer: c.cer,
          fir: c.fir,
          totaleCer: c.totaleCer || 0,
          righe: (c.righe || []).map(r => ({
            materiale: r.materiale,
            peso: r.peso,
            calo: r.calo,
            netto: r.netto,
            prezzoVendita: r.prezzoVendita,
            prezzoAcquisto: r.prezzoAcquisto
          }))
        })),

        totaleCER: blocchi.reduce((acc, c) => acc + (c.totaleCer || 0), 0)
      };

      setSnapshotIniziale(frozen);

    } catch (err) {
      console.error("Errore fetchData:", err);
    }
  };

  fetchData();
}, [activeUser]);
  const cerDisponibili = [...new Set(materiali.map((m) => m.codiceCER).filter((c) => c))];
  const materialiFiltrati = selectedCer ? materiali.filter((m) => m.codiceCER === selectedCer) : [];
  useEffect(() => {
    if (materialiFiltrati.length === 1) setSelectedMateriale(materialiFiltrati[0].nome);
  }, [selectedCer, materialiFiltrati]);
const listinoUserChangeRef = React.useRef(false);

useEffect(() => {
  if (!selectedListino) return;
  if (listini.length === 0) return;

  const ok = listini.some(l =>
    l.nome === selectedListino &&
    (l.tipoListino || "").trim().toLowerCase() === tipoMovimento.trim().toLowerCase()
  );

  setListinoValid(ok);
}, [selectedListino, listini, tipoMovimento]);
useEffect(() => {
  const nuovoFornitore = localStorage.getItem("nuovoFornitore");

  const savedData = localStorage.getItem("scarico_temp_data");
  const savedOra = localStorage.getItem("scarico_temp_ora");
  const savedUsaOra = localStorage.getItem("scarico_temp_usaOra");

  if (savedData) setDataScaricoStr(savedData);
  if (savedOra) setOraStr(savedOra);

  if (savedUsaOra !== null) {
    setUsaOra(savedUsaOra === "1");
  }

  localStorage.removeItem("scarico_temp_data");
  localStorage.removeItem("scarico_temp_ora");
  localStorage.removeItem("scarico_temp_usaOra");

  if (nuovoFornitore && fornitori.length > 0) {
    const exists = fornitori.find(f => f.nome === nuovoFornitore);

    if (exists) {
      setSelectedFornitore(nuovoFornitore);

      if (exists.predefListino) {
        const listinoAssoc = listini.find(
         l => l.id === exists.predefListino && ((l.tipoListino || "").trim() === tipoMovimento)
        );

        if (listinoAssoc) {
          setSelectedListino(listinoAssoc.nome);
        }
      }
    }

    localStorage.removeItem("nuovoFornitore");
  }
}, [fornitori, listini, tipoMovimento]);
  // --- TRIGGER AUTOSAVE ---
const [dirty, setDirty] = useState(false);
useEffect(() => {
  if (!dirty || uploadingImages) return;

 const timer = setTimeout(() => {
  salvaBozza();
}, 1200);

  return () => clearTimeout(timer);
}, [dirty, fotoFile, previewFoto]);
const handleAdd = () => {
  if (!selectedMateriale || !peso || parseFloat(peso.replace(",", ".")) === 0) return;

  const cer = selectedCer || "SENZA_CER";
  const fir = firCer || "";

  const listinoObj = listini.find(l => l.nome === selectedListino);

  let prezzoVendita = 0;
  let prezzoAcquisto = 0;
  let trovatoNelListino = false;

  if (listinoObj?.prezzi) {
    const key = Object.keys(listinoObj.prezzi).find(
      k => k.toLowerCase().trim() === selectedMateriale.toLowerCase().trim()
    );

    if (key) {
      prezzoVendita = Number(listinoObj.prezzi[key].vendita || 0);
      prezzoAcquisto = Number(listinoObj.prezzi[key].acquisto || 0);
      trovatoNelListino = true;
    }
  }

  if (!trovatoNelListino) {
    const mat = materiali.find(
      m => m.nome.toLowerCase().trim() === selectedMateriale.toLowerCase().trim()
    );

    if (mat) {
      prezzoVendita = Number(mat.prezzoVenditaDefault || 0);
      prezzoAcquisto = Number(mat.prezzoAcquistoDefault || 0);
    }
  }

  const nuovoRigo = {
    materiale: selectedMateriale,
    peso: Number(peso.replace(",", ".")),
    calo: Number(calo?.replace(",", ".") || 0),
    netto: Number(peso.replace(",", ".")) - Number(calo?.replace(",", ".") || 0),
    prezzoVendita,
    prezzoAcquisto
  };

 setScarico(prev => {
  const clean = [...prev].map(c => ({
    ...c,
    righe: [...(c.righe || [])]
  }));

  const idx = clean.findIndex(
    c => c.cer === cer && c.fir === fir
  );

    // se CER non esiste → lo creo
    if (idx === -1) {
      return [
        ...prev,
        {
          cer,
          fir,
          righe: [nuovoRigo],
          totaleCer: nuovoRigo.netto
        }
      ];
    }

    // altrimenti aggiorno CER esistente
const updated = [...prev];

// 🔥 UNA SOLA VARIABILE (niente duplicati)
const cerIdx = updated.findIndex(
  c => c.cer === cer && c.fir === fir
);

const existing = cerIdx !== -1 ? updated[cerIdx] : {
  cer,
  fir,
  righe: [],
  totaleCer: 0
};

const righe = [...existing.righe];

const existingIndex = righe.findIndex(
  r => r.materiale === selectedMateriale
);

if (existingIndex !== -1) {
  righe[existingIndex] = nuovoRigo;
} else {
  righe.push(nuovoRigo);
}

const updatedCER = {
  ...existing,
  righe,
  totaleCer: righe.reduce((s, r) => s + r.netto, 0)
};

if (cerIdx !== -1) {
  updated[cerIdx] = updatedCER;
} else {
  updated.push(updatedCER);
}

return updated;
  });

  setSelectedMateriale("");
  setPeso("");
  setCalo("");
setDirty(true);
};
const stampaUltimoMovimento = (tipo) => {
  handlePrint(null, tipo);
};
const handleEdit = (cer, fir, materiale) => {
  const cerObj = scarico.find(c => c.cer === cer && c.fir === fir);
  if (!cerObj) return;
  const riga = cerObj.righe.find(r => r.materiale === materiale);
  if (!riga) return;

  setSelectedCer(cer);
  setFirCer(fir);
  setSelectedMateriale(materiale);
  setPeso(riga.peso.toString().replace(".", ","));
  setCalo(riga.calo.toString().replace(".", ","));
};
const handleDelete = (cer, fir, materiale) => {
  setScarico(prev =>
    prev
      .map(c => {
        if (c.cer === cer && c.fir === fir) {
          const newRighe = c.righe.filter(r => r.materiale !== materiale);
          const totaleCer = newRighe.reduce((sum, r) => sum + r.netto, 0);
          return { ...c, righe: newRighe, totaleCer };
        }
        return c;
      })
      .filter(c => c.righe.length > 0)
  );
  setDirty(true);
};

const handleReset = async () => {
  setSelectedFornitore("");
  setSelectedListino("");
  setSelectedCer("");
  setSelectedMateriale("");
  setPeso("");
  setCalo("");
  setScarico([]);
  setFotoFile([]);
  setFirCer("");
  setPreviewFoto([]);
setDocIdOriginale(null);
  const now = new Date();

  if (usaOra) {
    setDataScaricoStr(formattaDataItaliana(now));
    setOraStr(formattaOra24(now));
  } else {
    if (!dataScaricoStr) setDataScaricoStr(formattaDataItaliana(now));
    if (!oraStr) setOraStr("00:00");
  }

  const utente = getLogUser();

  if (!utente) {
    console.error("UTENTE NON TROVATO:", activeUser);
    return;
  }

  try {
    await deleteDoc(doc(db, "scarichi_draft", getLogUser()));
  } catch (err) {
    console.error("Errore delete draft:", err);
  }
};

const salvaInCodaImmagini = async ({ files, utenteId, docTempId }) => {
  if (!files || files.length === 0) return;

  const promises = files.map(async (file) => {
    return addDoc(collection(db, "scarichi_images_queue"), {
      fileName: file.name,
      fileType: file.type,
      fileData: await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      }),
      utenteId,
      docTempId,
      uploaded: false,
      createdAt: serverTimestamp()
    });
  });

  await Promise.all(promises);
};
const handlePrint = async (movimentoId = null, tipo) => {
  try {
    if (!tipo) {
      alert("Errore: tipo movimento non specificato");
      return;
    }

    const collezione = tipo === "carico" ? "carichi" : "scarichi";
    let docData;

    // ---------------- RECUPERO DOCUMENTO ----------------
    if (movimentoId) {
      const refDoc = doc(db, collezione, movimentoId);
      const snap = await getDoc(refDoc);

      if (!snap.exists()) {
        alert("Movimento non trovato");
        return;
      }

      docData = snap.data();
    } else {
     const utente = getLogUser();

      if (!utente) {
        alert("Utente non loggato");
        return;
      }
      const snap = await getDocs(collection(db, collezione));
      const userDocs = snap.docs
        .filter(d => (d.data().utente || "").toLowerCase() === utente.toLowerCase())
        .sort((a, b) => {
          const at = a.data().data?.toDate ? a.data().data.toDate().getTime() : 0;
          const bt = b.data().data?.toDate ? b.data().data.toDate().getTime() : 0;
          return bt - at;
        });

      if (!userDocs.length) {
        alert(`Nessun movimento ${tipo}`);
        return;
      }

      docData = userDocs[0].data();
    }
    const { pdf, startY } = await PdfHeader();
    pdf.setFontSize(16);

    const dataObj = docData.data?.toDate
      ? docData.data.toDate()
      : new Date();

    pdf.text(
      `Movimento: ${tipo === "carico" ? "Carico" : "Scarico"}`,
      10,
      66
    );

    pdf.setFontSize(12);

    pdf.text(
      `${tipo === "carico" ? "Destinatario" : "Fornitore"}: ${docData.fornitore || "-"}`,
      10,
      76
    );

    pdf.text(
      `Data: ${formattaDataItaliana(dataObj)} ${formattaOra24(dataObj)}`,
      10,
      84
    );

    pdf.text(`Listino: ${docData.listino || "-"}`, 10, 92);

    let y = startY + 26;

    // ---------------- TABELLE CER ----------------
    const righe = docData.carico || docData.scarico || [];
    for (const c of righe) {
      pdf.setFontSize(13);
      pdf.text(`CER ${c.cer}${c.fir ? " - FIR: " + c.fir : ""}`, 10, y);
      y += 6;

      autoTable(pdf, {
        startY: y,
        head: [["Materiale", "Peso", "Calo", "Netto"]],
        body: (c.righe || []).map(r => [
          r.materiale,
          Number(r.peso || 0).toFixed(2),
          Number(r.calo || 0).toFixed(2),
          Number(r.netto || 0).toFixed(2),
        ]),
        theme: "grid",
        styles: { fontSize: 10 },
        margin: { left: 10 },
      });

      y = pdf.lastAutoTable.finalY + 6;

      pdf.text(
        `Totale CER: ${(c.totaleCer || 0).toFixed(2)} kg`,
        10,
        y
      );

      y += 10;
    }
    const fotos = Array.isArray(docData.fotoURL)
      ? docData.fotoURL
      : docData.fotoURL
      ? [docData.fotoURL]
      : [];

    if (fotos.length > 0) {
      if (y > 200) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(12);
      pdf.text("Foto movimento:", 10, y);
      y += 10;

      let x = 10;
      let imgY = y;

      for (let i = 0; i < fotos.length; i++) {
        try {
          const response = await fetch(fotos[i]);
          const blob = await response.blob();

          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          pdf.addImage(base64, "JPEG", x, imgY, 60, 60);

          x += 65;

          if (x > 160) {
            x = 10;
            imgY += 65;
          }
        } catch (err) {
          console.error("Errore immagine PDF:", err);
        }
      }
    }

    // ---------------- SAVE ----------------
    pdf.save(
      `${tipo === "carico" ? "Carico" : "Scarico"}_${docData.fornitore || "X"}_${docData.listino || "X"}.pdf`
    );

  } catch (err) {
    console.error("Errore PDF:", err);
    alert("Errore generazione PDF");
  }
};
const uploadSistema3Parti = async (file) => {
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
    });




  const base64 = await toBase64(file);

  const formData = new FormData();
  formData.append("key", "104a4faded51e531311077f0412b6a38");
  formData.append("image", base64);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (!res.ok || !data?.data?.url) {
    console.error("IMGBB ERROR:", data);
    throw new Error("Upload fallito");
  }

  return data.data.url;
};
const uploadFotoFiles = async (files) => {
  const urls = [];

  for (const file of files) {
    const url = await uploadSistema3Parti(file); 
    urls.push(url);
  }

  return urls;
};

const handleSave = async () => {
  console.log("🔥 HANDLE SAVE PARTITO");

  if (salvataggioInCorso) {
    console.log("⛔ BLOCCATO: salvataggioInCorso true");
    return;
  }

  setSalvataggioInCorso(true);

  try {
    const utenteNome = getLogUser();

    if (!utenteNome) {
      alert("Utente non valido");
      return;
    }

    console.log("📦 CHECK STATO:", {
      fornitore: selectedFornitore,
      listino: selectedListino,
      scarico: scarico?.length,
      fotoFile: fotoFile?.length,
      previewFoto: previewFoto?.length
    });

    if (!selectedFornitore || !selectedListino || !scarico || scarico.length === 0) {
      alert("Completa fornitore, listino e scarico");
      return;
    }

    const draftRef = doc(db, "scarichi_draft", utenteNome);
    const draftSnap = await getDoc(draftRef);

    let inModifica = false;
    let docIdOriginaleState = docIdOriginale;
    let sourceCollection = "scarichi";

    if (draftSnap.exists()) {
      const d = draftSnap.data();
      inModifica = !!d.inModifica;

      docIdOriginaleState =
        d.docIdOriginale ||
        docIdOriginale ||
        null;

      sourceCollection = d.sourceCollection || "scarichi";
    }

    // =========================
    // BEFORE LOG
    // =========================
    let before = null;

    if (inModifica && docIdOriginaleState) {
      const ref = doc(db, sourceCollection, docIdOriginaleState);
      const snap = await getDoc(ref);
      before = snap.exists() ? snap.data() : null;
    }

    // =========================
    // IMMAGINI (SAFE)
    // =========================
    let uploadedUrls = [];

    if (fotoFile && fotoFile.length > 0) {
      try {
        uploadedUrls = await uploadFotoFiles(fotoFile);
      } catch (e) {
        console.warn("Upload fallito → coda", e);

        await salvaInCodaImmagini({
          files: fotoFile,
          utenteId: utenteNome,
          docTempId: docIdOriginaleState || "new"
        });

        uploadedUrls = [];
      }
    }

    const existingUrls = (previewFoto || []).filter(
      (u) => typeof u === "string" && !u.startsWith("blob:")
    );

    const fotoURLs = Array.from(new Set([...existingUrls, ...uploadedUrls]));

    // =========================
    // PAYLOAD
    // =========================
    const payload = {
      fornitore: selectedFornitore || "",
      listino: selectedListino || "",
      tipo: tipoMovimento || "scarico",

      [tipoMovimento === "carico" ? "carico" : "scarico"]: scarico || [],

      utente: utenteLoggato,

      data: usaOra
        ? new Date()
        : (dataScaricoStr && oraStr
            ? parseDataOra(dataScaricoStr, oraStr)
            : new Date()),

      fotoURL: fotoURLs,

      lastUpdate: new Date()
    };

    // =========================
    // SAVE
    // =========================
    const targetCollection =
      tipoMovimento === "carico" ? "carichi" : "scarichi";

    let isUpdate = false;

    if (inModifica && docIdOriginaleState) {
      await setDoc(
        doc(db, targetCollection, docIdOriginaleState),
        payload,
        { merge: true }
      );
      isUpdate = true;
    } else {
      const newDoc = await addDoc(
        collection(db, targetCollection),
        payload
      );

      docIdOriginaleState = newDoc.id;
      isUpdate = false;
    }

    // =========================
    // LOG
    // =========================
    const refDocFinale = doc(
      db,
      targetCollection,
      docIdOriginaleState
    );

    const snapFinale = await getDoc(refDocFinale);
    const after = snapFinale.exists() ? snapFinale.data() : payload;

    await scriviLog({
      pagina: targetCollection,
      evento: isUpdate ? "AGGIORNA" : "CREA",
      riferimento: {
        collezione: targetCollection,
        documentoId: docIdOriginaleState
      },
      utente: getLogUser(),
      before: isUpdate ? before : null,
      after,
      ripristinabile: !!before
    });

    // =========================
    // CLEAN
    // =========================
    await deleteDoc(doc(db, "scarichi_draft", utenteNome));

    setScarico([]);
    setFotoFile([]);
    setPreviewFoto([]);
    setFirCer("");
    setSelectedCer("");
    setSelectedMateriale("");
    setPeso("");
    setCalo("");
    setSelectedFornitore("");
    setSelectedListino("");

    console.log("✅ SALVATAGGIO COMPLETATO");

  } catch (err) {
    console.error("❌ ERRORE SAVE:", err);
    alert("Errore salvataggio");
  } finally {
    setSalvataggioInCorso(false);
  }
};

const creaSnapshotScarico = (scaricoData) => {
  return (scaricoData || []).map(c => ({
    cer: c.cer || "",
    fir: c.fir || "",

    righe: (c.righe || []).map(r => ({
      materiale: r.materiale || "",
      peso: Number(r.peso || 0),
      calo: Number(r.calo || 0),
      netto: Number(r.netto || 0),
      prezzoVendita: Number(r.prezzoVendita || 0),
      prezzoAcquisto: Number(r.prezzoAcquisto || 0)
    })),

    totaleCer: Number(c.totaleCer || 0)
  }));
};

const listinoBloccato = selectedFornitore !== "";
  return (
    <div className="scarichi-container">
      <div className="scarichi-header">
       <h2 key={tipoMovimento + (docIdOriginale ? "_edit" : "_new")}>
  {docIdOriginale
    ? (tipoMovimento === "carico" ? "Modifica Carico" : "Modifica Scarico")
    : (tipoMovimento === "carico" ? "Nuovo Carico" : "Nuovo Scarico")
  }
</h2>
        <div>
          {activeUserRole === "admin" && (
            <button onClick={handleGoToDashboard} style={{ marginRight: "10px" }}>
              Torna alla Dashboard
            </button>
          )}
         <button onClick={logout}>
  🚪Logout ({activeUser.username || activeUser.email || "Sconosciuto"})
</button>
         {/* --- PULSANTE STAMPA ULTIMO SCARICO --- */}
    
  <div style={{ marginLeft: "15px" }}>
  <button onClick={() => stampaUltimoMovimento("scarico")}>
    Stampa Ultimo Scarico
  </button>
  <button onClick={() => stampaUltimoMovimento("carico")} style={{ marginLeft: "8px" }}>
    Stampa Ultimo Carico
  </button>
</div>
       </div>
      </div>
      <div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", alignItems: "center" }}>
          <label>            Data:            <DatePicker
              selected={dataScaricoStr ? parseDataOra(dataScaricoStr, oraStr) : new Date()}
              onChange={(date) => {          setDirty(true);        setDataScaricoStr(formattaDataItaliana(date));
                if (formattaDataItaliana(date) === formattaDataItaliana(new Date())) {                  const now = new Date();
                  const [hh, mm] = oraStr.split(":").map(Number);                  if (hh > now.getHours() || (hh === now.getHours() && mm > now.getMinutes())) {
                    setOraStr(formattaOra24(now));
                  }
                } else {
                  setOraStr("00:00");
                }
              }}
              dateFormat="dd MMM yyyy"
              locale="it"
             disabled={usaOra && !isEditing}
              placeholderText="DD MMM YYYY"
            />
          </label>

          <label>
            Ora:
            <DatePicker              selected={                oraStr                  ? new Date(0, 0, 0, ...oraStr.split(":").map(Number))
                  : new Date()
              }              onChange={(time) => {
  setOraStr(formattaOra24(time));
  setDirty(true); // 🔥 FIX
}}             showTimeSelect
              showTimeSelectOnly              timeIntervals={15}              timeFormat="HH:mm"              dateFormat="HH:mm"
             disabled={usaOra && !isEditing}             placeholderText="HH:mm"              minTime={new Date(0, 0, 0, 0, 0)}              maxTime={
                dataScaricoStr === formattaDataItaliana(new Date())                  ? new Date(0, 0, 0, new Date().getHours(), new Date().getMinutes())
                  : new Date(0, 0, 0, 23, 59)
              }
            />
          </label>

          <label style={{ marginLeft: "12px" }}>
            <input type="checkbox" checked={usaOra} onChange={handleUsaOraChange} /> Adesso
          </label>
        </div>

      {/* BLOCCO FORNITORE */}
{/* BLOCCO FORNITORE / DESTINATARIO */}
<div style={{ marginTop: "12px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
    <label style={{ marginRight: "10px" }}>
    Tipo Movimento:
<select
  value={tipoMovimento}
onChange={(e) => {
  const nuovoTipo = e.target.value;

  setLockDraftSync(true); // 🔥 BLOCCA sync automatico
  setTipoMovimento(nuovoTipo);

  if (!isEditing && !docIdOriginale) {
    setSelectedFornitore("");
    setSelectedListino("");
    setScarico([]);
    setSelectedCer("");
    setSelectedMateriale("");
    setPeso("");
    setCalo("");
    setFirCer("");
    setFotoFile([]);
  }

  setSalvataggioInCorso(false);
}}>
      <option value="scarico">Scarico</option>
      <option value="carico">Carico</option>
    </select>
  </label>
</div><div>
  <label style={{ marginRight: "6px" }}>
    {tipoMovimento === "carico" ? "Destinatario:" : "Fornitore:"}
  </label>

  <select
    disabled={listinoBloccato}
    value={selectedFornitore}
   onChange={(e) => {
  const nome = e.target.value;
  setSelectedFornitore(nome);

  const forn = fornitori.find((f) => f.nome === nome);
  if (!forn) return;

  // 1. usa listino predefinito se presente
  if (forn.predefListino) {
    const listinoAssoc = listini.find(
     l => l.id === forn.predefListino && ((l.tipoListino || "").trim() === tipoMovimento)
    );
    if (listinoAssoc) {
      setSelectedListino(listinoAssoc.nome);
      return;
    }
  }
  // 2. fallback: primo listino compatibile
  const primoCompatibile = listini.find(
    l => (l.tipoListino || "").trim() === tipoMovimento
  );
  if (primoCompatibile) {
    setSelectedListino(primoCompatibile.nome);
  } else {
    setSelectedListino("");
  }
}}
  >
    <option value="">-- Seleziona --</option>
    {[...fornitori].sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => (
      <option key={f.id} value={f.nome}>{f.nome}</option>
    ))}
  </select>
  {/* PULSANTE NUOVO FORNITORE / DESTINATARIO */}
  <button     type="button"    onClick={() => { // 🔥 SALVA STATO CORRENTE PRIMA DI USCIRE
    localStorage.setItem("scaricoReturnPage", "/scarichi");

    localStorage.setItem("scarico_temp_data", dataScaricoStr || "");
    localStorage.setItem("scarico_temp_ora", oraStr || "");
    localStorage.setItem("scarico_temp_usaOra", usaOra ? "1" : "0");

    navigate("/fornitori?openNew=true");  }}    
     style={{ marginLeft: "10px" }}  >+ {tipoMovimento === "carico" ? "Nuovo Destinatario" : "Nuovo Fornitore"}  </button>
</div>
        <label>Listino:</label>
        <select
 disabled={role !== "admin" && selectedListino && !isEditing}
  value={selectedListino}
  onChange={(e) => {
  listinoUserChangeRef.current = true;
  setSelectedListino(e.target.value);

  setTimeout(() => {
    listinoUserChangeRef.current = false;
  }, 300);
}}
>
          <option value="">-- Seleziona --</option>
          {listini.filter(l => {
  const tipo = (l.tipoListino || "").toString().trim().toLowerCase();

  if (!tipo) {
    // 🔥 DEFAULT: senza flag → SCARICO
    return tipoMovimento.toLowerCase() === "scarico";
  }

  return tipo === tipoMovimento.toLowerCase();
}).map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
        </select>
        
        <button onClick={handleReset} style={{ marginLeft: "15px" }}>    {tipoMovimento === "carico" ? "Reset Carico" : "Reset Scarico"}
  </button>
        {listinoBloccato && (
          <>
           <label>Foto scarico:</label>
<input
  type="file"
  accept="image/*"
  capture="environment"
  multiple
  onChange={(e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingImages(true);

    setFotoFile(prev => [...prev, ...files]);

    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewFoto(prev => [...prev, ...previews]);

    // sblocca autosave dopo stabilizzazione UI
    setTimeout(() => {
      setUploadingImages(false);
      setDirty(true);
    }, 600);
  }}
/>
{previewFoto.length > 0 && (
  <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
    {previewFoto.map((src, i) => (
      <div key={i} style={{ position: "relative" }}>
        <img
          src={src}
          alt="preview"
          style={{
            width: "80px",
            height: "80px",
            objectFit: "cover",
            borderRadius: "6px",
            border: "1px solid #ccc"
          }}
        />

        {/* 🔥 bottone elimina */}
        <button
          onClick={() => removeFoto(i)}
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: "none",
            background: "red",
            color: "white",
            fontSize: "14px",
            cursor: "pointer",
            lineHeight: "22px"
          }}
        >
          ×
        </button>
      </div>
    ))}
  </div>
)}
          </>
        )}
          {/* --- PULSANTE SALVA SCARICO FINALE --- */}
<div style={{ marginTop: "20px", textAlign: "center" }}>
<button
  onClick={handleSave}
  disabled={
  salvataggioInCorso ||
  firExists ||
  !firCer ||
  !listinoValid ||
  !dirty
}
  style={{
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: firExists ? "not-allowed" : "pointer"
  }}
>
  {salvataggioInCorso ? "Salvataggio..." : tipoMovimento === "carico" ? "Salva Carico" : "Salva Scarico"}
</button>
</div>
      </div>
      <hr />
      {listinoBloccato && (
        <>
          <label>Codice CER:</label>
          <select value={selectedCer} onChange={(e) => setSelectedCer(e.target.value)}>
            <option value="">-- Seleziona CER --</option>
            {[...cerDisponibili]
  .sort((a, b) => a.localeCompare(b, "it", { numeric: true }))
  .map((c) => (
    <option key={c} value={c}>
      {c}
    </option>
))}
          </select>
          <label>F.I.R (CER)/DDT:</label>
        <input
          type="text"
          value={firCer}
          onChange={(e) => setFirCer(e.target.value.toUpperCase())}
          placeholder="Numero formulario"
          style={{ textTransform: "uppercase" }}
        />
        {firExists && (
  <p style={{ color: "red", fontWeight: "bold" }}>
    il FIR immesso {firCer} è già presente a sistema, impossibile continuare
  </p>
)}{firCheckLoading && (
  <p style={{ color: "#999" }}>
    Controllo FIR in corso...
  </p>
)}
        </>
      )}
      {selectedCer && (
        <>
          <label>Materiale:</label>
          <select value={selectedMateriale} onChange={(e) => setSelectedMateriale(e.target.value)}>
            <option value="">-- Seleziona Materiale --</option>
            {[...materialiFiltrati]
  .sort((a, b) => a.nome.localeCompare(b.nome, "it", { numeric: true }))
  .map((m) => (
    <option key={m.id} value={m.nome}>
      {m.nome}
    </option>
))}
          </select>
<br/>
          <label>Peso (kg):</label>
          <input
            type="text"
            value={peso}
            onChange={(e) => {
              let val = e.target.value.replace(/[^0-9.,-]/g, "");
              if (parseFloat(val.replace(",", ".")) === 0) val = "";
              setPeso(val);
            }}
          />
          <label>Calo (kg):</label>
          <input type="text" value={calo} onChange={(e) => setCalo(e.target.value.replace(/[^0-9.,]/g, ""))} />
          <button onClick={handleAdd} disabled={!selectedMateriale || !peso || parseFloat(peso.replace(",", ".")) === 0}>
            Aggiungi / Aggiorna
          </button>
        </>
      )}
      <hr />
{scarico.map((c) => (
  <div key={c.cer + c.fir} style={{ marginBottom: "20px" }}>
    <h4>CER {c.cer} {c.fir && `- FIR: ${c.fir}`}</h4>
    <table>
      <thead>
        <tr>          
          <th>Materiale</th>          
          <th>Peso</th>          
          <th>Calo</th>          
          <th>Netto</th>          
          <th>Azioni</th>        
       </tr>
      </thead>
      <tbody>
  {c.righe.map((r) => (
    <tr key={r.materiale}>
      <td>{r.materiale}</td>
      <td>{r.peso}</td>
      <td>{r.calo}</td>
      <td>{r.netto}</td>
      <td>
        <button onClick={() => handleEdit(c.cer, c.fir, r.materiale)}>✏️</button>
        <button onClick={() => handleDelete(c.cer, c.fir, r.materiale)}>🗑️</button>
      </td>
    </tr>
  ))}
</tbody>
    </table>
    <p style={{ fontWeight: "bold", marginTop: "6px" }}>
      Totale CER: {c.totaleCer} kg
    </p>
  </div>
))}
    </div>
  );
};
export default Scarichi;