
export const stampaProspetto = async ({
  setModalProspetto,
  righeOrdinate,
  filteredScarichi,
  filtroFornitore,
  salvaESharePdfCapacitor,
}) => {
  setModalProspetto(false);

  const righe = [];

  righeOrdinate.forEach(g => {
    const movimentiDelGiorno = filteredScarichi.filter(s => {
      const dataObj =
        s.data instanceof Date
          ? s.data
          : s.data?.toDate?.() || null;

      if (!dataObj) return false;

      return dataObj.toLocaleDateString("it-IT") === g.giornoIT;
    });

    movimentiDelGiorno.forEach(m => {
      if (m.tipo !== "scarico") return;

      (m.cer || []).forEach(c => {
        (c.righe || []).forEach(r => {
          const peso = Number(r.peso || 0);
          const calo = Number(r.calo || 0);

          const caloKgRaw =
            r.caloTipo === "perc"
              ? (peso * calo) / 100
              : calo;

          const caloKg =
            (caloKgRaw % 1) <= 0.5
              ? Math.floor(caloKgRaw)
              : Math.ceil(caloKgRaw);

          const netto = peso - caloKg;

          righe.push({
            fir: c.fir || "",
            cer: c.cer || c.codiceCER || "-",
            materiale: r.materiale || "",
            pesoLordo: peso,
            caloKg,
            caloPerc: r.caloTipo === "perc" ? calo : null,
            netto,
            prezzoKg: Number(r.prezzoAcquisto || 0),
            fornitore: m.fornitore || "",
          });
        });
      });
    });
  });

  const fornitoreFinale =
    filtroFornitore && filtroFornitore !== "tutti"
      ? filtroFornitore
      : righe[0]?.fornitore || "";

  const autoTable = (await import("jspdf-autotable")).default;
  const { PdfHeader } = await import("../../../utils/dateUtils");
  const { pdf, startY } = await PdfHeader();

  pdf.setFontSize(14);
  pdf.text("Prospetto Fattura", 14, startY - 10);

  autoTable(pdf, {
    startY,
    head: [[
      "FIR",
      "CER",
      "Materiale",
      "Peso Lordo",
      "Calo",
      "Netto",
      "Prezzo €/Kg",
      "Totale €",
    ]],
    body: righe.map(r => {
      const tot = r.netto * r.prezzoKg;

      const caloLabel =
        r.caloPerc != null
          ? `${r.caloPerc}% (${r.caloKg} Kg)`
          : `${r.caloKg} Kg`;

      return [
        r.fir || "-",
        r.cer || "-",
        r.materiale || "-",
        r.pesoLordo.toFixed(2),
        caloLabel,
        r.netto.toFixed(2),
        r.prezzoKg.toFixed(2),
        tot.toFixed(2),
      ];
    }),
    styles: { fontSize: 9 },
  });

  const nomePulito = (fornitoreFinale || "sconosciuto")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();

  const today = new Date()
    .toLocaleDateString("it-IT")
    .replace(/\//g, "-");

  await salvaESharePdfCapacitor(
    pdf,
    `prospetto_${nomePulito}_${today}.pdf`
  );
};