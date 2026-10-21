
import React from "react";
import { FaTimes, FaSave } from "react-icons/fa";

const ModaliMagazzino = ({
  mostraRinomina = false,
  nomeMagazzino = "",
  setNomeMagazzino,
  onSalvaRinomina,
  mostraGiacenza = false,
  giacenzaIniziale = "",
  setGiacenzaIniziale,
  onSalvaGiacenza,
  salvataggio = false,
  onChiudi,
  stili = {}
}) => {
  if (!mostraRinomina && !mostraGiacenza) return null;

  const rinomina = mostraRinomina;

  const titolo = rinomina
    ? "Rinomina magazzino"
    : "Modifica giacenza iniziale";

  const gestoreSubmit = rinomina
    ? onSalvaRinomina
    : onSalvaGiacenza;

  return (
    <div style={stili.overlay}>
      <div
        style={stili.modale}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-modale-magazzino"
      >
        <div style={stili.modaleHeader}>
          <h2 id="titolo-modale-magazzino">{titolo}</h2>

          <button
            type="button"
            style={stili.chiudi}
            onClick={onChiudi}
            disabled={salvataggio}
            aria-label="Chiudi"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={gestoreSubmit}>
          {rinomina ? (
            <div style={stili.sezione}>
              <label
                htmlFor="mps-nome-magazzino"
                style={stili.etichetta}
              >
                Nome magazzino *
              </label>

              <input
                id="mps-nome-magazzino"
                type="text"
                value={nomeMagazzino}
                onChange={(e) => setNomeMagazzino(e.target.value)}
                style={stili.input}
                placeholder="Inserisci il nuovo nome"
                maxLength={100}
                required
                disabled={salvataggio}
                autoFocus
              />
            </div>
          ) : (
            <div style={stili.sezione}>
              <label
                htmlFor="mps-giacenza-iniziale"
                style={stili.etichetta}
              >
                Giacenza iniziale (kg) *
              </label>

              <input
                id="mps-giacenza-iniziale"
                type="number"
                value={giacenzaIniziale}
                onChange={(e) => setGiacenzaIniziale(e.target.value)}
                style={stili.input}
                placeholder="Inserisci la giacenza iniziale"
                min="0"
                step="0.001"
                required
                disabled={salvataggio}
                autoFocus
              />

              <p style={stili.nota}>
                La modifica aggiorna la base di calcolo della giacenza
                progressiva. I movimenti registrati non vengono modificati.
              </p>
            </div>
          )}

          <div style={stili.modaleAzioni}>
            <button
              type="button"
              style={stili.pulsanteSecondario}
              onClick={onChiudi}
              disabled={salvataggio}
            >
              <FaTimes style={{ marginRight: 6 }} />
              Annulla
            </button>

            <button
              type="submit"
              style={stili.pulsante}
              disabled={salvataggio}
            >
              <FaSave style={{ marginRight: 6 }} />
              {salvataggio ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModaliMagazzino;
