// src/components/ConfigurazioniGenerali.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc
} from "firebase/firestore";
import PageLayout from "./layout/PageLayout";
import ActionButton from "./ui/ActionButton";
import { FaSignOutAlt } from "react-icons/fa";
import "./ConfigurazioniGenerali.css";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from "date-fns/locale";
import { signOut } from "firebase/auth";

import Select from "react-select";
const ConfigurazioniGenerali = ({ logout }) => {
  const navigate = useNavigate();
const [listinoCaricoDefault, setListinoCaricoDefault] = useState("");
const [listinoScaricoDefault, setListinoScaricoDefault] = useState("");

  const [logoBase64, setLogoBase64] = useState("");
  const [logoMimeType, setLogoMimeType] = useState("image/png");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [capCitta, setCapCitta] = useState("");
  const [piva, setPiva] = useState("");
  const [guadagnoMinKg, setGuadagnoMinKg] = useState(0.2);
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [mailRecupero, setMailRecupero] = useState("");
const [listini, setListini] = useState([]);
const [codiceFiscale, setCodiceFiscale] = useState("");
const [codiceDestinatario, setCodiceDestinatario] = useState("");
const [pec, setPec] = useState("");
const [emailAziendale, setEmailAziendale] = useState("");
const [regimeFiscale, setRegimeFiscale] = useState("RF18");
const [naturaIvaDefault, setNaturaIvaDefault] = useState("N6.1");
const [riferimentoNormativo, setRiferimentoNormativo] = useState(
  "N6.1 - ART. 74 C.7 E 8 DPR 633/72"
);
const [condizioniPagamentoDefault, setCondizioniPagamentoDefault] =
  useState("TP02");
const [modalitaPagamentoDefault, setModalitaPagamentoDefault] =
  useState("MP05");

const [banche, setBanche] = useState([]);
const [bancaNome, setBancaNome] = useState("");
const [bancaIban, setBancaIban] = useState("");
const [bancaAbi, setBancaAbi] = useState("");
const [bancaCab, setBancaCab] = useState("");
const [bancaBic, setBancaBic] = useState("");
const [bancaIntestatario, setBancaIntestatario] = useState("");
const [bancaPredefinita, setBancaPredefinita] = useState(true);
const [bancaAttiva, setBancaAttiva] = useState(true);
const [bancaModificaId, setBancaModificaId] = useState(null);
const [loadingBanca, setLoadingBanca] = useState(false);

  // 🔥 FIX: ora è una Date vera
  const [giornoAvviamento, setGiornoAvviamento] = useState(null);

  const currentUser =
    JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};
 const handleLogout = async () => {
  await signOut(auth);
  sessionStorage.clear();
  navigate("/login", { replace: true });
};
  // -------- LOAD CONFIG --------
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "configurazioni", "datiAzienda");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();

          setRagioneSociale(data.ragioneSociale || "");
          setIndirizzo(data.indirizzo || "");
          setCapCitta(data.capCitta || "");
          setPiva(data.piva || "");
setCodiceFiscale(
  data.codiceFiscale || data.piva || ""
);
setCodiceDestinatario(
  data.codiceDestinatario ||
  data["Cod.destinatario"] ||
  ""
);
setPec(data.pec || "");
setEmailAziendale(
  data.emailAziendale ||
  data.mailRecupero ||
  ""
);
setLogoBase64(data.logoBase64 || "");
setLogoMimeType(data.logoMimeType || "image/png");

setGuadagnoMinKg(
  data.guadagnoMinKg !== undefined
    ? data.guadagnoMinKg
    : 0.2
);

setMailRecupero(
  data.mailRecupero || ""
);

setRegimeFiscale(
  data.regimeFiscale || "RF18"
);

setNaturaIvaDefault(
  data.naturaIvaDefault || "N6.1"
);

setRiferimentoNormativo(
  data.riferimentoNormativo ||
  "N6.1 - ART. 74 C.7 E 8 DPR 633/72"
);

setCondizioniPagamentoDefault(
  data.condizioniPagamentoDefault ||
  "TP02"
);

setModalitaPagamentoDefault(
  data.modalitaPagamentoDefault ||
  "MP05"
);

          // 🔥 FIX: parsing ISO -> Date
          setGiornoAvviamento(
            data.giornoAvviamento ? new Date(data.giornoAvviamento) : null
          );

          setListinoCaricoDefault(data.ListinoCARICODefault || "");
setListinoScaricoDefault(data.ListinoSCARICODefault || "");

        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchConfig();
  }, []);

useEffect(() => {
  const fetchListini = async () => {
    try {
      const snap = await getDocs(collection(db, "listini"));
      const arr = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setListini(arr);
    } catch (err) {
      console.error("Errore caricamento listini:", err);
    }
  };

  fetchListini();
}, []);

useEffect(() => {
  const fetchBanche = async () => {
    try {
      const snap = await getDocs(
        collection(db, "banche")
      );

      const arr = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data()
        }))
        .sort((a, b) => {
          if (a.predefinita && !b.predefinita) return -1;
          if (!a.predefinita && b.predefinita) return 1;

          return (a.nome || "").localeCompare(
            b.nome || "",
            "it"
          );
        });

      setBanche(arr);

    } catch (err) {
      console.error(
        "Errore caricamento banche:",
        err
      );
    }
  };

  fetchBanche();
}, []);


const handleFileChange = (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  const tipiConsentiti = [
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  if (!tipiConsentiti.includes(file.type)) {
    setMessaggio("Formato immagine non supportato. Usa PNG, JPEG o WebP.");
    e.target.value = "";
    return;
  }

  // Evita immagini troppo grandi nel documento Firestore.
  if (file.size > 500 * 1024) {
    setMessaggio("Il logo è troppo grande. Scegli un'immagine inferiore a 500 KB.");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onloadend = () => {
    if (typeof reader.result !== "string") {
      setMessaggio("Errore durante la lettura del logo.");
      return;
    }

    const base64 = reader.result.split(",")[1];

    setLogoBase64(base64);
    setLogoMimeType(file.type);
    setMessaggio("");
  };

  reader.onerror = () => {
    setMessaggio("Errore durante la lettura del logo.");
  };

  reader.readAsDataURL(file);
};


 const handleSave = async () => {
  setLoading(true);

  try {
    await setDoc(
      doc(db, "configurazioni", "datiAzienda"),
      {
        logoBase64,
        logoMimeType,
        ragioneSociale,
        indirizzo,
        capCitta,

        piva,
        codiceFiscale,
        codiceDestinatario,

        pec,
        emailAziendale,
        mailRecupero,

        regimeFiscale,
        naturaIvaDefault,
        riferimentoNormativo,
        condizioniPagamentoDefault,
        modalitaPagamentoDefault,

        guadagnoMinKg,

        giornoAvviamento: giornoAvviamento
          ? giornoAvviamento.toISOString()
          : null,

        updatedAt: new Date(),

        ListinoCARICODefault:
          listinoCaricoDefault,

        ListinoSCARICODefault:
          listinoScaricoDefault,
      },
      {
        merge: true
      }
    );

    setMessaggio(
      "Configurazione salvata con successo ✅"
    );

  } catch (err) {
    console.error(err);

    setMessaggio(
      "Errore durante il salvataggio ❌"
    );

  } finally {
    setLoading(false);
  }
};

  
const resetBanca = () => {
  setBancaNome("");
  setBancaIban("");
  setBancaAbi("");
  setBancaCab("");
  setBancaBic("");
  setBancaIntestatario(ragioneSociale || "");
  setBancaPredefinita(banche.length === 0);
  setBancaAttiva(true);
  setBancaModificaId(null);
};

const salvaBanca = async () => {
  if (!bancaNome.trim()) {
    alert("❌ Inserire il nome della banca");
    return;
  }

  if (!bancaIban.trim()) {
    alert("❌ Inserire l'IBAN");
    return;
  }

  setLoadingBanca(true);

  try {
    const dati = {
      nome: bancaNome.trim(),
      iban: bancaIban
        .replace(/\s+/g, "")
        .toUpperCase(),
      abi: bancaAbi.trim(),
      cab: bancaCab.trim(),
      bic: bancaBic.trim().toUpperCase(),
      intestatario:
        bancaIntestatario.trim() ||
        ragioneSociale.trim(),
      predefinita: bancaPredefinita,
      attiva: bancaAttiva,
      updatedAt: new Date()
    };

    /*
     * Se questa banca diventa predefinita,
     * togliamo il flag dalle altre.
     */
    if (bancaPredefinita) {
      const snap = await getDocs(
        collection(db, "banche")
      );

      for (const d of snap.docs) {
        if (
          !bancaModificaId ||
          d.id !== bancaModificaId
        ) {
          await updateDoc(
            doc(db, "banche", d.id),
            {
              predefinita: false
            }
          );
        }
      }
    }

    if (bancaModificaId) {
      await updateDoc(
        doc(
          db,
          "banche",
          bancaModificaId
        ),
        dati
      );
    } else {
      await addDoc(
        collection(db, "banche"),
        dati
      );
    }

    const snapAggiornato = await getDocs(
      collection(db, "banche")
    );

    setBanche(
      snapAggiornato.docs
        .map((d) => ({
          id: d.id,
          ...d.data()
        }))
        .sort((a, b) => {
          if (
            a.predefinita &&
            !b.predefinita
          ) {
            return -1;
          }

          if (
            !a.predefinita &&
            b.predefinita
          ) {
            return 1;
          }

          return (a.nome || "").localeCompare(
            b.nome || "",
            "it"
          );
        })
    );

    resetBanca();

  } catch (err) {
    console.error(
      "Errore salvataggio banca:",
      err
    );

    alert(
      "❌ Errore durante il salvataggio della banca"
    );

  } finally {
    setLoadingBanca(false);
  }
};

const modificaBanca = (banca) => {
  setBancaNome(banca.nome || "");
  setBancaIban(banca.iban || "");
  setBancaAbi(banca.abi || "");
  setBancaCab(banca.cab || "");
  setBancaBic(banca.bic || "");
  setBancaIntestatario(
    banca.intestatario ||
    ragioneSociale ||
    ""
  );
  setBancaPredefinita(
    banca.predefinita === true
  );
  setBancaAttiva(
    banca.attiva !== false
  );
  setBancaModificaId(banca.id);
};

const toggleBancaAttiva = async (banca) => {
  try {
    await updateDoc(
      doc(db, "banche", banca.id),
      {
        attiva: banca.attiva === false,
        updatedAt: new Date()
      }
    );

    setBanche((prev) =>
      prev.map((b) =>
        b.id === banca.id
          ? {
              ...b,
              attiva: banca.attiva === false
            }
          : b
      )
    );

  } catch (err) {
    console.error(
      "Errore modifica stato banca:",
      err
    );

    alert(
      "❌ Errore durante la modifica della banca"
    );
  }
};

 
return (
  <PageLayout
    title="Configurazioni Generali Azienda"
    logoBase64={logoBase64}
    maxWidth={1400}
    headerActions={
      <>
        <ActionButton
          variant="admin"
          compact
          onClick={() => navigate("/admin")}
        >
          🏠 Dashboard
        </ActionButton>

        <ActionButton
          variant="danger"
          compact
          onClick={handleLogout}
        >
          <FaSignOutAlt />
          Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
        </ActionButton>
      </>
    }
  >
    <div className="mf-config">
      <section className="mf-config-section">
        <h3>Dati aziendali</h3>

        <div className="mf-config-grid">
          <div className="mf-config-field mf-config-field--full">
            <label>Logo aziendale</label>
            <div className="mf-config-logo">
              {logoBase64 && (
                <img
                  src={`data:${logoMimeType};base64,${logoBase64}`}
                  alt="Logo aziendale"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="mf-config-field">
            <label>Ragione sociale</label>
            <input
              type="text"
              value={ragioneSociale}
              onChange={(e) => setRagioneSociale(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>Partita IVA</label>
            <input
              type="text"
              value={piva}
              onChange={(e) => setPiva(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>Indirizzo</label>
            <input
              type="text"
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>CAP e città</label>
            <input
              type="text"
              value={capCitta}
              onChange={(e) => setCapCitta(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>Guadagno minimo €/kg</label>
            <input
              type="number"
              step="0.01"
              value={guadagnoMinKg}
              onChange={(e) =>
                setGuadagnoMinKg(parseFloat(e.target.value) || 0.2)
              }
            />
          </div>

          <div className="mf-config-field">
            <label>Mail recupero password</label>
            <input
              type="email"
              value={mailRecupero}
              onChange={(e) => setMailRecupero(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="mf-config-section">
        <h3>Dati fiscali e fatturazione</h3>

        <div className="mf-config-grid">
          <div className="mf-config-field">
            <label>Codice fiscale</label>
            <input
              type="text"
              value={codiceFiscale}
              onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
            />
          </div>

          <div className="mf-config-field">
            <label>Codice destinatario</label>
            <input
              type="text"
              value={codiceDestinatario}
              onChange={(e) => setCodiceDestinatario(e.target.value.toUpperCase())}
            />
          </div>

          <div className="mf-config-field">
            <label>PEC</label>
            <input
              type="email"
              value={pec}
              onChange={(e) => setPec(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>E-mail aziendale</label>
            <input
              type="email"
              value={emailAziendale}
              onChange={(e) => setEmailAziendale(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>Regime fiscale</label>
            <input
              type="text"
              value={regimeFiscale}
              onChange={(e) => setRegimeFiscale(e.target.value.toUpperCase())}
            />
          </div>

          <div className="mf-config-field">
            <label>Natura IVA predefinita</label>
            <input
              type="text"
              value={naturaIvaDefault}
              onChange={(e) => setNaturaIvaDefault(e.target.value.toUpperCase())}
            />
          </div>

          <div className="mf-config-field mf-config-field--full">
            <label>Riferimento normativo</label>
            <input
              type="text"
              value={riferimentoNormativo}
              onChange={(e) => setRiferimentoNormativo(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>Condizioni pagamento</label>
            <input
              type="text"
              value={condizioniPagamentoDefault}
              onChange={(e) =>
                setCondizioniPagamentoDefault(e.target.value.toUpperCase())
              }
            />
          </div>

          <div className="mf-config-field">
            <label>Modalità pagamento</label>
            <input
              type="text"
              value={modalitaPagamentoDefault}
              onChange={(e) =>
                setModalitaPagamentoDefault(e.target.value.toUpperCase())
              }
            />
          </div>
        </div>
      </section>

      <section className="mf-config-section">
        <h3>Listini predefiniti</h3>

        <div className="mf-config-grid">
          <div className="mf-config-field">
            <label>Listino carico default</label>
            <Select
              className="mf-config-select"
              classNamePrefix="react-select"
              options={listini
                .filter((l) => l.tipoListino === "CARICO")
                .map((l) => ({ value: l.id, label: l.nome }))}
              value={
                listini
                  .filter((l) => l.tipoListino === "CARICO")
                  .map((l) => ({ value: l.id, label: l.nome }))
                  .find((o) => o.value === listinoCaricoDefault) || null
              }
              onChange={(selected) =>
                setListinoCaricoDefault(selected?.value || "")
              }
              placeholder="Seleziona listino carico..."
              isSearchable
              isClearable
            />
          </div>

          <div className="mf-config-field">
            <label>Listino scarico default</label>
            <Select
              className="mf-config-select"
              classNamePrefix="react-select"
              options={listini
                .filter((l) => l.tipoListino === "SCARICO")
                .map((l) => ({ value: l.id, label: l.nome }))}
              value={
                listini
                  .filter((l) => l.tipoListino === "SCARICO")
                  .map((l) => ({ value: l.id, label: l.nome }))
                  .find((o) => o.value === listinoScaricoDefault) || null
              }
              onChange={(selected) =>
                setListinoScaricoDefault(selected?.value || "")
              }
              placeholder="Seleziona listino scarico..."
              isSearchable
              isClearable
            />
          </div>
        </div>
      </section>

      <section className="mf-config-section">
        <h3>Gestione banche</h3>

        <div className="mf-config-grid">
          <div className="mf-config-field">
            <label>Nome banca</label>
            <input
              type="text"
              value={bancaNome}
              onChange={(e) => setBancaNome(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>IBAN</label>
            <input
              type="text"
              value={bancaIban}
              onChange={(e) => setBancaIban(e.target.value.toUpperCase())}
            />
          </div>

          <div className="mf-config-field">
            <label>ABI</label>
            <input
              type="text"
              value={bancaAbi}
              onChange={(e) => setBancaAbi(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>CAB</label>
            <input
              type="text"
              value={bancaCab}
              onChange={(e) => setBancaCab(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label>BIC (SWIFT)</label>
            <input
              type="text"
              value={bancaBic}
              onChange={(e) => setBancaBic(e.target.value.toUpperCase())}
            />
          </div>

          <div className="mf-config-field">
            <label>Intestatario</label>
            <input
              type="text"
              value={bancaIntestatario}
              onChange={(e) => setBancaIntestatario(e.target.value)}
            />
          </div>

          <div className="mf-config-field">
            <label className="mf-config-checkbox">
              <input
                type="checkbox"
                checked={bancaPredefinita}
                onChange={(e) => setBancaPredefinita(e.target.checked)}
              />
              Banca predefinita
            </label>
          </div>

          <div className="mf-config-field">
            <label className="mf-config-checkbox">
              <input
                type="checkbox"
                checked={bancaAttiva}
                onChange={(e) => setBancaAttiva(e.target.checked)}
              />
              Banca attiva
            </label>
          </div>
        </div>

        <div className="mf-config-banca-actions">
          <ActionButton
            onClick={salvaBanca}
            disabled={loadingBanca}
          >
            {loadingBanca
              ? "Salvataggio..."
              : bancaModificaId
              ? "Aggiorna banca"
              : "Aggiungi banca"}
          </ActionButton>

          {bancaModificaId && (
            <ActionButton variant="admin" onClick={resetBanca}>
              Annulla modifica
            </ActionButton>
          )}
        </div>

        <div className="mf-config-table-wrap">
          {banche.length === 0 ? (
            <p style={{ padding: 12, margin: 0 }}>
              Nessuna banca configurata.
            </p>
          ) : (
            <table className="mf-config-table">
              <thead>
                <tr>
                  <th>Banca</th>
                  <th>IBAN</th>
                  <th>ABI</th>
                  <th>CAB</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {banche.map((banca) => (
                  <tr key={banca.id}>
                    <td>
                      {banca.nome}
                      {banca.predefinita && <strong> ⭐</strong>}
                    </td>
                    <td>{banca.iban || "-"}</td>
                    <td>{banca.abi || "-"}</td>
                    <td>{banca.cab || "-"}</td>
                    <td>{banca.attiva === false ? "Disattiva" : "Attiva"}</td>
                    <td>
                      <div className="mf-config-table-actions">
                        <ActionButton
                          variant="admin"
                          compact
                          onClick={() => modificaBanca(banca)}
                        >
                          Modifica
                        </ActionButton>
                        <ActionButton
                          variant={banca.attiva === false ? "primary" : "danger"}
                          compact
                          onClick={() => toggleBancaAttiva(banca)}
                        >
                          {banca.attiva === false ? "Attiva" : "Disattiva"}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mf-config-section">
        <h3>Avviamento gestionale</h3>

        <div className="mf-config-grid">
          <div className="mf-config-field mf-config-date">
            <label>Giorno di avviamento gestionale</label>
            <DatePicker
              selected={
                giornoAvviamento &&
                !isNaN(new Date(giornoAvviamento).getTime())
                  ? new Date(giornoAvviamento)
                  : null
              }
              onChange={(date) => setGiornoAvviamento(date)}
              dateFormat="dd MMM yyyy"
              locale={it}
              placeholderText="Seleziona data avvio"
              isClearable
            />
          </div>
        </div>
      </section>

      <div className="mf-config-footer">
        <ActionButton onClick={handleSave} disabled={loading}>
          {loading ? "Salvataggio..." : "Salva configurazione"}
        </ActionButton>
      </div>

      {messaggio && (
        <div className="mf-config-message" role="status">
          {messaggio}
        </div>
      )}
    </div>
  </PageLayout>
);

};

export default ConfigurazioniGenerali;