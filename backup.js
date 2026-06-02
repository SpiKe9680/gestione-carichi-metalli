const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backup() {
  console.log("🚀 Avvio backup Firestore...");

  const collections = await db.listCollections();

  const backup = {};

  for (const col of collections) {
    console.log(`📦 Esporto collection: ${col.id}`);

    const snapshot = await col.get();

    backup[col.id] = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
  }

  fs.writeFileSync(
    "backup-firestore.json",
    JSON.stringify(backup, null, 2)
  );

  console.log("✅ Backup completato con successo!");
  console.log("📁 File creato: backup-firestore.json");
}

backup().catch(err => {
  console.error("❌ Errore backup:", err);
});