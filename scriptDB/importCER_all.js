import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// serviceAccountKey.json è sempre nella stessa cartella dello script
const serviceAccountPath = path.join(
  __dirname,
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(
    "❌ serviceAccountKey.json non trovato:",
    serviceAccountPath
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// La cartella dei JSON viene passata come parametro
const cartellaInput = process.argv[2];

if (!cartellaInput) {
  console.error(
    '❌ Devi indicare la cartella contenente i file JSON.\n\nEsempio:\nnode "C:\\GestioneCarichiMetalli\\gestione-carichi-metalli\\scriptDB\\importCER_all.js" "C:\\GestioneCarichiMetalli\\gestione-carichi-metalli\\scriptDB\\CER"'
  );
  process.exit(1);
}

const cartella = path.resolve(cartellaInput);

if (!fs.existsSync(cartella)) {
  console.error("❌ Cartella non trovata:", cartella);
  process.exit(1);
}

async function insertCER() {
  try {
    const files = fs
      .readdirSync(cartella)
      .filter((file) =>
        file.toLowerCase().endsWith(".json")
      );

    if (!files.length) {
      console.log(
        "⚠️ Nessun file JSON trovato nella cartella:",
        cartella
      );
      process.exit(0);
    }

    let totale = 0;

    for (const file of files) {
      const percorsoFile = path.join(cartella, file);

      console.log(`\n📄 Elaboro: ${file}`);

      const cerData = JSON.parse(
        fs.readFileSync(percorsoFile, "utf8")
      );

      for (const [id, item] of Object.entries(cerData)) {
        await db
          .collection("cer_descrizioni")
          .doc(id)
          .set(item, { merge: true });

        console.log(`✅ CER ${id} importato/aggiornato`);
        totale++;
      }
    }

    console.log("\n==================================");
    console.log("✅ IMPORTAZIONE COMPLETATA");
    console.log("==================================");
    console.log(`Cartella: ${cartella}`);
    console.log(`File elaborati: ${files.length}`);
    console.log(`Record elaborati: ${totale}`);
    console.log("==================================");

    process.exit(0);

  } catch (errore) {
    console.error("\n❌ ERRORE IMPORTAZIONE:");
    console.error(errore);
    process.exit(1);
  }
}

insertCER();