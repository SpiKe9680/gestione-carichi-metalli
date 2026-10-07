import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

import { db } from "../firebase";

/* =========================
   SNAPSHOT (SAFE)
========================= */
export const createSnapshot = (docData) => {
  try {
    if (!docData) return null;

    const json = JSON.stringify(docData, (key, value) => {
      // 🔥 fix timestamp firestore
      if (value?.toDate) {
        return {
          __type: "timestamp",
          value: value.toDate().toISOString()
        };
      }

      // 🔥 evita undefined
      if (value === undefined) return null;

      // 🔥 evita funzioni / robe strane
      if (typeof value === "function") return null;

      return value;
    });

    if (!json) return null;

    return JSON.parse(json);

  } catch (e) {
    console.error("💥 SNAPSHOT ROTTO:", docData);
    console.error("💥 ERRORE:", e);
    return null;
  }
};

/* =========================
   RESTORE SNAPSHOT
========================= */
export const restoreSnapshot = (snap) => {
  const parsed = JSON.parse(JSON.stringify(snap));

  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    Object.keys(obj).forEach((k) => {
      const v = obj[k];

      // 🔥 FIX TIMESTAMP FIRESTORE
      if (v?.__type === "timestamp") {
        obj[k] = new Date(v.value);
      }

      // 🔥 FIX TIMESTAMP SERIALIZZATI FIRESTORE
      else if (
        v &&
        typeof v === "object" &&
        "seconds" in v &&
        "nanoseconds" in v
      ) {
        obj[k] = new Date(v.seconds * 1000);
      }

      // 🔥 RICORSIVO
      else if (typeof v === "object") {
        obj[k] = walk(v);
      }
    });

    return obj;
  };

  return walk(parsed);
};

/* =========================
   CONFRONTO SNAPSHOT
========================= */
const snapshotUguali = (a, b) => {
  try {
    const campiDaIgnorare = new Set([
      "lastUpdate",
      "updatedAt",
      "timestamp",
      "timestampRipristino"
    ]);

    const normalizza = (value) => {
      if (value === undefined) {
        return null;
      }

      // Firestore Timestamp
      if (
        value &&
        typeof value.toDate === "function"
      ) {
        return {
          __type: "timestamp",
          value: value.toDate().toISOString()
        };
      }

      // JavaScript Date
      if (value instanceof Date) {
        return {
          __type: "timestamp",
          value: value.toISOString()
        };
      }

      // Array
      if (Array.isArray(value)) {
        return value.map(normalizza);
      }

      // Oggetto
      if (
        value &&
        typeof value === "object"
      ) {
        const risultato = {};

        Object.keys(value)
          .filter(
            (key) =>
              !campiDaIgnorare.has(key)
          )
          .sort()
          .forEach((key) => {
            risultato[key] =
              normalizza(value[key]);
          });

        return risultato;
      }

      return value;
    };

    return (
      JSON.stringify(normalizza(a)) ===
      JSON.stringify(normalizza(b))
    );

  } catch (e) {
    console.error(
      "💥 ERRORE CONFRONTO SNAPSHOT:",
      e
    );

    return false;
  }
};

/* =========================
   NORMALIZZA ID
========================= */
const normalizzaId = (id) =>
  String(id || "")
    .replace(/^scarico_/, "")
    .replace(/^carico_/, "")
    .trim();

/* =========================
   SCRIVI LOG
========================= */
export const scriviLog = async ({
  pagina,
  evento,
  riferimento,
  before,
  after,
  utente,
  ripristinabile = true,
  meta = {}
}) => {
  const safe = (obj) =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([_, v]) => v !== undefined
      )
    );

  const utenteLog =
    typeof utente === "string"
      ? utente
      : utente
        ? JSON.stringify(utente)
        : "sconosciuto";

  return await addDoc(
    collection(db, "log_operazioni"),
    safe({
      pagina,
      evento,
      riferimento,
      before: createSnapshot(before),
      after: createSnapshot(after),
      utente: utenteLog,
      timestamp: serverTimestamp(),
      meta,
      ripristinabile,
      ripristinato: false
    })
  );
};

/* =========================
   RIPRISTINA LOG
========================= */
export const ripristinaLog = async (log) => {
  if (!log?.before) {
    throw new Error("Snapshot BEFORE mancante");
  }

  if (!log?.id) {
    throw new Error("ID log mancante");
  }

  if (log?.ripristinato) {
    throw new Error("Operazione già ripristinata");
  }

  const collezione =
    log?.riferimento?.collezione;

  const documentoId =
    log?.riferimento?.documentoId;

  const evento =
    String(log?.evento || "")
      .toUpperCase()
      .trim();

  if (!collezione || !documentoId) {
    throw new Error(
      "Riferimento log non valido"
    );
  }

  const ref = doc(
    db,
    collezione,
    documentoId
  );

  const snap = await import("firebase/firestore").then(
    ({ getDoc }) => getDoc(ref)
  );

  const documentoEsiste =
    snap.exists();

  const datiAttuali =
    documentoEsiste
      ? snap.data()
      : null;

  /* ============================================================
     CASO 1
     ELIMINA MOVIMENTO COMPLETO
     ============================================================ */

  if (
    evento === "ELIMINA_SCARICO" ||
    evento === "ELIMINA_CARICO"
  ) {
    if (documentoEsiste) {
      throw new Error(
        "Il movimento esiste già. Ripristino bloccato per evitare di sovrascrivere modifiche successive."
      );
    }

    const restored =
      restoreSnapshot(log.before);

    await setDoc(
      ref,
      restored,
      { merge: false }
    );

    await setDoc(
      doc(
        db,
        "log_operazioni",
        log.id
      ),
      {
        ripristinato: true,
        timestampRipristino:
          serverTimestamp(),
        ripristinoEsito:
          "DOCUMENTO_RICREATO"
      },
      { merge: true }
    );

    return;
  }

  /* ============================================================
     CASO 2
     ELIMINA RIGA / CER
     ============================================================ */

  if (evento === "ELIMINA_CER") {
    // Il movimento è stato eliminato successivamente.
    // NON lo ricreiamo.
    if (!documentoEsiste) {
      throw new Error(
        "Il movimento è stato eliminato successivamente. Il CER/riga non può essere ripristinato senza ricreare il movimento."
      );
    }

    const beforeData =
      restoreSnapshot(log.before);

    const afterData =
      log.after
        ? restoreSnapshot(log.after)
        : null;

    const field =
      Array.isArray(beforeData?.scarico)
        ? "scarico"
        : Array.isArray(beforeData?.carico)
          ? "carico"
          : null;

    if (!field) {
      throw new Error(
        "Struttura movimento non riconosciuta nel log"
      );
    }

    const cerIndex =
      Number.isInteger(
        log?.riferimento?.cerIndex
      )
        ? log.riferimento.cerIndex
        : null;

    const rIndex =
      Number.isInteger(
        log?.riferimento?.rIndex
      )
        ? log.riferimento.rIndex
        : null;

    if (cerIndex === null) {
      throw new Error(
        "CER index mancante nel riferimento del log"
      );
    }

    if (rIndex === null) {
      throw new Error(
        "Riga index mancante nel riferimento del log"
      );
    }

    const cerOriginale =
      beforeData[field]?.[cerIndex];

    if (!cerOriginale) {
      throw new Error(
        "CER originale non trovato nello snapshot BEFORE"
      );
    }

    const rigaOriginale =
      cerOriginale?.righe?.[rIndex];

    if (!rigaOriginale) {
      throw new Error(
        "Riga originale non trovata nello snapshot BEFORE"
      );
    }

    const movimentiAttuali =
      Array.isArray(datiAttuali[field])
        ? [...datiAttuali[field]]
        : [];

    /* ------------------------------------------------------------
       CONTROLLO STATO ATTUALE

       Se abbiamo AFTER, confrontiamo solamente il contenuto
       del movimento interessato e ignoriamo lastUpdate.
       ------------------------------------------------------------ */

    if (
      afterData &&
      Array.isArray(afterData[field])
    ) {
      const statoAttualeMovimenti =
        createSnapshot(
          datiAttuali[field] || []
        );

      const statoAttesoMovimenti =
        createSnapshot(
          afterData[field] || []
        );

      if (
        JSON.stringify(statoAttualeMovimenti) !==
        JSON.stringify(statoAttesoMovimenti)
      ) {
        throw new Error(
          "Il movimento è stato modificato dopo questa operazione. Ripristino bloccato per evitare di sovrascrivere modifiche successive."
        );
      }
    }

    /* ------------------------------------------------------------
       IDENTIFICAZIONE CER ATTUALE
       Non ci affidiamo soltanto al cerIndex perché dopo una
       cancellazione gli indici possono essere cambiati.
       ------------------------------------------------------------ */

    const firTarget =
      String(
        cerOriginale?.fir || ""
      )
        .trim()
        .toUpperCase();

    const cerTarget =
      String(
        cerOriginale?.cer ||
        cerOriginale?.codiceCER ||
        ""
      )
        .trim()
        .toUpperCase();

    const indiceCerAttuale =
      movimentiAttuali.findIndex((cer) => {
        const fir =
          String(
            cer?.fir || ""
          )
            .trim()
            .toUpperCase();

        const codice =
          String(
            cer?.cer ||
            cer?.codiceCER ||
            ""
          )
            .trim()
            .toUpperCase();

        return (
          fir === firTarget &&
          codice === cerTarget
        );
      });

    /* ------------------------------------------------------------
       CASO A
       IL CER ESISTE ANCORA

       Ripristiniamo SOLO la riga eliminata.
       ------------------------------------------------------------ */

    if (indiceCerAttuale >= 0) {
      const cerAttuale = {
        ...movimentiAttuali[indiceCerAttuale],
        righe: Array.isArray(
          movimentiAttuali[indiceCerAttuale]?.righe
        )
          ? [
              ...movimentiAttuali[
                indiceCerAttuale
              ].righe
            ]
          : []
      };

      const rigaGiaPresente =
        cerAttuale.righe.some((riga) =>
          snapshotUguali(
            riga,
            rigaOriginale
          )
        );

      if (rigaGiaPresente) {
        await setDoc(
          doc(
            db,
            "log_operazioni",
            log.id
          ),
          {
            ripristinato: true,
            timestampRipristino:
              serverTimestamp(),
            ripristinoEsito:
              "RIGA_GIA_PRESENTE"
          },
          { merge: true }
        );

        return;
      }

      const indiceRiga =
        Math.min(
          Math.max(rIndex, 0),
          cerAttuale.righe.length
        );

      cerAttuale.righe.splice(
        indiceRiga,
        0,
        rigaOriginale
      );

      movimentiAttuali[
        indiceCerAttuale
      ] = cerAttuale;

      await updateDoc(
        ref,
        {
          [field]: movimentiAttuali
        }
      );

      await setDoc(
        doc(
          db,
          "log_operazioni",
          log.id
        ),
        {
          ripristinato: true,
          timestampRipristino:
            serverTimestamp(),
          ripristinoEsito:
            "RIGA_RIPRISTINATA"
        },
        { merge: true }
      );

      return;
    }

    /* ------------------------------------------------------------
       CASO B
       IL CER NON ESISTE PIÙ

       Significa che era rimasta soltanto quella riga.
       Quindi dobbiamo ripristinare l'intero CER.
       ------------------------------------------------------------ */

    const cerGiaPresente =
      movimentiAttuali.some(
        (cer) =>
          snapshotUguali(
            cer,
            cerOriginale
          )
      );

    if (cerGiaPresente) {
      await setDoc(
        doc(
          db,
          "log_operazioni",
          log.id
        ),
        {
          ripristinato: true,
          timestampRipristino:
            serverTimestamp(),
          ripristinoEsito:
            "CER_GIA_PRESENTE"
        },
        { merge: true }
      );

      return;
    }

    const indiceInserimento =
      Math.min(
        Math.max(cerIndex, 0),
        movimentiAttuali.length
      );

    movimentiAttuali.splice(
      indiceInserimento,
      0,
      cerOriginale
    );

    await updateDoc(
      ref,
      {
        [field]: movimentiAttuali
      }
    );

    await setDoc(
      doc(
        db,
        "log_operazioni",
        log.id
      ),
      {
        ripristinato: true,
        timestampRipristino:
          serverTimestamp(),
        ripristinoEsito:
          "CER_RIPRISTINATO"
      },
      { merge: true }
    );

    return;
  }

  /* ============================================================
     CASO 3
     MODIFICHE / ALTRE OPERAZIONI REVERSIBILI
     ============================================================ */

  if (!documentoEsiste) {
    throw new Error(
      "Il documento non esiste più. Ripristino non applicabile."
    );
  }

  if (log.after) {
    const afterSnapshot =
      restoreSnapshot(log.after);

    if (
      !snapshotUguali(
        datiAttuali,
        afterSnapshot
      )
    ) {
      throw new Error(
        "Il documento è stato modificato dopo questa operazione. Ripristino bloccato per evitare di sovrascrivere modifiche successive."
      );
    }
  }

  const restored =
    restoreSnapshot(log.before);

  await setDoc(
    ref,
    restored,
    { merge: false }
  );

  await setDoc(
    doc(
      db,
      "log_operazioni",
      log.id
    ),
    {
      ripristinato: true,
      timestampRipristino:
        serverTimestamp(),
      ripristinoEsito:
        "DOCUMENTO_RIPRISTINATO"
    },
    { merge: true }
  );
};