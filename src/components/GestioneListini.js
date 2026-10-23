
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  getCountFromServer,writeBatch
} from "firebase/firestore";
import Select from "react-select";
import { useNavigate } from "react-router-dom";

import { scriviLog } from "../utils/log";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";
import { loadConfigAzienda, getDataOraStampa, PdfHeader } from "../utils/dateUtils";
import { signOut } from "firebase/auth";
import PageLayout from "./layout/PageLayout";
import ActionButton from "./ui/ActionButton";
import "./GestioneListini.css";

const GestioneListini = () => {
  let currentUser = {};

  try {
    const raw = sessionStorage.getItem("utenteLoggato");

    if (!raw || raw === "undefined" || raw === "null") {
      currentUser = {};
    } else {
      currentUser = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("⚠️ utenteLoggato non valido:", sessionStorage.getItem("utenteLoggato"));
    currentUser = {};
  }

  const [propagaModificaGlobale, setPropagaModificaGlobale] = useState(false);
  const [listini, setListini] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [propagaPrezzi, setPropagaPrezzi] = useState({});
  const [editor, setEditor] = useState(null);
  const [originalEditor, setOriginalEditor] = useState(null);
const [movimentiPerListino, setMovimentiPerListino] = useState({});
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const requestSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key && prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getUtenteReact = () => {
    return (
      currentUser.username || currentUser.email
    );
  };

  const [nuovoListino, setNuovoListino] = useState("");
  const [listinoDaCopiare, setListinoDaCopiare] = useState("");
  const [nuovoTipoListino, setNuovoTipoListino] = useState("SCARICO");
  const [showCreaForm, setShowCreaForm] = useState(false);
  const [errori, setErrori] = useState([]);
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState({});
  const [modificaPercentuale, setModificaPercentuale] = useState(0);
  const [modificaAzione, setModificaAzione] = useState("AUMENTA");

  const navigate = useNavigate();
  const [tipoFiltroListino, setTipoFiltroListino] = useState("SCARICO");

  // NAV
  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  const goHome = () => navigate("/admin");

  // LOAD LISTINI E FORNITORI
  const loadListini = async () => {
    try {
      const snap = await getDocs(collection(db, "listini"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setListini(dati);

      if (dati.length && !listinoDaCopiare)
        setListinoDaCopiare(dati[0].id);

    } catch (e) {
      setErrori([e.message]);
    }
  };

  const materialiDinamici = React.useMemo(() => {
    const set = new Set();

    listini.forEach(l => {
      Object.keys(l.prezzi || {}).forEach(k => {
        if (k && k.trim()) {
          set.add(k.trim());
        }
      });
    });

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "it", { numeric: true })
    );
  }, [listini]);

  const loadFornitori = async () => {
    try {
      const snap = await getDocs(collection(db, "fornitori"));
      const dati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFornitori(dati);
    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  useEffect(() => {
    loadListini();
    loadFornitori();
    loadConfigAzienda();
  }, []);

  useEffect(() => {
  let annullato = false;

  const caricaConteggiMovimenti = async () => {
    if (listini.length === 0) {
      setMovimentiPerListino({});
      return;
    }

    const risultati = await Promise.all(
      listini.map(async (listino) => {
        const tipo = listino.tipoListino || "SCARICO";
        const collezione = tipo === "CARICO" ? "carichi" : "scarichi";
        const chiave = `${tipo}|${listino.nome}`;

        try {
          const qMovimenti = query(
            collection(db, collezione),
            where("listino", "==", listino.nome)
          );

          const risultato = await getCountFromServer(qMovimenti);

          return [chiave, risultato.data().count];
        } catch (errore) {
          console.error(
            `Errore conteggio movimenti per il listino ${listino.nome}:`,
            errore
          );

          return [chiave, null];
        }
      })
    );

    if (!annullato) {
      setMovimentiPerListino(Object.fromEntries(risultati));
    }
  };

  caricaConteggiMovimenti();

  return () => {
    annullato = true;
  };
}, [listini]);

  // SELEZIONE LISTINO
  const normalizzaPrezzi = (prezzi = {}) => {
    const out = {};

    Object.entries(prezzi).forEach(([k, v]) => {
      if (typeof v === "object" && v !== null) {
        out[k] = {
          vendita: Number(v.vendita ?? v.acquisto ?? 0),
          acquisto: Number(v.acquisto ?? v.vendita ?? 0)
        };
      } else {
        out[k] = {
          vendita: Number(v) || 0,
          acquisto: Number(v) || 0
        };
      }
    });

    return out;
  };

  const selezionaListino = (listinoId) => {
    const l = listini.find(x => x.id === listinoId);
    if (!l) return;

    const listinoFix = {
      ...l,
      prezzi: normalizzaPrezzi(l.prezzi || {}),
      tipoListino: l.tipoListino || "SCARICO"
    };

    setEditor(listinoFix);
    setOriginalEditor(JSON.parse(JSON.stringify(listinoFix)));
  };


  // UPDATE PREZZO
  const updatePrezzo = (codice, valore) => {
    const num = Number(valore) || 0;

    setEditor(prev => {
      return {
        ...prev,
        prezzi: {
          ...prev.prezzi,
          [codice]: {
            ...(prev.prezzi?.[codice] || {}),
            vendita: num,
            acquisto: num
          }
        }
      };
    });

    setPropagaPrezzi(prev => {
      const nuovo = { ...prev };
      delete nuovo[codice];
      return nuovo;
    });
  };


  const campoModificato = (codice) => {
    if (!editor || !originalEditor) return false;

    const nuovo = editor.prezzi?.[codice];
    const vecchio = originalEditor.prezzi?.[codice];

    const nuovoVal = editor.tipoListino === "CARICO"
      ? nuovo?.vendita ?? 0
      : nuovo?.acquisto ?? 0;

    const vecchioVal = originalEditor.tipoListino === "CARICO"
      ? vecchio?.vendita ?? 0
      : vecchio?.acquisto ?? 0;

    return Number(nuovoVal) !== Number(vecchioVal);
  };

  const associaFornitore = async (listinoId, fornitoreId) => {
    const listino = listini.find(l => l.id === listinoId);
    const fornitore = fornitori.find(f => f.id === fornitoreId);
    if (!listino || !fornitore) return;

    try {
      const datiOriginali = {
        listinoId,
        fornitoreId,
        predefListinoVecchio: fornitore.predefListino || null
      };

      await updateDoc(doc(db, "fornitori", fornitoreId), {
        predefListino: listinoId
      });

      for (const l of listini) {
        if ((l.predefFornitori || []).includes(fornitoreId) && l.id !== listinoId) {
          const nuoviFornitori = l.predefFornitori.filter(fid => fid !== fornitoreId);
          await updateDoc(doc(db, "listini", l.id), {
            predefFornitori: nuoviFornitori
          });
        }
      }

      const predefFornitori = listino.predefFornitori || [];
      if (!predefFornitori.includes(fornitoreId)) {
        await updateDoc(doc(db, "listini", listinoId), {
          predefFornitori: [...predefFornitori, fornitoreId]
        });
      }

      await scriviLog({
        pagina: "gestione-listini",
        evento: "ASSOCIA_FORNITORE",
        riferimento: {
          collezione: "listini",
          documentoId: listinoId
        },
        before: datiOriginali,
        after: { listinoId, fornitoreId },
        utente: getUtenteReact(),
        ripristinabile: true
      });

      setFornitoreSelezionato(prev => ({ ...prev, [listinoId]: "" }));
      loadListini();
      loadFornitori();

    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };


const associaTutteControparti = async (listinoId) => {
  const listino = listini.find(l => l.id === listinoId);

  if (!listino) return;

  if (fornitori.length === 0) {
    alert("Non ci sono controparti da associare.");
    return;
  }

  const conferma = window.confirm(
    `Sei sicuro di voler associare tutte le ${fornitori.length} controparti al listino "${listino.nome}"?\n\n` +
    `Se confermi, questo listino diventerà il predefinito per tutte le controparti.`
  );

  if (!conferma) return;

  try {
    const batch = writeBatch(db);
    const idsControparti = new Set(fornitori.map(f => f.id));

    fornitori.forEach(f => {
      batch.update(doc(db, "fornitori", f.id), {
        predefListino: listinoId
      });
    });

    listini.forEach(l => {
      const predefFornitori = l.predefFornitori || [];

      const nuoviPredefFornitori = l.id === listinoId
        ? [...new Set([
            ...predefFornitori,
            ...idsControparti
          ])]
        : predefFornitori.filter(
            id => !idsControparti.has(id)
          );

      batch.update(doc(db, "listini", l.id), {
        predefFornitori: nuoviPredefFornitori
      });
    });

    await batch.commit();

    await scriviLog({
      pagina: "gestione-listini",
      evento: "ASSOCIA_TUTTE_CONTROPARTI",
      riferimento: {
        collezione: "listini",
        documentoId: listinoId
      },
      before: {
        nomeListino: listino.nome,
        tipoListino: listino.tipoListino || "SCARICO",
        numeroControparti: fornitori.length,
        controparti: fornitori.map(f => ({
          id: f.id,
          nome: f.nome || f.id,
          listinoPredefinitoPrecedente: f.predefListino || null
        }))
      },
      after: {
        nomeListino: listino.nome,
        tipoListino: listino.tipoListino || "SCARICO",
        numeroControparti: fornitori.length,
        controparti: fornitori.map(f => ({
          id: f.id,
          nome: f.nome || f.id,
          listinoPredefinito: listinoId
        }))
      },
      utente: getUtenteReact(),
      ripristinabile: false
    });

    await loadListini();
    await loadFornitori();

    alert(
      `Tutte le ${fornitori.length} controparti sono state associate al listino "${listino.nome}".`
    );
  } catch (errore) {
    console.error("Errore nell'associazione massiva:", errore);
    alert(
      "Errore durante l'associazione massiva delle controparti. Verifica i dati prima di riprovare."
    );
  }
};




const deassociaTutteControparti = async (listinoId) => {
  const listino = listini.find(l => l.id === listinoId);

  if (!listino) return;

  const idsAssociati = [...new Set(listino.predefFornitori || [])];

  if (idsAssociati.length === 0) {
    alert("Non ci sono controparti associate a questo listino.");
    return;
  }

  const conferma = window.confirm(
    `Sei sicuro di voler deassociare tutte le ${idsAssociati.length} controparti dal listino "${listino.nome}"?\n\n` +
    `Le controparti non avranno più questo listino come predefinito, salvo quelle che nel frattempo sono state associate a un altro listino.`
  );

  if (!conferma) return;

  try {
    const batch = writeBatch(db);

    const contropartiDaAggiornare = idsAssociati
      .map(id => fornitori.find(f => f.id === id))
      .filter(f => f && f.predefListino === listinoId);

    contropartiDaAggiornare.forEach(f => {
      batch.update(doc(db, "fornitori", f.id), {
        predefListino: null
      });
    });

    batch.update(doc(db, "listini", listinoId), {
      predefFornitori: []
    });

    await batch.commit();

    await scriviLog({
      pagina: "gestione-listini",
      evento: "DEASSOCIA_TUTTE_CONTROPARTI",
      riferimento: {
        collezione: "listini",
        documentoId: listinoId
      },
      before: {
        nomeListino: listino.nome,
        tipoListino: listino.tipoListino || "SCARICO",
        numeroControparti: idsAssociati.length,
        controparti: idsAssociati.map(id => {
          const controparte = fornitori.find(f => f.id === id);

          return {
            id,
            nome: controparte?.nome || id,
            listinoPredefinitoPrecedente:
              controparte?.predefListino || null
          };
        })
      },
      after: {
        nomeListino: listino.nome,
        tipoListino: listino.tipoListino || "SCARICO",
        contropartiAssociate: []
      },
      utente: getUtenteReact(),
      ripristinabile: false
    });

    await loadListini();
    await loadFornitori();

    alert(
      `Le ${idsAssociati.length} controparti sono state deassociate dal listino "${listino.nome}".`
    );
  } catch (errore) {
    console.error("Errore nella deassociazione massiva:", errore);
    alert(
      "Errore durante la deassociazione massiva. Verifica i dati prima di riprovare."
    );
  }
};


  const generaPDFListinoConHeader = async (listino) => {
    const { pdf, startY } = await PdfHeader();
    pdf.setFontSize(16);
    const { data, ora } = getDataOraStampa();

    pdf.setFontSize(16);
    pdf.text(`Listino: ${listino.nome} - Stampato il ${data} alle ${ora}`, 14, 65);

    pdf.setFontSize(12);
    pdf.text(`Tipo Listino: ${listino.tipoListino || "SCARICO"}`, 14, 75);

    const materiali = Object.keys(listino.prezzi || {}).sort();
    const rows = materiali.map(c => [
      c,
      listino.tipoListino === "CARICO"
        ? listino.prezzi?.[c]?.vendita ?? 0
        : listino.prezzi?.[c]?.acquisto ?? 0
    ]);

    autoTable(pdf, {
      startY: startY,
      head: [["Materiale", "Prezzo"]],
      body: rows,
      styles: { fontSize: 9 },
      theme: "grid"
    });

    await salvaESharePdfCapacitor(pdf, `listino_${listino.nome}.pdf`);
  };

  const salvaListino = async () => {
    if (!editor) return;

    try {
      const ref = doc(db, "listini", editor.id);

      await updateDoc(ref, {
        prezzi: editor.prezzi,
        nome: editor.nome,
        tipoListino: editor.tipoListino
      });

      const altriListini = listini.filter(
        l => l.id !== editor.id &&
        (l.tipoListino || "SCARICO") === editor.tipoListino
      );

      for (const l of altriListini) {
        let updated = false;
        const nuoviPrezzi = { ...(l.prezzi || {}) };

        Object.keys(propagaPrezzi).forEach(codice => {
          if (!propagaPrezzi[codice]) return;

          const valore = editor.prezzi?.[codice];
          if (!valore) return;

          nuoviPrezzi[codice] = {
            vendita: valore.vendita,
            acquisto: valore.acquisto
          };

          updated = true;
        });

        if (updated) {
          await updateDoc(doc(db, "listini", l.id), {
            prezzi: nuoviPrezzi
          });
        }
      }

      await scriviLog({
        pagina: "gestione-listini",
        evento: "MODIFICA_LISTINO",
        riferimento: {
          collezione: "listini",
          documentoId: editor.id
        },
        before: originalEditor,
        after: editor,
        utente: getUtenteReact(),
        ripristinabile: true
      });

      setEditor(null);
      setOriginalEditor(null);
      setPropagaPrezzi({});
      loadListini();

    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  const creaNuovoListino = async () => {
    try {
      if (!nuovoListino || !listinoDaCopiare) {
        alert("Compila tutti i campi");
        return;
      }

      const nomePulito = nuovoListino.trim().toLowerCase();

      const esiste = listini.some(l =>
        (l.nome || "").trim().toLowerCase() === nomePulito
      );

      if (esiste) {
        alert("Esiste già un listino con questo nome");
        return;
      }

      const origine = listini.find(l => l.id === listinoDaCopiare);
      if (!origine) {
        alert("Listino origine non trovato");
        return;
      }

      const prezziModificati = {};

      Object.entries(origine.prezzi || {}).forEach(([codice, valore]) => {
        const vendita = Number(valore?.vendita) || 0;
        const acquisto = Number(valore?.acquisto) || 0;

        let nuovaVendita = vendita;
        let nuovoAcquisto = acquisto;

        if (modificaPercentuale > 0) {
          const factor = modificaAzione === "AUMENTA"
            ? (1 + modificaPercentuale / 100)
            : (1 - modificaPercentuale / 100);

          nuovaVendita *= factor;
          nuovoAcquisto *= factor;
        }

        prezziModificati[codice] = {
          vendita: parseFloat(nuovaVendita.toFixed(2)),
          acquisto: parseFloat(nuovoAcquisto.toFixed(2))
        };
      });

      const copia = {
        nome: nuovoListino,
        prezzi: prezziModificati,
        predefFornitori: [],
        tipoListino: nuovoTipoListino || "SCARICO"
      };

      const docRef = await addDoc(collection(db, "listini"), copia);

      await scriviLog({
        pagina: "gestione-listini",
        evento: "CREAZIONE_LISTINO",
        riferimento: {
          collezione: "listini",
          documentoId: docRef.id
        },
        before: null,
        after: { id: docRef.id, ...copia },
        utente: getUtenteReact(),
        ripristinabile: true
      });

      setShowCreaForm(false);
      setNuovoListino("");
      setModificaPercentuale(0);

      await loadListini();

      alert("Listino creato con successo");

    } catch (e) {
      alert("Errore: " + e.message);
    }
  };

  const cancellaListino = async () => {
    if (!editor) return;

    try {
      const q = query(
        collection(db, "scarichi"),
        where("listino", "==", editor.nome)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const numeroScarichi = snap.size;

        if (window.confirm(`Listino usato in ${numeroScarichi} scarichi.\nVisualizzarli?`)) {
          navigate(`/gestione-scarichi?listino=${encodeURIComponent(editor.nome)}`);
        }
        return;
      }

      if (!window.confirm(`Cancellare "${editor.nome}"?`)) return;

      const datiOriginali = { ...editor };

      await deleteDoc(doc(db, "listini", editor.id));

      await scriviLog({
        pagina: "gestione-listini",
        evento: "CANCELLAZIONE_LISTINO",
        riferimento: {
          collezione: "listini",
          documentoId: editor.id
        },
        before: datiOriginali,
        after: null,
        utente: getUtenteReact(),
        ripristinabile: false
      });

      setEditor(null);
      loadListini();

    } catch (e) {
      setErrori(prev => [...prev, e.message]);
    }
  };

  // PDF
  const stampaListinoSelezionato = async () => {
    if (!editor) return;
    await generaPDFListinoConHeader(editor);
  };

  const stampaTuttiListini = async () => {
    const pdf = new jsPDF("p", "mm", "a4");

    for (let i = 0; i < listini.length; i++) {
      const l = listini[i];

      if (i !== 0) pdf.addPage();

      await generaPDFListinoConHeader(l, pdf);
    }

    await salvaESharePdfCapacitor(pdf, "tutti_listini.pdf");
  };

  let listiniOrdinati = [...listini].filter(
    l => (l.tipoListino || "SCARICO") === tipoFiltroListino
  );

  if (sortConfig.key) {
    listiniOrdinati.sort((a, b) => {
      let aVal = "";
      let bVal = "";

      switch (sortConfig.key) {
        case "nome":
          aVal = a.nome || "";
          bVal = b.nome || "";
          break;

        case "tipo":
          aVal = a.tipoListino || "SCARICO";
          bVal = b.tipoListino || "SCARICO";
          break;

        case "fornitori":
          aVal = (a.predefFornitori || []).length;
          bVal = (b.predefFornitori || []).length;
          break;

        case "index":
          aVal = listini.indexOf(a);
          bVal = listini.indexOf(b);
          break;
case "materiali":
  aVal = Object.keys(a.prezzi || {}).length;
  bVal = Object.keys(b.prezzi || {}).length;
  break;

case "movimenti":
  aVal = movimentiPerListino[`${a.tipoListino || "SCARICO"}|${a.nome}`] ?? -1;
  bVal = movimentiPerListino[`${b.tipoListino || "SCARICO"}|${b.nome}`] ?? -1;
  break;

case "controparti":
  aVal = (a.predefFornitori || [])
    .map(id => fornitori.find(f => f.id === id)?.nome || id)
    .join("; ");
  bVal = (b.predefFornitori || [])
    .map(id => fornitori.find(f => f.id === id)?.nome || id)
    .join("; ");
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

  const headerActions = (
    <>
      <ActionButton variant="admin" compact onClick={goHome}>
        🏠 Dashboard
      </ActionButton>
      <ActionButton variant="danger" compact onClick={handleLogout}>
        🚪 Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
      </ActionButton>
    </>
  );

  return (
    <PageLayout
      title="Gestione Listini"
      maxWidth={1600}
      headerActions={headerActions}
    >
      <div className="gestione-listini">
        <div className="gl-filter-panel">
          <label htmlFor="gl-tipo-filtro">Tipo listino:</label>
          <select
            id="gl-tipo-filtro"
            value={tipoFiltroListino}
            onChange={e => setTipoFiltroListino(e.target.value)}
          >
            <option value="SCARICO">Scarico (ingresso)</option>
            <option value="CARICO">Carico (uscita)</option>
          </select>
        </div>

        <div className="gl-toolbar">
          <ActionButton variant="admin" onClick={stampaTuttiListini}>
            🖨 Stampa tutti i listini
          </ActionButton>

          <ActionButton
            variant="admin"
            onClick={stampaListinoSelezionato}
            disabled={!editor}
          >
            🖨 Stampa listino selezionato
          </ActionButton>

          <ActionButton
            variant="primary"
            onClick={() => setShowCreaForm(true)}
          >
            ➕ Crea nuovo listino
          </ActionButton>
        </div>

        {showCreaForm && (
          <section className="gl-create-panel">
            <h3 className="gl-section-title">Crea nuovo listino</h3>

            <div className="gl-create-form">
              <div className="gl-form-field">
                <label className="gl-field-label" htmlFor="gl-nuovo-nome">
                  Nome nuovo listino
                </label>
                <input
                  id="gl-nuovo-nome"
                  type="text"
                  placeholder="Inserisci il nome"
                  value={nuovoListino}
                  onChange={e => setNuovoListino(e.target.value)}
                />
              </div>

              <div className="gl-form-field">
                <label className="gl-field-label" htmlFor="gl-listino-origine">
                  Copia prezzi da
                </label>
                <select
                  id="gl-listino-origine"
                  value={listinoDaCopiare}
                  onChange={e => setListinoDaCopiare(e.target.value)}
                >
                  {listiniOrdinati.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gl-form-field">
                <label className="gl-field-label" htmlFor="gl-nuovo-tipo">
                  Tipo del nuovo listino
                </label>
                <select
                  id="gl-nuovo-tipo"
                  value={nuovoTipoListino}
                  onChange={e => setNuovoTipoListino(e.target.value)}
                >
                  <option value="SCARICO">Scarico (ingresso)</option>
                  <option value="CARICO">Carico (uscita)</option>
                </select>
              </div>

              <div className="gl-form-field">
                <label className="gl-field-label" htmlFor="gl-modifica-azione">
                  Variazione prezzi
                </label>
                <select
                  id="gl-modifica-azione"
                  value={modificaAzione}
                  onChange={e => setModificaAzione(e.target.value)}
                >
                  <option value="AUMENTA">Aumenta prezzi</option>
                  <option value="DIMINUISCI">Diminuisci prezzi</option>
                </select>
              </div>

              <div className="gl-form-field">
                <label className="gl-field-label" htmlFor="gl-percentuale">
                  Percentuale di variazione
                </label>
                <div className="gl-percent-row">
                  <input
                    id="gl-percentuale"
                    type="number"
                    value={modificaPercentuale}
                    onChange={e => setModificaPercentuale(Number(e.target.value))}
                    min={0}
                    max={99}
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="gl-form-actions">
                <ActionButton variant="primary" onClick={creaNuovoListino}>
                  ✅ Crea listino
                </ActionButton>
              </div>
            </div>
          </section>
        )}

       
<div className="gl-table-wrapper">
  <table className="gl-table">
    <thead>
      <tr>
        <th
          className="gl-sortable"
          onClick={() => requestSort("index")}
        >
          #
        </th>

        <th
          className="gl-sortable"
          onClick={() => requestSort("nome")}
        >
          Nome listino
        </th>

        <th
          className="gl-sortable"
          onClick={() => requestSort("tipo")}
        >
          Tipo
        </th>

        <th
          className="gl-sortable"
          onClick={() => requestSort("materiali")}
        >
          Materiali
        </th>

        <th
          className="gl-sortable"
          onClick={() => requestSort("movimenti")}
        >
          Movimenti
        </th>

        <th
          className="gl-sortable"
          onClick={() => requestSort("controparti")}
        >
          Controparti predefinite
        </th>

        <th>Associa controparte</th>
      </tr>
    </thead>

    <tbody>
      {listiniOrdinati.map((l, i) => {
        const tipo = l.tipoListino || "SCARICO";
        const numeroMateriali = Object.keys(l.prezzi || {}).length;
        const conteggioMovimenti =
          movimentiPerListino[`${tipo}|${l.nome}`];
const nomiControparti = (l.predefFornitori || [])
  .map(id => fornitori.find(f => f.id === id)?.nome || id)
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
  .join("; ");

const contropartiOrdinate = (l.predefFornitori || [])
  .map(id => fornitori.find(f => f.id === id)?.nome || id)
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
const contropartiDisponibili = fornitori
  .filter(f => !(l.predefFornitori || []).includes(f.id))
  .sort((a, b) =>
    (a.nome || a.id).localeCompare(
      b.nome || b.id,
      "it",
      { sensitivity: "base" }
    )
  )
  .map(f => ({
    value: f.id,
    label: f.nome || f.id
  }));
        return (
          <tr
            key={l.id}
            onClick={() => selezionaListino(l.id)}
            className={
              editor?.id === l.id ? "gl-row-selected" : ""
            }
          >
            <td className="gl-number-cell">{i + 1}</td>

            <td className="gl-name-cell">{l.nome || "-"}</td>

            <td>{tipo}</td>

            <td className="gl-number-cell">
              {numeroMateriali || "-"}
            </td>

            <td className="gl-number-cell">
              {conteggioMovimenti > 0
                ? conteggioMovimenti
                : "-"}
            </td>

           <td className="gl-suppliers-cell">
  {nomiControparti
    ? contropartiOrdinate.map((nome, indice) => (
          <div key={`${l.id}-${indice}`} className="gl-counterparty-item">
            {nome}
          </div>
        ))
    : "-"}
</td>

            
<td className="gl-association-cell">
  <div
    className="gl-association-controls"
    onClick={e => e.stopPropagation()}
  >
    <Select
      options={contropartiDisponibili}
      value={
        contropartiDisponibili.find(
          o => o.value === (fornitoreSelezionato[l.id] || "")
        ) || null
      }
      onChange={selected => {
        setFornitoreSelezionato(prev => ({
          ...prev,
          [l.id]: selected?.value || ""
        }));
      }}
      placeholder="Cerca controparte..."
      isSearchable
    />

    <button
      type="button"
      className="gl-small-button"
      onClick={() =>
        associaFornitore(
          l.id,
          fornitoreSelezionato[l.id]
        )
      }
      disabled={!fornitoreSelezionato[l.id]}
    >
      Associa
    </button>
<button
  type="button"
  className="gl-small-button"
  onClick={() => associaTutteControparti(l.id)}
  disabled={
    fornitori.length > 0 &&
    fornitori.every(f => (l.predefFornitori || []).includes(f.id))
  }
>
  Associa tutte
</button>

<button
  type="button"
  className="gl-small-button"
  onClick={() => deassociaTutteControparti(l.id)}
  disabled={(l.predefFornitori || []).length === 0}
>
  Deassocia tutte
</button>
  </div>
</td>


          </tr>
        );
      })}
    </tbody>
  </table>
</div>


        {editor && (
          <section className="gl-editor">
            <div className="gl-editor-header">
              <h3>Modifica listino: {editor.nome}</h3>
            </div>

            <div className="gl-editor-type">
              <label className="gl-field-label" htmlFor="gl-editor-tipo">
                Tipo listino:
              </label>
              <select
                id="gl-editor-tipo"
                value={editor.tipoListino || "SCARICO"}
                onChange={e =>
                  setEditor(prev => ({
                    ...prev,
                    tipoListino: e.target.value
                  }))
                }
              >
                <option value="SCARICO">Scarico (ingresso)</option>
                <option value="CARICO">Carico (uscita)</option>
              </select>
            </div>
<div className="gl-price-unit">Prezzi in €/kg</div>

<div className="gl-price-list"></div>
            <div className="gl-price-list">
              {materialiDinamici.map(c => (
                <div key={c} className="gl-price-item">
                  <label
                    className="gl-price-name"
                    htmlFor={`gl-prezzo-${materialiDinamici.indexOf(c)}`}
                  >
                    {c}
                  </label>

                  <input
                    id={`gl-prezzo-${materialiDinamici.indexOf(c)}`}
                    className={`gl-price-input ${
                      campoModificato(c) ? "gl-price-input--modified" : ""
                    }`}
                    type="number"
                    value={
                      editor.tipoListino === "CARICO"
                        ? editor.prezzi?.[c]?.vendita ?? 0
                        : editor.prezzi?.[c]?.acquisto ?? 0
                    }
                    onChange={e => updatePrezzo(c, e.target.value)}
                  />

                  {campoModificato(c) && (
                    <label className="gl-propagate-option">
                      <input
                        type="checkbox"
                        checked={!!propagaPrezzi[c]}
                        onChange={e =>
                          setPropagaPrezzi(prev => ({
                            ...prev,
                            [c]: e.target.checked
                          }))
                        }
                      />
                      <span>
                        Applica a tutti i listini ({editor.tipoListino})
                      </span>
                    </label>
                  )}
                </div>
              ))}
            </div>

            <label className="gl-global-propagate">
              <input
                type="checkbox"
                checked={propagaModificaGlobale}
                onChange={e => setPropagaModificaGlobale(e.target.checked)}
              />
              <span>
                Applicare questa modifica a tutti i listini (
                {editor.tipoListino === "CARICO" ? "CARICO" : "SCARICO"})
              </span>
            </label>

            <div className="gl-editor-actions">
              <ActionButton variant="primary" onClick={salvaListino}>
                💾 Salva modifiche
              </ActionButton>

              <ActionButton variant="danger" onClick={cancellaListino}>
                🗑 Cancella listino
              </ActionButton>
            </div>
          </section>
        )}

        {errori.length > 0 && (
          <div className="gl-errors" role="alert">
            {errori.join("\n")}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default GestioneListini;
