const admin = require("firebase-admin");
const bcrypt = require("bcrypt");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =============================
// UTENTE ALBERTO (OPERATORE)
// =============================
const USER_ID = "cvEYQsMcWTPZuewOM869lhCIdp63";

async function migrateAlberto() {
  console.log("🚀 Avvio migrazione utente: Alberto");

  const docRef = db.collection("utenti").doc(USER_ID);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log("❌ Utente non trovato");
    return;
  }

  const user = doc.data();

  console.log("👤 Utente trovato:", user.email || user.username);

  // sicurezza: evita doppia migrazione
  if (user.password_hash) {
    console.log("⚠️ Utente già migrato (password_hash presente)");
    return;
  }

  if (!user.password) {
    console.log("❌ Nessuna password in chiaro trovata");
    return;
  }

  // =============================
  // HASH PASSWORD
  // =============================
  const hash = await bcrypt.hash(user.password, 10);

  // =============================
  // UPDATE UTENTE
  // =============================
  await docRef.update({
    password_hash: hash,
    password: admin.firestore.FieldValue.delete(),

    failed_attempts: 0,
    lock_until: null,

    ruolo: (user.ruolo || "operatore").toUpperCase()
  });

  console.log("✅ MIGRAZIONE COMPLETATA per Alberto");
}

migrateAlberto().catch(err => {
  console.error("❌ Errore migrazione:", err);
});