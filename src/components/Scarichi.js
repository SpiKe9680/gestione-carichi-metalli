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
import {  PdfHeader , loadConfigAzienda } from "../utils/dateUtils";
import Select from "react-select";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
import {  saveOfflinePhotos,  loadOfflinePhotos,  clearOfflinePhotos} from "../utils/offlinePhotos";

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
const [note, setNote] = useState("");
const [firError, setFirError] = useState(false);
const [snapshotIniziale, setSnapshotIniziale] = useState(null);
  const [firExists, setFirExists] = useState(false);
const [firCheckLoading, setFirCheckLoading] = useState(false);
 const [tipoMovimento, setTipoMovimento] = useState("scarico");
  const navigate = useNavigate();
const getLogUser = () => {
  if (activeUser?.username) return activeUser.username;
  if (activeUser?.email) return activeUser.email;

  const stored = JSON.parse(sessionStorage.getItem("utenteLoggato"));
  if (stored?.username) return stored.username;
  if (stored?.email) return stored.email;

  return null; // se null → NON salvare bozza
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
const autosaveTimerRef = React.useRef(null);
const lastSnapshotRef = React.useRef(null);
const [dirty, setDirty] = useState(false);
const removeFoto = (index) => {
  setPreviewFoto(prev => prev.filter((_, i) => i !== index));
  setFotoFile(prev => prev.filter((_, i) => i !== index));

  setDirty(true); // 🔥 FIX: abilita autosave e salvataggio
};
const utenteLoggato = getLogUser() || activeUser?.email;
const [previewFoto, setPreviewFoto] = useState([]);
const [lockDraftSync, setLockDraftSync] = useState(false);
const [activeUserRole, setActiveUserRole] = useState(null);
const [docIdOriginale, setDocIdOriginale] = useState(null);
  const [usaOra, setUsaOra] = useState(true);
  const [dataScaricoStr, setDataScaricoStr] = useState("");
  const [oraStr, setOraStr] = useState("");
  // 🔥 CHECK CONNESSIONE — BLOCCA TUTTO SE OFFLINE
  const realNetworkCheck = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    await fetch("https://www.google.com/generate_204", {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal
    });

    clearTimeout(timeout);
    return true;
  } catch (e) {
    return false;
  }
};

const checkConnection = async (navigate, activeUserRole) => {
  const online = await realNetworkCheck();
  if (online) return true;

  alert("Connessione assente. Impossibile continuare.");

  const ruolo = (activeUserRole || "").toLowerCase().trim();

  if (ruolo === "operatore") navigate("/login");
  else navigate("/admin");

  return false;
};

useEffect(() => {
  if (!checkConnection(navigate, activeUserRole)) return;

  const handleOffline = () => checkConnection(navigate, activeUserRole);
  const handleOnline = () => console.log("🔵 Connessione ripristinata");

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  };
}, [activeUserRole]);

useEffect(() => {
  const stored = sessionStorage.getItem("utenteLoggato");
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed && parsed.username && !activeUser?.username) {
      setactiveUser(parsed);
    }
  }
}, []);
useEffect(() => {
  if (!activeUser?.username) {
    const stored = sessionStorage.getItem("utenteLoggato");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.username) {
        setactiveUser(parsed);
      }
    }
  }
}, [activeUser]);


const headerBtnStyle = {
  height: "38px",
  padding: "0 12px",
  borderRadius: "6px",
  fontSize: "13px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap"
};
  const [userEmail, setUserEmail] = useState(null);
const [configAzienda, setConfigAzienda] = useState(null);

useEffect(() => {
  const load = async () => {
    const config = await loadConfigAzienda();
    setConfigAzienda(config);
  };
  load();
}, []);
  const formattaDataItaliana = (date) => {
    const gg = String(date.getDate()).padStart(2, "0");
    const mese = mesiItaliani[date.getMonth()];
    const yyyy = date.getFullYear();
    return `${gg} ${mese} ${yyyy}`;
  };
const checkFirExists = async (value) => {
  if (isEditing) return;
  if (!value?.trim()) {
    setFirExists(false);
    return;
  }

  setFirCheckLoading(true);

  try {
    const fir = value.trim().toUpperCase();

    let exists = false;

    const checkDocs = (docs) => {
      for (const snap of docs) {
        const data = snap.data();
        const blocchi = data.scarico || data.carico || [];

        for (const c of blocchi) {
          if ((c.fir || "").toUpperCase() !== fir) continue;
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
    console.error("Errore FIR check:", err);
  } finally {
    setFirCheckLoading(false);
  }
};

const getClientIP = async () => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "NON_DISPONIBILE";
  } catch (e) {
    return "NON_DISPONIBILE";
  }
};
const buildLogUser = (user, fallback = "ADMIN") => {
  const ruolo = user?.ruolo || fallback;

  const username =
    user?.username?.trim() ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "UTENTE_SCONOSCIUTO";

  return `${ruolo} - ${username}`;
};

  const formattaOra24 = (date) => {
  if (!date) return "";

  return (
    date.getHours().toString().padStart(2, "0") +
    ":" +
    date.getMinutes().toString().padStart(2, "0")
  );
};
 const inizializzatoRef = React.useRef(false);
const [listinoValid, setListinoValid] = useState(true);
useEffect(() => {
  if (inizializzatoRef.current) return;

  // 🔥 NON toccare mai la draft o edit mode
  if (isEditing || docIdOriginale) {
    inizializzatoRef.current = true;
    return;
  }

  if (!dataScaricoStr && !oraStr && usaOra) {
    const now = new Date();
    setDataScaricoStr(formattaDataItaliana(now));
    setOraStr(formattaOra24(now));
  }

  inizializzatoRef.current = true;
}, [usaOra, dataScaricoStr, oraStr, isEditing, docIdOriginale]);
useEffect(() => {
  //console.log("Ruolo E NOME utente corrente: ", activeUserRole,activeUser);
}, [activeUserRole]);

useEffect(() => {
  const syncQueue = async () => {
    try {
      const snap = await getDocs(collection(db, "scarichi_images_queue"));

      // 🔵 PROCESSA LA QUEUE FIRESTORE
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (data.uploaded) continue;

        try {
          const res = await fetch(data.fileData);
          const blob = await res.blob();

          const file = new File([blob], data.fileName, {
            type: data.fileType
          });

          const url = await uploadSistema3Parti(file);

          await setDoc(
            doc(db, "scarichi", data.docTempId),
            { fotoURL: arrayUnion(url) },
            { merge: true }
          );

          await setDoc(
            doc(db, "scarichi_draft", data.utenteId),
            { fotoURL: arrayUnion(url) },
            { merge: true }
          );

          await setDoc(
            doc(db, "scarichi_images_queue", docSnap.id),
            { uploaded: true, url },
            { merge: true }
          );
        } catch (err) {
          console.warn("Retry upload fallito", err);
        }
      }

      // 🔵 SYNC FOTO OFFLINE (IndexedDB) — FUORI DAL FOR
      const utenteId = getLogUser();
      if (utenteId) {
        const offline = await loadOfflinePhotos(utenteId);
        if (offline.length > 0) {
          const files = offline.map(f => {
            const blob = new Blob([f.data], { type: f.type });
            return new File([blob], f.name, { type: f.type });
          });

          try {
            const uploadedUrls = await uploadFotoFiles(files);

            await setDoc(
              doc(db, "scarichi_draft", utenteId),
              { fotoURL: arrayUnion(...uploadedUrls) },
              { merge: true }
            );

            await clearOfflinePhotos(utenteId);
          } catch (e) {
            console.warn("Upload offline fallito, restano in coda", e);
          }
        }
      }

    } catch (e) {
      console.error("Queue sync error", e);
    }
  };

  const interval = setInterval(syncQueue, 30000);
  syncQueue();

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  if (isEditing) {
    setFirExists(false);
  }
}, [isEditing]);
useEffect(() => {
  if (!selectedFornitore || !fornitori.length || !listini.length) return;

  const forn = fornitori.find(f => f.nome === selectedFornitore);
  if (!forn?.predefListino) return;

  const listinoAssoc = listini.find(
    l =>
      l.id === forn.predefListino &&
      (l.tipoListino || "").trim().toLowerCase() ===
      (tipoMovimento || "").trim().toLowerCase()
  );

  if (listinoAssoc) {
    setSelectedListino(listinoAssoc.nome);
  }
}, [selectedFornitore, fornitori, listini, tipoMovimento]);
useEffect(() => {
  console.log("🟡 EDIT MODE:", {
    isEditing,
    docIdOriginale,
    selectedCer,
    firCer
  });
}, [isEditing, docIdOriginale, selectedCer, firCer]);





useEffect(() => {
  if (isEditing) return;
  if (!scarico?.length) return;

  const match =
    scarico.find(c => c.cer === selectedCer) || scarico[0];

  if (match) {
    setSelectedCer(match.cer || "");
    setFirCer(match.fir || "");
  }
}, [scarico]);
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
const triggerAutosave = () => {
  if (!initialized) return;
  if (uploadingImages) return;
  if (lockDraftSync) return;

  // ❌ NON controllare la connessione qui

  const snapshot = JSON.stringify({
    scarico,
    selectedFornitore,
    selectedListino,
    firCer,
    tipoMovimento,
    dataScaricoStr,
    oraStr,
    foto: previewFoto
      .map(p => (typeof p === "string" ? p : p?.url))
      .filter(p => p && !p.startsWith("blob:"))
      .sort()
      .join("|")
  });

  if (snapshot === lastSnapshotRef.current) return;

  lastSnapshotRef.current = snapshot;

  if (autosaveTimerRef.current) {
    clearTimeout(autosaveTimerRef.current);
  }

  autosaveTimerRef.current = setTimeout(() => {
    requestAnimationFrame(() => {
      salvaBozza();
    });
  }, 1000);
};

useEffect(() => {
  triggerAutosave();
}, [
  scarico,
  selectedFornitore,
  selectedListino,
  firCer,
  selectedCer, // 🔥 FIX
  tipoMovimento,
  dataScaricoStr,
  oraStr,
  previewFoto
]);

const salvaPdfSuDisco = async (pdf, filename) => {
  try {
    if (!window.showSaveFilePicker) return false;

    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "PDF",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });

    const writable = await handle.createWritable();
    const blob = pdf.output("blob");

    await writable.write(blob);
    await writable.close();

    return true;
  } catch (err) {
    console.warn("Salvataggio su disco annullato o fallito", err);
    return false;
  }
};
const salvaBozza = async () => {
  try {
    const utenteId = getLogUser();
    if (!utenteId) return;

    // ❌ NON controllare la connessione qui

    const draftRef = doc(db, "scarichi_draft", utenteId);

    const payload = {
      tipoMovimento,
      fornitore: selectedFornitore || "",
      listino: selectedListino || "",
      scarico: tipoMovimento === "scarico" ? scarico : [],
      carico: tipoMovimento === "carico" ? scarico : [],
      firCer: firCer || "",
      selectedCer: selectedCer || "",
      utente: utenteLoggato,
      dataScaricoStr,
      oraStr,
      data:
        dataScaricoStr && oraStr
          ? parseDataOra(dataScaricoStr, oraStr)
          : null,
      fotoURL: (previewFoto || []).filter(
        p => typeof p === "string" && !p.startsWith("blob:")
      ),
      note: note || "",
      inModifica: true,
      updatedAt: serverTimestamp()
    };

    await setDoc(draftRef, payload, { merge: true });
  } catch (e) {
    console.error("Errore salvaBozza:", e);
  }
};

const [uploadingImages, setUploadingImages] = useState(false);
const [initialized, setInitialized] = useState(false);

useEffect(() => {
  if (initialized) return;

  const init = async () => {
    try {
      
      const user = await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((u) => {
          unsub();
          resolve(u);
        });
      });

      if (user) {
        setAuthUser({ email: user.email, uid: user.uid });
        setUserEmail(user.email);
      }

      const storedUser = JSON.parse(sessionStorage.getItem("utenteLoggato"));

      setActiveUserRole(
        storedUser?.ruolo ||
        storedUser?.role ||
        user?.ruolo ||
        user?.role ||
        null
      );

      const [fornSnap, listSnap, matSnap] = await Promise.all([
        getDocs(collection(db, "fornitori")),
        getDocs(collection(db, "listini")),
        getDocs(collection(db, "materiali")),
      ]);

      setFornitori(fornSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setListini(listSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMateriali(matSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const utenteId = getLogUser();

      if (utenteId && !isEditing && !docIdOriginale) {
        const draftSnap = await getDoc(doc(db, "scarichi_draft", utenteId));

        if (draftSnap.exists()) {
          const d = draftSnap.data();

          const tipo = d.tipoMovimento || "scarico";
          setTipoMovimento(tipo);

          setSelectedFornitore(d.fornitore || "");
          setSelectedListino(d.listino || "");

          setFirCer(d.firCer || "");
          setSelectedCer(d.selectedCer || "");

          const blocchi =
            tipo === "carico"
              ? d.carico || []
              : d.scarico || [];

          setScarico(
            Array.isArray(blocchi)
              ? blocchi.map(c => ({
                  cer: c.cer || "",
                  fir: c.fir || "",
                  righe: Array.isArray(c.righe) ? c.righe : [],
                  totaleCer: c.totaleCer || 0
                }))
              : []
          );

          const foto = Array.isArray(d.fotoURL)
            ? d.fotoURL.filter(f => typeof f === "string" && f.length > 10)
            : [];

          setPreviewFoto(foto);
setNote(d.note || "");
          setDocIdOriginale(d.docIdOriginale || null);

// 🔥 FOTO OFFLINE DA INDEXEDDB
const offline = await loadOfflinePhotos(utenteId);
if (offline.length > 0) {
  const files = offline.map(f => {
    const blob = new Blob([f.data], { type: f.type });
    return new File([blob], f.name, { type: f.type });
  });

  setFotoFile(prev => [...prev, ...files]);

  const previewsOffline = files.map(file =>
    URL.createObjectURL(file)
  );
  setPreviewFoto(prev => [...prev, ...previewsOffline]);
}


          // 🔥 FIX DATA/ORA BOZZA
          if (d.data) {
            const date = d.data.toDate ? d.data.toDate() : new Date(d.data);

            setDataScaricoStr(formattaDataItaliana(date));
            setOraStr(formattaOra24(date));
          }

          setUsaOra(false); // evita overwrite automatico
        }
      }

      setInitialized(true);
    } catch (err) {
      console.error("INIT ERROR:", err);
    }
  };

  init();
}, [initialized]);
  const cerDisponibili = [...new Set(materiali.map((m) => m.codiceCER).filter((c) => c))];
  const materialiFiltrati = selectedCer ? materiali.filter((m) => m.codiceCER === selectedCer) : [];
  useEffect(() => {
    if (materialiFiltrati.length === 1) setSelectedMateriale(materialiFiltrati[0].nome);
  }, [selectedCer, materialiFiltrati]);
const listinoUserChangeRef = React.useRef(false);

useEffect(() => {
  if (!selectedListino || listini.length === 0) {
    setListinoValid(true);
    return;
  }

  const ok = listini.some((l) => {
    const tipo = (l.tipoListino || "").trim().toLowerCase();
    return (
      l.nome === selectedListino &&
      tipo === tipoMovimento.trim().toLowerCase()
    );
  });

  setListinoValid(ok);
}, [selectedListino, listini, tipoMovimento]);
useEffect(() => {
  return () => {
    previewFoto.forEach((p) => {
      if (typeof p === "string" && p.startsWith("blob:")) {
        URL.revokeObjectURL(p);
      }
    });
  };
}, [previewFoto]);
useEffect(() => {
  const nuovoFornitore = localStorage.getItem("nuovoFornitore");
if (nuovoFornitore) {
  const utente = getLogUser();

  if (utente) {
    deleteDoc(doc(db, "scarichi_draft", utente))
      .then(() => {
        console.log("🧹 Draft eliminata dopo creazione fornitore");
      })
      .catch(err => {
        console.warn("Errore delete draft:", err);
      });
  }

  // 🔥 RESET HARD STATO (fondamentale)
  setScarico([]);
  setSelectedCer("");
  setSelectedMateriale("");
  setPeso("");
  setCalo("");
  setFirCer("");
  setPreviewFoto([]);
  setFotoFile([]);
  setNote("");
}
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

useEffect(() => {
  const handleBeforeUnload = () => {
    if (dirty) {
      salvaBozza();
    }
  };

  

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [dirty]);
const isFornitorePrivato =
  (selectedFornitore || "").trim() === "FORNITORE PRIVATO";
const handleAdd = () => {
  if (!selectedMateriale || !peso || parseFloat(peso.replace(",", ".")) === 0) return;
  if (!checkConnection(navigate, activeUserRole)) return;

  const cer = selectedCer || "SENZA_CER";
  const fir = firCer || "";

  const listinoObj = listini.find(l => l.nome === selectedListino);

  let prezzoVendita = 0;
  let prezzoAcquisto = 0;

  const key = Object.keys(listinoObj?.prezzi || {}).find(
    k => k.toLowerCase().trim() === selectedMateriale.toLowerCase().trim()
  );

  if (key) {
    prezzoVendita = Number(listinoObj.prezzi[key].vendita || 0);
    prezzoAcquisto = Number(listinoObj.prezzi[key].acquisto || 0);
  }

  const nuovoRigo = {
    materiale: selectedMateriale,
    peso: Number(peso.replace(",", ".")),
    calo: Number(calo?.replace(",", ".") || 0),
    netto:
      Number(peso.replace(",", ".")) -
      Number(calo?.replace(",", ".") || 0),
    prezzoVendita,
    prezzoAcquisto
  };

  setScarico(prev => {
    const updated = [...prev];

    const cerIdx = updated.findIndex(c => c.cer === cer);

    if (cerIdx === -1) {
      updated.push({
        cer,
        fir,
        righe: [nuovoRigo],
        totaleCer: nuovoRigo.netto
      });

      return updated;
    }

    const existing = updated[cerIdx];
    const righe = [...(existing.righe || [])];

    const rigaIdx = righe.findIndex(
      r => r.materiale === selectedMateriale
    );

    if (rigaIdx !== -1) {
      righe[rigaIdx] = nuovoRigo;
    } else {
      righe.push(nuovoRigo);
    }

    updated[cerIdx] = {
      ...existing,
      fir,
      righe,
      totaleCer: righe.reduce((s, r) => s + r.netto, 0)
    };

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
  setPreviewFoto([]);
  setFirCer("");
  setDocIdOriginale(null);

  const now = new Date();

  setDataScaricoStr(formattaDataItaliana(now));
  setOraStr(formattaOra24(now));

  const utente = getLogUser();
  if (!utente) return;

  try {
    await deleteDoc(doc(db, "scarichi_draft", utente));
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

    // ---------------- HEADER PDF ----------------
    const { pdf, startY } = await PdfHeader();
    pdf.setFontSize(16);
    let y = startY + 26;

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

    // ---------------- NOTE ----------------
    if (docData.note && docData.note.trim() !== "") {
      const noteLines = pdf.splitTextToSize(docData.note, 180);
      const noteBlockHeight = noteLines.length * 5 + 10;

      if (y + noteBlockHeight > 280) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(12);
      pdf.text("Note:", 10, y);
      y += 6;

      pdf.setFontSize(10);
      pdf.text(noteLines, 10, y);

      y += noteLines.length * 5 + 10;
    }

    // ---------------- TABELLE CER ----------------
    const righe = docData.carico || docData.scarico || [];

    const isPrivatoScarico =
      tipo === "scarico" &&
      (
        (docData.fornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO" ||
        (docData.listino || "").trim().toUpperCase() === "LISTINOPRIVATI"
      );

    let totaleScaricoEuro = 0;

    for (const c of righe) {
      pdf.setFontSize(13);
      pdf.text(`CER ${c.cer}${c.fir ? " - FIR: " + c.fir : ""}`, 10, y);
      y += 6;

      if (isPrivatoScarico) {
        // 🔥 STAMPA PRIVATI (€/kg + totale €)
        autoTable(pdf, {
          startY: y,
          head: [["Materiale", "Netto kg", "€/kg", "Totale €"]],
          body: (c.righe || []).map(r => {
            const netto = Number(r.netto || 0);
            const prezzo = Number(r.prezzoAcquisto || 0);
            const totale = netto * prezzo;
            totaleScaricoEuro += totale;

            return [
              r.materiale,
              netto.toFixed(2),
              prezzo.toFixed(2),
              totale.toFixed(2),
            ];
          }),
          theme: "grid",
          styles: { fontSize: 10 },
          margin: { left: 10 },
        });

        y = pdf.lastAutoTable.finalY + 6;

        pdf.text(`Totale CER: ${(c.totaleCer || 0).toFixed(2)} kg`, 10, y);
        y += 10;

      } else {
        // 🔵 STAMPA NORMALE
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

        pdf.text(`Totale CER: ${(c.totaleCer || 0).toFixed(2)} kg`, 10, y);
        y += 10;
      }
    }

    // ---------------- TOTALE FINALE PRIVATI ----------------
    if (isPrivatoScarico) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(14);
      pdf.text(
        `Totale scarico da pagare al fornitore: ${totaleScaricoEuro.toFixed(2)} €`,
        10,
        y
      );

      y += 14;
    }

// ---------------- FOTO ----------------
const fotos = Array.isArray(docData.fotoURL)
  ? docData.fotoURL
  : docData.fotoURL
  ? [docData.fotoURL]
  : [];

if (fotos.length > 0) {
  // Se siamo troppo in basso → nuova pagina
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

      // 🔥 Se la foto non ci sta → nuova pagina
      if (imgY + 60 > 280) {
        pdf.addPage();
        x = 10;
        imgY = 20;
      }

      pdf.addImage(base64, "JPEG", x, imgY, 60, 60);

      x += 65;

      // 🔥 Se finisce la riga → vai a capo
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
    const filename = `${tipo === "carico" ? "Carico" : "Scarico"}_${docData.fornitore || "X"}_${docData.listino || "X"}.pdf`;

    await salvaESharePdfCapacitor(pdf, filename);
    return;

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

  const ok = await checkConnection(navigate, activeUserRole);
  if (!ok) {
    setSalvataggioInCorso(false);
    return;
  }

  if (salvataggioInCorso) return;
  setSalvataggioInCorso(true);

  try {
    const utenteNome = getLogUser();
    if (!utenteNome) {
      alert("Utente non valido");
      return;
    }

    if (!selectedFornitore || !scarico || scarico.length === 0) {
      alert("Completa fornitore e scarico");
      return;
    }

    const isFornitorePrivato =
      (selectedFornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO";

    // 🔥 FIR NON OBBLIGATORIO PER PRIVATI
    // Per gli altri → FIR auto-generato se mancante
    let scaricoFix = [...scarico];

    if (!isFornitorePrivato) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");

      const timestamp = `${yy}${mm}${dd}_${hh}${min}`;

      scaricoFix = scaricoFix.map((riga) => {
        if (riga.fir && riga.fir.trim() !== "") return riga;

        const firAuto = `${selectedFornitore}_${riga.cer}_${timestamp}`
          .replace(/\s+/g, "")
          .toUpperCase();

        return {
          ...riga,
          fir: firAuto
        };
      });
    }

    // 🔥 FOTO OBBLIGATORIE SOLO PER NON PRIVATI
    const hasImages =
      (fotoFile && fotoFile.length > 0) ||
      (previewFoto && previewFoto.some((p) => typeof p === "string" && !p.startsWith("blob:")));

    if (!isFornitorePrivato && !hasImages) {
      alert("Devi caricare almeno un'immagine prima di salvare");
      return;
    }

    // ---------------- DRAFT / MODIFICA ----------------
    const draftRef = doc(db, "scarichi_draft", utenteNome);
    const draftSnap = await getDoc(draftRef);

    let inModifica = false;
    let docIdOriginaleState = docIdOriginale;
    let sourceCollection = "scarichi";

    if (draftSnap.exists()) {
      const d = draftSnap.data();
      inModifica = !!d.inModifica;
      docIdOriginaleState = d.docIdOriginale || docIdOriginale || null;
      sourceCollection = d.sourceCollection || "scarichi";
    }

    let before = null;
    if (inModifica && docIdOriginaleState) {
      const ref = doc(db, sourceCollection, docIdOriginaleState);
      const snap = await getDoc(ref);
      before = snap.exists() ? snap.data() : null;
    }

    // ---------------- UPLOAD FOTO ONLINE ----------------
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

    // ---------------- FOTO GIÀ ESISTENTI ----------------
    const existingUrls = (previewFoto || []).filter(
      (u) => typeof u === "string" && !u.startsWith("blob:")
    );

    // ---------------- FOTO OFFLINE (IndexedDB) ----------------
    const utenteId = getLogUser();
    let offlineUrls = [];

    const offline = await loadOfflinePhotos(utenteId);
    if (offline.length > 0) {
      const files = offline.map(f => {
        const blob = new Blob([f.data], { type: f.type });
        return new File([blob], f.name, { type: f.type });
      });

      try {
        const uploaded = await uploadFotoFiles(files);
        offlineUrls = uploaded;
        await clearOfflinePhotos(utenteId);
      } catch (e) {
        console.warn("Upload offline fallito, restano in coda", e);
      }
    }

    // ---------------- MERGE FOTO ----------------
    const fotoURLs = Array.from(
      new Set([...existingUrls, ...uploadedUrls, ...offlineUrls])
    );

    // ---------------- PAYLOAD ----------------
    const payload = {
      fornitore: selectedFornitore || "",
      listino: selectedListino || "",
      tipo: tipoMovimento || "scarico",

      [tipoMovimento === "carico" ? "carico" : "scarico"]: scaricoFix,

      utente: utenteLoggato,

      data: usaOra
        ? new Date()
        : dataScaricoStr && oraStr
        ? parseDataOra(dataScaricoStr, oraStr)
        : new Date(),

      fotoURL: fotoURLs,
      note: note || "",
      lastUpdate: new Date()
    };

    const targetCollection =
      tipoMovimento === "carico" ? "carichi" : "scarichi";

    let isUpdate = false;

    // ---------------- SALVATAGGIO ----------------
    if (inModifica && docIdOriginaleState) {
      await setDoc(doc(db, targetCollection, docIdOriginaleState), payload, { merge: true });
      isUpdate = true;
    } else {
      const newDoc = await addDoc(collection(db, targetCollection), payload);
      docIdOriginaleState = newDoc.id;
      isUpdate = false;
    }

    // ---------------- LOG ----------------
    const refDocFinale = doc(db, targetCollection, docIdOriginaleState);
    const snapFinale = await getDoc(refDocFinale);
    const after = snapFinale.exists() ? snapFinale.data() : payload;

    const clientIP = await getClientIP?.() || "NON_DISPONIBILE";

    await scriviLog({
      pagina: targetCollection,
      evento: isUpdate ? "MODIFICA_MOVIMENTO" : "CREAZIONE_MOVIMENTO",

      riferimento: {
        collezione: targetCollection,
        documentoId: docIdOriginaleState
      },

      utente: buildLogUser(activeUser, "OPERATORE"),

      before: isUpdate
        ? {
            fornitore: before?.fornitore || "-",
            listino: before?.listino || "-",
            tipo: before?.tipo || "-"
          }
        : null,

      after: {
        fornitore: after?.fornitore || "-",
        listino: after?.listino || "-",
        tipo: after?.tipo || "-",
        righe: (after?.scarico || after?.carico || []).length
      },

      ripristinabile: !!before
    });

    // ---------------- RESET DRAFT ----------------
    await deleteDoc(doc(db, "scarichi_draft", utenteNome));

    // ---------------- RESET UI ----------------
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

    setDirty(false);

    console.log("✅ SALVATAGGIO COMPLETATO");

    const vuoleStampare = window.confirm("Vuoi stampare il movimento in PDF?");
    if (vuoleStampare) {
      await handlePrint(docIdOriginaleState, tipoMovimento);
    }

  } catch (err) {
    console.error("❌ ERRORE SAVE:", err);
    alert("Errore salvataggio");
  } finally {
    setSalvataggioInCorso(false);
  }
};





const listinoBloccato = selectedFornitore !== "";

const sortByLabel = (a, b) => {
  const strA = (typeof a === "string" ? a : a?.nome || "").toString();
  const strB = (typeof b === "string" ? b : b?.nome || "").toString();

  return strA.localeCompare(strB, "it", { sensitivity: "base" });
};

// FORNITORI
const fornitoriOptions = fornitori.sort(sortByLabel).map(f => ({
  value: f.nome,
  label: f.nome
}));


const listiniOptions = listini
  .filter(l =>
    (l.tipoListino || "").trim().toLowerCase() ===
    (tipoMovimento || "").trim().toLowerCase()
  )
  .sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "it", {
      sensitivity: "base"
    })
  )
  .map(l => ({
    value: l.nome,
    label: l.nome
  }));

// CER
const cerOptions = cerDisponibili.sort(sortByLabel).map(c => ({
  value: c,
  label: c
}));

// MATERIALI
const materialiOptions = materialiFiltrati.map(m => ({
  value: m.nome,
  label: m.nome
}));

// 🔥 Calcoli per fornitore privato
let totaleScaricoEuro = 0;

const scaricoConTotali = scarico.map(c => {
  let totaleCerEuro = 0;

  const righe = c.righe.map(r => {
    const totale = Number(r.netto || 0) * Number(r.prezzoAcquisto || 0);
    totaleCerEuro += totale;
    return { ...r, totaleEuro: totale };
  });

  totaleScaricoEuro += totaleCerEuro;

  return { ...c, righe, totaleCerEuro };
});


  return (
    <div className="scarichi-container">
      <div className="scarichi-header" style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
}}>
<div style={{
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  marginBottom: "15px"
}}>
  
  {configAzienda?.logoBase64 && (
    <img
      src={`data:image/png;base64,${configAzienda.logoBase64}`}
      alt="logo"
      style={{
        height: "150px",
        maxWidth: "300px",
        objectFit: "contain"
      }}
    />
  )}

  <h2 style={{ margin: 0 }}>
    {docIdOriginale
      ? (tipoMovimento === "carico" ? "Modifica Carico" : "Modifica Scarico")
      : (tipoMovimento === "carico" ? "Nuovo Carico" : "Nuovo Scarico")
    }
  </h2>

</div>
        <div>
        {["admin", "manager"].includes(
  (activeUserRole || role || "").toLowerCase().trim()
) && (
  <div style={{ display: "flex", gap: "8px" }}>
  <button style={headerBtnStyle}  onClick={handleGoToDashboard}>
    Torna alla Dashboard
  </button>
  </div>
)}
<div style={{ display: "flex", gap: "8px" }}>
         <button style={headerBtnStyle}  onClick={logout}>
  🚪Logout ({activeUser.username || activeUser.email || "Sconosciuto"})
</button>
</div>
         {/* --- PULSANTE STAMPA ULTIMO SCARICO --- */}
    
  <div style={{ display: "flex", gap: "8px" }}>
  <button style={headerBtnStyle}  onClick={() => stampaUltimoMovimento("scarico")}>
    Stampa Ultimo Scarico
  </button></div><div style={{ display: "flex", gap: "8px" }}>
  <button style={headerBtnStyle}  onClick={() => stampaUltimoMovimento("carico")} style={{ marginLeft: "8px" }}>
    Stampa Ultimo Carico
  </button>
</div>
<div style={{ display: "flex", gap: "8px" }}>
       <button onClick={handleReset} style={{ marginLeft: "15px" }}>    {tipoMovimento === "carico" ? "Reset Carico" : "Reset Scarico"}
  </button></div>
       </div>
      </div>
      <div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", alignItems: "center" }}>
          <label>            Data:            
            <DatePicker
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

setLockDraftSync(true);

setTimeout(() => {
  setLockDraftSync(false);
}, 500);
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

<Select
  options={fornitoriOptions}
  value={fornitoriOptions.find(o => o.value === selectedFornitore) || null}
onChange={(selected) => {
  const nome = selected?.value || "";
  setSelectedFornitore(nome);

  // 🔥 LOGICA FORNITORE PRIVATO (solo SCARICO)
  if (nome.trim().toUpperCase() === "FORNITORE PRIVATO" && tipoMovimento === "scarico") {
    setSelectedListino("LISTINOPRIVATI");
    return;
  }

  // 🔵 Logica normale
  const forn = fornitori.find(f => f.nome === nome);
  if (!forn) return;

  const primoCompatibile = listini.find(
    l => (l.tipoListino || "").trim() === tipoMovimento
  );

  if (primoCompatibile) {
    setSelectedListino(primoCompatibile.nome);
  }
}}

  placeholder={tipoMovimento === "carico" ? "Cerca cliente..." : "Cerca fornitore..."}
  isSearchable
  isClearable
/>

  {/* PULSANTE NUOVO FORNITORE / DESTINATARIO */}
  <button     type="button"    onClick={() => { // 🔥 SALVA STATO CORRENTE PRIMA DI USCIRE
    localStorage.setItem("scaricoReturnPage", "/scarichi");

    localStorage.setItem("scarico_temp_data", dataScaricoStr || "");
    localStorage.setItem("scarico_temp_ora", oraStr || "");
    localStorage.setItem("scarico_temp_usaOra", usaOra ? "1" : "0");
localStorage.setItem("fornitore_prefill_nome", "");
    navigate("/fornitori?openNew=true");  }}    
     style={{ marginLeft: "10px" }}  >+ {tipoMovimento === "carico" ? "Nuovo Destinatario" : "Nuovo Fornitore"}  </button>
</div>
        <label>Listino:</label>
<Select
  options={listiniOptions}
  value={listiniOptions.find(o => o.value === selectedListino) || null}
  onChange={(selected) => {
    // 🔥 BLOCCO LISTINO PER FORNITORE PRIVATO (solo SCARICO)
    if ((selectedFornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO" && tipoMovimento === "scarico") {
      return;
    }
    setSelectedListino(selected?.value || "");
  }}
  placeholder="Cerca listino..."
  isSearchable
  isClearable
  isDisabled={(selectedFornitore || "").trim().toUpperCase() === "FORNITORE PRIVATO" && tipoMovimento === "scarico"}
  menuPortalTarget={document.body}
  styles={{
    menuPortal: base => ({ ...base, zIndex: 9999 })
  }}
/>

        
 
        {listinoBloccato && (
          <>
           <label>Foto scarico:</label>
<input
  type="file"
  accept="image/*"
  capture="environment"
  multiple
onChange={async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const utenteId = getLogUser();
  setUploadingImages(true);

  const online = await realNetworkCheck();

  if (online) {
    // 🔵 ONLINE → CARICO SUBITO LE FOTO E SALVO GLI URL
    try {
      const uploadedUrls = await uploadFotoFiles(files);

      // aggiungo gli URL alle preview
      setPreviewFoto(prev => [...prev, ...uploadedUrls]);

      // aggiungo gli URL anche a fotoFile (per coerenza)
      setFotoFile(prev => [...prev, ...files]);

      // 🔥 SALVO SUBITO LA BOZZA CON GLI URL
      await salvaBozza();
    } catch (err) {
      console.error("Errore upload immediato:", err);
    }
  } else {
    // 🔴 OFFLINE → SALVO IN INDEXEDDB
    if (utenteId) {
      await saveOfflinePhotos(utenteId, files);
    }

    // preview locali (blob)
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewFoto(prev => [...prev, ...previews]);

    // salvo i file per upload futuro
    setFotoFile(prev => [...prev, ...files]);
  }

  setUploadingImages(false);
  setDirty(true);
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
        <div style={{ marginTop: "12px" }}>
  <label>Note:</label>
  <textarea
    value={note}
    onChange={(e) => {
      setNote(e.target.value);
      setDirty(true);
    }}
    rows={3}
    style={{ width: "100%" }}
  />
</div>
          {/* --- PULSANTE SALVA SCARICO FINALE --- */}
<div style={{ marginTop: "20px", textAlign: "center" }}>
<button
  onClick={handleSave}
 disabled={
  salvataggioInCorso ||
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
<Select
  options={cerOptions}
  value={cerOptions.find(o => o.value === selectedCer) || null}
  onChange={(selected) => {
    setSelectedCer(selected?.value || "");
  }}
  placeholder="Cerca CER..."
  isSearchable
/>
          <label>F.I.R (CER)/DDT:</label>
          
<input
  id="fir-input"
  type="text"
  value={firCer}
  disabled={isFornitorePrivato}
  onChange={(e) => {
    setFirCer(e.target.value.toUpperCase());
    setFirError(false);
    setDirty(true);
  }}
  onBlur={() => {
    if (!isFornitorePrivato) {
      setFirError(!firCer);
      checkFirExists(firCer);
    }
  }}
  placeholder={
    isFornitorePrivato
      ? "FIR non richiesto per fornitore privato"
      : firError
        ? "FIR obbligatorio"
        : "Numero formulario (FIR)"
  }
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
<Select
  options={materialiOptions}
  value={materialiOptions.find(o => o.value === selectedMateriale) || null}
  onChange={(selected) => {
    setSelectedMateriale(selected?.value || "");
  }}
  placeholder="Cerca materiale..."
  isSearchable
/>
<br/>
          <label>Peso (kg):</label>
          <input
            type="text"
            value={peso}
           onChange={(e) => {
  let val = e.target.value;

  // Permetti solo numeri, virgola e punto
  val = val.replace(/[^0-9.,]/g, "");

  // Se ci sono più virgole o punti → tieni solo il primo
  const parts = val.split(/[,\.]/);

  if (parts.length > 2) {
    val = parts[0] + "." + parts[1]; // normalizzo al primo separatore
  }

  setPeso(val);
}}

onBlur={(e) => {
  let val = e.target.value;

  // Rimuovi tutto ciò che non è numero o separatore
  val = val.replace(/[^0-9.,]/g, "");

  // Split su virgola o punto
  let parts = val.split(/[,\.]/);

  // Se più di due parti → tieni solo le prime due
  if (parts.length > 2) {
    parts = parts.slice(0, 2);
  }

  // Ricostruisci con punto come separatore decimale
  if (parts.length === 1) {
    val = parts[0];
  } else {
    val = parts[0] + "." + parts[1];
  }

  // Se il valore è vuoto o zero → imposta stringa vuota
  if (!val || parseFloat(val) === 0) {
    val = "";
  }

  setPeso(val);
}}

          />
          <label>Calo (kg):</label>
          <input type="text" value={calo} onChange={(e) => {
  let val = e.target.value;

  // Permetti solo numeri, virgola e punto
  val = val.replace(/[^0-9.,]/g, "");

  // Se ci sono più virgole o punti → tieni solo il primo
  const parts = val.split(/[,\.]/);

  if (parts.length > 2) {
    val = parts[0] + "." + parts[1]; // normalizzo al primo separatore
  }

  setCalo(val);
}}

onBlur={(e) => {
  let val = e.target.value;

  // Rimuovi tutto ciò che non è numero o separatore
  val = val.replace(/[^0-9.,]/g, "");

  // Split su virgola o punto
  let parts = val.split(/[,\.]/);

  // Se più di due parti → tieni solo le prime due
  if (parts.length > 2) {
    parts = parts.slice(0, 2);
  }

  // Ricostruisci con punto come separatore decimale
  if (parts.length === 1) {
    val = parts[0];
  } else {
    val = parts[0] + "." + parts[1];
  }

  // Se il valore è vuoto o zero → imposta stringa vuota
  if (!val || parseFloat(val) === 0) {
    val = "";
  }

  setCalo(val);
}}
 />
          <button onClick={handleAdd} disabled={!selectedMateriale || !peso || parseFloat(peso.replace(",", ".")) === 0}>
            Aggiungi / Aggiorna
          </button>
        </>
      )}
      <hr />
{scaricoConTotali.map((c) => (
  <div key={c.cer + c.fir} style={{ marginBottom: "20px" }}>
    <h4>CER {c.cer} {c.fir && `- FIR: ${c.fir}`}</h4>

    <table>
      <thead>
        <tr>
          <th>Materiale</th>
          <th>Peso</th>
          <th>Calo</th>
          <th>Netto</th>

          {/* 🔥 SOLO PER FORNITORE PRIVATO */}
          {isFornitorePrivato && (
            <>
              <th>€/kg</th>
              <th>Totale €</th>
            </>
          )}

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

            {/* 🔥 SOLO PER FORNITORE PRIVATO */}
            {isFornitorePrivato && (
              <>
                <td>{Number(r.prezzoAcquisto).toFixed(2)}</td>
                <td>{Number(r.totaleEuro).toFixed(2)}</td>
              </>
            )}

            <td>
              <button onClick={() => handleEdit(c.cer, c.fir, r.materiale)}>✏️</button>
              <button onClick={() => handleDelete(c.cer, c.fir, r.materiale)}>🗑️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* 🔥 Totale CER */}
    <p style={{ fontWeight: "bold", marginTop: "6px" }}>
      Totale CER: {c.totaleCer} kg

      {isFornitorePrivato && (
        <> — <span style={{ color: "green" }}>{c.totaleCerEuro.toFixed(2)} €</span></>
      )}
    </p>
  </div>
))}
{isFornitorePrivato && (
  <h3 style={{ marginTop: "20px", color: "green" }}>
    Totale scarico da pagare: {totaleScaricoEuro.toFixed(2)} €
  </h3>
)}

    </div>
  );
};
export default Scarichi;