
import { unzipSync, strFromU8 } from "fflate";

const MAX_RIGHE = 10000;
const MAX_COLONNE = 100;

const normalizzaTesto = (valore) =>
  String(valore ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("it-IT");

const testoCella = (cella) => {
  if (!cella) return "";

  const paragrafi = Array.from(
    cella.getElementsByTagNameNS("*", "p")
  );

  if (paragrafi.length) {
    return paragrafi
      .map((p) => p.textContent || "")
      .join("\n")
      .trim();
  }

  return cella.textContent?.trim() || "";
};

const valoreAttributo = (elemento, nome) => {
  if (!elemento) return "";

  for (const attributo of Array.from(elemento.attributes || [])) {
    if (
      attributo.localName === nome ||
      attributo.name === nome ||
      attributo.name.endsWith(`:${nome}`)
    ) {
      return attributo.value;
    }
  }

  return "";
};

const espandiCelleRiga = (riga) => {
  const celle = [];

  for (const cella of Array.from(riga.children)) {
    const tipo = cella.localName;

    if (tipo !== "table-cell" && tipo !== "covered-table-cell") {
      continue;
    }

    const ripetizioni = Math.max(
      1,
      Math.min(
        Number(valoreAttributo(cella, "number-columns-repeated")) || 1,
        MAX_COLONNE
      )
    );

    const valore = leggiValoreCella(cella);

    for (let i = 0; i < ripetizioni; i += 1) {
      celle.push(valore);

      if (celle.length >= MAX_COLONNE) {
        return celle;
      }
    }
  }

  return celle;
};

const leggiValoreCella = (cella) => {
  const tipo = valoreAttributo(cella, "value-type");
  const data = valoreAttributo(cella, "date-value");
  const valore = valoreAttributo(cella, "value");
  const valoreStringa = valoreAttributo(cella, "string-value");
  const testo = testoCella(cella);

  if (tipo === "date" && data) {
    return data;
  }

  if (tipo === "float" || tipo === "currency" || tipo === "percentage") {
    return valore !== "" ? valore : testo;
  }

  if (tipo === "boolean") {
    return valore;
  }

  if (tipo === "string" && valoreStringa !== "") {
    return valoreStringa;
  }

  return testo;
};
const leggiRigheFoglio = (foglio) => {
  const righe = [];

  const righeXML = Array.from(
    foglio.getElementsByTagNameNS("*", "table-row")
  ).filter((rigaXML) => {
    let antenato = rigaXML.parentElement;

    while (antenato && antenato !== foglio) {
      if (antenato.localName === "table") {
        return false;
      }

      antenato = antenato.parentElement;
    }

    return true;
  });

  let indiceRigaODS = 0;

  for (const rigaXML of righeXML) {
    const celle = espandiCelleRiga(rigaXML);

    const ripetizioni = Math.max(
      1,
      Number(valoreAttributo(rigaXML, "number-rows-repeated")) || 1
    );

    const vuota = celle.every(
      (valore) => String(valore ?? "").trim() === ""
    );

    if (vuota) {
      indiceRigaODS += ripetizioni;
      continue;
    }

    if (righe.length + ripetizioni > MAX_RIGHE) {
      throw new Error(
        `Il foglio "${valoreAttributo(foglio, "name")}" supera il limite di ${MAX_RIGHE} righe con contenuto.`
      );
    }

    for (let i = 0; i < ripetizioni; i += 1) {
      const riga = [...celle];
      riga.indiceODS = indiceRigaODS + i;
      righe.push(riga);
    }

    indiceRigaODS += ripetizioni;
  }

  return righe;
};
const parseNumero = (valore) => {
  if (typeof valore === "number") {
    return Number.isFinite(valore) ? valore : null;
  }

  let testo = String(valore ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[€]/g, "");

  if (!testo) return null;

  const negativoParentesi = /^\(.*\)$/.test(testo);

  if (negativoParentesi) {
    testo = testo.slice(1, -1);
  }

  if (!/^-?[\d.,]+$/.test(testo)) {
    return null;
  }

  const ultimaVirgola = testo.lastIndexOf(",");
  const ultimoPunto = testo.lastIndexOf(".");

  if (ultimaVirgola !== -1 && ultimoPunto !== -1) {
    if (ultimaVirgola > ultimoPunto) {
      testo = testo.replace(/\./g, "").replace(",", ".");
    } else {
      testo = testo.replace(/\./g, "").replace(",", ".");
    }
  } else if (ultimaVirgola !== -1) {
    testo = testo.replace(/\./g, "").replace(",", ".");
  }

  const numero = Number(testo);

  if (!Number.isFinite(numero)) return null;

  return negativoParentesi ? -numero : numero;
};

const parseData = (valore) => {
  if (valore instanceof Date && !Number.isNaN(valore.getTime())) {
    return [
      valore.getFullYear(),
      String(valore.getMonth() + 1).padStart(2, "0"),
      String(valore.getDate()).padStart(2, "0")
    ].join("-");
  }

  const testo = String(valore ?? "").trim();

  if (!testo) return null;

  const italiana = testo.match(
  /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/
);

  if (italiana) {
    const giorno = Number(italiana[1]);
    const mese = Number(italiana[2]);
    const anno = Number(italiana[3]);

    return validaData(anno, mese, giorno);
  }

  const iso = testo.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);

  if (iso) {
    return validaData(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3])
    );
  }

  return null;
};

const validaData = (anno, mese, giorno) => {
  const data = new Date(Date.UTC(anno, mese - 1, giorno));

  if (
    data.getUTCFullYear() !== anno ||
    data.getUTCMonth() !== mese - 1 ||
    data.getUTCDate() !== giorno
  ) {
    return null;
  }

  return [
    String(anno).padStart(4, "0"),
    String(mese).padStart(2, "0"),
    String(giorno).padStart(2, "0")
  ].join("-");
};

const trovaIntestazione = (righe) => {
  const intestazioniAttese = {
    data: ["data"],
    descrizione: ["fornitore/cliente", "fornitore / cliente"],
    ingresso: ["ingresso"],
    uscita: ["uscita"],
    numeroDocumento: ["n. documento", "numero documento", "n documento"],
    note: ["note"]
  };

  for (let indice = 0; indice < Math.min(righe.length, 50); indice += 1) {
    const celle = righe[indice].map(normalizzaTesto);
    const colonne = {};

    for (const [chiave, alternative] of Object.entries(intestazioniAttese)) {
      const posizione = celle.findIndex((cella) =>
        alternative.includes(cella)
      );

      if (posizione !== -1) {
        colonne[chiave] = posizione;
      }
    }

      
    if (
      ["data", "descrizione", "ingresso", "uscita"].every(
        (chiave) => colonne[chiave] !== undefined
      )
    ) {
      // Se "note" non ha intestazione, individua la colonna
      // immediatamente successiva a "numeroDocumento".
      if (
        colonne.note === undefined &&
        colonne.numeroDocumento !== undefined
      ) {
        colonne.note = colonne.numeroDocumento + 1;
      }

      return { indice, colonne };
    }

  }

  return null;
};

const valoreColonna = (riga, colonne, nome) => {
  const indice = colonne[nome];

  if (indice === undefined) return "";

  return String(riga[indice] ?? "").trim();
};

const rigaVuota = (riga) =>
  !riga.some((valore) => String(valore ?? "").trim() !== "");

const analizzaFoglio = (nomeFoglio, righe) => {
  const intestazione = trovaIntestazione(righe);

 if (!intestazione) {
  return null;
}

  const { indice, colonne } = intestazione;
  const movimenti = [];
  const anomalie = [];
  const giacenzeIniziali = [];
  let ultimaData = null;
  let totaleEntrate = 0;
  let totaleUscite = 0;

  for (let i = indice + 1; i < righe.length; i += 1) {
    const riga = righe[i];

    if (rigaVuota(riga)) continue;

    const dataOriginale = valoreColonna(riga, colonne, "data");
    const descrizione = valoreColonna(riga, colonne, "descrizione");
    const ingressoOriginale = valoreColonna(riga, colonne, "ingresso");
    const uscitaOriginale = valoreColonna(riga, colonne, "uscita");
    const numeroDocumento = valoreColonna(
      riga,
      colonne,
      "numeroDocumento"
    );
    const note = valoreColonna(riga, colonne, "note");

    const descrizioneNormalizzata = normalizzaTesto(descrizione);
    const ingresso = parseNumero(ingressoOriginale);
    const uscita = parseNumero(uscitaOriginale);

    if (descrizioneNormalizzata.includes("giacenza iniziale")) {
      if (
        ingressoOriginale === "" ||
        ingresso === null ||
        ingresso < 0 ||
        uscitaOriginale !== ""
      ) {
        anomalie.push({
          riga: Number.isInteger(riga.indiceODS)
  ? riga.indiceODS + 1
  : i + 1,
          tipo: "errore",
          messaggio:
            "La giacenza iniziale deve contenere un valore numerico non negativo nella colonna INGRESSO e la colonna USCITA deve essere vuota."
        });
      } else {
        giacenzeIniziali.push(ingresso);
      }

      continue;
    }

    // Le righe informative senza quantità non diventano movimenti.
    if (
      descrizioneNormalizzata.includes("prezzo acquisto") &&
      ingressoOriginale === "" &&
      uscitaOriginale === ""
    ) {
      continue;
    }

    const data = parseData(dataOriginale);
    const haIngresso = ingressoOriginale !== "";
    const haUscita = uscitaOriginale !== "";

    if (!descrizione && !haIngresso && !haUscita && !dataOriginale) {
      continue;
    }

    if (!data) {
      anomalie.push({
        riga: Number.isInteger(riga.indiceODS)
  ? riga.indiceODS + 1
  : i + 1,
        tipo: "errore",
        messaggio: `Data mancante o non valida: "${dataOriginale}".`
      });
      continue;
    }

    if (haIngresso === haUscita) {
      anomalie.push({
        riga: Number.isInteger(riga.indiceODS)
  ? riga.indiceODS + 1
  : i + 1,
        tipo: "errore",
        messaggio:
          "Indicare una quantità soltanto: INGRESSO oppure USCITA."
      });
      continue;
    }

    const quantita = haIngresso ? ingresso : uscita;

    if (quantita === null || quantita <= 0) {
      anomalie.push({
        riga: Number.isInteger(riga.indiceODS)
  ? riga.indiceODS + 1
  : i + 1,
        tipo: "errore",
        messaggio: "La quantità deve essere numerica e maggiore di zero."
      });
      continue;
    }

    if (ultimaData && data < ultimaData) {
      anomalie.push({
       riga: Number.isInteger(riga.indiceODS)
  ? riga.indiceODS + 1
  : i + 1,
        tipo: "avviso",
        messaggio:
          `Data precedente alla riga valida precedente (${dataOriginale}). Verificare che sia corretta.`
      });
    }

    ultimaData = data;

    movimenti.push({
      data,
      tipo: haIngresso ? "ENTRATA" : "USCITA",
      descrizione,
      numeroDocumento,
      note,
      quantita
    });

    if (haIngresso) {
      totaleEntrate += quantita;
    } else {
      totaleUscite += quantita;
    }
  }

  if (giacenzeIniziali.length === 0) {
    anomalie.push({
      riga: null,
      tipo: "errore",
      messaggio: "Non è stata trovata una giacenza iniziale valida."
    });
  } else if (
    giacenzeIniziali.some((valore) => valore !== giacenzeIniziali[0])
  ) {
    anomalie.push({
      riga: null,
      tipo: "errore",
      messaggio: "Sono presenti più giacenze iniziali con valori diversi."
    });
  } else if (giacenzeIniziali.length > 1) {
    anomalie.push({
      riga: null,
      tipo: "avviso",
      messaggio: "La giacenza iniziale compare più volte con lo stesso valore."
    });
  }

  return {
    nome: nomeFoglio,
    valido: !anomalie.some((anomalia) => anomalia.tipo === "errore"),
    errore: null,
    giacenzaIniziale:
      giacenzeIniziali.length > 0 &&
      giacenzeIniziali.every((valore) => valore === giacenzeIniziali[0])
        ? giacenzeIniziali[0]
        : null,
    movimenti,
    anomalie,
    totaleEntrate,
    totaleUscite
  };
};

/**
 * Legge un file ODS e restituisce i fogli disponibili.
 *
 * Ogni foglio contiene:
 * - nome: nome originale del foglio
 * - valido: indica se può essere importato
 * - giacenzaIniziale: giacenza iniziale numerica
 * - movimenti: movimenti già normalizzati per METALFLOW
 * - anomalie: errori bloccanti e avvisi
 * - totaleEntrate / totaleUscite: riepilogo quantità
 */
export const leggiFileODS = async (file) => {
  if (!file) {
    throw new Error("Seleziona un file ODS.");
  }

  if (!file.name.toLocaleLowerCase("it-IT").endsWith(".ods")) {
    throw new Error("Il file selezionato non è un file .ods.");
  }

  const buffer = await file.arrayBuffer();
  const archivio = unzipSync(new Uint8Array(buffer));
  const contenuto = archivio["content.xml"];

  if (!contenuto) {
    throw new Error("Il file ODS non contiene content.xml.");
  }

  const xml = strFromU8(contenuto);
  const documento = new DOMParser().parseFromString(
    xml,
    "application/xml"
  );

  if (documento.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Il contenuto XML del file ODS non è valido.");
  }

  const fogliXML = Array.from(
    documento.getElementsByTagNameNS("*", "table")
  ).filter((elemento) => {
    const nome = valoreAttributo(elemento, "name");
    return Boolean(nome) && elemento.parentElement?.localName !== "table";
  });

  if (!fogliXML.length) {
    throw new Error("Non è stato trovato alcun foglio nel file ODS.");
  }

  return fogliXML
    .map((foglioXML) => {
      const nome = valoreAttributo(foglioXML, "name");
      const righe = leggiRigheFoglio(foglioXML);

      return analizzaFoglio(nome, righe);
    })
    .filter(Boolean);
};
