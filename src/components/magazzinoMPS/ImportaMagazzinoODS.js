
import React, { useMemo, useState } from "react";


const formattaNumero = (valore) =>
  Number(valore || 0).toLocaleString("it-IT", {
    maximumFractionDigits: 3
  });

const formattaData = (valore) => {
  if (!valore) return "";

  const parti = String(valore).split("-");

  if (parti.length !== 3) return valore;

  return `${parti[2]}/${parti[1]}/${parti[0]}`;
};

const stili = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  modale: {
    backgroundColor: "#fff",
    color: "#222",
    width: "100%",
    maxWidth: 1050,
    maxHeight: "92vh",
    overflowY: "auto",
    borderRadius: 10,
    padding: 24,
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)"
  },
  titolo: {
    margin: "0 0 8px",
    fontSize: 22
  },
  descrizione: {
    margin: "0 0 20px",
    color: "#555",
    lineHeight: 1.5
  },
  sezione: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16
  },
  elencoFogli: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 10,
    marginTop: 12
  },
  foglio: {
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: 12,
    display: "flex",
    alignItems: "flex-start",
    gap: 10
  },
  riepilogo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    margin: "14px 0"
  },
  cardRiepilogo: {
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: 12
  },
  etichetta: {
    color: "#666",
    fontSize: 13,
    marginBottom: 5
  },
  valore: {
    fontSize: 19,
    fontWeight: 600
  },
  tabellaContenitore: {
    overflowX: "auto",
    marginTop: 12
  },
  tabella: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13
  },
  th: {
    textAlign: "left",
    backgroundColor: "#f2f2f2",
    padding: 9,
    borderBottom: "1px solid #ddd",
    whiteSpace: "nowrap"
  },
  td: {
    padding: 9,
    borderBottom: "1px solid #eee",
    verticalAlign: "top"
  },
  errore: {
    backgroundColor: "#fff0f0",
    color: "#9c2020",
    border: "1px solid #efc0c0",
    borderRadius: 6,
    padding: 10,
    marginTop: 10
  },
  avviso: {
    backgroundColor: "#fff8e6",
    color: "#795600",
    border: "1px solid #ead69c",
    borderRadius: 6,
    padding: 10,
    marginTop: 10
  },
  pulsanti: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20
  },
  pulsante: {
    border: "1px solid #bbb",
    borderRadius: 6,
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: 14
  },
  primario: {
    backgroundColor: "#1769aa",
    color: "#fff",
    border: "1px solid #1769aa"
  },
  disabilitato: {
    opacity: 0.5,
    cursor: "not-allowed"
  }
};

const ImportaMagazzinoODS = ({
  aperto,
  onChiudi,
  onImporta,
  magazzini = []
}) => {
  const [nomeFile, setNomeFile] = useState("");
  const [fogli, setFogli] = useState([]);
  const [fogliSelezionati, setFogliSelezionati] = useState([]);
  const [foglioAnteprima, setFoglioAnteprima] = useState("");
  const [caricamentoFile, setCaricamentoFile] = useState(false);
  const [importazione, setImportazione] = useState(false);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  const fogliScelti = useMemo(
    () => fogli.filter((foglio) => fogliSelezionati.includes(foglio.nome)),
    [fogli, fogliSelezionati]
  );

  const magazziniPerNome = useMemo(() => {
    const mappa = new Map();

    for (const magazzino of magazzini) {
      const chiave = String(magazzino.nome || "")
        .trim()
        .toLocaleLowerCase("it-IT");

      if (chiave) mappa.set(chiave, magazzino);
    }

    return mappa;
  }, [magazzini]);

  const foglioAttivo = useMemo(
    () => fogli.find((foglio) => foglio.nome === foglioAnteprima) || null,
    [fogli, foglioAnteprima]
  );

  const selezionaFile = async (evento) => {
    const file = evento.target.files?.[0];

    setErrore("");
    setMessaggio("");
    setFogli([]);
    setFogliSelezionati([]);
    setFoglioAnteprima("");
    setNomeFile("");

    if (!file) return;

    setCaricamentoFile(true);
    setNomeFile(file.name);

    try {
      const { leggiFileODS } = await import("./importaMagazzinoODSUtils");
      const risultati = await leggiFileODS(file);

   setFogli(risultati);

  if (risultati.length === 0) {
    setMessaggio(
      "Nel file non sono presenti fogli compatibili con l'importazione dei magazzini."
    );
  } else {
    setMessaggio(
      `File letto correttamente. Trovati ${risultati.length} fogli compatibili. Seleziona quelli da importare.`
    );
  }
    } catch (e) {
      setErrore(e.message || "Errore durante la lettura del file ODS.");
    } finally {
      setCaricamentoFile(false);
      evento.target.value = "";
    }
  };

  const cambiaSelezione = (nome, selezionato) => {
    setFogliSelezionati((precedenti) =>
      selezionato
        ? [...precedenti, nome]
        : precedenti.filter((elemento) => elemento !== nome)
    );

    setFoglioAnteprima(nome);
    setErrore("");
  };

  const selezionaTutti = () => {
    setFogliSelezionati(fogli.map((foglio) => foglio.nome));

    if (fogli.length) {
      setFoglioAnteprima(fogli[0].nome);
    }
  };

  const deselezionaTutti = () => {
    setFogliSelezionati([]);
    setFoglioAnteprima("");
  };

  const eseguiImportazione = async () => {
    setErrore("");
    setMessaggio("");

    if (!fogliScelti.length) {
      setErrore("Seleziona almeno un foglio da importare.");
      return;
    }

    const nonValidi = fogliScelti.filter((foglio) => !foglio.valido);

    if (nonValidi.length) {
      setErrore(
        `Non puoi procedere: ${nonValidi.map((foglio) => `"${foglio.nome}"`).join(", ")} contiene o contengono errori bloccanti. Correggi il file e ricaricalo.`
      );
      return;
    }

    const nomiDuplicati = new Set();
    const nomiVisti = new Set();

    for (const foglio of fogliScelti) {
      const chiave = foglio.nome.trim().toLocaleLowerCase("it-IT");

      if (nomiVisti.has(chiave)) {
        nomiDuplicati.add(foglio.nome);
      }

      nomiVisti.add(chiave);
    }

    if (nomiDuplicati.size) {
      setErrore(
        `Sono stati selezionati fogli con nomi duplicati: ${Array.from(nomiDuplicati).join(", ")}.`
      );
      return;
    }

    const esistenti = fogliScelti
      .map((foglio) => ({
        nome: foglio.nome,
        magazzino: magazziniPerNome.get(
          foglio.nome.trim().toLocaleLowerCase("it-IT")
        )
      }))
      .filter((elemento) => elemento.magazzino);

    if (esistenti.length) {
      const elenco = esistenti.map((elemento) => elemento.nome).join("\n");
      const conferma = window.confirm(
        `Esistono già magazzini con questi nomi:\n\n${elenco}\n\nL'importazione sostituirà i relativi dati. Vuoi continuare?`
      );

      if (!conferma) return;
    }

    if (typeof onImporta !== "function") {
      setErrore("La funzione di importazione non è ancora collegata.");
      return;
    }

    setImportazione(true);

    try {
      await onImporta(fogliScelti);
      setMessaggio("Importazione completata.");
    } catch (e) {
      setErrore(e.message || "Errore durante l'importazione.");
    } finally {
      setImportazione(false);
    }
  };

  const chiudi = () => {
    if (importazione || caricamentoFile) return;

    setNomeFile("");
    setFogli([]);
    setFogliSelezionati([]);
    setFoglioAnteprima("");
    setErrore("");
    setMessaggio("");
    onChiudi?.();
  };

  if (!aperto) return null;

  return (
    <div style={stili.overlay} onMouseDown={(evento) => {
      if (evento.target === evento.currentTarget) chiudi();
    }}>
      <div
        style={stili.modale}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-importazione-ods"
      >
        <h2 id="titolo-importazione-ods" style={stili.titolo}>
          Importa magazzini da ODS
        </h2>

        <p style={stili.descrizione}>
          Seleziona un file ODS, scegli esplicitamente i fogli da importare
          e controlla l'anteprima prima di procedere. Ogni foglio diventerà
          un magazzino con il nome originale.
        </p>

        <section style={stili.sezione}>
          <h3 style={{ marginTop: 0 }}>1. Seleziona il file</h3>

          <input
            type="file"
            accept=".ods,application/vnd.oasis.opendocument.spreadsheet"
            onChange={selezionaFile}
            disabled={caricamentoFile || importazione}
          />

          {nomeFile && (
            <p style={{ marginBottom: 0, marginTop: 10 }}>
              File: <strong>{nomeFile}</strong>
            </p>
          )}

          {caricamentoFile && <p>Lettura del file in corso...</p>}
        </section>

        {fogli.length > 0 && (
          <>
            <section style={stili.sezione}>
              <h3 style={{ marginTop: 0 }}>2. Scegli i fogli</h3>

              <div style={stili.pulsanti}>
                <button
                  type="button"
                  style={stili.pulsante}
                  onClick={selezionaTutti}
                  disabled={importazione}
                >
                  Seleziona tutti
                </button>

                <button
                  type="button"
                  style={stili.pulsante}
                  onClick={deselezionaTutti}
                  disabled={importazione}
                >
                  Deseleziona tutti
                </button>
              </div>

              <div style={stili.elencoFogli}>
                {fogli.map((foglio) => {
                  const selezionato = fogliSelezionati.includes(foglio.nome);
                  const chiave = foglio.nome
                    .trim()
                    .toLocaleLowerCase("it-IT");
                  const esiste = magazziniPerNome.has(chiave);

                  return (
                    <label key={foglio.nome} style={stili.foglio}>
                      <input
                        type="checkbox"
                        checked={selezionato}
                        disabled={importazione}
                        onChange={(evento) =>
                          cambiaSelezione(foglio.nome, evento.target.checked)
                        }
                      />

                      <span>
                        <strong>{foglio.nome}</strong>
                        <br />
                        <small>
                          {foglio.movimenti.length} movimenti
                          {esiste ? " · Magazzino già esistente" : ""}
                        </small>
                        <br />
                        <small
                          style={{
                            color: foglio.valido ? "#237a38" : "#b42318"
                          }}
                        >
                          {foglio.valido
                            ? "Pronto per l'importazione"
                            : "Da correggere"}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {fogliScelti.length > 0 && (
              <section style={stili.sezione}>
                <h3 style={{ marginTop: 0 }}>3. Riepilogo selezione</h3>

                <div style={stili.riepilogo}>
                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Fogli selezionati</div>
                    <div style={stili.valore}>{fogliScelti.length}</div>
                  </div>

                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Movimenti</div>
                    <div style={stili.valore}>
                      {fogliScelti.reduce(
                        (totale, foglio) => totale + foglio.movimenti.length,
                        0
                      )}
                    </div>
                  </div>

                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Errori bloccanti</div>
                    <div style={stili.valore}>
                      {fogliScelti.reduce(
                        (totale, foglio) =>
                          totale +
                          foglio.anomalie.filter(
                            (anomalia) => anomalia.tipo === "errore"
                          ).length,
                        0
                      )}
                    </div>
                  </div>
                </div>

                <label>
                  <strong>Foglio da visualizzare:</strong>{" "}
                  <select
                    value={foglioAnteprima}
                    onChange={(evento) => setFoglioAnteprima(evento.target.value)}
                    disabled={importazione}
                  >
                    {fogliScelti.map((foglio) => (
                      <option key={foglio.nome} value={foglio.nome}>
                        {foglio.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}

            {foglioAttivo && fogliSelezionati.includes(foglioAttivo.nome) && (
              <section style={stili.sezione}>
                <h3 style={{ marginTop: 0 }}>
                  Anteprima: {foglioAttivo.nome}
                </h3>

                <div style={stili.riepilogo}>
                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Giacenza iniziale</div>
                    <div style={stili.valore}>
                      {foglioAttivo.giacenzaIniziale === null
                        ? "Non valida"
                        : formattaNumero(foglioAttivo.giacenzaIniziale)}
                    </div>
                  </div>

                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Movimenti validi</div>
                    <div style={stili.valore}>
                      {foglioAttivo.movimenti.length}
                    </div>
                  </div>

                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Totale entrate</div>
                    <div style={stili.valore}>
                      {formattaNumero(foglioAttivo.totaleEntrate)}
                    </div>
                  </div>

                  <div style={stili.cardRiepilogo}>
                    <div style={stili.etichetta}>Totale uscite</div>
                    <div style={stili.valore}>
                      {formattaNumero(foglioAttivo.totaleUscite)}
                    </div>
                  </div>
                </div>

                {foglioAttivo.anomalie.map((anomalia, indice) => (
                  <div
                    key={`${anomalia.riga ?? "generale"}-${indice}`}
                    style={
                      anomalia.tipo === "errore"
                        ? stili.errore
                        : stili.avviso
                    }
                  >
                    <strong>
                      {anomalia.tipo === "errore" ? "Errore" : "Avviso"}
                      {anomalia.riga ? ` · Riga ${anomalia.riga}` : ""}
                    </strong>
                    : {anomalia.messaggio}
                  </div>
                ))}

                <div style={stili.tabellaContenitore}>
                  <table style={stili.tabella}>
                    <thead>
                      <tr>
                        <th style={stili.th}>Data</th>
                        <th style={stili.th}>Tipo</th>
                        <th style={stili.th}>Fornitore/Cliente</th>
                        <th style={stili.th}>Quantità</th>
                        <th style={stili.th}>N. Documento</th>
                        <th style={stili.th}>Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {foglioAttivo.movimenti.slice(0, 100).map((movimento, indice) => (
                        <tr key={`${movimento.data}-${indice}`}>
                          <td style={stili.td}>
                            {formattaData(movimento.data)}
                          </td>
                          <td style={stili.td}>{movimento.tipo}</td>
                          <td style={stili.td}>{movimento.descrizione}</td>
                          <td style={stili.td}>
                            {formattaNumero(movimento.quantita)}
                          </td>
                          <td style={stili.td}>{movimento.numeroDocumento}</td>
                          <td style={stili.td}>{movimento.note}</td>
                        </tr>
                      ))}

                      {foglioAttivo.movimenti.length === 0 && (
                        <tr>
                          <td style={stili.td} colSpan={6}>
                            Nessun movimento valido trovato.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {foglioAttivo.movimenti.length > 100 && (
                    <p>
                      Anteprima limitata ai primi 100 movimenti. In importazione
                      saranno considerati tutti i movimenti validi.
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {errore && <div style={stili.errore}>{errore}</div>}
        {messaggio && <div style={stili.avviso}>{messaggio}</div>}

        <div style={stili.pulsanti}>
          <button
            type="button"
            style={stili.pulsante}
            onClick={chiudi}
            disabled={importazione || caricamentoFile}
          >
            Annulla
          </button>

          <button
            type="button"
            style={{
              ...stili.pulsante,
              ...stili.primario,
              ...((!fogliScelti.length ||
                fogliScelti.some((foglio) => !foglio.valido) ||
                importazione ||
                caricamentoFile)
                ? stili.disabilitato
                : {})
            }}
            onClick={eseguiImportazione}
            disabled={
              !fogliScelti.length ||
              fogliScelti.some((foglio) => !foglio.valido) ||
              importazione ||
              caricamentoFile
            }
          >
            {importazione ? "Importazione in corso..." : "Importa fogli selezionati"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportaMagazzinoODS;
