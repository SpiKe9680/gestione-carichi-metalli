
import React from "react";
import CreatableSelect from "react-select/creatable";
import {
  FaEdit,
  FaTrash,
  FaWarehouse
} from "react-icons/fa";

const SelettoreMagazzino = ({
  magazzini = [],
  magazzinoSelezionato = null,
  onChange,
  onCrea,
  onRinomina,
  onElimina,
  salvataggio = false,
  stili = {}
}) => {
  const opzioni = magazzini.map((magazzino) => ({
    value: magazzino.id,
    label: magazzino.nome
  }));

  const valoreSelezionato = magazzinoSelezionato
    ? {
        value: magazzinoSelezionato.id,
        label: magazzinoSelezionato.nome
      }
    : null;

  return (
    <section style={stili.sezione}>
      <label style={stili.etichetta}>
        <FaWarehouse style={{ marginRight: 8 }} />
        Magazzino MPS
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap"
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <CreatableSelect
            isClearable
            isDisabled={salvataggio}
            isLoading={salvataggio}
            options={opzioni}
            value={valoreSelezionato}
            onChange={onChange}
            onCreateOption={onCrea}
            placeholder="Seleziona o crea un magazzino..."
            formatCreateLabel={(inputValue) =>
              `Crea magazzino "${inputValue}"`
            }
            noOptionsMessage={() => "Nessun magazzino disponibile"}
            loadingMessage={() => "Caricamento..."}
            styles={{
              control: (base, state) => ({
                ...base,
                minHeight: 42,
                borderColor: state.isFocused ? "#64748b" : "#d1d5db",
                boxShadow: state.isFocused
                  ? "0 0 0 1px #64748b"
                  : "none",
                "&:hover": {
                  borderColor: "#64748b"
                }
              }),
              menu: (base) => ({
                ...base,
                zIndex: 20
              })
            }}
          />
        </div>

        {magazzinoSelezionato && (
          <>
            {onRinomina && (
              <button
                type="button"
                style={stili.pulsanteSecondario}
                onClick={() => onRinomina(magazzinoSelezionato)}
                disabled={salvataggio}
                title="Rinomina il magazzino selezionato"
              >
                <FaEdit style={{ marginRight: 6 }} />
                Rinomina
              </button>
            )}

            {onElimina && (
              <button
                type="button"
                style={{
                  ...stili.pulsanteSecondario,
                  color: "#b91c1c",
                  borderColor: "#fecaca"
                }}
                onClick={() => onElimina(magazzinoSelezionato)}
                disabled={salvataggio}
                title="Elimina il magazzino selezionato"
              >
                <FaTrash style={{ marginRight: 6 }} />
                Elimina
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default SelettoreMagazzino;
