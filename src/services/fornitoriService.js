import { addDoc, collection, getDocs } from "firebase/firestore";

export const normalizzaNomeFornitore = (nome) =>
  (nome || "").toString().trim();

export const trovaFornitorePerNome = (fornitori = [], nome) => {
  const n = normalizzaNomeFornitore(nome).toLowerCase();
  if (!n) return null;

  return (
    fornitori.find(
      (f) => normalizzaNomeFornitore(f?.nome).toLowerCase() === n
    ) || null
  );
};

/**
 * Crea la controparte su Firestore solo se manca.
 * Da chiamare al salvataggio del movimento, non mentre si digita.
 */
export const assicuratiFornitore = async (db, { nome, fornitoriEsistenti = [] }) => {
  const nomeTrim = normalizzaNomeFornitore(nome);
  if (!nomeTrim) {
    throw new Error("Nome fornitore vuoto");
  }

  const inMemoria = trovaFornitorePerNome(fornitoriEsistenti, nomeTrim);
  if (inMemoria) {
    return {
      id: inMemoria.id,
      nome: inMemoria.nome || nomeTrim,
      created: false,
    };
  }

  const snap = await getDocs(collection(db, "fornitori"));
  const trovato = snap.docs.find(
    (d) =>
      normalizzaNomeFornitore(d.data()?.nome).toLowerCase() ===
      nomeTrim.toLowerCase()
  );

  if (trovato) {
    return {
      id: trovato.id,
      nome: trovato.data()?.nome || nomeTrim,
      created: false,
    };
  }

  const ref = await addDoc(collection(db, "fornitori"), {
    nome: nomeTrim,
    indirizzo: "",
    piva_cf: "",
    createdAt: Date.now(),
  });

  return { id: ref.id, nome: nomeTrim, created: true };
};
