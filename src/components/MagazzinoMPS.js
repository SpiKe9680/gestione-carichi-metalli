
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  FaSignOutAlt,
  FaHome,
  FaWarehouse
} from "react-icons/fa";
import { scriviLog } from "../utils/log";
import { loadConfigAzienda } from "../utils/dateUtils";
import ImportaMagazzinoODS from "./magazzinoMPS/ImportaMagazzinoODS";
import SelettoreMagazzino from "./magazzinoMPS/SelettoreMagazzino";
import RiepilogoMagazzino from "./magazzinoMPS/RiepilogoMagazzino";
import RegistroMovimenti from "./magazzinoMPS/RegistroMovimenti";
import ModaleMovimento from "./magazzinoMPS/ModaleMovimento";
import ModaliMagazzino from "./magazzinoMPS/ModaliMagazzino";
import {
  COL_MAGAZZINI,
  COL_MOVIMENTI,
  normalizzaNome,
  oggi,
  leggiUtente,
  calcolaSaldoMovimenti
} from "./magazzinoMPS/magazzinoMPSUtils";
import stampaMagazzinoMPS from "./magazzinoMPS/magazzinoMPSStampa";

const MagazzinoMPS = ({ logout }) => {
  const navigate = useNavigate();

  const [utente] = useState(leggiUtente);
  const ruolo = String(utente?.ruolo || "").toUpperCase();
  const autorizzato = ["ADMIN", "MANAGER"].includes(ruolo);
  const nomeUtente = utente?.username || utente?.email || "sconosciuto";

  const [configAzienda, setConfigAzienda] = useState(null);
  const [magazzini, setMagazzini] = useState([]);
  const [magazzinoSelezionato, setMagazzinoSelezionato] = useState(null);
  const [movimenti, setMovimenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [caricamentoMovimenti, setCaricamentoMovimenti] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
const [mostraImportazioneODS, setMostraImportazioneODS] = useState(false);
  const [mostraMovimento, setMostraMovimento] = useState(false);
  const [movimentoInModifica, setMovimentoInModifica] = useState(null);
  const [tipo, setTipo] = useState("ENTRATA");
  const [data, setData] = useState(oggi());
  const [descrizione, setDescrizione] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [note, setNote] = useState("");
  const [quantita, setQuantita] = useState("");

  const [mostraGiacenza, setMostraGiacenza] = useState(false);
  const [giacenzaIniziale, setGiacenzaIniziale] = useState("");

  const [mostraRinomina, setMostraRinomina] = useState(false);
  const [nomeMagazzino, setNomeMagazzino] = useState("");

  const registraLog = useCallback(
    async ({
      evento,
      collezione,
      documentoId,
      before,
      after,
      meta = {}
    }) => {
      await scriviLog({
        pagina: "magazzino-mps",
        evento,
        riferimento: {
          collezione,
          documentoId,
          magazzinoId:
            collezione === COL_MAGAZZINI
              ? documentoId
              : magazzinoSelezionato?.id || null
        },
        before,
        after,
        utente: nomeUtente,
        ripristinabile: false,
        meta
      });
    },
    [magazzinoSelezionato?.id, nomeUtente]
  );

  const resetMessaggi = () => {
    setErrore("");
    setMessaggio("");
  };

  const caricaMagazzini = useCallback(async (idDaSelezionare = null) => {
    setCaricamento(true);
    setErrore("");

    try {
      const snapshot = await getDocs(collection(db, COL_MAGAZZINI));

      const elenco = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) =>
          String(a.nome || "").localeCompare(
            String(b.nome || ""),
            "it",
            { sensitivity: "base" }
          )
        );

      setMagazzini(elenco);

      const idTarget = idDaSelezionare || magazzinoSelezionato?.id;
      const selezionato = elenco.find((m) => m.id === idTarget) || null;

      setMagazzinoSelezionato(selezionato);
    } catch (e) {
      console.error("Errore caricamento magazzini MPS:", e);
      setErrore("Impossibile caricare i magazzini.");
    } finally {
      setCaricamento(false);
    }
  }, [magazzinoSelezionato?.id]);




  const caricaMovimenti = useCallback(async (magazzinoId) => {
    if (!magazzinoId) {
      setMovimenti([]);
      setCaricamentoMovimenti(false);
      return;
    }

    setCaricamentoMovimenti(true);

    try {
      const q = query(
        collection(db, COL_MOVIMENTI),
        where("magazzinoId", "==", magazzinoId)
      );

      const snapshot = await getDocs(q);

      const elenco = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

            elenco.sort((a, b) => {
        // 1. Ordina per data crescente
        const confrontoData = String(a.data || "").localeCompare(
          String(b.data || "")
        );

        if (confrontoData !== 0) return confrontoData;

        // 2. A parità di data, prima le entrate e poi le uscite
        const prioritaA = a.tipo === "ENTRATA" ? 0 : 1;
        const prioritaB = b.tipo === "ENTRATA" ? 0 : 1;

        if (prioritaA !== prioritaB) {
          return prioritaA - prioritaB;
        }

        // 3. A parità di data e tipo, ordina per creazione
        const tempoA = a.createdAt?.toMillis?.() || 0;
        const tempoB = b.createdAt?.toMillis?.() || 0;

        if (tempoA !== tempoB) return tempoA - tempoB;

        return String(a.id).localeCompare(String(b.id));
      });

      setMovimenti(elenco);
    } catch (e) {
      console.error("Errore caricamento movimenti MPS:", e);
      setErrore("Impossibile caricare i movimenti del magazzino.");
    } finally {
      setCaricamentoMovimenti(false);
    }
  }, []);


const importaMagazziniODS = useCallback(async (fogliSelezionati) => {
  setSalvataggio(true);
  setErrore("");
  setMessaggio("");

  try {
    if (!Array.isArray(fogliSelezionati) || !fogliSelezionati.length) {
      throw new Error("Non hai selezionato alcun foglio da importare.");
    }

    // Rileva eventuali nomi duplicati nel file.
    const nomiSelezionati = fogliSelezionati.map((foglio) =>
      normalizzaNome(foglio.nome)
    );

    if (new Set(nomiSelezionati).size !== nomiSelezionati.length) {
      throw new Error("Il file contiene nomi di magazzino duplicati.");
    }

    // Rilegge i magazzini esistenti prima di preparare le scritture.
    const snapshotMagazzini = await getDocs(
      collection(db, COL_MAGAZZINI)
    );

    const magazziniEsistenti = snapshotMagazzini.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    const pianoImportazione = [];
    const idMagazziniEsistenti = new Set();

    for (const foglio of fogliSelezionati) {
      if (!foglio.valido || foglio.giacenzaIniziale === null) {
        throw new Error(
          `Il foglio "${foglio.nome}" contiene errori o non ha una giacenza iniziale valida.`
        );
      }

      const nome = String(foglio.nome || "").trim();

      if (!nome) {
        throw new Error("È presente un foglio senza nome.");
      }

      const corrispondenze = magazziniEsistenti.filter(
        (magazzino) => normalizzaNome(magazzino.nome) === normalizzaNome(nome)
      );

      if (corrispondenze.length > 1) {
        throw new Error(
          `Esistono più magazzini con il nome "${nome}". Risolvi il duplicato prima di importare.`
        );
      }

      const esistente = corrispondenze[0] || null;

      if (esistente && idMagazziniEsistenti.has(esistente.id)) {
        throw new Error(
          `Il magazzino "${nome}" è stato selezionato più volte.`
        );
      }

      if (esistente) {
        idMagazziniEsistenti.add(esistente.id);
      }

      const movimentiPrecedenti = [];

      if (esistente) {
        const snapshotMovimenti = await getDocs(
          query(
            collection(db, COL_MOVIMENTI),
            where("magazzinoId", "==", esistente.id)
          )
        );

        movimentiPrecedenti.push(...snapshotMovimenti.docs);
      }

      pianoImportazione.push({
        foglio,
        nome,
        esistente,
        movimentiPrecedenti,
        riferimentoMagazzino: esistente
          ? doc(db, COL_MAGAZZINI, esistente.id)
          : doc(collection(db, COL_MAGAZZINI))
      });
    }

    // Ogni operazione di scrittura conta nel limite del batch.
    const numeroScritture = pianoImportazione.reduce(
      (totale, elemento) =>
        totale +
        1 +
        elemento.movimentiPrecedenti.length +
        elemento.foglio.movimenti.length,
      0
    );

    if (numeroScritture > 500) {
      throw new Error(
        `Importazione annullata: servono ${numeroScritture} scritture, ma un singolo batch Firestore ne consente al massimo 500. Nessun dato è stato modificato.`
      );
    }

    const batch = writeBatch(db);
    const nomeOperatore =
      utente?.username ||
      utente?.nome ||
      utente?.email ||
      "Sistema";

    const timestamp = serverTimestamp();

    for (const elemento of pianoImportazione) {
      const {
        foglio,
        nome,
        esistente,
        movimentiPrecedenti,
        riferimentoMagazzino
      } = elemento;

      // Nella sostituzione conserva l'ID del magazzino esistente.
      batch.set(
        riferimentoMagazzino,
        {
          nome,
          giacenzaIniziale: foglio.giacenzaIniziale,
          creatoDa: esistente?.creatoDa || nomeOperatore,
          creatoAt: esistente?.creatoAt || timestamp,
          aggiornatoAt: timestamp,
          aggiornatoDa: nomeOperatore
        },
        { merge: false }
      );

      // I vecchi movimenti vengono sostituiti nella stessa operazione.
      for (const movimento of movimentiPrecedenti) {
        batch.delete(movimento.ref);
      }

      for (const movimento of foglio.movimenti) {
        const riferimentoMovimento = doc(collection(db, COL_MOVIMENTI));

        batch.set(riferimentoMovimento, {
          magazzinoId: riferimentoMagazzino.id,
          tipo: movimento.tipo,
          data: movimento.data,
          descrizione: movimento.descrizione,
          numeroDocumento: String(movimento.numeroDocumento ?? ""),
          note: movimento.note || "",
          quantita: movimento.quantita,
          creatoDa: nomeOperatore,
          creatoAt: timestamp,
          aggiornatoDa: nomeOperatore,
          aggiornatoAt: timestamp
        });
      }
    }

    // Tutti i fogli selezionati vengono salvati insieme.
    await batch.commit();

    // Il log è secondario: un suo eventuale errore non annulla
    // un'importazione già completata.
    for (const elemento of pianoImportazione) {
      try {
        await registraLog({
          evento: "IMPORTA_MAGAZZINO_MPS_ODS",
          collezione: COL_MAGAZZINI,
          documentoId: elemento.riferimentoMagazzino.id,
          before: elemento.esistente
            ? {
                nome: elemento.esistente.nome,
                giacenzaIniziale: elemento.esistente.giacenzaIniziale,
                numeroMovimenti: elemento.movimentiPrecedenti.length
              }
            : null,
          after: {
            nome: elemento.nome,
            giacenzaIniziale: elemento.foglio.giacenzaIniziale,
            numeroMovimenti: elemento.foglio.movimenti.length
          },
          meta: {
            operazione: elemento.esistente
              ? "SOSTITUZIONE_DA_ODS"
              : "CREAZIONE_DA_ODS"
          }
        });
      } catch (erroreLog) {
        console.error("Errore registrazione log importazione ODS:", erroreLog);
      }
    }

    const primoId = pianoImportazione[0].riferimentoMagazzino.id;

    await caricaMagazzini(primoId);
    await caricaMovimenti(primoId);

    setMostraImportazioneODS(false);
    setMessaggio(
      `Importazione completata: ${pianoImportazione.length} magazzini elaborati.`
    );
  } catch (e) {
    console.error("Errore importazione magazzini ODS:", e);
    setErrore(e.message || "Impossibile importare i magazzini dal file ODS.");
    throw e;
  } finally {
    setSalvataggio(false);
  }
}, [utente, registraLog, caricaMagazzini, caricaMovimenti]);

  
  useEffect(() => {
    if (!autorizzato) {
      setCaricamento(false);
      return;
    }

    caricaMagazzini();
  }, [autorizzato, caricaMagazzini]);

  useEffect(() => {
    caricaMovimenti(magazzinoSelezionato?.id);
  }, [magazzinoSelezionato?.id, caricaMovimenti]);

  useEffect(() => {
    let attivo = true;

    const caricaConfigurazione = async () => {
      try {
        const configurazione = await loadConfigAzienda();
        if (attivo) setConfigAzienda(configurazione);
      } catch (e) {
        console.error("Errore caricamento configurazione azienda:", e);
      }
    };

    caricaConfigurazione();

    return () => {
      attivo = false;
    };
  }, []);

  const saldo = useMemo(
    () =>
      calcolaSaldoMovimenti(
        movimenti,
        magazzinoSelezionato?.giacenzaIniziale || 0
      ),
    [movimenti, magazzinoSelezionato?.giacenzaIniziale]
  );

  const giacenzaAttuale = saldo.length
    ? saldo[saldo.length - 1].progressivo
    : Number(magazzinoSelezionato?.giacenzaIniziale || 0);

  const totaleEntrate = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipo === "ENTRATA")
        .reduce((somma, m) => somma + Number(m.quantita || 0), 0),
    [movimenti]
  );

  const totaleUscite = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipo === "USCITA")
        .reduce((somma, m) => somma + Number(m.quantita || 0), 0),
    [movimenti]
  );

  const selezionaMagazzino = (selected) => {
    resetMessaggi();

    if (!selected?.value) {
      setMagazzinoSelezionato(null);
      setMovimenti([]);
      return;
    }

    const esistente = magazzini.find(
      (m) => m.id === selected.value
    );

    if (esistente) setMagazzinoSelezionato(esistente);
  };

  const creaMagazzino = async (inputValue) => {
    const nome = String(inputValue || "").trim();
    if (!nome) return;

    resetMessaggi();

    const duplicato = magazzini.find(
      (m) => normalizzaNome(m.nome) === normalizzaNome(nome)
    );

    if (duplicato) {
      setMagazzinoSelezionato(duplicato);
      setMessaggio(`Il magazzino "${duplicato.nome}" esiste già.`);
      return;
    }

    setSalvataggio(true);

    try {
      const dati = {
        nome,
        giacenzaIniziale: 0,
        creatoDa: nomeUtente,
        creatoAt: serverTimestamp(),
        aggiornatoAt: serverTimestamp()
      };

      const riferimento = await addDoc(
        collection(db, COL_MAGAZZINI),
        dati
      );

      const snapshot = await getDoc(
        doc(db, COL_MAGAZZINI, riferimento.id)
      );

      await registraLog({
        evento: "CREA_MAGAZZINO_MPS",
        collezione: COL_MAGAZZINI,
        documentoId: riferimento.id,
        before: null,
        after: snapshot.exists()
          ? snapshot.data()
          : { nome, giacenzaIniziale: 0 },
        meta: { operazione: "CREAZIONE" }
      });

      await caricaMagazzini(riferimento.id);
      setMessaggio(`Magazzino "${nome}" creato.`);
    } catch (e) {
      console.error("Errore creazione magazzino MPS:", e);
      setErrore(
        "Creazione non completata oppure log non registrato. Verifica il magazzino prima di riprovare."
      );
      await caricaMagazzini();
    } finally {
      setSalvataggio(false);
    }
  };

  const apriRinomina = (magazzino) => {
    resetMessaggi();
    setNomeMagazzino(magazzino.nome || "");
    setMostraRinomina(true);
  };

  const salvaRinomina = async (e) => {
    e.preventDefault();
    resetMessaggi();

    if (!magazzinoSelezionato?.id) return;

    const nome = String(nomeMagazzino || "").trim();

    if (!nome) {
      setErrore("Inserisci il nome del magazzino.");
      return;
    }

    const duplicato = magazzini.find(
      (m) =>
        m.id !== magazzinoSelezionato.id &&
        normalizzaNome(m.nome) === normalizzaNome(nome)
    );

    if (duplicato) {
      setErrore(`Esiste già un magazzino chiamato "${duplicato.nome}".`);
      return;
    }

    if (nome === magazzinoSelezionato.nome) {
      setMostraRinomina(false);
      return;
    }

    setSalvataggio(true);

    try {
      const riferimento = doc(
        db,
        COL_MAGAZZINI,
        magazzinoSelezionato.id
      );

      const snapshotPrima = await getDoc(riferimento);

      if (!snapshotPrima.exists()) {
        throw new Error("Il magazzino non esiste più. Ricarica la pagina.");
      }

      const before = snapshotPrima.data();

      await updateDoc(riferimento, {
        nome,
        aggiornatoDa: nomeUtente,
        aggiornatoAt: serverTimestamp()
      });

      const snapshotDopo = await getDoc(riferimento);

      await registraLog({
        evento: "RINOMINA_MAGAZZINO_MPS",
        collezione: COL_MAGAZZINI,
        documentoId: magazzinoSelezionato.id,
        before,
        after: snapshotDopo.exists()
          ? snapshotDopo.data()
          : { ...before, nome },
        meta: {
          operazione: "RINOMINA",
          nomePrecedente: before.nome || "",
          nomeNuovo: nome
        }
      });

      setMostraRinomina(false);
      await caricaMagazzini(magazzinoSelezionato.id);
      setMessaggio(`Magazzino rinominato in "${nome}".`);
    } catch (e) {
      console.error("Errore rinomina magazzino MPS:", e);
      setErrore(
        e.message || "Errore durante la rinomina del magazzino."
      );
      await caricaMagazzini(magazzinoSelezionato?.id);
    } finally {
      setSalvataggio(false);
    }
  };

  const eliminaMagazzino = async (magazzino) => {
    if (!magazzino?.id) return;

    resetMessaggi();
    setSalvataggio(true);

    try {
      const q = query(
        collection(db, COL_MOVIMENTI),
        where("magazzinoId", "==", magazzino.id)
      );

      const snapshotMovimenti = await getDocs(q);

      if (!snapshotMovimenti.empty) {
        setErrore(
          `Impossibile eliminare "${magazzino.nome}": contiene ${snapshotMovimenti.size} moviment${snapshotMovimenti.size === 1 ? "o" : "i"}. Elimina prima i movimenti associati.`
        );
        return;
      }

      const conferma = window.confirm(
        `Vuoi eliminare definitivamente il magazzino "${magazzino.nome}"? Questa operazione non può essere annullata.`
      );

      if (!conferma) return;

      const riferimento = doc(db, COL_MAGAZZINI, magazzino.id);
      const snapshotPrima = await getDoc(riferimento);

      if (!snapshotPrima.exists()) {
        throw new Error("Il magazzino non esiste più.");
      }

      const before = snapshotPrima.data();

      await deleteDoc(riferimento);

      await registraLog({
        evento: "ELIMINA_MAGAZZINO_MPS",
        collezione: COL_MAGAZZINI,
        documentoId: magazzino.id,
        before,
        after: null,
        meta: {
          operazione: "ELIMINAZIONE",
          nomeMagazzino: magazzino.nome
        }
      });

      setMagazzinoSelezionato(null);
      setMovimenti([]);
      await caricaMagazzini();
      setMessaggio(`Magazzino "${magazzino.nome}" eliminato.`);
    } catch (e) {
      console.error("Errore eliminazione magazzino MPS:", e);
      setErrore(
        e.message || "Errore durante l'eliminazione del magazzino."
      );
      await caricaMagazzini(magazzinoSelezionato?.id);
    } finally {
      setSalvataggio(false);
    }
  };

  const apriNuovoMovimento = () => {
    resetMessaggi();
    setMovimentoInModifica(null);
    setTipo("ENTRATA");
    setData(oggi());
    setDescrizione("");
    setNumeroDocumento("");
    setNote("");
    setQuantita("");
    setMostraMovimento(true);
  };

  const apriModificaMovimento = (movimento) => {
    resetMessaggi();
    setMovimentoInModifica(movimento);
    setTipo(movimento.tipo);
    setData(movimento.data || oggi());
    setDescrizione(movimento.descrizione || "");
    setNumeroDocumento(movimento.numeroDocumento || "");
    setNote(movimento.note || "");
    setQuantita(String(movimento.quantita ?? ""));
    setMostraMovimento(true);
  };

  const salvaMovimento = async (e) => {
    e.preventDefault();
    resetMessaggi();

    if (!magazzinoSelezionato?.id) {
      setErrore("Seleziona prima un magazzino.");
      return;
    }

    const qta = Number(String(quantita).replace(",", "."));
    const descrizionePulita = descrizione.trim();
    const notePulite = String(note || "").trim();
const numeroDocumentoPulito = String(numeroDocumento || "").trim();
    if (
      !data ||
      !descrizionePulita ||
      !Number.isFinite(qta) ||
      qta <= 0
    ) {
      setErrore(
        "Inserisci data, descrizione e una quantità maggiore di zero."
      );
      return;
    }

    if (!["ENTRATA", "USCITA"].includes(tipo)) {
      setErrore("Seleziona un tipo di movimento valido.");
      return;
    }

    setSalvataggio(true);

    try {
      const base = {
        magazzinoId: magazzinoSelezionato.id,
        tipo,
        data,
        descrizione: descrizionePulita,
        numeroDocumento: numeroDocumentoPulito,
        note: notePulite,
        quantita: qta,
        aggiornatoDa: nomeUtente,
        aggiornatoAt: serverTimestamp()
      };

      if (movimentoInModifica) {
        const riferimento = doc(
          db,
          COL_MOVIMENTI,
          movimentoInModifica.id
        );

        const snapshotPrima = await getDoc(riferimento);

        if (!snapshotPrima.exists()) {
          throw new Error("Il movimento non esiste più. Ricarica la pagina.");
        }

        const before = snapshotPrima.data();

        if (before.magazzinoId !== magazzinoSelezionato.id) {
          throw new Error(
            "Il movimento non appartiene al magazzino selezionato."
          );
        }

        await updateDoc(riferimento, base);

        const snapshotDopo = await getDoc(riferimento);

        await registraLog({
          evento: "MODIFICA_MOVIMENTO_MPS",
          collezione: COL_MOVIMENTI,
          documentoId: movimentoInModifica.id,
          before,
          after: snapshotDopo.exists()
            ? snapshotDopo.data()
            : { ...before, ...base },
          meta: {
            operazione: "MODIFICA",
            magazzino: magazzinoSelezionato.nome
          }
        });

        setMessaggio("Movimento modificato.");
      } else {
        const dati = {
          ...base,
          creatoDa: nomeUtente,
          creatoAt: serverTimestamp()
        };

        const riferimento = await addDoc(
          collection(db, COL_MOVIMENTI),
          dati
        );

        const snapshotDopo = await getDoc(
          doc(db, COL_MOVIMENTI, riferimento.id)
        );

        await registraLog({
          evento: "CREA_MOVIMENTO_MPS",
          collezione: COL_MOVIMENTI,
          documentoId: riferimento.id,
          before: null,
          after: snapshotDopo.exists()
            ? snapshotDopo.data()
            : dati,
          meta: {
            operazione: "CREAZIONE",
            magazzino: magazzinoSelezionato.nome
          }
        });

        setMessaggio("Movimento inserito.");
      }

      setMostraMovimento(false);
      setMovimentoInModifica(null);
      await caricaMovimenti(magazzinoSelezionato.id);
    } catch (e) {
      console.error("Errore salvataggio movimento MPS:", e);
      setErrore(
        e.message || "Errore durante il salvataggio del movimento."
      );
      await caricaMovimenti(magazzinoSelezionato.id);
    } finally {
      setSalvataggio(false);
    }
  };

  const eliminaMovimento = async (movimento) => {
    const conferma = window.confirm(
      `Eliminare il movimento "${movimento.descrizione}" del ${movimento.data || ""}? La giacenza progressiva verrà ricalcolata.`
    );

    if (!conferma) return;

    resetMessaggi();
    setSalvataggio(true);

    try {
      const riferimento = doc(
        db,
        COL_MOVIMENTI,
        movimento.id
      );

      const snapshot = await getDoc(riferimento);

      if (!snapshot.exists()) {
        throw new Error("Il movimento non esiste più. Ricarica la pagina.");
      }

      const before = snapshot.data();

      if (before.magazzinoId !== magazzinoSelezionato?.id) {
        throw new Error(
          "Il movimento non appartiene al magazzino selezionato."
        );
      }

      await deleteDoc(riferimento);

      await registraLog({
        evento: "ELIMINA_MOVIMENTO_MPS",
        collezione: COL_MOVIMENTI,
        documentoId: movimento.id,
        before,
        after: null,
        meta: {
          operazione: "ELIMINAZIONE",
          magazzino: magazzinoSelezionato.nome
        }
      });

      setMessaggio("Movimento eliminato. Giacenza ricalcolata.");
      await caricaMovimenti(magazzinoSelezionato.id);
    } catch (e) {
      console.error("Errore eliminazione movimento MPS:", e);
      setErrore(
        e.message ||
          "Eliminazione non completata oppure log non registrato. Verifica il registro prima di riprovare."
      );
      await caricaMovimenti(magazzinoSelezionato?.id);
    } finally {
      setSalvataggio(false);
    }
  };

  
  const cancellaTuttiMovimenti = async () => {
    if (!magazzinoSelezionato?.id) {
      setErrore("Seleziona prima un magazzino.");
      return;
    }

    const magazzinoId = magazzinoSelezionato.id;
    const nomeMagazzino = magazzinoSelezionato.nome || "senza nome";

    resetMessaggi();
    setSalvataggio(true);

    try {
      const q = query(
        collection(db, COL_MOVIMENTI),
        where("magazzinoId", "==", magazzinoId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessaggio("Il magazzino non contiene movimenti da cancellare.");
        return;
      }

      const numeroMovimenti = snapshot.size;

      const conferma = window.confirm(
        `ATTENZIONE: stai per cancellare definitivamente tutti i ${numeroMovimenti} movimenti del magazzino "${nomeMagazzino}". La giacenza iniziale sarà mantenuta. L'operazione non può essere annullata. Vuoi continuare?`
      );

      if (!conferma) return;

      // Firestore consente al massimo 500 operazioni per batch.
      const documenti = snapshot.docs;

      for (let i = 0; i < documenti.length; i += 500) {
        const batch = writeBatch(db);
        const gruppo = documenti.slice(i, i + 500);

        gruppo.forEach((movimento) => {
          batch.delete(movimento.ref);
        });

        await batch.commit();
      }

      // Aggiorna il registro dopo la cancellazione.
      await caricaMovimenti(magazzinoId);

      // Il log è secondario: non deve far sembrare fallita
      // una cancellazione già completata.
      try {
        await registraLog({
          evento: "CANCELLA_TUTTI_MOVIMENTI_MPS",
          collezione: COL_MOVIMENTI,
          documentoId: null,
          before: {
            magazzinoId,
            nomeMagazzino,
            numeroMovimenti
          },
          after: null,
          meta: {
            operazione: "CANCELLAZIONE_MASSIVA",
            magazzinoId,
            nomeMagazzino,
            numeroMovimenti
          }
        });
      } catch (erroreLog) {
        console.error(
          "Movimenti cancellati, ma registrazione del log non riuscita:",
          erroreLog
        );
      }

      setMessaggio(
        `Cancellati ${numeroMovimenti} movimenti dal magazzino "${nomeMagazzino}". La giacenza iniziale è stata mantenuta.`
      );
    } catch (e) {
      console.error("Errore cancellazione movimenti MPS:", e);

      setErrore(
        e.message ||
          "Errore durante la cancellazione dei movimenti. Verifica il registro prima di riprovare."
      );

      await caricaMovimenti(magazzinoId);
    } finally {
      setSalvataggio(false);
    }
  };


  const apriGiacenzaIniziale = () => {
    resetMessaggi();
    setGiacenzaIniziale(
      String(magazzinoSelezionato?.giacenzaIniziale ?? 0)
    );
    setMostraGiacenza(true);
  };

  const salvaGiacenzaIniziale = async (e) => {
    e.preventDefault();
    resetMessaggi();

    const valore = Number(
      String(giacenzaIniziale).replace(",", ".")
    );

    if (!Number.isFinite(valore) || valore < 0) {
      setErrore(
        "La giacenza iniziale deve essere un numero maggiore o uguale a zero."
      );
      return;
    }

    if (!magazzinoSelezionato?.id) return;

    setSalvataggio(true);

    try {
      const riferimento = doc(
        db,
        COL_MAGAZZINI,
        magazzinoSelezionato.id
      );

      const snapshotPrima = await getDoc(riferimento);

      if (!snapshotPrima.exists()) {
        throw new Error("Il magazzino non esiste più. Ricarica la pagina.");
      }

      const before = snapshotPrima.data();

      await updateDoc(riferimento, {
        giacenzaIniziale: valore,
        aggiornatoDa: nomeUtente,
        aggiornatoAt: serverTimestamp()
      });

      const snapshotDopo = await getDoc(riferimento);

      await registraLog({
        evento: "MODIFICA_GIACENZA_INIZIALE_MPS",
        collezione: COL_MAGAZZINI,
        documentoId: magazzinoSelezionato.id,
        before,
        after: snapshotDopo.exists()
          ? snapshotDopo.data()
          : { ...before, giacenzaIniziale: valore },
        meta: {
          operazione: "MODIFICA_GIACENZA_INIZIALE",
          valorePrecedente: Number(before.giacenzaIniziale || 0),
          valoreNuovo: valore
        }
      });

      setMostraGiacenza(false);
      await caricaMagazzini(magazzinoSelezionato.id);
      setMessaggio("Giacenza iniziale aggiornata. Saldi ricalcolati.");
    } catch (e) {
      console.error("Errore modifica giacenza iniziale MPS:", e);
      setErrore(
        e.message ||
          "Aggiornamento non completato oppure log non registrato. Verifica la giacenza prima di riprovare."
      );
      await caricaMagazzini(magazzinoSelezionato?.id);
    } finally {
      setSalvataggio(false);
    }
  };

  const stampaMagazzino = async () => {
    if (!magazzinoSelezionato) {
      setErrore("Seleziona un magazzino prima di procedere con la stampa.");
      return;
    }

    resetMessaggi();
    setSalvataggio(true);

    try {
      await stampaMagazzinoMPS({
        magazzino: magazzinoSelezionato,
        movimenti,
        totaleEntrate,
        totaleUscite,
        giacenzaAttuale
      });

      setMessaggio("Registro magazzino preparato per la stampa.");
    } catch (e) {
      console.error("Errore stampa magazzino MPS:", e);
      setErrore(
        e.message || "Errore durante la generazione del PDF del magazzino."
      );
    } finally {
      setSalvataggio(false);
    }
  };

  const handleLogout = async () => {
    if (logout) {
      await logout();
      return;
    }

    await auth.signOut();
    sessionStorage.removeItem("utenteLoggato");
    navigate("/login");
  };

  if (!utente) return null;

  if (!autorizzato) {
    return (
      <div style={stili.contenitore}>
        <h2>Accesso non autorizzato</h2>
        <p>Magazzino MPS è riservato agli utenti MANAGER e ADMIN.</p>
        <button
          style={stili.pulsante}
          onClick={() => navigate("/scarichi")}
        >
          Torna agli scarichi
        </button>
      </div>
    );
  }

  const stiliSelettore = {
    sezione: stili.sezione,
    etichetta: stili.etichetta,
    input: stili.input,
    pulsanteSecondario: stili.pulsanteSecondario
  };

  return (
    <div style={stili.contenitore}>
      <header style={stili.header}>
        <div style={stili.brand}>
          {configAzienda?.logoBase64 && (
            <img
              src={`data:image/png;base64,${configAzienda.logoBase64}`}
              alt="Logo aziendale"
              style={stili.logo}
            />
          )}

          <div>
            <h2 style={stili.titolo}>Movimentazione Metalli</h2>
            <h3 style={stili.sottotitolo}>MAGAZZINO MPS</h3>
          </div>
        </div>

        <div style={stili.headerAzioni}>
          <button
            style={stili.pulsanteSecondario}
            onClick={() => navigate("/admin")}
          >
            <FaHome /> Dashboard
          </button>

          <button
            style={stili.pulsanteLogout}
            onClick={handleLogout}
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </header>

      {errore && <div style={stili.errore}>{errore}</div>}
      {messaggio && <div style={stili.successo}>{messaggio}</div>}
<div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
  <button
    type="button"
    style={stili.pulsanteSecondario}
    onClick={() => setMostraImportazioneODS(true)}
    disabled={salvataggio || caricamento}
  >
    Importa magazzini da ODS
  </button>
</div>
      <SelettoreMagazzino
        magazzini={magazzini}
        magazzinoSelezionato={magazzinoSelezionato}
        onChange={selezionaMagazzino}
        onCrea={creaMagazzino}
        onRinomina={apriRinomina}
        onElimina={eliminaMagazzino}
        salvataggio={salvataggio || caricamento}
        stili={stiliSelettore}
      />

      {caricamento ? (
        <p>Caricamento magazzini...</p>
      ) : !magazzinoSelezionato ? (
        <div style={stili.vuoto}>
          <FaWarehouse size={30} />
          <p>
            Seleziona un magazzino esistente oppure creane uno dal selettore.
          </p>
        </div>
      ) : (
        <>
          <RiepilogoMagazzino
            magazzinoSelezionato={magazzinoSelezionato}
            totaleEntrate={totaleEntrate}
            totaleUscite={totaleUscite}
            giacenzaAttuale={giacenzaAttuale}
            onModificaGiacenza={apriGiacenzaIniziale}
            stili={stili}
          />

          <RegistroMovimenti
            magazzinoSelezionato={magazzinoSelezionato}
            movimenti={movimenti}
            saldo={saldo}
            caricamento={caricamentoMovimenti}
            salvataggio={salvataggio}
            onNuovoMovimento={apriNuovoMovimento}
            onModificaMovimento={apriModificaMovimento}
            onEliminaMovimento={eliminaMovimento}
            onCancellaTutti={cancellaTuttiMovimenti}
            onStampa={stampaMagazzino}
            onRipristinaOrdine={() => caricaMovimenti(magazzinoSelezionato?.id)}
            stili={stili}
          />
        </>
      )}

      <ModaleMovimento
        aperto={mostraMovimento}
        movimentoInModifica={movimentoInModifica}
        tipo={tipo}
        setTipo={setTipo}
        data={data}
        setData={setData}
        descrizione={descrizione}
        setDescrizione={setDescrizione}
        numeroDocumento={numeroDocumento}
setNumeroDocumento={setNumeroDocumento}
        note={note}
        setNote={setNote}
        quantita={quantita}
        setQuantita={setQuantita}
        salvataggio={salvataggio}
        onSubmit={salvaMovimento}
        onChiudi={() => setMostraMovimento(false)}
        stili={stili}
      />

      <ModaliMagazzino
        mostraRinomina={mostraRinomina}
        nomeMagazzino={nomeMagazzino}
        setNomeMagazzino={setNomeMagazzino}
        onSalvaRinomina={salvaRinomina}
        mostraGiacenza={mostraGiacenza}
        giacenzaIniziale={giacenzaIniziale}
        setGiacenzaIniziale={setGiacenzaIniziale}
        onSalvaGiacenza={salvaGiacenzaIniziale}
        salvataggio={salvataggio}
        onChiudi={() => {
          setMostraRinomina(false);
          setMostraGiacenza(false);
        }}
        stili={stili}
      />

      <ImportaMagazzinoODS
  aperto={mostraImportazioneODS}
  onChiudi={() => setMostraImportazioneODS(false)}
  onImporta={importaMagazziniODS}
  magazzini={magazzini}
/>
    </div>
  );
};

const stili = {
  contenitore: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: 20,
    fontFamily: "Arial, sans-serif",
    color: "#263238"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    borderBottom: "2px solid #dce3e8",
    paddingBottom: 16,
    marginBottom: 24
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14
  },
  logo: {
    maxWidth: 110,
    maxHeight: 70,
    objectFit: "contain"
  },
  titolo: { margin: 0, fontSize: 23 },
  sottotitolo: {
    margin: "8px 0 0",
    fontSize: 19,
    color: "#34516a"
  },
  headerAzioni: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap"
  },
  sezione: {
    maxWidth: 900,
    marginBottom: 24,
    padding: 18,
    background: "#f6f8fa",
    borderRadius: 8
  },
  etichetta: {
    display: "block",
    fontWeight: 600,
    margin: "12px 0 6px"
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #bcc7d1",
    borderRadius: 5,
    fontSize: 15,
    marginBottom: 8
  },
  pulsante: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#1e5a80",
    color: "#fff",
    border: 0,
    borderRadius: 5,
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 14
  },
  pulsanteSecondario: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#e8edf1",
    color: "#263238",
    border: "1px solid #c7d0d8",
    borderRadius: 5,
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 14
  },
  pulsanteLogout: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#a83232",
    color: "#fff",
    border: 0,
    borderRadius: 5,
    padding: "10px 14px",
    cursor: "pointer"
  },
  pulsantePiccolo: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#e8edf1",
    color: "#263238",
    border: "1px solid #c7d0d8",
    borderRadius: 4,
    padding: "6px 9px",
    cursor: "pointer"
  },
  riepilogo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
    margin: "20px 0 28px"
  },
  cardRiepilogo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    background: "#f5f7f9",
    border: "1px solid #dce3e8",
    borderRadius: 8,
    padding: 16
  },
  cardGiacenza: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#e8f3f8",
    border: "1px solid #b6d6e5",
    borderRadius: 8,
    padding: 16
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    margin: "20px 0 12px"
  },
  titoloRegistro: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    margin: 0,
    fontSize: 19
  },
  tabellaContenitore: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #dce3e8",
    borderRadius: 7
  },
  tabella: {
    width: "100%",
    minWidth: 1000,
    borderCollapse: "collapse",
    background: "#fff"
  },
  cella: {
    padding: "10px 12px",
    borderBottom: "1px solid #e3e8ec",
    textAlign: "left",
    verticalAlign: "top"
  },
  cellaEntrata: { color: "#198754", fontWeight: 600 },
  cellaUscita: { color: "#c0392b", fontWeight: 600 },
  cellaGiacenza: { fontWeight: 700 },
  azioniRiga: { display: "flex", gap: 7 },
  pulsanteModifica: {
    background: "#e8edf1",
    border: 0,
    borderRadius: 4,
    padding: 8,
    cursor: "pointer"
  },
  pulsanteElimina: {
    background: "#fbe9e7",
    color: "#a83232",
    border: 0,
    borderRadius: 4,
    padding: 8,
    cursor: "pointer"
  },
  tabellaVuota: {
    padding: 24,
    textAlign: "center",
    color: "#657782"
  },
  vuoto: {
    textAlign: "center",
    padding: 40,
    background: "#f6f8fa",
    borderRadius: 8,
    color: "#657782"
  },
  nota: {
    fontSize: 13,
    color: "#657782",
    lineHeight: 1.5
  },
  errore: {
    padding: 12,
    marginBottom: 14,
    background: "#fdecea",
    color: "#9b2424",
    borderRadius: 5
  },
  successo: {
    padding: 12,
    marginBottom: 14,
    background: "#e7f5eb",
    color: "#176b35",
    borderRadius: 5
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    overflowY: "auto"
  },
  modale: {
    background: "#fff",
    borderRadius: 9,
    padding: 22,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)"
  },
  modaleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #e2e7eb",
    paddingBottom: 12,
    marginBottom: 10
  },
  chiudi: {
    background: "transparent",
    border: 0,
    fontSize: 18,
    cursor: "pointer",
    padding: 6
  },
  modaleAzioni: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18
  }
};

export default MagazzinoMPS;
