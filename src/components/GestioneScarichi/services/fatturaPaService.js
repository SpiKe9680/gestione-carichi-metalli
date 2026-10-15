
const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const testo = (value) => String(value ?? "").trim();

const numero = (value) => {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const decimale = (value) => numero(value).toFixed(2);

const dataIso = (value) => {
  let data = value?.toDate ? value.toDate() : value;

  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }

  const d = data instanceof Date ? data : new Date(data);

  if (Number.isNaN(d.getTime())) return "";

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const tag = (nome, valore) =>
  `<${nome}>${escapeXml(valore)}</${nome}>`;

const tagOpzionale = (nome, valore) =>
  testo(valore) ? tag(nome, valore) : "";

const indirizzoCompleto = (anagrafica) =>
  [anagrafica?.indirizzo, anagrafica?.numeroCivico]
    .map(testo)
    .filter(Boolean)
    .join(", ");

const ricavaCapComuneProvincia = (anagrafica) => {
  const capCitta = testo(anagrafica?.capCitta);
  const cap = testo(anagrafica?.cap) || capCitta.match(/\b\d{5}\b/)?.[0] || "";

  const comune = testo(anagrafica?.comune);
  const provincia = testo(anagrafica?.provincia);

  return { cap, comune, provincia };
};

const descrizioneRiga = (riga, blocco) => {
  const parti = [
    testo(riga.materiale) || "Materiale",
    testo(blocco.cer) ? `CER ${testo(blocco.cer)}` : "",
    testo(blocco.fir) ? `FIR ${testo(blocco.fir)}` : "",
  ].filter(Boolean);

  return parti.join(" - ");
};

export const validaFatturaPa = (fattura) => {
  const errori = [];
  const cedente = fattura?.cedente || {};
  const cliente = fattura?.clienteDati || {};
  const banca = fattura?.banca || {};

  const controlla = (condizione, messaggio) => {
    if (!condizione) errori.push(messaggio);
  };

  controlla(testo(cedente.ragioneSociale), "Cedente: ragione sociale");
  controlla(testo(cedente.piva), "Cedente: partita IVA");
  controlla(testo(cedente.regimeFiscale), "Cedente: regime fiscale");
  controlla(testo(indirizzoCompleto(cedente)), "Cedente: indirizzo");
  controlla(
    !!ricavaCapComuneProvincia(cedente).cap,
    "Cedente: CAP"
  );
  controlla(
    !!ricavaCapComuneProvincia(cedente).comune ||
      !!testo(cedente.capCitta).match(/\d{5}\s+(.+?)\s+\([A-Z]{2}\)/),
    "Cedente: comune"
  );

  controlla(
    testo(cliente.ragioneSociale || cliente.nome),
    "Cliente: ragione sociale"
  );
  controlla(testo(cliente.piva), "Cliente: partita IVA");
  controlla(testo(indirizzoCompleto(cliente)), "Cliente: indirizzo");

  const clienteEstero = testo(cliente.paese).toUpperCase() &&
    testo(cliente.paese).toUpperCase() !== "IT";

  controlla(
    !!ricavaCapComuneProvincia(cliente).cap ||
      !!testo(cliente.capCitta).match(/\b\d{5}\b/),
    "Cliente: CAP"
  );
  controlla(
    !!testo(cliente.comune) ||
      !!testo(cliente.capCitta).match(/\d{5}\s+(.+?)\s+\([A-Z]{2}\)/),
    "Cliente: comune"
  );

  if (!clienteEstero) {
    controlla(
      !!testo(cliente.provincia) ||
        !!testo(cliente.capCitta).match(/\(([A-Z]{2})\)/),
      "Cliente: provincia"
    );
    controlla(
      /^[A-Z0-9]{7}$/.test(testo(cliente.codiceDestinatario).toUpperCase()),
      "Cliente: codice destinatario SDI di 7 caratteri"
    );
  } else {
    controlla(testo(cliente.paese), "Cliente estero: codice paese");
  }

  controlla(testo(fattura.numeroFattura), "Numero fattura");
  controlla(!!dataIso(fattura.dataFattura), "Data fattura");
  controlla(
    ["TD01", "TD24"].includes(testo(fattura.tipoDocumento)),
    "Tipo documento non valido"
  );
  controlla(testo(fattura.naturaIva), "Natura IVA");

  const righe = (fattura.blocchi || []).flatMap((blocco) =>
    (blocco.righe || []).map((riga) => ({ blocco, riga }))
  );

  controlla(righe.length > 0, "Nessuna riga fattura");

  righe.forEach(({ riga }, indice) => {
    controlla(
      numero(riga.netto) > 0,
      `Riga ${indice + 1}: peso netto mancante o non valido`
    );
    controlla(
      numero(riga.prezzo) >= 0,
      `Riga ${indice + 1}: prezzo non valido`
    );
  });

  controlla(testo(fattura.riferimentoNormativo), "Riferimento normativo IVA");

  if (fattura.modalitaPagamento) {
    controlla(testo(banca.iban), "Pagamento: IBAN della banca");
  }

  return [...new Set(errori)];
};

export const generaXmlFatturaPa = (fattura) => {
  const errori = validaFatturaPa(fattura);

  if (errori.length) {
    return { xml: null, errori };
  }

  const cedente = fattura.cedente;
  const cliente = fattura.clienteDati;
  const banca = fattura.banca || {};
  const { cap: capCedente, comune: comuneCedente, provincia: provinciaCedente } =
    ricavaCapComuneProvincia(cedente);
  const { cap: capCliente, comune: comuneCliente, provincia: provinciaCliente } =
    ricavaCapComuneProvincia(cliente);

  const paeseCliente = testo(cliente.paese || "IT").toUpperCase();
  const idCliente = testo(cliente.piva || cliente.codiceFiscale);
  const idCedente = testo(cedente.piva || cedente.codiceFiscale);
  const codiceDestinatario =
    testo(cliente.codiceDestinatario).toUpperCase() || "XXXXXXX";

  const righe = (fattura.blocchi || []).flatMap((blocco) =>
    (blocco.righe || []).map((riga) => ({
      blocco,
      riga,
      importo: Math.round(numero(riga.netto) * numero(riga.prezzo) * 100) / 100,
    }))
  );

  const imponibile =
    Math.round(righe.reduce((somma, riga) => somma + riga.importo, 0) * 100) / 100;

  const righeXml = righe.map(({ blocco, riga, importo }, indice) => {
    const cer = testo(blocco.cer);
    const natura = testo(fattura.naturaIva);

    return `<DettaglioLinee>
      ${tag("NumeroLinea", indice + 1)}
      <CodiceArticolo>
        ${tag("CodiceTipo", cer ? "CER" : "ADDEBITO")}
        ${tag("CodiceValore", cer || "-")}
      </CodiceArticolo>
      ${tag("Descrizione", descrizioneRiga(riga, blocco))}
      ${tag("Quantita", decimale(riga.netto))}
      ${tag("UnitaMisura", "kg")}
      ${tag("PrezzoUnitario", decimale(riga.prezzo))}
      ${tag("PrezzoTotale", decimale(importo))}
      ${tag("AliquotaIVA", "0.00")}
      ${tag("Natura", natura)}
    </DettaglioLinee>`;
  }).join("\n");

  const datiPagamento = fattura.modalitaPagamento
    ? `<DatiPagamento>
        ${tag("CondizioniPagamento", fattura.condizioniPagamento || "TP02")}
        <DettaglioPagamento>
          ${tag("ModalitaPagamento", fattura.modalitaPagamento)}
          ${tagOpzionale("DataScadenzaPagamento", dataIso(fattura.dataScadenzaPagamento))}
          ${tag("ImportoPagamento", decimale(imponibile))}
          ${tagOpzionale("IstitutoFinanziario", banca.nome)}
          ${tagOpzionale("IBAN", banca.iban)}
          ${tagOpzionale("ABI", banca.abi)}
          ${tagOpzionale("CAB", banca.cab)}
        </DettaglioPagamento>
      </DatiPagamento>`
    : "";

  const datiTrasmissione = `<DatiTrasmissione>
    <IdTrasmittente>
      ${tag("IdPaese", "IT")}
      ${tag("IdCodice", idCedente)}
    </IdTrasmittente>
    ${tag("ProgressivoInvio", testo(fattura.numeroFattura).replace(/\D/g, "").slice(-10).padStart(5, "0"))}
    ${tag("FormatoTrasmissione", "FPR12")}
    ${tag("CodiceDestinatario", codiceDestinatario)}
    ${testo(cliente.pec) ? `<PECDestinatario>${escapeXml(cliente.pec)}</PECDestinatario>` : ""}
  </DatiTrasmissione>`;

  const datiCedente = `<CedentePrestatore>
    <DatiAnagrafici>
      <IdFiscaleIVA>
        ${tag("IdPaese", "IT")}
        ${tag("IdCodice", idCedente)}
      </IdFiscaleIVA>
      ${tagOpzionale("CodiceFiscale", cedente.codiceFiscale)}
      <Anagrafica>${tag("Denominazione", cedente.ragioneSociale)}</Anagrafica>
      ${tag("RegimeFiscale", cedente.regimeFiscale || "RF18")}
    </DatiAnagrafici>
    <Sede>
      ${tag("Indirizzo", indirizzoCompleto(cedente))}
      ${tag("CAP", capCedente)}
      ${tag("Comune", comuneCedente || testo(cedente.capCitta).replace(/^\d{5}\s*/, "").replace(/\s*\([A-Z]{2}\)$/, ""))}
      ${tagOpzionale("Provincia", provinciaCedente || testo(cedente.capCitta).match(/\(([A-Z]{2})\)/)?.[1])}
      ${tag("Nazione", "IT")}
    </Sede>
  </CedentePrestatore>`;

  const datiCliente = `<CessionarioCommittente>
    <DatiAnagrafici>
      ${paeseCliente && idCliente
        ? `<IdFiscaleIVA>${tag("IdPaese", paeseCliente)}${tag("IdCodice", idCliente)}</IdFiscaleIVA>`
        : ""}
      ${tagOpzionale("CodiceFiscale", cliente.codiceFiscale)}
      <Anagrafica>${tag("Denominazione", cliente.ragioneSociale || cliente.nome)}</Anagrafica>
    </DatiAnagrafici>
    <Sede>
      ${tag("Indirizzo", indirizzoCompleto(cliente))}
      ${tag("CAP", capCliente || "00000")}
      ${tag("Comune", comuneCliente || testo(cliente.capCitta).replace(/^\d{5}\s*/, "").replace(/\s*\([A-Z]{2}\)$/, ""))}
      ${tagOpzionale("Provincia", provinciaCliente || testo(cliente.capCitta).match(/\(([A-Z]{2})\)/)?.[1])}
      ${tag("Nazione", paeseCliente)}
    </Sede>
  </CessionarioCommittente>`;

  const data = dataIso(fattura.dataFattura);
  const numeroFattura = testo(fattura.numeroFattura);
  const tipoDocumento = testo(fattura.tipoDocumento || "TD24");
  const natura = testo(fattura.naturaIva);
  const riepilogo = `<DatiRiepilogo>
    ${tag("AliquotaIVA", "0.00")}
    ${tag("Natura", natura)}
    ${tag("ImponibileImporto", decimale(imponibile))}
    ${tag("Imposta", "0.00")}
    ${tag("EsigibilitaIVA", "I")}
    ${tag("RiferimentoNormativo", fattura.riferimentoNormativo)}
  </DatiRiepilogo>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12" xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader xmlns="">
    ${datiTrasmissione}
    ${datiCedente}
    ${datiCliente}
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody xmlns="">
    <DatiGenerali>
      <DatiGeneraliDocumento>
        ${tag("TipoDocumento", tipoDocumento)}
        ${tag("Divisa", "EUR")}
        ${tag("Data", data)}
        ${tag("Numero", numeroFattura)}
        ${tag("ImportoTotaleDocumento", decimale(imponibile))}
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${righeXml}
      ${riepilogo}
    </DatiBeniServizi>
    ${datiPagamento}
  </FatturaElettronicaBody>
</FatturaElettronica>`;

  return { xml, errori: [] };
};

export const scaricaXmlFatturaPa = (xml, numeroFattura) => {
  const blob = new Blob([xml], {
    type: "application/xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `IT${Date.now()}_${testo(numeroFattura) || "fattura"}.xml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
