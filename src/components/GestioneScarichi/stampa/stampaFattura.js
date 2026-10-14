import { collection, getDocs } from "firebase/firestore";
import {
  normalizzaCER,
  calcolaRiga,
  round2,
  formatEuro,
} from "../utils/calcoli";
import { getUtenteReact } from "../services/movimentiService";


export const stampaFattura = async ({
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

    if (modalTipo !== "fattura") {
      alert("❌ Questa funzione stampa soltanto le fatture");
      return;
    }

    const movs = scarichi.filter(
      (m) =>
        modalData.movimentiIds.includes(m.id) &&
        m.tipo === "carico"
    );

    if (!movs.length) {
      alert("❌ Nessun movimento da stampare");
      return;
    }

    const formatDate = (value) => {
      if (!value) return "";

      const date =
        value instanceof Date
          ? value
          : typeof value?.toDate === "function"
          ? value.toDate()
          : new Date(value);

      return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString("it-IT");
    };

    const leggi = (oggetto, ...chiavi) => {
      for (const chiave of chiavi) {
        const value = oggetto?.[chiave];

        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          return String(value).trim();
        }
      }

      return "";
    };

    const autoTable = (
      await import("jspdf-autotable")
    ).default;

    const { pdf, startY } = await (
      await import("../../../utils/dateUtils")
    ).PdfHeader();

    // Tutte le pagine utilizzano il formato A4 verticale.
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    const rightX = pageWidth - marginX;

    const aggiungiPaginaVerticale = () => {
      pdf.addPage("a4", "portrait");
    };

    const config = (await getConfigAzienda(db)) || {};
    const cedente = modalData.cedente || config;
    const cliente = modalData.clienteDati || {};

    const cerSnap = await getDocs(
      collection(db, "cer_descrizioni")
    );

    const descrizioniCER = {};

    cerSnap.docs.forEach((d) => {
      const dati = d.data();
      const codice = String(dati.codice || d.id || "")
        .replace(/\D/g, "")
        .trim();

      if (codice) {
        descrizioniCER[codice] = dati.descrizione || "";
      }
    });

    const righeCedente = [
      leggi(cedente, "ragioneSociale", "denominazione", "nome"),
      leggi(cedente, "indirizzo", "via", "sede"),
      leggi(cedente, "capCitta") ||
        [
          leggi(cedente, "cap"),
          leggi(cedente, "comune", "citta", "città"),
          leggi(cedente, "provincia")
            ? `(${leggi(cedente, "provincia")})`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      leggi(cedente, "piva", "partitaIva")
        ? `P. IVA: ${leggi(cedente, "piva", "partitaIva")}`
        : "",
      leggi(cedente, "codiceFiscale", "cf")
        ? `C.F.: ${leggi(cedente, "codiceFiscale", "cf")}`
        : "",
      leggi(cedente, "email", "emailAziendale", "mailRecupero"),
      leggi(cedente, "pec")
        ? `PEC: ${leggi(cedente, "pec")}`
        : "",
    ].filter(Boolean);

    const righeCliente = [
      leggi(cliente, "ragioneSociale") ||
        modalData.cliente ||
        "",
      leggi(cliente, "indirizzo", "via", "sede"),
      [
        leggi(cliente, "numeroCivico", "civico"),
      ]
        .filter(Boolean)
        .join(" "),
      [
        leggi(cliente, "cap"),
        leggi(cliente, "comune", "citta", "città"),
        leggi(cliente, "provincia")
          ? `(${leggi(cliente, "provincia")})`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      leggi(cliente, "piva", "partitaIva", "piva_cf")
        ? `P. IVA: ${leggi(
            cliente,
            "piva",
            "partitaIva",
            "piva_cf"
          )}`
        : "",
      leggi(cliente, "codiceFiscale", "cf")
        ? `C.F.: ${leggi(cliente, "codiceFiscale", "cf")}`
        : "",
      leggi(
        cliente,
        "codiceDestinatario",
        "codDestinatario",
        "codice_sdi"
      )
        ? `Codice destinatario: ${leggi(
            cliente,
            "codiceDestinatario",
            "codDestinatario",
            "codice_sdi"
          )}`
        : "",
      leggi(cliente, "pec")
        ? `PEC: ${leggi(cliente, "pec")}`
        : "",
    ].filter(Boolean);

    const numeroFattura =
      leggi(modalData, "numeroFattura") || "Da definire";

    const dataFattura = formatDate(modalData.dataFattura);
    const dataScadenza = formatDate(
      modalData.dataScadenzaPagamento
    );

    const naturaIva =
      leggi(modalData, "naturaIva") || "N6.1";

    const riferimentoNormativo =
      leggi(modalData, "riferimentoNormativo") ||
      "N6.1 - ART. 74 C.7 E 8 DPR 633/72";

    /*
     * Costruzione delle righe della fattura.
     * Gli importi sono calcolati da calcolaRiga.
     */
    const body = [];
    let totaleImponibile = 0;

    movs.forEach((m) => {
      (m.cer || []).forEach((c) => {
        const codiceCER =
          c.cer || c.codiceCER || c.codice || "-";

        const codiceNormalizzato = normalizzaCER(codiceCER);
        const descrizioneCER =
          descrizioniCER[codiceNormalizzato] || "";

        const dataFIR =
          c.dataFIR || c.firData || c.data || m.data;

        body.push([
          {
            content: `Codice E.E.R. ${codiceCER}${
              descrizioneCER ? ` - ${descrizioneCER}` : ""
            }`,
            colSpan: 7,
            styles: {
              fontStyle: "bold",
              fillColor: [238, 238, 238],
              fontSize: 7.5,
            },
          },
        ]);

        body.push([
          {
            content: `Riferimento FIR: ${c.fir || m.fir || "-"}${
              formatDate(dataFIR)
                ? ` - Data: ${formatDate(dataFIR)}`
                : ""
            }`,
            colSpan: 7,
            styles: {
              fontSize: 7,
              textColor: [70, 70, 70],
            },
          },
        ]);

        (c.righe || []).forEach((r) => {
          const { netto, prezzo, tot } = calcolaRiga(
            r,
            "carico"
          );

          const imponibileRiga = round2(Number(tot) || 0);
          totaleImponibile += imponibileRiga;

          const codiceMateriale = leggi(
            r,
            "codice",
            "codiceMateriale",
            "cod"
          );

          const descrizione = [
            codiceMateriale,
            leggi(r, "materiale", "descrizione", "nome"),
          ]
            .filter(Boolean)
            .join(" - ") || "-";

          const unitaMisura =
            leggi(r, "unitaMisura", "um") || "kg";

          const sconto = leggi(
            r,
            "scontoPercentuale",
            "sconto",
            "scontoPerc"
          );

          body.push([
            descrizione,
            unitaMisura,
            Number(netto || 0).toLocaleString("it-IT", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 3,
            }),
            `€ ${formatEuro(prezzo)}`,
            sconto ? `${sconto}%` : "-",
            `€ ${formatEuro(imponibileRiga)}`,
            `0,00 ${naturaIva}`,
          ]);
        });
      });
    });

    totaleImponibile = round2(totaleImponibile);

    // L'imposta è esposta a zero nella copia di cortesia.
    const totaleIVA = 0;
    const totaleDocumento = round2(
      totaleImponibile + totaleIVA
    );

    /*
     * INTESTAZIONE FATTURA
     */
    let y = Math.max(startY, 25);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("FATTURA", marginX, y);

    pdf.setFontSize(10);
    pdf.text(`Numero: ${numeroFattura}`, rightX, y, {
      align: "right",
    });

    y += 6;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      `Data: ${dataFattura || "Da definire"}`,
      rightX,
      y,
      { align: "right" }
    );

    y += 10;

    /*
     * CEDENTE E CLIENTE
     */
    const gapColonne = 10;
    const larghezzaColonna =
      (contentWidth - gapColonne) / 2;

    const xCedente = marginX;
    const xCliente = marginX + larghezzaColonna + gapColonne;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("CEDENTE / PRESTATORE", xCedente, y);
    pdf.text("INTESTATARIO DOCUMENTO", xCliente, y);

    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.8);

    const testoCedente = pdf.splitTextToSize(
      righeCedente.join("\n"),
      larghezzaColonna
    );

    const testoCliente = pdf.splitTextToSize(
      righeCliente.join("\n"),
      larghezzaColonna
    );

    pdf.text(testoCedente, xCedente, y);
    pdf.text(testoCliente, xCliente, y);

    const righeAnagrafica = Math.max(
      testoCedente.length,
      testoCliente.length
    );

    y += righeAnagrafica * 3.7 + 7;

    /*
     * DATI DOCUMENTO E PAGAMENTO
     */
    const banca =
      modalData.banca ||
      modalData.bancaPredefinita ||
      null;

    const datiPagamento = [
      `Tipo documento: ${leggi(modalData, "tipoDocumento") || "TD24"}`,
      `Pagamento: ${leggi(modalData, "modalitaPagamento") || "MP05"}`,
      banca
        ? `Banca di appoggio: ${leggi(
            banca,
            "nome",
            "banca",
            "istituto",
            "intestatario"
          )}`
        : "",
      banca && leggi(banca, "iban")
        ? `IBAN: ${leggi(banca, "iban")}`
        : "",
      dataScadenza
        ? `Scadenza pagamento: ${dataScadenza}`
        : "",
    ].filter(Boolean);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("DATI DOCUMENTO E PAGAMENTO", marginX, y);

    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.8);

    const testoPagamento = pdf.splitTextToSize(
      datiPagamento.join("   |   "),
      contentWidth
    );

    pdf.text(testoPagamento, marginX, y);
    y += testoPagamento.length * 3.8 + 6;

    /*
     * Se l'intestazione occupa troppo spazio, la tabella
     * comincia su una nuova pagina A4 verticale.
     */
    if (y > pageHeight - 95) {
      aggiungiPaginaVerticale();
      y = 20;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(`FATTURA N. ${numeroFattura}`, marginX, y);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        `Data: ${dataFattura || "Da definire"}`,
        rightX,
        y,
        { align: "right" }
      );

      y += 8;
    }

    /*
     * TABELLA COMMERCIALE
     * Le larghezze sono dimensionate per l'A4 verticale.
     */
    autoTable(pdf, {
      startY: y,
      head: [[
        "Descrizione",
        "UM",
        "Quantità",
        "Prezzo unit.",
        "Sconto",
        "Imponibile",
        "IVA / Natura",
      ]],
      body,
      theme: "grid",
      showHead: "everyPage",
      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: 1.8,
        valign: "middle",
        overflow: "linebreak",
        lineColor: [180, 180, 180],
        lineWidth: 0.15,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: [225, 225, 225],
        textColor: [20, 20, 20],
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
        valign: "middle",
      },
      columnStyles: {
        0: {
          cellWidth: 58,
          halign: "left",
        },
        1: {
          cellWidth: 10,
          halign: "center",
        },
        2: {
          cellWidth: 20,
          halign: "right",
        },
        3: {
          cellWidth: 24,
          halign: "right",
        },
        4: {
          cellWidth: 13,
          halign: "right",
        },
        5: {
          cellWidth: 29,
          halign: "right",
        },
        6: {
          cellWidth: 28,
          halign: "right",
        },
      },
      margin: {
        left: marginX,
        right: marginX,
        top: 14,
        bottom: 14,
      },
      tableWidth: contentWidth,
      rowPageBreak: "avoid",
    });

    /*
     * RIEPILOGO IVA E TOTALE
     */
    let yRiepilogo = pdf.lastAutoTable.finalY + 8;

    // Riserviamo spazio per riepilogo, totale e dicitura finale.
    // Se non basta, il riepilogo passa a una nuova pagina verticale.
    if (yRiepilogo > pageHeight - 68) {
      aggiungiPaginaVerticale();
      yRiepilogo = 20;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("RIEPILOGO IVA", marginX, yRiepilogo);

    autoTable(pdf, {
      startY: yRiepilogo + 4,
      head: [[
        "Natura",
        "Descrizione / riferimento normativo",
        "Imponibile",
        "Aliquota",
        "Imposta",
      ]],
      body: [[
        naturaIva,
        riferimentoNormativo,
        `€ ${formatEuro(totaleImponibile)}`,
        "0%",
        `€ ${formatEuro(totaleIVA)}`,
      ]],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.2,
        cellPadding: 2,
        valign: "middle",
        overflow: "linebreak",
        lineColor: [180, 180, 180],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [225, 225, 225],
        textColor: [20, 20, 20],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 70, halign: "left" },
        2: { cellWidth: 32, halign: "right" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 35, halign: "right" },
      },
      margin: {
        left: marginX,
        right: marginX,
        top: 14,
        bottom: 14,
      },
      tableWidth: contentWidth,
    });

    let yTotale = pdf.lastAutoTable.finalY + 8;

    // Controllo ulteriore per evitare che il totale esca dalla pagina.
    if (yTotale > pageHeight - 38) {
      aggiungiPaginaVerticale();
      yTotale = 22;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);

    pdf.text(
      `Totale imponibile: € ${formatEuro(totaleImponibile)}`,
      rightX,
      yTotale,
      { align: "right" }
    );

    yTotale += 5;

    pdf.text(
      `Totale IVA: € ${formatEuro(totaleIVA)}`,
      rightX,
      yTotale,
      { align: "right" }
    );

    yTotale += 7;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);

    pdf.text(
      `TOTALE DOCUMENTO: € ${formatEuro(totaleDocumento)}`,
      rightX,
      yTotale,
      { align: "right" }
    );

    yTotale += 9;

    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.5);

    pdf.text(
      "COPIA DI CORTESIA - Fa fede la fattura elettronica.",
      marginX,
      yTotale
    );

    /*
     * SALVATAGGIO / CONDIVISIONE PDF
     */
    const nomePulito = (
      modalData.cliente || "sconosciuto"
    )
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();

    const numeroPulito = String(numeroFattura).replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );

    await salvaESharePdfCapacitor(
      pdf,
      `fattura_${nomePulito}_${numeroPulito}.pdf`
    );
  } catch (err) {
    console.error("Errore stampa fattura:", err);

    try {
      await scriviLog({
        pagina: "GestioneScarichi",
        evento: "ERRORE_STAMPA_FATTURA",
        riferimento: { funzione: "stampaFattura" },
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

    alert("❌ Errore durante la stampa della fattura");
  }
};
