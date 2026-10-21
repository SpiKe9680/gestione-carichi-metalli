
export const COL_MAGAZZINI = "magazzini_mps";
export const COL_MOVIMENTI = "movimenti_mps";

/**
 * Normalizza un nome per confronti senza distinzione
 * tra maiuscole e minuscole.
 */
export const normalizzaNome = (nome) =>
  String(nome || "").trim().toLocaleLowerCase("it");

/**
 * Restituisce la data odierna nel formato YYYY-MM-DD,
 * utilizzando la data locale del dispositivo.
 */
export const oggi = () => {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 10);
};

/**
 * Formatta un valore numerico secondo le convenzioni italiane.
 */
export const formattaNumero = (valore) =>
  Number(valore || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });

/**
 * Converte una data YYYY-MM-DD nel formato DD/MM/YYYY.
 */
export const formattaData = (valore) => {
  if (!valore) return "";

  const parti = String(valore).slice(0, 10).split("-");

  if (parti.length !== 3 || parti.some((parte) => !parte)) {
    return String(valore);
  }

  const [anno, mese, giorno] = parti;
  return `${giorno}/${mese}/${anno}`;
};

/**
 * Recupera l'utente autenticato nell'applicazione METALFLOW.
 */
export const leggiUtente = () => {
  try {
    return JSON.parse(sessionStorage.getItem("utenteLoggato") || "null");
  } catch {
    return null;
  }
};

/**
 * Calcola il saldo progressivo del magazzino.
 * Le entrate aumentano la giacenza, le uscite la diminuiscono.
 */
export const calcolaSaldoMovimenti = (
  movimenti = [],
  giacenzaIniziale = 0
) => {
  let progressivo = Number(giacenzaIniziale || 0);

  return [...movimenti]
    .sort((a, b) => {
      const confrontoData = String(a.data || "").localeCompare(
        String(b.data || "")
      );

      if (confrontoData !== 0) return confrontoData;

      const confrontoCreazione =
        (a.createdAt?.toMillis?.() || 0) -
        (b.createdAt?.toMillis?.() || 0);

      if (confrontoCreazione !== 0) return confrontoCreazione;

      return String(a.id || "").localeCompare(String(b.id || ""));
    })
    .map((movimento) => {
      const quantita = Number(movimento.quantita || 0);

      if (movimento.tipo === "ENTRATA") {
        progressivo += quantita;
      } else if (movimento.tipo === "USCITA") {
        progressivo -= quantita;
      }

      return {
        ...movimento,
        progressivo
      };
    });
};
