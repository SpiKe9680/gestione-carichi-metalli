const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

/**
 * ===============================
 * ELIMINA UTENTE
 * Auth + Firestore
 * ===============================
 */
exports.deleteUserAdmin = functions.https.onRequest(async (req, res) => {
  try {

    const { uid } = req.body;

    if (!uid) {
      return res.status(400).send("UID mancante");
    }

    // elimina da Firebase Authentication
    await admin.auth().deleteUser(uid);

    // elimina da Firestore (collection corretta)
    await db.collection("utenti").doc(uid).delete();

    res.send({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});


/**
 * ===============================
 * MODIFICA UTENTE
 * Email Auth + Firestore
 * ===============================
 */
exports.updateUserAdmin = functions.https.onRequest(async (req, res) => {
  try {

    const { uid, email, ruolo } = req.body;

    if (!uid || !email) {
      return res.status(400).send("Dati mancanti");
    }

    // aggiorna email in Authentication
    await admin.auth().updateUser(uid, {
      email: email
    });

    // aggiorna Firestore
    await db.collection("utenti").doc(uid).update({
      email: email,
      ruolo: ruolo
    });

    res.send({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});
