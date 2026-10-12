
import { addDoc, collection, doc, getDoc,getDocs  } from "firebase/firestore";
import { validaEPreparaProspetto } from "./fatturaService";

export const salvaProspettoUnificato = async ({
  db,
  modalData,
  tipo,
  money,
  round2,
}) => {
  const scarichiIds = modalData.movimentiIds || [];

  if (!scarichiIds.length) {
    throw new Error("Nessun movimento selezionato");
  }

  await validaEPreparaProspetto(db, scarichiIds);

  let totale = 0;

  (modalData.blocchi || []).forEach((b) => {
    (b.righe || []).forEach((r) => {
      const kg = money(r.netto);
      const prezzo = money(r.prezzo);
      totale += round2(kg * prezzo);
    });
  });

  totale = round2(totale);

 
const collectionName =
  tipo === "prospetto" ? "prospettiFattura" : "fattureCarichi";


  return addDoc(collection(db, collectionName), {
    tipo,
    cliente: modalData.cliente,
    totale,
    movimentiIds: scarichiIds,
    blocchi: modalData.blocchi,
    dataCreazione: new Date().toISOString(),
    DataPagamento: null,
  });
};


export const getConfigAzienda = async (db) => {
  const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
  if (!snap.exists()) return null;
  return snap.data();
};


export const caricaAnagraficaCliente = async (db, clienteNome) => {
  const fornitoriSnap = await getDocs(
    collection(db, "fornitori")
  );

  const normalizza = (v) =>
    String(v || "")
      .trim()
      .toLowerCase();

  const clienteTrovato = fornitoriSnap.docs.find((d) => {
    const data = d.data();

    const nome =
      data.nome ||
      data.ragioneSociale ||
      "";

    return normalizza(nome) === normalizza(clienteNome);
  });

  if (!clienteTrovato) return null;

  const dataCliente = clienteTrovato.data();

  return {
    id: clienteTrovato.id,

    ragioneSociale:
      dataCliente.ragioneSociale ||
      dataCliente.nome ||
      clienteNome,

    nome:
      dataCliente.nome ||
      "",

    piva:
      dataCliente.piva ||
      dataCliente.piva_cf ||
      dataCliente.pivaCf ||
      dataCliente.codiceFiscale ||
      "",

    codiceFiscale:
      dataCliente.codiceFiscale ||
      dataCliente.piva_cf ||
      dataCliente.pivaCf ||
      dataCliente.piva ||
      "",

    indirizzo:
      dataCliente.indirizzo ||
      "",

    numeroCivico:
      dataCliente.numeroCivico ||
      dataCliente.civico ||
      "",

    cap:
      dataCliente.cap ||
      "",

    comune:
      dataCliente.comune ||
      "",

    provincia:
      dataCliente.provincia ||
      "",

    capCitta:
      dataCliente.capCitta ||
      "",

    codiceDestinatario:
      dataCliente.codiceDestinatario ||
      dataCliente["Cod.destinatario"] ||
      dataCliente.codiceSdi ||
      "",

    pec:
      dataCliente.pec ||
      "",

    email:
      dataCliente.email ||
      dataCliente.mail ||
      ""
  };
};


export const caricaBancheAttive = async (db) => {
  const bancheSnap = await getDocs(
    collection(db, "banche")
  );

  const bancheAttive = bancheSnap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .filter((b) => b.attiva !== false);

  const bancaPredefinita =
    bancheAttive.find((b) => b.predefinita === true) ||
    bancheAttive[0] ||
    null;

  return {
    bancheAttive,
    bancaPredefinita
  };
};
