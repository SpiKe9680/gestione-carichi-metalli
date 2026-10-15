
const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const testo = (value) => String(value ?? "").trim();

const numero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const euro = (value) => numero(value).toFixed(2);

const dataISO = (value) => {
  const d = value?.toDate
    ? value.toDate()
    : value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const campo = (nome, valore) =>
  testo(valore)
    ? `<${nome}>${escapeXml(testo(valore))}</${nome}>`
    : "";

const parseIndirizzo = (anagrafica = {}) => {
  const capCitta = testo(anagrafica.capCitta);
  const match = capCitta.match(
    /^(\d{5})\s+(.+?)\s+\(([A-Za-z]{2})\)$/
  );

  return {
    cap: testo(anagrafica.cap) || match?.[1] || "",
    comune: testo(anagrafica.comune) || match?.[2] || "",
    provincia:
      testo(anagrafica.provincia) ||
      match?.[3]?.toUpperCase() ||
      "",
  };
};

export const analizzaFatturaPa = (documento = {}) => {
  const errori = [];
  const cedente = documento.cedente || {};
  const cliente = documento.clienteDati || {};
  const banca = documento.banca || {};

  const sedeCedente = parseIndirizzo(cedente);
  const sedeCliente = parseIndirizzo(cliente);

  const richiedi = (valore, descrizione) => {
    if (!testo(valore)) errori.push(descrizione);
  };

  richiedi(documento.numeroFattura, "Numero fattura");
  richiedi(dataISO(documento.dataFattura), "Data fattura");
  richiedi(documento.tipoDocumento, "Tipo documento");

  richiedi(cedente.ragioneSociale, "Ragione sociale cedente");
  richiedi(cedente.piva, "Partita IVA cedente");
  richiedi(cedente.regimeFiscale, "Regime fiscale cedente");
  richiedi(cedente.indirizzo, "Indirizzo cedente");
  richiedi(sedeCedente.cap, "CAP cedente");
  richiedi(sedeCedente.comune, "Comune cedente");
  richiedi(sedeCedente.provincia, "Provincia cedente");

  richiedi(
    cliente.ragioneSociale || cliente.nome || documento.cliente,
    "Ragione sociale cliente"
  );
  richiedi(cliente.piva, "Partita IVA cliente");
  richiedi(cliente.indirizzo, "Indirizzo cliente");
  richiedi(sedeCliente.cap, "CAP cliente");
  richiedi(sedeCliente.comune, "Comune cliente");
  richiedi(sedeCliente.provincia, "Provincia cliente");

  if (
    !testo(cliente.codiceDestinatario) &&
    !testo(cliente.pec)
  ) {
    errori.push("Codice destinatario SDI oppure PEC cliente");
  }

  richiedi(documento.naturaIva, "Natura IVA");
  richiedi(documento.riferimentoNormativo, "Riferimento normativo IVA");
  richiedi(documento.condizioniPagamento, "Condizioni di pagamento");
  richiedi(documento.modalitaPagamento, "Modalità di pagamento");
  richiedi(dataISO(documento.dataScadenzaPagamento), "Scadenza pagamento");

  if (documento.modalitaPagamento === "MP05") {
    richiedi(banca.iban, "IBAN banca di accredito");
  }

  if (!Array.isArray(documento.blocchi) || !documento.blocchi.length) {
    errori.push("Righe della fattura");
  } else {
    const righe = documento.blocchi.flatMap((blocco) =>
      (blocco.righe || []).map((riga) => ({ blocco, riga }))
    );

    if (!righe.length) errori.push("Righe della fattura");

    righe.forEach(({ riga }, i) => {
      if (!testo(riga.materiale)) {
        errori.push(`Materiale riga ${i + 1}`);
      }

      const netto = riga.netto ?? riga.pesoNetto ?? riga.peso;
      if (netto === null || netto === undefined || netto === "") {
        errori.push(`Quantità riga ${i + 1}`);
      } else if (!Number.isFinite(Number(netto)) || Number(netto) <= 0) {
        errori.push(`Quantità non valida riga ${i + 1}`);
      }

      if (
        riga.prezzo === null ||
        riga.prezzo === undefined ||
        riga.prezzo === "" ||
        !Number.isFinite(Number(riga.prezzo)) ||
        Number(riga.prezzo) < 0
      ) {
        errori.push(`Prezzo non valido riga ${i + 1}`);
      }
    });
  }

  return [...new Set(errori)];
};

export const costruisciXmlFatturaPa = (documento = {}) => {
  const errori = analizzaFatturaPa(documento);

  if (errori.length) {
    throw new Error(
      "DATI_FATTURA_MANCANTI\n" + errori.join("\n")
    );
  }

  const cedente = documento.cedente;
  const cliente = documento.clienteDati;
  const banca = documento.banca || {};
  const sedeCedente = parseIndirizzo(cedente);
  const sedeCliente = parseIndirizzo(cliente);

  const righe = documento.blocchi.flatMap((blocco) =>
    (blocco.righe || []).map((riga) => ({
      fir: blocco.fir || riga.fir || "",
      cer: blocco.cer || riga.cer || "",
      materiale: riga.materiale,
      netto: numero(riga.netto ?? riga.pesoNetto ?? riga.peso),
      prezzo: numero(riga.prezzo),
    }))
  );

  let imponibile = 0;

  const righeXml = righe.map((riga, index) => {
    const totaleRiga = Math.round(
      riga.netto * riga.prezzo * 100
    ) / 100;

    imponibile += totaleRiga;

    const descrizione = [
      riga.materiale,
      riga.cer ? `CER ${riga.cer}` : "",
      riga.fir ? `FIR ${riga.fir}` : "",
    ].filter(Boolean).join(" - ");

    return `
      <DettaglioLinee>
        <NumeroLinea>${index + 1}</NumeroLinea>
        <Descrizione>${escapeXml(descrizione)}</Descrizione>
        <Quantita>${riga.netto.toFixed(2)}</Quantita>
        <UnitaMisura>KG</UnitaMisura>
        <PrezzoUnitario>${euro(riga.prezzo)}</PrezzoUnitario>
        <PrezzoTotale>${euro(totaleRiga)}</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>${escapeXml(documento.naturaIva)}</Natura>
      </DettaglioLinee>`;
  }).join("");

  imponibile = Math.round(imponibile * 100) / 100;

  const codiceDestinatario =
    testo(cliente.codiceDestinatario) || "0000000";

  const pecDestinatario = testo(cliente.pec);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12"
 xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(cedente.piva)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(
        testo(documento.numeroFattura).replace(/[^a-zA-Z0-9]/g, "").slice(-10)
      )}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(codiceDestinatario)}</CodiceDestinatario>
      ${pecDestinatario && codiceDestinatario === "0000000"
        ? `<PECDestinatario>${escapeXml(pecDestinatario)}</PECDestinatario>`
        : ""}
    </DatiTrasmissione>

    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(cedente.piva)}</IdCodice>
        </IdFiscaleIVA>
        ${campo("CodiceFiscale", cedente.codiceFiscale)}
        <Anagrafica>
          <Denominazione>${escapeXml(cedente.ragioneSociale)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${escapeXml(cedente.regimeFiscale)}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(cedente.indirizzo)}</Indirizzo>
        <CAP>${escapeXml(sedeCedente.cap)}</CAP>
        <Comune>${escapeXml(sedeCedente.comune)}</Comune>
        <Provincia>${escapeXml(sedeCedente.provincia)}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
      ${cedente.email ? `<Contatti>${campo("Email", cedente.email)}</Contatti>` : ""}
    </CedentePrestatore>

    <CessionarioCommittente>
      <DatiAnagrafici>
        ${cliente.piva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXml(cliente.piva)}</IdCodice></IdFiscaleIVA>` : ""}
        ${campo("CodiceFiscale", cliente.codiceFiscale)}
        <Anagrafica>
          <Denominazione>${escapeXml(cliente.ragioneSociale || cliente.nome || documento.cliente)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(cliente.indirizzo)}</Indirizzo>
        <CAP>${escapeXml(sedeCliente.cap)}</CAP>
        <Comune>${escapeXml(sedeCliente.comune)}</Comune>
        <Provincia>${escapeXml(sedeCliente.provincia)}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>

  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${escapeXml(documento.tipoDocumento)}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${dataISO(documento.dataFattura)}</Data>
        <Numero>${escapeXml(documento.numeroFattura)}</Numero>
        <ImportoTotaleDocumento>${euro(imponibile)}</ImportoTotaleDocumento>
        ${campo("Causale", documento.riferimentoNormativo)}
      </DatiGeneraliDocumento>
    </DatiGenerali>

    <DatiBeniServizi>
      ${righeXml}
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>${escapeXml(documento.naturaIva)}</Natura>
        <ImponibileImporto>${euro(imponibile)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
        ${campo("RiferimentoNormativo", documento.riferimentoNormativo)}
      </DatiRiepilogo>
    </DatiBeniServizi>

    <DatiPagamento>
      <CondizioniPagamento>${escapeXml(documento.condizioniPagamento)}</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${escapeXml(documento.modalitaPagamento)}</ModalitaPagamento>
        <DataScadenzaPagamento>${dataISO(documento.dataScadenzaPagamento)}</DataScadenzaPagamento>
        <ImportoPagamento>${euro(imponibile)}</ImportoPagamento>
        ${campo("IstitutoFinanziario", banca.nome)}
        ${campo("IBAN", banca.iban)}
        ${campo("BIC", banca.bic)}
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

  return {
    xml,
    nomeFile: `IT${testo(cedente.codiceFiscale || cedente.piva)}_${testo(documento.numeroFattura)}.xml`,
  };
};
