
export const stampaMovimenti = async ({
filteredScarichi,
righeOrdinate,
round2,
salvaESharePdfCapacitor,
scriviLog,
getUtenteReact,
}) => {
const movimenti = filteredScarichi;

if (!movimenti || !Array.isArray(movimenti)) return;

try {
const autoTable = (await import("jspdf-autotable")).default;
const { PdfHeader } = await import("../../../utils/dateUtils");

const formatDate = (date) => {
  const d =
    date instanceof Date
      ? date
      : date?.toDate
      ? date.toDate()
      : new Date(date);

  return d.toLocaleDateString("it-IT");
};

const formatHour = (date) => {
  const d =
    date instanceof Date
      ? date
      : date?.toDate
      ? date.toDate()
      : new Date(date);

  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const safe = (v) => Number(v) || 0;
const getUtente = (m) => m.utente || m.email || "sconosciuto";

const gruppi = {};

let totaleScarichi = 0;
let totaleCarichi = 0;
let totalePesoScarichi = 0;
let totalePesoCarichi = 0;
let totaleCosti = 0;
let totaleRicavi = 0;

movimenti.forEach((s) => {
  if (!s.data) return;

  const dataObj =
    s.data instanceof Date
      ? s.data
      : s.data?.toDate
      ? s.data.toDate()
      : null;

  if (!dataObj) return;

  const giorno = formatDate(dataObj);

  if (!gruppi[giorno]) {
    gruppi[giorno] = {
      scarichi: 0,
      carichi: 0,
      firSet: new Set(),
      pesoScarichi: 0,
      pesoCarichi: 0,
      costi: 0,
      ricavi: 0,
      utenti: new Set(),
      dettagli: [],
    };
  }

  const g = gruppi[giorno];
  const utente = getUtente(s);
  const controparte = s.fornitore || s.destinatario || "sconosciuto";

  (s.cer || []).forEach((cer) => {
    const tipo = cer.tipo ?? s.tipo;

    const righe = cer.righe || [
      {
        netto: safe(cer.netto),
        prezzoAcquisto: safe(cer.prezzoAcquisto),
        prezzoVendita: safe(cer.prezzoVendita),
      },
    ];

    const peso = righe.reduce((t, r) => t + safe(r.netto), 0);

    const costo = righe.reduce(
      (t, r) =>
        t + round2(round2(r.prezzoAcquisto) * round2(r.netto)),
      0
    );

    const ricavo = righe.reduce(
      (t, r) =>
        t + round2(round2(r.prezzoVendita) * round2(r.netto)),
      0
    );

    if (tipo === "scarico") {
      g.scarichi++;
      g.pesoScarichi += peso;
      g.costi += costo;

      totaleScarichi++;
      totalePesoScarichi += peso;
      totaleCosti += costo;
    } else {
      g.carichi++;
      g.pesoCarichi += peso;
      g.ricavi += ricavo;

      totaleCarichi++;
      totalePesoCarichi += peso;
      totaleRicavi += ricavo;
    }

    if (cer.fir) g.firSet.add(cer.fir);

    g.utenti.add(utente);

    g.dettagli.push({
      ora: formatHour(dataObj),
      controparte,
      fir: cer.fir || "-",
      peso,
      costo,
      ricavo,
      utente,
      tipo,
    });
  });
});

const { pdf, startY } = await PdfHeader();

let y = startY - 30;

pdf.setFontSize(14);
pdf.text("Report Movimenti", 14, y);
y += 8;

righeOrdinate.forEach((rigaOrdinata) => {
  const giorno = rigaOrdinata.giornoIT;
  const g = gruppi[giorno];

  if (!g) return;

  pdf.setFontSize(12);
  pdf.text(`Giorno: ${giorno}`, 14, y);
  y += 4;

  autoTable(pdf, {
    startY: y,
    head: [["Ora", "Movimento", "FIR", "Peso", "Costi", "Ricavi", "Utente"]],
    body: g.dettagli.map((d) => [
      d.ora,
      d.controparte,
      d.fir,
      d.peso.toFixed(2),
      d.tipo === "scarico" ? d.costo.toFixed(2) : "",
      d.tipo === "carico" ? d.ricavo.toFixed(2) : "",
      d.utente,
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
  });

  y = pdf.lastAutoTable.finalY + 5;

  pdf.text(
    `Totale giorno: ${g.scarichi}/${g.carichi} | FIR: ${g.firSet.size}`,
    14,
    y
  );

  y += 10;

  if (y > 260) {
    pdf.addPage();
    y = 20;
  }
});

const utile = totaleRicavi - totaleCosti;

pdf.addPage();

pdf.setFontSize(14);
pdf.text("Totali Complessivi", 14, 20);

autoTable(pdf, {
  startY: 30,
  head: [["Movimenti", "Peso S", "Peso C", "Costi", "Ricavi", "Utile"]],
  body: [[
    `${totaleScarichi}/${totaleCarichi}`,
    totalePesoScarichi.toFixed(2),
    totalePesoCarichi.toFixed(2),
    totaleCosti.toFixed(2),
    totaleRicavi.toFixed(2),
    utile.toFixed(2),
  ]],
});

await salvaESharePdfCapacitor(pdf, "movimenti.pdf");

} catch (err) {
console.error("Errore stampa movimenti:", err);

try {
  await scriviLog({
    pagina: "GestioneScarichi",
    evento: "ERRORE_STAMPA",
    utente: getUtenteReact(),
    riferimento: { funzione: "handleStampa" },
    before: null,
    after: {
      errore: err?.message || "Errore sconosciuto",
      codice: err?.code || null,
    },
    ripristinabile: false,
  });
} catch (erroreLog) {
  console.error("❌ ERRORE SCRITTURA LOG STAMPA:", erroreLog);
}

alert("❌ Errore durante la stampa dei movimenti");

}
};