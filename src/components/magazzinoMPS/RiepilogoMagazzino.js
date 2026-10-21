
import React from "react";
import {
  FaBoxes,
  FaArrowDown,
  FaArrowUp,
  FaWarehouse,
  FaEdit
} from "react-icons/fa";
import { formattaNumero } from "./magazzinoMPSUtils";

const RiepilogoMagazzino = ({
  magazzinoSelezionato,
  totaleEntrate = 0,
  totaleUscite = 0,
  giacenzaAttuale = 0,
  onModificaGiacenza,
  stili = {}
}) => {
  if (!magazzinoSelezionato) {
    return (
      <div style={stili.vuoto}>
        Seleziona un magazzino per visualizzare il riepilogo.
      </div>
    );
  }

  const giacenzaIniziale = Number(
    magazzinoSelezionato.giacenzaIniziale || 0
  );

  const schede = [
    {
      titolo: "Giacenza iniziale",
      valore: giacenzaIniziale,
      icona: <FaWarehouse />,
      colore: "#475569",
      azione: onModificaGiacenza ? (
        <button
          type="button"
          style={stili.pulsantePiccolo}
          onClick={() => onModificaGiacenza()}
          title="Modifica la giacenza iniziale"
        >
          <FaEdit style={{ marginRight: 5 }} />
          Modifica
        </button>
      ) : null
    },
    {
      titolo: "Totale entrate",
      valore: totaleEntrate,
      icona: <FaArrowDown />,
      colore: "#15803d"
    },
    {
      titolo: "Totale uscite",
      valore: totaleUscite,
      icona: <FaArrowUp />,
      colore: "#b91c1c"
    },
    {
      titolo: "Giacenza attuale",
      valore: giacenzaAttuale,
      icona: <FaBoxes />,
      colore: "#1d4ed8",
      evidenziata: true
    }
  ];

  return (
    <div style={stili.riepilogo}>
      {schede.map((scheda) => (
        <div
          key={scheda.titolo}
          style={{
            ...stili.cardRiepilogo,
            ...(scheda.evidenziata ? stili.cardGiacenza : {})
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12
            }}
          >
            <span style={{ color: "#475569", fontSize: 14 }}>
              {scheda.titolo}
            </span>

            <span
              style={{
                color: scheda.colore,
                fontSize: 18,
                display: "flex",
                alignItems: "center"
              }}
            >
              {scheda.icona}
            </span>
          </div>

          <div
            style={{
              color: scheda.colore,
              fontSize: 25,
              fontWeight: 700,
              overflowWrap: "anywhere"
            }}
          >
            {formattaNumero(scheda.valore)} kg
          </div>

          {scheda.azione && (
            <div style={{ marginTop: 12 }}>
              {scheda.azione}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RiepilogoMagazzino;
