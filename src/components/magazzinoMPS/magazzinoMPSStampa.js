import autoTable from "jspdf-autotable";
import { PdfHeader } from "../../utils/dateUtils";
import { salvaESharePdfCapacitor } from "../../utils/pdfStorage";
import {
  calcolaSaldoMovimenti,
  formattaData,
  formattaNumero
} from "./magazzinoMPSUtils";


const stampaMagazzinoMPS = async ({
  magazzino,
  movimenti = [],
  totaleEntrate = 0,
  totaleUscite = 0,
  giacenzaAttuale = 0
}) => {
  if (!magazzino) {
    throw new Error("Seleziona un magazzino prima di procedere con la stampa.");
  }

  const { pdf, startY } = await PdfHeader();

  const margineSinistro = 14;
  const larghezzaPagina = pdf.internal.pageSize.getWidth();
  const larghezzaUtilizzabile = larghezzaPagina - margineSinistro * 2;

  let y = startY + 5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("REGISTRO MAGAZZINO MPS", margineSinistro, y);

  y += 9;

  pdf.setFontSize(12);
  pdf.text(
    `Magazzino: ${String(magazzino.nome || "")}`,
    margineSinistro,
    y
  );

  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  pdf.text(
    `Giacenza iniziale: ${formattaNumero(magazzino.giacenzaIniziale)} kg`,
    margineSinistro,
    y
  );

  y += 6;

  pdf.text(
    `Totale entrate: ${formattaNumero(totaleEntrate)} kg`,
    margineSinistro,
    y
  );

  y += 6;

  pdf.text(
    `Totale uscite: ${formattaNumero(totaleUscite)} kg`,
    margineSinistro,
    y
  );

  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.text(
    `Giacenza attuale: ${formattaNumero(giacenzaAttuale)} kg`,
    margineSinistro,
    y
  );

  y += 8;

  const movimentiOrdinati = calcolaSaldoMovimenti(
    movimenti,
    magazzino.giacenzaIniziale
  );

  const righe = movimentiOrdinati.map((movimento) => {
    const entrata =
      movimento.tipo === "ENTRATA"
        ? Number(movimento.quantita || 0)
        : 0;

    const uscita =
      movimento.tipo === "USCITA"
        ? Number(movimento.quantita || 0)
        : 0;

    return [
      formattaData(movimento.data),
      String(movimento.descrizione || ""),
      entrata > 0 ? formattaNumero(entrata) : "-",
      uscita > 0 ? formattaNumero(uscita) : "-",
      String(movimento.numeroDocumento || ""),
      String(movimento.note || ""),
      formattaNumero(movimento.progressivo)
    ];
  });

  autoTable(pdf, {
    startY: y,
    head: [[
      "Data",
      "Fornitore/Cliente",
      "Ingresso (kg)",
      "Uscita (kg)",
      "N. Documento",
      "Note",
      "Giacenza (kg)"
    ]],
    body: righe,
    margin: {
      left: margineSinistro,
      right: margineSinistro
    },
    tableWidth: larghezzaUtilizzabile,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle"
    },
    headStyles: {
      fontStyle: "bold"
    },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 36 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 23 },
      5: { cellWidth: "auto" },
      6: { cellWidth: 25, halign: "right" }
    },
    didDrawPage: () => {
      const altezzaPagina = pdf.internal.pageSize.getHeight();

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      pdf.text(
        `Magazzino MPS: ${String(magazzino.nome || "")}`,
        margineSinistro,
        altezzaPagina - 8
      );

      pdf.text(
        `Pagina ${pdf.internal.getNumberOfPages()}`,
        larghezzaPagina - margineSinistro,
        altezzaPagina - 8,
        { align: "right" }
      );
    }
  });

  const nomePulito = String(magazzino.nome || "magazzino")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const dataStampa = new Date().toISOString().slice(0, 10);
  const filename = `Registro_MPS_${nomePulito}_${dataStampa}.pdf`;

  await salvaESharePdfCapacitor(pdf, filename);

  return pdf;
};


export default stampaMagazzinoMPS;
