
export const calcolaRighePerGiorno = ({
  scarichiPerGiorno,
  filtroFornitore,
  filtroListino,
  filtroUtente,
  filtroCER,
}) => {
  return Object.keys(scarichiPerGiorno).map(giornoIT => {
    const movimentiDelGiorno = scarichiPerGiorno[giornoIT];
    const safe = v => Number(v) || 0;

    const tuttiCer = movimentiDelGiorno.flatMap(s =>
      (s.cer || []).map(cer => ({
        fir: cer.fir || "-",
        cer: cer.cer || cer.codiceCER || "-",
        tipo: cer.tipo ?? s.tipo,
        listino: s.listino,
        movimentoFinanziarioId: s.movimentoFinanziarioId,
        righe: (cer.righe || []).map(r => ({
          ...r,
          fir: cer.fir || "-",
          cer: cer.cer || cer.codiceCER || "-",
          materiale: r.materiale,
          netto: r.netto || 0,
          prezzoAcquisto: r.prezzoAcquisto || 0,
          prezzoVendita: r.prezzoVendita || 0,
        })),
      }))
    );

    const nrMovimentiScarico = tuttiCer.filter(
      c => c.tipo === "scarico"
    ).length;

    const nrMovimentiCarico = tuttiCer.filter(
      c => c.tipo === "carico"
    ).length;

    const nrFIR = tuttiCer.map(c => c.fir).filter(Boolean).length;

    // SCARICHI

    const pesoLordoScarichi = tuttiCer
      .filter(c => c.tipo === "scarico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => s + safe(r.peso || 0), 0),
        0
      );

    const caloScarichi = tuttiCer
      .filter(c => c.tipo === "scarico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => {
            const peso = safe(r.peso || 0);
            const calo = safe(r.calo || 0);

            const caloKg = r.caloTipo === "perc"
              ? (peso * calo) / 100
              : calo;

            const caloKgRounded = caloKg % 1 <= 0.5
              ? Math.floor(caloKg)
              : Math.ceil(caloKg);

            return s + caloKgRounded;
          }, 0),
        0
      );

    const taraScarichi = tuttiCer
      .filter(c => c.tipo === "scarico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => s + safe(r.tara || 0), 0),
        0
      );

    const pesoNettoScarichi = tuttiCer
      .filter(c => c.tipo === "scarico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => s + safe(r.netto || 0), 0),
        0
      );

    // CARICHI

    const pesoLordoCarichi = tuttiCer
      .filter(c => c.tipo === "carico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => s + safe(r.peso || 0), 0),
        0
      );

    const caloCarichi = tuttiCer
      .filter(c => c.tipo === "carico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => {
            const peso = safe(r.peso || 0);
            const calo = safe(r.calo || 0);

            const caloKg = r.caloTipo === "perc"
              ? (peso * calo) / 100
              : calo;

            const caloKgRounded = caloKg % 1 <= 0.5
              ? Math.floor(caloKg)
              : Math.ceil(caloKg);

            return s + caloKgRounded;
          }, 0),
        0
      );

    const taraCarichi = tuttiCer
      .filter(c => c.tipo === "carico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => s + safe(r.tara || 0), 0),
        0
      );

    const pesoNettoCarichi = tuttiCer
      .filter(c => c.tipo === "carico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce((s, r) => s + safe(r.netto || 0), 0),
        0
      );

    const costiTotali = tuttiCer
      .filter(c => c.tipo === "scarico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce(
            (s, r) =>
              s + safe(r.prezzoAcquisto) * safe(r.netto),
            0
          ),
        0
      );

    const ricaviTotali = tuttiCer
      .filter(c => c.tipo === "carico")
      .reduce(
        (tot, c) =>
          tot + c.righe.reduce(
            (s, r) =>
              s + safe(r.prezzoVendita) * safe(r.netto),
            0
          ),
        0
      );

    const utentiDelGiorno = [...new Set(
      movimentiDelGiorno.map(s =>
        `${s.fornitore || s.destinatario || "sconosciuto"} / ${s.utente || "Sconosciuto"}`
      )
    )].join("; ");

    const totaleMovimenti = movimentiDelGiorno.length;

    const consuntivati = movimentiDelGiorno.filter(
      m => m.movimentoFinanziarioId
    ).length;

    const hasConsuntivati = consuntivati > 0;

    let backgroundColor = "";
    let textColor = "#000";

    const filtroAttivo =
      filtroFornitore !== "tutti" ||
      filtroListino !== "tutti" ||
      filtroUtente !== "tutti" ||
      filtroCER !== "tutti";

    if (hasConsuntivati && filtroAttivo) {
      backgroundColor = "#40ef46";
    } else if (nrMovimentiScarico > 0 && nrMovimentiCarico > 0) {
      backgroundColor = "#326c9f";
      textColor = "#fff";
    } else if (nrMovimentiCarico > 0) {
      backgroundColor = "#C8E6C9";
    } else {
      backgroundColor = "#FFECB3";
    }

    return {
      giornoIT,
      nrMovimentiScarico,
      nrMovimentiCarico,
      nrFIR,
      pesoLordoScarichi,
      caloScarichi,
      taraScarichi,
      pesoNettoScarichi,
      pesoLordoCarichi,
      caloCarichi,
      taraCarichi,
      pesoNettoCarichi,
      costiTotali,
      ricaviTotali,
      utenti: utentiDelGiorno,
      backgroundColor,
      textColor,
      tooltip: hasConsuntivati
        ? `Consuntivati: ${consuntivati}/${totaleMovimenti}`
        : "",
    };
  });
};

export const ordinaRighePerGiorno = (righePerGiorno, sortConfig) => {
  return [...righePerGiorno].sort((a, b) => {
    if (sortConfig.key === "data") {
      const [ggA, mmA, yyyyA] = a.giornoIT.split("/").map(Number);
      const [ggB, mmB, yyyyB] = b.giornoIT.split("/").map(Number);

      return sortConfig.direction === "asc"
        ? new Date(yyyyA, mmA - 1, ggA) -
            new Date(yyyyB, mmB - 1, ggB)
        : new Date(yyyyB, mmB - 1, ggB) -
            new Date(yyyyA, mmA - 1, ggA);
    }

    if (sortConfig.key === "movimenti") {
      const totA = a.nrMovimentiScarico + a.nrMovimentiCarico;
      const totB = b.nrMovimentiScarico + b.nrMovimentiCarico;
      return sortConfig.direction === "asc"
        ? totA - totB
        : totB - totA;
    }

    if (sortConfig.key === "costi") {
      return sortConfig.direction === "asc"
        ? a.costiTotali - b.costiTotali
        : b.costiTotali - a.costiTotali;
    }

    if (sortConfig.key === "ricavi") {
      return sortConfig.direction === "asc"
        ? a.ricaviTotali - b.ricaviTotali
        : b.ricaviTotali - a.ricaviTotali;
    }

    if (sortConfig.key === "nrFIR") {
      return sortConfig.direction === "asc"
        ? a.nrFIR - b.nrFIR
        : b.nrFIR - a.nrFIR;
    }

    if (sortConfig.key === "nrFornitori") {
      return sortConfig.direction === "asc"
        ? a.nrFornitori - b.nrFornitori
        : b.nrFornitori - a.nrFornitori;
    }

    const chiaviPeso = [
      "pesoLordoScarichi",
      "caloScarichi",
      "taraScarichi",
      "pesoNettoScarichi",
      "pesoLordoCarichi",
      "caloCarichi",
      "taraCarichi",
      "pesoNettoCarichi",
    ];

    if (chiaviPeso.includes(sortConfig.key)) {
      const valoreA = a[sortConfig.key];
      const valoreB = b[sortConfig.key];

      return sortConfig.direction === "asc"
        ? valoreA - valoreB
        : valoreB - valoreA;
    }

    return 0;
  });
};