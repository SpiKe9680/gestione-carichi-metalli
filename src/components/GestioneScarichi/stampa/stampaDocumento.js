import { collection, getDocs } from "firebase/firestore";
import {
normalizzaCER,
calcolaRiga,
round2,
formatEuro,
} from "../utils/calcoli";
import { getUtenteReact } from "../services/movimentiService";

export const stampaDocumento = async ({
db,
modalData,
modalTipo,
scarichi,
getConfigAzienda,
salvaESharePdfCapacitor,
scriviLog,
}) => {
try {
if (!modalData?.movimentiIds?.length) {
alert("❌ Nessun movimento selezionato");
return;
}

const isProspetto = modalTipo === "prospetto";
const titolo = isProspetto ? "Prospetto Fattura" : "Fattura";

const movs = scarichi
  .filter((m) => modalData.movimentiIds.includes(m.id))
  .filter((m) => isProspetto ? m.tipo === "scarico" : m.tipo === "carico");

if (!movs.length) {
  alert("❌ Nessun movimento da stampare");
  return;
}

const cerSnap = await getDocs(collection(db, "cer_descrizioni"));
const cerDescrizioni = {};

cerSnap.docs.forEach((d) => {
  const dati = d.data();
  const codice = String(dati.codice || d.id || "")
    .replace(/\D/g, "")
    .trim();

  if (codice) cerDescrizioni[codice] = dati.descrizione || "";
});

const datiAzienda = (await getConfigAzienda(db)) || {};
const ragioneSociale = datiAzienda.ragioneSociale || "";
const indirizzo = datiAzienda.indirizzo || "";
const capCitta = datiAzienda.capCitta || "";
const piva = datiAzienda.piva || "";
const codDestinatario =
  datiAzienda["Cod.destinatario"] ||
  datiAzienda.codDestinatario ||
  "";
const pec = datiAzienda.pec || "";
const email = datiAzienda.mailRecupero || "";

const formatDate = (date) => {
  if (!date) return "";

  const d =
    date instanceof Date
      ? date
      : date?.toDate
      ? date.toDate()
      : new Date(date);

  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("it-IT");
};

const formatNumero = (value) => {
  const numero = Number(value || 0);
  return numero === 0 ? "-" : numero.toFixed(2);
};

const autoTable = (await import("jspdf-autotable")).default;
const { pdf, startY } = await (
 await import("../../../utils/dateUtils")
).PdfHeader();

const body = [];
let totale = 0;

movs.forEach((m) => {
  (m.cer || []).forEach((c) => {
    const codiceCER = c.cer || c.codiceCER || c.codice || "-";
    const codiceCERNormalizzato = normalizzaCER(codiceCER);
    const descrizioneCER = cerDescrizioni[codiceCERNormalizzato] || "";
    const dataFIR = c.dataFIR || c.firData || c.data || m.data;

    body.push([{
      content: `E.E.R. ${codiceCER}${descrizioneCER ? ` ${descrizioneCER}` : ""}`,
      colSpan: 7,
      styles: { fontStyle: "bold", fillColor: [238, 238, 238], halign: "left" },
    }]);

    body.push([{
      content: `FIR: ${c.fir || m.fir || "-"}${formatDate(dataFIR) ? `  DEL ${formatDate(dataFIR)}` : ""}`,
      colSpan: 7,
      styles: { fontStyle: "bold", halign: "left" },
    }]);

    (c.righe || []).forEach((r) => {
      const tipo = isProspetto ? "scarico" : "carico";
      const { peso, calo, caloKg, tara, netto, prezzo, tot } = calcolaRiga(r, tipo);

      totale += tot;

      let caloLabel = "-";
      if (Number(caloKg || 0) !== 0) {
        caloLabel = r.caloTipo === "perc"
          ? `${Number(calo || 0).toFixed(2)} %`
          : `${Number(caloKg).toFixed(2)} Kg`;
      }

      body.push([
        `ROTTAME ${r.materiale || "-"}`,
        formatNumero(peso),
        caloLabel,
        formatNumero(tara),
        formatNumero(netto),
        formatNumero(prezzo),
        formatEuro(tot),
      ]);
    });
  });
});

totale = round2(totale);

pdf.setFontSize(14);
pdf.text(`${titolo} - ${modalData.cliente || ""}`, 14, startY - 10);

autoTable(pdf, {
  startY,
  head: [[
    "DESCRIZIONE",
    "Q.TÀ (KG)",
    "CALO",
    "TARA (KG)",
    "Q.TÀ DA FATTURARE (KG)",
    "Prezzo Kg. €",
    "TOT. €",
  ]],
  body,
  theme: "grid",
  styles: { fontSize: 8.5, cellPadding: 2, valign: "middle" },
  headStyles: { fontStyle: "bold", halign: "center" },
  columnStyles: {
    0: { cellWidth: 51 },
    1: { cellWidth: 18, halign: "right" },
    2: { cellWidth: 22, halign: "right" },
    3: { cellWidth: 18, halign: "right" },
    4: { cellWidth: 30, halign: "right" },
    5: { cellWidth: 20, halign: "right" },
    6: { cellWidth: 23, halign: "right" },
  },
});

let y = pdf.lastAutoTable.finalY + 8;

if (y > 250) {
  pdf.addPage();
  y = 20;
}

pdf.setFontSize(12);
pdf.setFont("helvetica", "bold");
pdf.text("TOTALE FATTURA", 14, y);
pdf.text(`€ ${formatEuro(totale)}`, 195, y, { align: "right" });

y += 12;

const notaFiscale = [
  "N.B.:",
  "",
  "IN FATTURA ALLA VOCE",
  "“RIEPILOGO IVA-NATURA IVA/Rif.normativo”",
  "VA RIPORTATA LA SEGUENTE DICITURA:",
  "",
  "N6.1: Inversione contabile - cessione di rottami",
  "e altri materiali di recupero",
  "(Reverse charge art. 74, commi 7 e 8, DPR 633/72)",
  "",
  "Invitandovi a prendere nota di quanto sopra",
  "riportato, porgiamo i nostri più cordiali saluti.",
].join("\n");

const notaRighe = pdf.splitTextToSize(notaFiscale, 180);

if (y + notaRighe.length * 4 + 50 > 285) {
  pdf.addPage();
  y = 20;
}

pdf.setFont("helvetica", "normal");
pdf.setFontSize(8.5);
pdf.text(notaRighe, 14, y);

y += notaRighe.length * 4 + 10;

const datiAziendaRighe = [];

if (ragioneSociale) datiAziendaRighe.push(ragioneSociale);

if (indirizzo || capCitta) {
  datiAziendaRighe.push([indirizzo, capCitta].filter(Boolean).join(" - "));
}

if (piva) datiAziendaRighe.push(`P.IVA: ${piva}`);
if (codDestinatario) datiAziendaRighe.push(`Cod. destinatario: ${codDestinatario}`);
if (pec) datiAziendaRighe.push(`Pec: ${pec}`);
if (email) datiAziendaRighe.push(`E-mail: ${email}`);

pdf.setFont("helvetica", "bold");
pdf.setFontSize(9);
pdf.text(datiAziendaRighe, 14, y);

const nomePulito = (modalData.cliente || "sconosciuto")
  .replace(/[^a-zA-Z0-9]/g, "_")
  .toLowerCase();

const today = new Date()
  .toLocaleDateString("it-IT")
  .replace(/\//g, "-");

await salvaESharePdfCapacitor(
  pdf,
  `${isProspetto ? "prospetto" : "fattura"}_${nomePulito}_${today}.pdf`
);

} catch (err) {
console.error("Errore stampa documento:", err);

try {
  await scriviLog({
    pagina: "GestioneScarichi",
    evento: "ERRORE_STAMPA_DOCUMENTO",
    riferimento: { funzione: "handleStampaDocumento" },
    before: null,
    after: {
      errore: err?.message || "Errore sconosciuto",
      codice: err?.code || null,
    },
    utente: getUtenteReact(),
    ripristinabile: false,
  });
} catch (erroreLog) {
  console.error("❌ ERRORE SCRITTURA LOG:", erroreLog);
}

alert("❌ Errore durante la stampa del documento");

}
};

