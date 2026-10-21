
import React from "react";
import DatePicker from "react-datepicker";
import { it } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  FaTimes,
  FaSave
} from "react-icons/fa";
const dataInFormatoItaliano = (data) => {
  if (!data) return "";

  const match = String(data).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return data;

  return `${match[3]}/${match[2]}/${match[1]}`;
};

const dataDaFormatoItaliano = (valore) => {
  const match = String(valore).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return "";

  const giorno = Number(match[1]);
  const mese = Number(match[2]);
  const anno = Number(match[3]);

  const verifica = new Date(anno, mese - 1, giorno);

  if (
    verifica.getFullYear() !== anno ||
    verifica.getMonth() !== mese - 1 ||
    verifica.getDate() !== giorno
  ) {
    return "";
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
};
const ModaleMovimento = ({
  aperto = false,
  movimentoInModifica = null,
  tipo,
  setTipo,
  data,
  setData,
  descrizione,
  setDescrizione,
  numeroDocumento,
  setNumeroDocumento,
  note,
  setNote,
  quantita,
  setQuantita,
  salvataggio = false,
  onSubmit,
  onChiudi,
  stili = {}
}) => {
  if (!aperto) return null;

  const modifica = Boolean(movimentoInModifica);

  return (
    <div style={stili.overlay}>
      <div
        style={stili.modale}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-modale-movimento"
      >
        <div style={stili.modaleHeader}>
          <h2 id="titolo-modale-movimento">
            {modifica ? "Modifica movimento" : "Nuovo movimento"}
          </h2>

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

        <form onSubmit={onSubmit}>
          <div style={stili.sezione}>
            <label htmlFor="mps-tipo" style={stili.etichetta}>
              Tipo movimento *
            </label>

            <select
              id="mps-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={stili.input}
              required
              disabled={salvataggio}
            >
              <option value="ENTRATA">Entrata</option>
              <option value="USCITA">Uscita</option>
            </select>
          </div>

     <div style={stili.sezione}>
  <label htmlFor="mps-data" style={stili.etichetta}>
    Data *
  </label>

  <DatePicker
    id="mps-data"
    selected={data ? new Date(`${data}T12:00:00`) : null}
    onChange={(date) => {
      if (!date) {
        setData("");
        return;
      }

      const anno = date.getFullYear();
      const mese = String(date.getMonth() + 1).padStart(2, "0");
      const giorno = String(date.getDate()).padStart(2, "0");

      setData(`${anno}-${mese}-${giorno}`);
    }}
    dateFormat="dd/MM/yyyy"
    locale={it}
    placeholderText="GG/MM/AAAA"
    className="input-data-mps"
    required
    disabled={salvataggio}
    autoComplete="off"
  />
</div>

          <div style={stili.sezione}>
            <label htmlFor="mps-descrizione" style={stili.etichetta}>
              Descrizione *
            </label>

            <input
              id="mps-descrizione"
              type="text"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              style={stili.input}
              placeholder="Descrizione del movimento"
              maxLength={250}
              required
              disabled={salvataggio}
            />
          </div>

          <div style={stili.sezione}>
            <label htmlFor="mps-numero-documento" style={stili.etichetta}>
              N. Documento
            </label>

            <input
              id="mps-numero-documento"
              type="text"
              value={numeroDocumento ?? ""}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              style={stili.input}
              placeholder="Numero documento (facoltativo)"
              maxLength={100}
              disabled={salvataggio}
            />
          </div>

          <div style={stili.sezione}>
            <label htmlFor="mps-note" style={stili.etichetta}>
              Note
            </label>

            <textarea
              id="mps-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                ...stili.input,
                minHeight: 90,
                resize: "vertical",
                fontFamily: "inherit"
              }}
              placeholder="Note aggiuntive (facoltative)"
              rows={3}
              maxLength={2000}
              disabled={salvataggio}
            />
          </div>

          <div style={stili.sezione}>
            <label htmlFor="mps-quantita" style={stili.etichetta}>
              Quantità (kg) *
            </label>

            <input
              id="mps-quantita"
              type="number"
              value={quantita}
              onChange={(e) => setQuantita(e.target.value)}
              style={stili.input}
              placeholder="Inserisci la quantità"
              min="0.001"
              step="0.001"
              required
              disabled={salvataggio}
            />
          </div>

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
              {salvataggio
                ? "Salvataggio..."
                : modifica
                  ? "Salva modifiche"
                  : "Registra movimento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModaleMovimento;
