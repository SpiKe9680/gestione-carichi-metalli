import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const cerData = JSON.parse(fs.readFileSync("./20.json", "utf8"));

async function insertCER() {
  for (const [id, item] of Object.entries(cerData)) {
    await db.collection("cer_descrizioni").doc(id).set(item);
    console.log(`Inserito CER ${id}`);
  }
  process.exit(0);
}

insertCER();
