// Import delle funzioni necessarie dai SDK Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configurazione Firebase del tuo progetto
const firebaseConfig = {
  apiKey: "AIzaSyB2y2bdCYn8AaEDcWGXCIMbx-IWA4I4MEc",
  authDomain: "gestione-carichi-metalli-231fc.firebaseapp.com",
  projectId: "gestione-carichi-metalli-231fc",
  storageBucket: "gestione-carichi-metalli-231fc.appspot.com",
  messagingSenderId: "707976831222",
  appId: "1:707976831222:web:dda5e13d6606dcd0264cd7"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Export dei servizi per usarli altrove
export const db = getFirestore(app);
export const auth = getAuth(app);
