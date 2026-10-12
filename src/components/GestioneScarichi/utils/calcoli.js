
export const money = (value) => {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
};

export const formatEuro = (value) => {
  return Number(value || 0).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
};

export const normalizzaCER = (value) => {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
};

export const calcolaRiga = (r, tipo) => {
  const peso = Number(r.peso || r.netto || 0);

  const calo = Number(r.calo || 0);

  const tara = Number(r.tara || 0);

  const caloKgRaw =
    r.caloTipo === "perc"
      ? (peso * calo) / 100
      : calo;

  const caloKg =
    (caloKgRaw % 1) <= 0.5
      ? Math.floor(caloKgRaw)
      : Math.ceil(caloKgRaw);

  const netto = peso - caloKg - tara;

  const prezzo =
    tipo === "scarico"
      ? Number(r.prezzoAcquisto ?? 0)
      : Number(r.prezzoVendita ?? 0);

  return {
    peso,
    calo,
    caloKg,
    tara,
    netto,
    prezzo,
    tot: money(netto * prezzo),
  };
};

export const round2 = (n) => {
  const num = Number(n) || 0;
  return Number(num.toFixed(2));
};

export const normalizeDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  return new Date(d);
};

export const getLabelFornDest = (tipoMovimento) => {
  if (tipoMovimento === "carico") return "Smaltitori";
  if (tipoMovimento === "scarico") return "Fornitori";
  return "Fornitore / Smaltitore";
};

export const formatDataIT = (d) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;