import React from "react";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaPrint
} from "react-icons/fa";
import {
  formattaData,
  formattaNumero
} from "./magazzinoMPSUtils";


const RegistroMovimenti = ({
  magazzinoSelezionato,
  movimenti = [],
  saldo = [],
  caricamento = false,
  salvataggio = false,
  onNuovoMovimento,
  onModificaMovimento,
  onEliminaMovimento,
  onCancellaTutti,
  onStampa,
  onRipristinaOrdine,
  stili = {}
}) => {
  if (!magazzinoSelezionato) {
    return (
      <section style={stili.sezione}>
        <div style={stili.vuoto}>
          Seleziona un magazzino per visualizzare il registro dei movimenti.
        </div>
      </section>
    );
  }

  const righe = saldo.length > 0 ? saldo : movimenti;

  return (
    <section>
      <div style={stili.toolbar}>
        <h3 style={stili.titoloRegistro}>
          Registro movimenti
        </h3>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap"
          }}
        >
          {onStampa && (
            <button
              type="button"
              style={stili.pulsanteSecondario}
              onClick={onStampa}
              disabled={caricamento || salvataggio}
            >
              <FaPrint style={{ marginRight: 6 }} />
              Stampa magazzino
            </button>
          )}
          {onRipristinaOrdine && (
            <button
              type="button"
              style={stili.pulsanteSecondario}
              onClick={onRipristinaOrdine}
              disabled={caricamento || salvataggio}
              title="Ripristina l'ordine cronologico con entrate prima delle uscite a parità di data"
            >
              ↕ Ripristina ordine cronologico
            </button>
          )}
          {onCancellaTutti && (
            <button
              type="button"
              style={{
                ...stili.pulsanteElimina,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap"
              }}
              onClick={onCancellaTutti}
              disabled={
                caricamento ||
                salvataggio ||
                movimenti.length === 0
              }
              title="Cancella tutti i movimenti del magazzino selezionato"
            >
              <FaTrash style={{ marginRight: 6 }} />
              Cancella tutti i movimenti
            </button>
          )}

          {onNuovoMovimento && (
            <button
              type="button"
              style={stili.pulsante}
              onClick={onNuovoMovimento}
              disabled={caricamento || salvataggio}
            >
              <FaPlus style={{ marginRight: 6 }} />
              Nuovo movimento
            </button>
          )}
        </div>
      </div>

      <div style={stili.tabellaContenitore}>
        <table style={stili.tabella}>
          <thead>
            <tr>
              <th style={stili.cella}>Data</th>
              <th style={stili.cella}>Fornitore/Cliente</th>
              <th style={{ ...stili.cella, textAlign: "right" }}>
                Ingresso (kg)
              </th>
              <th style={{ ...stili.cella, textAlign: "right" }}>
                Uscita (kg)
              </th>
              <th style={stili.cella}>N. Documento</th>
              <th style={stili.cella}>Note</th>
              <th style={{ ...stili.cella, textAlign: "right" }}>
                Giacenza progressiva (kg)
              </th>
              <th style={stili.cella}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {caricamento ? (
              <tr>
                <td colSpan={8} style={stili.tabellaVuota}>
                  Caricamento movimenti...
                </td>
              </tr>
            ) : righe.length === 0 ? (
              <tr>
                <td colSpan={8} style={stili.tabellaVuota}>
                  Nessun movimento registrato per questo magazzino.
                </td>
              </tr>
            ) : (
              righe.map((movimento) => {
                const entrata =
                  movimento.tipo === "ENTRATA"
                    ? Number(movimento.quantita || 0)
                    : 0;

                const uscita =
                  movimento.tipo === "USCITA"
                    ? Number(movimento.quantita || 0)
                    : 0;

                return (
                  <tr key={movimento.id}>
                    <td style={stili.cella}>
                      {formattaData(movimento.data)}
                    </td>

                    <td style={stili.cella}>
                      {movimento.descrizione || "-"}
                    </td>

                    <td
                      style={{
                        ...stili.cella,
                        ...stili.cellaEntrata,
                        textAlign: "right"
                      }}
                    >
                      {entrata > 0 ? formattaNumero(entrata) : "-"}
                    </td>

                    <td
                      style={{
                        ...stili.cella,
                        ...stili.cellaUscita,
                        textAlign: "right"
                      }}
                    >
                      {uscita > 0 ? formattaNumero(uscita) : "-"}
                    </td>

                    <td style={stili.cella}>
                      {movimento.numeroDocumento || "-"}
                    </td>

                    <td
                      style={{
                        ...stili.cella,
                        whiteSpace: "pre-wrap",
                        minWidth: 160
                      }}
                    >
                      {movimento.note || "-"}
                    </td>

                    <td
                      style={{
                        ...stili.cella,
                        ...stili.cellaGiacenza,
                        textAlign: "right"
                      }}
                    >
                      {formattaNumero(movimento.progressivo)}
                    </td>

                    <td style={stili.cella}>
                      <div style={stili.azioniRiga}>
                        {onModificaMovimento && (
                          <button
                            type="button"
                            style={stili.pulsanteModifica}
                            onClick={() =>
                              onModificaMovimento(movimento)
                            }
                            disabled={salvataggio}
                            title="Modifica movimento"
                          >
                            <FaEdit />
                          </button>
                        )}

                        {onEliminaMovimento && (
                          <button
                            type="button"
                            style={stili.pulsanteElimina}
                            onClick={() =>
                              onEliminaMovimento(movimento)
                            }
                            disabled={salvataggio}
                            title="Elimina movimento"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};


export default RegistroMovimenti;
