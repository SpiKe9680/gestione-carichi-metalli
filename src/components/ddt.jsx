// src/components/DDT.jsx
import React, { useEffect, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  addDoc,
  collection
} from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { FaSignOutAlt } from "react-icons/fa";
import DatePicker from "react-datepicker";
import autoTable from "jspdf-autotable";
import { PdfHeader } from "../utils/dateUtils";
import { salvaESharePdfCapacitor } from "../utils/pdfStorage";

const formattaDataIt = (d) =>
  d ? new Date(d).toLocaleDateString("it-IT") : "";

const DDT = ({ logout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser =
    JSON.parse(sessionStorage.getItem("utenteLoggato")) || {};

  const editingId = location.state?.id || null;

  // ------------------------------
  // STATI PRINCIPALI
  // ------------------------------
  const [numeroDDT, setNumeroDDT] = useState("");
  const [dataDDT, setDataDDT] = useState(new Date());
  const [oraDDT, setOraDDT] = useState("08:00");
  const [usaOra, setUsaOra] = useState(true);
const [tipoMovimento, setTipoMovimento] = useState("carico"); 

  const [selectedControparte, setSelectedControparte] = useState("");
  const [controparti, setControparti] = useState([]);
  const [nomeControparte, setNomeControparte] = useState("");
  const [indirizzoControparte, setIndirizzoControparte] = useState("");
  const [pivaControparte, setPivaControparte] = useState("");

  // DESTINAZIONE
  const [destinazioneNome, setDestinazioneNome] = useState("");
  const [destinazioneIndirizzo, setDestinazioneIndirizzo] = useState("");
  const [destinazionePiva, setDestinazionePiva] = useState("");

  const [vettore, setVettore] = useState("");
  const [conducente, setConducente] = useState("");
  const [targa, setTarga] = useState("");
  const [rimorchio, setRimorchio] = useState("");
  const [colli, setColli] = useState("");
  const [porto, setPorto] = useState("FRANCO");
  const [causale, setCausale] = useState("");
  const [luogo, setLuogo] = useState("");

  const [riferimentoOrdine, setRiferimentoOrdine] = useState("");

  const [descrizioneMateriale, setDescrizioneMateriale] = useState("");
  const [composizione, setComposizione] = useState("");
  const [dimensione, setDimensione] = useState("");
  const [tipo, setTipo] = useState("");
  const [caratteristiche, setCaratteristiche] = useState("");

  const [pesoDichiarato, setPesoDichiarato] = useState("");
  const [pesoRiscontrato, setPesoRiscontrato] = useState("");

  const [note, setNote] = useState("");

  const [config, setConfig] = useState(null);

  // DATI AZIENDALI
  const [configAzienda, setConfigAzienda] = useState(null);

  useEffect(() => {
    const loadAzienda = async () => {
      const ref = doc(db, "Configurazioni", "datiAzienda");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setConfigAzienda(snap.data());
      } else {
        setConfigAzienda({
          ragioneSociale: "TAMMARO METALLI SRL",
          indirizzo: "VIALE AGRIGENTO, 1",
          capCitta: "80025 CASANDRINO (NA)",
          piva: "10097291214",
          logoBase64: null
        });
      }
    };

    loadAzienda();
  }, []);

  // ------------------------------
  // CARICA CONFIG
  // ------------------------------
  useEffect(() => {
    const loadConfig = async () => {
      const ref = doc(db, "ddt_config", "default");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();

        setConfig({
          vettori: data.vettori || [],
          conducenti: data.conducenti || [],
          targhe: data.targhe || [],
          rimorchi: data.rimorchi || [],
          causali: data.causali || [],
          descrizioniMateriali: data.descrizioniMateriali || [],
          composizioni: data.composizioni || [],
          dimensioni: data.dimensioni || [],
          tipi: data.tipi || [],
          caratteristiche: data.caratteristiche || [],
          luoghi: data.luoghi || [],
          riferimentiOrdine: data.riferimentiOrdine || []
        });
      } else {
        const base = {
          vettori: [],
          conducenti: [],
          targhe: [],
          rimorchi: [],
          causali: [],
          descrizioniMateriali: [],
          composizioni: [],
          dimensioni: [],
          tipi: [],
          caratteristiche: [],
          luoghi: [],
          riferimentiOrdine: []
        };
        await setDoc(ref, base);
        setConfig(base);
      }
    };

    loadConfig();
  }, []);

  // ------------------------------
  // CARICA CONTROPARTI
  // ------------------------------
  useEffect(() => {
    const loadControparti = async () => {
      const snap = await getDocs(collection(db, "fornitori"));
      const lista = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      setControparti(lista);
    };

    loadControparti();
  }, []);

  // ------------------------------
  // SE ARRIVA editingId → CARICA DDT
  // ------------------------------
  useEffect(() => {
    if (!editingId) return;

    const loadDDT = async () => {
      const ref = doc(db, "carichi", editingId);
      const snap = await getDoc(ref);

      if (!snap.exists()) return;

      const d = snap.data();

      setTipoMovimento(d.tipoMovimento || "carico");
      setNumeroDDT(d.numeroDocumento || d.numeroDDT || "");
      setDataDDT(d.dataDDT?.toDate?.() || d.data || new Date());
      setOraDDT(d.oraDDT || d.ora || "08:00");

      setNomeControparte(d.nomeControparte || "");
      setIndirizzoControparte(d.indirizzoControparte || "");
      setPivaControparte(d.pivaControparte || "");

      setDestinazioneNome(d.destinazioneNome || "");
      setDestinazioneIndirizzo(d.destinazioneIndirizzo || "");
      setDestinazionePiva(d.destinazionePiva || "");

      setVettore(d.vettore || "");
      setConducente(d.conducente || "");
      setTarga(d.targa || "");
      setRimorchio(d.rimorchio || "");
      setColli(d.colli || "");
      setPorto(d.porto || "FRANCO");
      setCausale(d.causale || "");
      setLuogo(d.luogo || "");

      setRiferimentoOrdine(d.riferimentoOrdine || "");

      setDescrizioneMateriale(d.descrizioneMateriale || "");
      setComposizione(d.composizione || "");
      setDimensione(d.dimensione || "");
      setTipo(d.tipo || "");
      setCaratteristiche(d.caratteristiche || "");

      setPesoDichiarato(d.pesoDichiarato || "");
      setPesoRiscontrato(d.pesoRiscontrato || "");

      setNote(d.note || "");
    };

    loadDDT();
  }, [editingId]);

  // ------------------------------
  // AGGIUNTA A CONFIG
  // ------------------------------
  const addToConfig = async (field, value) => {
    if (!value || !value.trim()) return;

    const ref = doc(db, "ddt_config", "default");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const list = data[field] || [];

    if (!list.includes(value)) {
      const updated = [...list, value];
      await updateDoc(ref, { [field]: updated });
      setConfig((prev) => ({ ...prev, [field]: updated }));
    }
  };

  // ------------------------------
  // SALVATAGGIO DDT
  // ------------------------------
  const handleSave = async () => {
    if (!numeroDDT.trim()) return alert("Inserire il numero DDT");
    if (!nomeControparte.trim()) return alert("Inserire la controparte");
    if (!indirizzoControparte.trim()) return alert("Inserire indirizzo valido");
    if (!pivaControparte.trim()) return alert("Inserire P.IVA valida");

    const movimento = tipoMovimento === "carico" ? "carichi" : "scarichi";

    const peso = Number(pesoDichiarato || 0);
    const netto = Number(pesoRiscontrato || 0);
    const calo = peso - netto;

    // eventuale update dati destinazione su fornitore selezionato
    if (selectedControparte) {
      const refDest = doc(db, "fornitori", selectedControparte);
      const snapDest = await getDoc(refDest);

      if (snapDest.exists()) {
        const old = snapDest.data();
        const changed =
          (old.indirizzo || "") !== destinazioneIndirizzo ||
          (old.piva_cf || "") !== destinazionePiva;

        if (changed) {
          const ok = window.confirm(
            "I dati della destinazione sono cambiati. Vuoi aggiornare il database?"
          );
          if (ok) {
            await updateDoc(refDest, {
              indirizzo: destinazioneIndirizzo,
              piva_cf: destinazionePiva
            });
          }
        }
      }
    }

    const payload = {
      tipoMovimento,
      tipoDocumento: "DDT",
      numeroDocumento: numeroDDT,

      data: dataDDT,
      ora: oraDDT,

      nomeControparte,
      indirizzoControparte,
      pivaControparte,

      destinazioneNome,
      destinazioneIndirizzo,
      destinazionePiva,

      vettore,
      conducente,
      targa,
      rimorchio,
      colli,
      porto,
      causale,
      luogo,

      riferimentoOrdine,

      descrizioneMateriale,
      composizione,
      dimensione,
      tipo,
      caratteristiche,

      pesoDichiarato,
      pesoRiscontrato,

      note,

      [movimento]: [
        {
          cer: "DDT",
          numeroDocumento: numeroDDT,
          tipoDocumento: "DDT",
          righe: [
            {
              materiale: descrizioneMateriale,
              peso,
              calo,
              netto,
              prezzoKg: 0
            }
          ]
        }
      ],

      createdAt: new Date(),
      createdBy: currentUser.username || currentUser.email || "Sconosciuto"
    };

    if (editingId) {
      await updateDoc(doc(db, movimento, editingId), payload);
      alert("DDT aggiornato");
    } else {
      await addDoc(collection(db, movimento), payload);
      alert("DDT salvato");
    }

    if (tipoMovimento === "carico") {
    if (window.confirm("Stampo DDT + Conformità?")) {
        handleStampaDDT();
        handleStampaConformita();
    }
} else {
    if (window.confirm("Stampo Ricevuta di Scarico?")) {
        handleStampaScarico();
    }
}


    navigate("/admin");
  };

const handleStampaScarico = async () => {

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const leftX = 14;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  // LOGO + INTESTAZIONE
  if (configAzienda.logoBase64) {
    pdf.addImage(
      configAzienda.logoBase64,
      "PNG",
      pageWidth - 50,
      10,
      35,
      20
    );
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(configAzienda.ragioneSociale, leftX, 20);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(configAzienda.indirizzo, leftX, 26);
  pdf.text(configAzienda.capCitta, leftX, 31);
  pdf.text(`P.IVA: ${configAzienda.piva}`, leftX, 36);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("RICEVUTA DI SCARICO", leftX, 50);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Data: ${formattaDataIt(dataDDT)}`, leftX, 58);

  // FORNITORE
  pdf.setFont("helvetica", "bold");
  pdf.text("FORNITORE:", leftX, 70);

  pdf.setFont("helvetica", "normal");
  pdf.text(nomeControparte, leftX, 76);
  pdf.text(indirizzoControparte, leftX, 81);
  pdf.text(`P.IVA/CF: ${pivaControparte}`, leftX, 86);

  // TABELLA MATERIALE
  autoTable(pdf, {
    startY: 100,
    margin: { left: leftX },
    tableWidth: pageWidth - 28,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.5 },
    headStyles: { fontStyle: "bold" },
    head: [["DESCRIZIONE", "UM", "PESO DICHIARATO", "PESO RISCONTRATO"]],
    body: [
      [
        descrizioneMateriale,
        "Kg",
        pesoDichiarato,
        pesoRiscontrato || ""
      ]
    ]
  });

  let cursorY = pdf.lastAutoTable.finalY + 12;

  // VETTORE / TARGA
  pdf.setFont("helvetica", "bold");
  pdf.text("VETTORE:", leftX, cursorY);
  pdf.setFont("helvetica", "normal");
  pdf.text(vettore || "-", leftX + 30, cursorY);

  cursorY += 6;

  pdf.setFont("helvetica", "bold");
  pdf.text("TARGA:", leftX, cursorY);
  pdf.setFont("helvetica", "normal");
  pdf.text(targa || "-", leftX + 30, cursorY);

  cursorY += 15;

  // FIRMA OPERATORE
  pdf.setFont("helvetica", "bold");
  pdf.text("FIRMA OPERATORE:", leftX, cursorY);
  pdf.line(leftX + 45, cursorY + 1, leftX + 120, cursorY + 1);

  // SALVA
  await salvaESharePdfCapacitor(pdf, `RICEVUTA_SCARICO_${numeroDDT}.pdf`);
};


const handleStampaDDT = async () => {

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const { pdf, startY } = await PdfHeader();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const leftX = 14;
  const rightX = pageWidth / 2 + 5;

  let cursorY = startY;
  let rightY = startY;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  // MITTENTE
  pdf.setFont("helvetica", "bold");
  pdf.text("MITTENTE:", leftX, cursorY);
  cursorY += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text(configAzienda.ragioneSociale, leftX, cursorY); cursorY += 4;
  pdf.text(configAzienda.indirizzo, leftX, cursorY); cursorY += 4;
  pdf.text(configAzienda.capCitta, leftX, cursorY); cursorY += 4;
  pdf.text(`P.IVA/C.F.: ${configAzienda.piva}`, leftX, cursorY); cursorY += 8;

  // CESSIONARIO
  pdf.setFont("helvetica", "bold");
  pdf.text("CESSIONARIO, DITTA. DOMICILIO:", leftX, cursorY);
  cursorY += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text(nomeControparte, leftX, cursorY); cursorY += 4;
  pdf.text(indirizzoControparte, leftX, cursorY); cursorY += 4;
  pdf.text(`P.IVA/CF: ${pivaControparte}`, leftX, cursorY);

  // COLONNA DESTRA — DDT
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("DOCUMENTO DI TRASPORTO (D.D.T.)", rightX, rightY);
  rightY += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("D.P.R. 472 DEL 14/08/1986 – D.P.R. 696 DEL 21-12-1996", rightX, rightY);
  rightY += 5;

  pdf.setFont("helvetica", "bold");
  pdf.text(`Nr. ${numeroDDT} del ${formattaDataIt(dataDDT)}`, rightX, rightY);
  rightY += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text("A MEZZO:  CEDENTE  _____    CESSIONARIO _____", rightX, rightY);
  rightY += 5;

  pdf.text("CASUALE TRASPORTO: VENDITA", rightX, rightY);
  rightY += 8;

  // DESTINAZIONE
  pdf.setFont("helvetica", "bold");
  pdf.text("LUOGO DI DESTINAZIONE:", rightX, rightY);
  rightY += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text(destinazioneNome, rightX, rightY); rightY += 4;
  pdf.text(destinazioneIndirizzo, rightX, rightY); rightY += 4;
  pdf.text(`P.IVA/CF: ${destinazionePiva}`, rightX, rightY);

  // ALLINEA LE DUE COLONNE
  cursorY = Math.max(cursorY, rightY) + 10;

  // TABELLA BENI
  autoTable(pdf, {
    startY: cursorY,
    margin: { left: leftX },
    tableWidth: pageWidth - 28,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.2 },
    headStyles: { fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 }
    },
    head: [
      ["DESCRIZIONE DEI BENI (Natura e Qualità)", "UNITÀ DI MISURA", "QUANTITÀ"]
    ],
    body: [
      [descrizioneMateriale, "Kg.", pesoDichiarato],
      ["TRATTASI DI M.P.S. (MATERIA PRIMA E SECONDARIA) ESCLUSE DAL CAMPO DI APPLICAZIONI D. Lgs N°22/97 AI SENSI DEL DM 05/02/98", "", ""],
      ["ROTTAMI NON FERROSI EOW AI SENSI DEL D.LGS 152/2006 (COME MODIFICATO AL D.LGS205/10) ART.184-TER CONFORME ALLE SPECIFICHE DEL RE. 333/2011)", "", ""],
      ["PESO DA VERIFICARSI A DESTINO", "Kg.", ""],
      ["PESO RISCONTRATO KG.:", "", pesoRiscontrato]
    ],
    didParseCell: (data) => {
      if (data.row.index === 4 && data.column.index === 0) {
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  cursorY = pdf.lastAutoTable.finalY + 10;

  // TABELLA VETTORE (UNA SOLA)
  autoTable(pdf, {
    startY: cursorY,
    margin: { left: leftX },
    tableWidth: pageWidth - 28,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.2 },
    headStyles: { fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 }
    },
    head: [["VETTORE", "COLLI", "QUANTITÀ", "PORTO"]],
    body: [
      [vettore, colli, `KG. ${pesoDichiarato}`, porto],
      ["NOME E COGNOME DEL CONDUCENTE:", "", "FIRMA CONDUCENTE", "FIRMA DESTINATARIO"],
      [conducente, "", "", ""],
      ["TARGA AUTOM.:", "", "", ""],
      [targa, "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""]
    ],
    didParseCell: (data) => {
      if (data.row.index === 1 || data.row.index === 3) {
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  cursorY = pdf.lastAutoTable.finalY + 10;

  // FOOTER
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  pdf.text(
    "Consegna o inizio trasporto a mezzo cedente               cessionario",
    leftX,
    cursorY
  );
  cursorY += 8;

  pdf.text(
    "Ai sensi del D.Lgs 196/2003 Vi informiamo che i Vs. dati saranno utilizzati esclusivamente",
    leftX,
    cursorY
  );
  cursorY += 4;

  pdf.text(
    "per fini connessi ai rapporti commerciali tra di noi in essere.",
    leftX,
    cursorY
  );
  cursorY += 6;

  pdf.text(
    "Vi preghiamo di controllare i Vs. dati anagrafici, la P. IVA e il Codice Fiscale.",
    leftX,
    cursorY
  );
  cursorY += 4;

  pdf.text("Non ci riteniamo responsabili di eventuali errori.", leftX, cursorY);

  await salvaESharePdfCapacitor(pdf, `DDT_${numeroDDT}.pdf`);
};




const handleStampaConformita = async () => {

  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const leftX = 14;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  // LOGO A SINISTRA (OK)
  if (configAzienda.logoBase64) {
    pdf.addImage(
      configAzienda.logoBase64,
      "PNG",
      leftX,
      10,
      35,
      20
    );
  }

  // INTESTAZIONE A DESTRA
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(configAzienda.ragioneSociale, pageWidth - 14, 20, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(configAzienda.indirizzo, pageWidth - 14, 26, { align: "right" });
  pdf.text(configAzienda.capCitta, pageWidth - 14, 31, { align: "right" });
  pdf.text(`P.IVA ${configAzienda.piva}`, pageWidth - 14, 36, { align: "right" });

  // TITOLO
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("DICHIARAZIONE DI CONFORMITÀ", leftX, 60);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    "(Ai criteri che determinano quando un rifiuto cessa di essere tale di cui all'art. 5 paragrafo 1 del reg. (CE) 31.03-2011, n.333/2011 “END OF WASTE”)",
    leftX,
    68,
    { maxWidth: 180 }
  );

  let y = 85;

  // SEZIONE 1
  pdf.setFont("helvetica", "bold");
  pdf.text("1. PRODUTTORE/IMPORTATORE DEI ROTTAMI METALLICI", leftX, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.text(`NOME: ${configAzienda.ragioneSociale}`, leftX, y); y += 6;
  pdf.text(`INDIRIZZO: ${configAzienda.indirizzo} - ${configAzienda.capCitta}`, leftX, y); y += 6;
  pdf.text(`REFERENTE: ${configAzienda.referente}`, leftX, y); y += 6;
  pdf.text(`E-MAIL: ${configAzienda.mailRecupero}`, leftX, y); y += 12;

  // SEZIONE 2
  pdf.setFont("helvetica", "bold");
  pdf.text("2. DENOMINAZIONE O CODICE DELLA CATEGORIA DI ROTTAMI METALLICI", leftX, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.text("TRATTASI DI END OF WASTE AI SENSI DEL REG. UE 333/2011", leftX, y); y += 6;
  pdf.text(`NORMA TECNICA: ${descrizioneMateriale}`, leftX, y); y += 6;
  pdf.text(`PARTITA N./DDT N°: ${numeroDDT}`, leftX, y); y += 12;

  // SEZIONE 3
  pdf.setFont("helvetica", "bold");
  pdf.text("3. PRINCIPALI DISPOSIZIONI TECNICHE DELLA SPECIFICA (SE CONCORDATE CON IL CLIENTE)", leftX, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.text("COMPOSIZIONE:", leftX, y); y += 6;
  pdf.text("DIMENSIONE:", leftX, y); y += 6;
  pdf.text("TIPO:", leftX, y); y += 6;
  pdf.text("CARATTERISTICHE:", leftX, y); y += 12;

  // SEZIONE 4
  pdf.setFont("helvetica", "bold");
  pdf.text(
    "4. LA SUDDETTA PARTITA DI ROTTAMI METALLICI È CONFORME ALLA SPECIFICA DELLA NORMA DI CUI AL PUNTO 2",
    leftX,
    y,
    { maxWidth: 180 }
  );
  y += 12;

  // SEZIONE 5
  pdf.setFont("helvetica", "bold");
  pdf.text("5. PESO DELLA PARTITA", leftX, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.text(`TONNELLATE/Kg: ${pesoDichiarato}`, leftX, y);
  y += 15;

  // CERTIFICAZIONI
  pdf.text(
    "1. Si certifica che sulla partita dei rottami è stato eseguito il controllo radiometrico,",
    leftX,
    y
  ); y += 6;

  pdf.text(
    "   con strumento “Contatore Geiger - Radiazioni α, β, γ, χ”. Da tale controllo il materiale è risultato NON RADIOATTIVO.",
    leftX,
    y,
    { maxWidth: 180 }
  ); y += 10;

  pdf.text(
    "2. TAMMARO METALLI SRL applica un sistema di gestione della qualità conforme all'art. 6",
    leftX,
    y
  ); y += 6;

  pdf.text(
    "   Regolamento (UE) n. 333/2011 controllato da un verificatore riconosciuto.",
    leftX,
    y
  ); y += 10;

  pdf.text(
    "3. La partita di rottami metallici soddisfa i criteri di cui alle lettere A), B), C),",
    leftX,
    y
  ); y += 6;

  pdf.text(
    "   degli art. 3 e 4 del Regolamento (UE) n. 333/2011.",
    leftX,
    y
  ); y += 15;

  // FIRMA
  pdf.setFont("helvetica", "bold");
  pdf.text(
    `Il sottoscritto ${configAzienda.referente} dichiara in fede che le informazioni fornite`,
    leftX,
    y
  ); y += 6;

  pdf.text(
    "nella presente dichiarazione sono complete ed esatte.",
    leftX,
    y
  ); y += 15;

  // LUOGO E DATA
  pdf.setFont("helvetica", "normal");
  pdf.text("LUOGO E DATA", leftX, y); y += 8;

  pdf.text(configAzienda.capCitta, leftX, y); y += 6;
  pdf.text(formattaDataIt(dataDDT), leftX, y);

  // SALVA
  await salvaESharePdfCapacitor(pdf, `CONFORMITA_${numeroDDT}.pdf`);
};



  if (!config || !configAzienda) return <p>Caricamento configurazione DDT...</p>;

  return (
    <div className="ddt-container">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => navigate("/admin")}>🏠 Dashboard</button>
        <button onClick={logout}>
          <FaSignOutAlt /> Logout (
          {currentUser.username || currentUser.email || "Sconosciuto"})
        </button>
      </div>

      <h2>{editingId ? "Modifica DDT" : "Inserimento DDT 333"}</h2>

      {/* Tipo movimento */}
      <label>Tipo Movimento:</label>
      <select
        value={tipoMovimento}
        onChange={(e) => setTipoMovimento(e.target.value)}
      >
        <option value="scarico">Scarico</option>
        <option value="carico">Carico</option>
      </select>

      {/* Numero DDT */}
      <label>Numero DDT:</label>
      <input
        type="text"
        value={numeroDDT}
        onChange={(e) => setNumeroDDT(e.target.value)}
      />

      {/* DATA + ORA */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "8px",
          alignItems: "center"
        }}
      >
        <label>
          Data:
          <DatePicker
            selected={dataDDT}
            onChange={(date) => {
              setDataDDT(date);

              const oggi = new Date();
              const isToday =
                date.toLocaleDateString("it-IT") ===
                oggi.toLocaleDateString("it-IT");

              if (isToday) {
                const [hh, mm] = oraDDT.split(":").map(Number);
                if (
                  hh > oggi.getHours() ||
                  (hh === oggi.getHours() && mm > oggi.getMinutes())
                ) {
                  setOraDDT(
                    `${String(oggi.getHours()).padStart(2, "0")}:${String(
                      oggi.getMinutes()
                    ).padStart(2, "0")}`
                  );
                }
              } else {
                setOraDDT("00:00");
              }
            }}
            dateFormat="dd MMM yyyy"
            locale="it"
            placeholderText="DD MMM YYYY"
          />
        </label>

        <label>
          Ora:
          <DatePicker
            selected={
              oraDDT
                ? new Date(0, 0, 0, ...oraDDT.split(":").map(Number))
                : new Date()
            }
            onChange={(time) => {
              const hh = String(time.getHours()).padStart(2, "0");
              const mm = String(time.getMinutes()).padStart(2, "0");
              setOraDDT(`${hh}:${mm}`);
            }}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={15}
            timeFormat="HH:mm"
            dateFormat="HH:mm"
            placeholderText="HH:mm"
            minTime={new Date(0, 0, 0, 0, 0)}
            maxTime={
              formattaDataIt(dataDDT) === formattaDataIt(new Date())
                ? new Date(
                    0,
                    0,
                    0,
                    new Date().getHours(),
                    new Date().getMinutes()
                  )
                : new Date(0, 0, 0, 23, 59)
            }
          />
        </label>

        <label style={{ marginLeft: "12px" }}>
          <input
            type="checkbox"
            checked={usaOra}
            onChange={(e) => {
              const checked = e.target.checked;
              setUsaOra(checked);

              if (checked) {
                const now = new Date();
                setDataDDT(now);
                setOraDDT(
                  `${String(now.getHours()).padStart(2, "0")}:${String(
                    now.getMinutes()
                  ).padStart(2, "0")}`
                );
              }
            }}
          />{" "}
          Adesso
        </label>
      </div>

      {/* Controparte */}
      <label>
        {tipoMovimento === "scarico"
          ? "Fornitore / Mittente"
          : "Cliente / Destinatario"}
        :
      </label>
      <CreatableSelect
        options={controparti.map((c) => ({
          label: c.nome,
          value: c.id,
          indirizzo: c.indirizzo || "",
          piva: c.piva_cf || ""
        }))}
        onChange={(opt) => {
          if (!opt) {
            setSelectedControparte("");
            setNomeControparte("");
            setIndirizzoControparte("");
            setPivaControparte("");
            return;
          }

          setSelectedControparte(opt.value);
          setNomeControparte(opt.label);
          setIndirizzoControparte(opt.indirizzo || "");
          setPivaControparte(opt.piva || "");
        }}
        onCreateOption={(text) => {
          setSelectedControparte(text);
          setNomeControparte(text);
          setIndirizzoControparte("");
          setPivaControparte("");
        }}
        isClearable
      />

      {/* Riferimento ordine */}
      <label>Rif. ordine / commessa:</label>
      <CreatableSelect
        options={(config.riferimentiOrdine || []).map((v) => ({
          label: v,
          value: v
        }))}
        onChange={(v) => setRiferimentoOrdine(v?.value || "")}
        onCreateOption={(text) => {
          setRiferimentoOrdine(text);
          addToConfig("riferimentiOrdine", text);
        }}
        isClearable
      />

      <label>Indirizzo:</label>
      <input
        type="text"
        value={indirizzoControparte}
        onChange={(e) => setIndirizzoControparte(e.target.value)}
      />

      <label>Partita IVA / CF:</label>
      <input
        type="text"
        value={pivaControparte}
        onChange={(e) => setPivaControparte(e.target.value)}
      />

      <hr />

      {/* DESTINAZIONE */}
      <h3>Destinazione</h3>

      <label>Destinazione (ragione sociale):</label>
      <CreatableSelect
        options={controparti.map((c) => ({
          label: c.nome,
          value: c.id,
          indirizzo: c.indirizzo || "",
          piva: c.piva_cf || ""
        }))}
        onChange={(opt) => {
          if (!opt) {
            setDestinazioneNome("");
            setDestinazioneIndirizzo("");
            setDestinazionePiva("");
            return;
          }

          setDestinazioneNome(opt.label);
          setDestinazioneIndirizzo(opt.indirizzo || "");
          setDestinazionePiva(opt.piva || "");
        }}
        onCreateOption={(text) => {
          setDestinazioneNome(text);
          setDestinazioneIndirizzo("");
          setDestinazionePiva("");
        }}
        isClearable
      />

      <label>Indirizzo destinazione:</label>
      <input
        type="text"
        value={destinazioneIndirizzo}
        onChange={(e) => setDestinazioneIndirizzo(e.target.value)}
      />

      <label>P.IVA / CF destinazione:</label>
      <input
        type="text"
        value={destinazionePiva}
        onChange={(e) => setDestinazionePiva(e.target.value)}
      />

      <hr />

      {/* DATI DI TRASPORTO */}
      <h3>Dati di Trasporto</h3>

      <label>Vettore:</label>
      <CreatableSelect
        options={config.vettori.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setVettore(v?.value || "")}
        onCreateOption={(text) => {
          setVettore(text);
          addToConfig("vettori", text);
        }}
        isClearable
      />

      <label>Conducente:</label>
      <CreatableSelect
        options={config.conducenti.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setConducente(v?.value || "")}
        onCreateOption={(text) => {
          setConducente(text);
          addToConfig("conducenti", text);
        }}
        isClearable
      />

      <label>Targa mezzo:</label>
      <CreatableSelect
        options={config.targhe.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setTarga(v?.value || "")}
        onCreateOption={(text) => {
          setTarga(text);
          addToConfig("targhe", text);
        }}
        isClearable
      />

      <label>Targa rimorchio:</label>
      <CreatableSelect
        options={config.rimorchi.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setRimorchio(v?.value || "")}
        onCreateOption={(text) => {
          setRimorchio(text);
          addToConfig("rimorchi", text);
        }}
        isClearable
      />

      <label>Colli:</label>
      <input
        type="number"
        value={colli}
        onChange={(e) => setColli(e.target.value)}
      />

      <label>Porto:</label>
      <select value={porto} onChange={(e) => setPorto(e.target.value)}>
        <option value="FRANCO">FRANCO</option>
        <option value="ASSEGNATO">ASSEGNATO</option>
      </select>

      <label>Causale Trasporto:</label>
      <CreatableSelect
        options={config.causali.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setCausale(v?.value || "")}
        onCreateOption={(text) => {
          setCausale(text);
          addToConfig("causali", text);
        }}
        isClearable
      />

      <label>
        {tipoMovimento === "carico"
          ? "Luogo di consegna:"
          : "Luogo di prelievo:"}
      </label>
      <CreatableSelect
        options={config.luoghi.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setLuogo(v?.value || "")}
        onCreateOption={(text) => {
          setLuogo(text);
          addToConfig("luoghi", text);
        }}
        isClearable
      />

      <hr />

      {/* DESCRIZIONE BENI */}
      <h3>Descrizione dei Beni</h3>

      <label>Descrizione materiale:</label>
      <CreatableSelect
        options={config.descrizioniMateriali.map((v) => ({
          label: v,
          value: v
        }))}
        onChange={(v) => setDescrizioneMateriale(v?.value || "")}
        onCreateOption={(text) => {
          setDescrizioneMateriale(text);
          addToConfig("descrizioniMateriali", text);
        }}
        isClearable
      />

      <label>Composizione:</label>
      <CreatableSelect
        options={config.composizioni.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setComposizione(v?.value || "")}
        onCreateOption={(text) => {
          setComposizione(text);
          addToConfig("composizioni", text);
        }}
        isClearable
      />

      <label>Dimensione:</label>
      <CreatableSelect
        options={config.dimensioni.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setDimensione(v?.value || "")}
        onCreateOption={(text) => {
          setDimensione(text);
          addToConfig("dimensioni", text);
        }}
        isClearable
      />

      <label>Tipo:</label>
      <CreatableSelect
        options={config.tipi.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setTipo(v?.value || "")}
        onCreateOption={(text) => {
          setTipo(text);
          addToConfig("tipi", text);
        }}
        isClearable
      />

      <label>Caratteristiche:</label>
      <CreatableSelect
        options={config.caratteristiche.map((v) => ({ label: v, value: v }))}
        onChange={(v) => setCaratteristiche(v?.value || "")}
        onCreateOption={(text) => {
          setCaratteristiche(text);
          addToConfig("caratteristiche", text);
        }}
        isClearable
      />

      <label>Peso dichiarato (Kg):</label>
      <input
        type="number"
        value={pesoDichiarato}
        onChange={(e) => setPesoDichiarato(e.target.value)}
      />

      <label>Peso riscontrato (Kg):</label>
      <input
        type="number"
        value={pesoRiscontrato}
        onChange={(e) => setPesoRiscontrato(e.target.value)}
      />

      <label>Note:</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} />

      <hr />

      <button onClick={handleSave} className="btn-save">
        💾 Salva DDT
      </button>

     <button 
  onClick={tipoMovimento === "carico" ? handleStampaDDT : handleStampaScarico}
>
  {tipoMovimento === "carico" ? "Stampa DDT" : "Stampa Ricevuta di Scarico"}
</button>

     <button   disabled={tipoMovimento === "scarico"}   onClick={handleStampaConformita}
>
  Lettera di Conformità
</button>
    </div>
  );
};

export default DDT;
