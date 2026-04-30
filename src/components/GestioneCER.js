// src/pages/GestioneCER.js
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
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

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const GestioneCER = () => {
  const navigate = useNavigate();
const [filtroTipoMovimento, setFiltroTipoMovimento] = useState("TUTTI"); // SCARICO | CARICO | TUTTI
  const [materiali, setMateriali] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [listini, setListini] = useState([]);
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
      const safeDate = (d) => {
  if (!d) return null;
  if (typeof d.toDate === "function") return d.toDate();
  if (d instanceof Date) return d;
  return new Date(d);
};

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

const safeDate = (d) => {
  if (!d) return null;

  if (typeof d.toDate === "function") {
    return d.toDate();
  }

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

  // ---------------- TOGGLE DETTAGLI ----------------
  const toggleDettagli = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ---------------- PREPARO MAPPA LISTINI ----------------
  const listiniMap = Object.fromEntries(listini.map(l => [l.nome, l]));

  // ---------------- FILTRAGGIO ----------------
 // ---------------- FILTRAGGIO MATERIALI DINAMICO ----------------
const materialiFiltrati = materiali
  .filter(m => (filtroMateriale==="Tutti" || m.nome===filtroMateriale) && (filtroCER==="Tutti" || m.codiceCER===filtroCER))
  .map(m => {
    const start = dal;
    const end = al ? new Date(al) : null;
    if(end) end.setHours(23,59,59,999);

    // unisco scarichi e carichi in un unico array
    let movimenti = [
      ...scarichi.map(s => ({ ...s, tipo: "scarico" })),
      ...carichi.map(c => ({ ...c, tipo: "carico" }))
    ];

    // filtro per date se il checkbox 'tutti' non è selezionato
    movimenti = movimenti.filter(mov => {
      const dataM = mov.data?.toDate?.();
      return !(!tutti && start && end) || (dataM && dataM >= start && dataM <= end);
    });

    // FILTRAGGIO E CALCOLO DETTAGLIO
const movimentiMateriale = movimenti
  .filter(mov => {
    if (filtroTipoMovimento === "SCARICO") return mov.tipo === "scarico";
    if (filtroTipoMovimento === "CARICO") return mov.tipo === "carico";
    return true; // TUTTI
  })
  .flatMap(mov =>
    (mov.scarico || mov.carico || []).flatMap(blocco =>
      (blocco.righe || [])
        .filter(r => r.materiale === m.nome)
        .map(r => {
          let prezzoKg = 0;
          let prezzoTotale = 0;

          if (mov.tipo === "scarico") {
            prezzoKg = r.prezzoAcquisto || 0;
            prezzoTotale = prezzoKg * (r.peso || 0);
          }

          if (mov.tipo === "carico") {
            prezzoKg = r.prezzoVendita || 0;
            prezzoTotale = prezzoKg * (r.peso || 0);
          }

          return {
            ...r,
            data: mov.data,
            listino: mov.listino,
            fornitore: mov.fornitore,
            tipo: mov.tipo,
            prezzoKg,
            prezzoTotale
          };
        })
    )
  );

    movimentiMateriale.sort((a,b) => (a.data?.toDate?.() || new Date(0)) - (b.data?.toDate?.() || new Date(0)));

    // Calcolo i numeri dinamici in base al filtroTipoMovimento
    const nrScarichi = movimentiMateriale.filter(r => r.tipo === "scarico").length;
    const nrCarichi = movimentiMateriale.filter(r => r.tipo === "carico").length;
    const nrMovimenti = movimentiMateriale.length;

    const dataPrimoScarico = movimentiMateriale.find(r => r.tipo === "scarico") ? formatDataIT(movimentiMateriale.find(r => r.tipo === "scarico").data.toDate()) : "";
    const dataUltimoScarico = [...movimentiMateriale].reverse().find(r => r.tipo === "scarico") ? formatDataIT([...movimentiMateriale].reverse().find(r => r.tipo === "scarico").data.toDate()) : "";
    const dataPrimoCarico = movimentiMateriale.find(r => r.tipo === "carico") ? formatDataIT(movimentiMateriale.find(r => r.tipo === "carico").data.toDate()) : "";
    const dataUltimoCarico = [...movimentiMateriale].reverse().find(r => r.tipo === "carico") ? formatDataIT([...movimentiMateriale].reverse().find(r => r.tipo === "carico").data.toDate()) : "";
    const dataPrimoMovimento = nrMovimenti ? formatDataIT(safeDate( movimentiMateriale[0].data.toDate())) : "";
    const dataUltimoMovimento = nrMovimenti ? formatDataIT(movimentiMateriale[nrMovimenti-1].data.toDate()) : "";

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
  .sort((a,b) => {
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
  y -= 30;

  // 🔥 FILTRI
  const formatData = (d) => {
    if (!d) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  if (!tutti) {
    const label = `Dal ${formatData(dal) || "..."} Al ${formatData(al) || "..."}`;
    pdf.setFontSize(11);
    pdf.text(label, 14, y);
    y += 7;
  }

  pdf.setFontSize(11);
  pdf.text(`Tipo Movimento: ${filtroTipoMovimento}`, 14, y);
  y += 10;

  // 🔥 INTESTAZIONI DINAMICHE
  let head = [];
  if (filtroTipoMovimento === "SCARICO") {
    head = [["Nome", "Categoria", "CER", "Nr Scarichi", "Primo", "Ultimo"]];
  } else if (filtroTipoMovimento === "CARICO") {
    head = [["Nome", "Categoria", "CER", "Nr Carichi", "Primo", "Ultimo"]];
  } else {
    head = [["Nome", "Categoria", "CER", "Nr Mov", "Primo", "Ultimo"]];
  }

  // 🔥 DATI
  const body = materialiFiltrati.map((m) => {
    if (filtroTipoMovimento === "SCARICO") {
      return [
        m.nome,
        m.categoria,
        m.codiceCER,
        m.nrScarichi,
        m.dataPrimoScarico,
        m.dataUltimoScarico,
      ];
    }

    if (filtroTipoMovimento === "CARICO") {
      return [
        m.nome,
        m.categoria,
        m.codiceCER,
        m.nrCarichi,
        m.dataPrimoCarico,
        m.dataUltimoCarico,
      ];
    }

    return [
      m.nome,
      m.categoria,
      m.codiceCER,
      m.nrMovimenti,
      m.dataPrimoMovimento,
      m.dataUltimoMovimento,
    ];
  });

  autoTable(pdf, {
    startY: y,
    head,
    body,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [230, 230, 230] },
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
</div>



      <div style={{margin:"20px 0", display:"flex", gap:"12px", alignItems:"center"}}>
        <label>
          Materiale:
          <select value={filtroMateriale} onChange={e=>setFiltroMateriale(e.target.value)}>
            {materialiDropdown.map(m=> <option key={m}>{m}</option>)}
          </select>
        </label>

        <label>
          Codice CER:
          <select value={filtroCER} onChange={e=>setFiltroCER(e.target.value)}>
            {cerDropdown.map(c=> <option key={c}>{c}</option>)}
          </select>
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
                <td>{m.nrScarichi}</td>
                <td>{m.dataPrimoScarico}</td>
                <td>{m.dataUltimoScarico}</td>
                <td>
                  <button onClick={()=>handleEdit(m)}>Modifica</button>
                  {m.nrScarichi>0 && (
                    <button style={{marginLeft:5}} onClick={()=>toggleDettagli(m.idDoc)}>
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
          <td>{r.data?.toDate().toLocaleString("it-IT")}</td>
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