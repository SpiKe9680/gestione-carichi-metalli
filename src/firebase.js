// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Config Firebase dalle variabili .env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Export dei servizi Firebase
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// 🔹 Funzione helper login admin Firebase
export const loginAdminFirebase = async () => {
  const email = process.env.REACT_APP_FIREBASE_ADMIN_EMAIL;
  const password = process.env.REACT_APP_FIREBASE_ADMIN_PASSWORD;

  if (!email || !password) throw new Error("Admin Firebase non configurato!");
  return signInWithEmailAndPassword(auth, email, password);
};