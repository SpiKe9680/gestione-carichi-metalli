export const mesiItaliani = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export const formattaDataItaliana = (date) => {
  const gg = String(date.getDate()).padStart(2, "0");
  const mese = mesiItaliani[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${gg} ${mese} ${yyyy}`;
};

export const formattaOra24 = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const parseDataOra = (dataStr, oraStr) => {
  if (!dataStr) return new Date();
  const [gg, meseStr, yyyy] = dataStr.split(" ");
  const mm = mesiItaliani.indexOf(meseStr);
  if (mm < 0) return new Date();
  const d = new Date(Number(yyyy), mm, Number(gg));
  if (oraStr) {
    const [hh, min] = oraStr.split(":").map(Number);
    if (!isNaN(hh) && !isNaN(min)) d.setHours(hh, min, 0, 0);
  }
  const now = new Date();
  if (d > now) return now;
  return d;
};