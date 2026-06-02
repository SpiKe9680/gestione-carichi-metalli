const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateAllUsers() {
  console.log("🚀 Avvio migrazione TUTTI gli utenti...");

  const snap = await db.collection("utenti").get();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    const user = doc.data();

    try {
      console.log(`🔄 Utente: ${user.email || user.username}`);

      // ❌ già migrato
      if (user.password_hash) {
        console.log("⚠️ già migrato, skip");
        skipped++;
        continue;
      }

      // ❌ senza password
      if (!user.password) {
        console.log("⚠️ nessuna password, skip");
        skipped++;
        continue;
      }

      // 🔐 hash password
      const hash = await bcrypt.hash(user.password, 10);

      await doc.ref.update({
        password_hash: hash,
        password: admin.firestore.FieldValue.delete(),

        failed_attempts: user.failed_attempts || 0,
        lock_until: user.lock_until || null,

        ruolo: (user.ruolo || "OPERATORE").toUpperCase(),
        attivo: user.attivo ?? true
      });

      console.log("✅ migrato");
      migrated++;

    } catch (err) {
      console.error("❌ errore utente:", user.email, err.message);
      errors++;
    }
  }

  console.log("=================================");
  console.log("🎉 MIGRAZIONE COMPLETATA");
  console.log("✅ Migrati:", migrated);
  console.log("⚠️ Skippati:", skipped);
  console.log("❌ Errori:", errors);
  console.log("=================================");
}

migrateAllUsers().catch(err => {
  console.error("💥 ERRORE FATALE:", err);
});