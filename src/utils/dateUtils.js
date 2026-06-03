import { jsPDF } from "jspdf";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
/**
 * Legge la configurazione azienda dal db
 * @returns {Promise<Object>} Oggetto config azienda
 */
export const loadConfigAzienda = async () => {
  try {
    const snap = await getDoc(doc(db, "configurazioni", "datiAzienda"));
    if (snap.exists()) return snap.data();
    return {};
  } catch (e) {
    console.error("Errore caricamento configurazione azienda:", e);
    return {};
  }
};

/**
 * Restituisce la data e ora corrente formattata per la stampa
 * @returns {Object} { data: "gg/mm/aaaa", ora: "hh:mm" }
 */
// src/utils/dateUtils.js
export const getDataOraStampa = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const data = `${day}/${month}/${year}`;
  
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const ora = `${hour}:${minute}`;
  
  return { data, ora };
};

export const mesiItaliani = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export const formattaDataItaliana = (date) => {
  const gg = String(date.getDate()).padStart(2, "0");
  const mese = mesiItaliani[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${gg} ${mese} ${yyyy}`;
};

export const formattaOra24 = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const parseDataOra = (dataStr, oraStr) => {
  if (!dataStr) return new Date();
  const [gg, meseStr, yyyy] = dataStr.split(" ");
  const mm = mesiItaliani.indexOf(meseStr);
  if (mm < 0) return new Date();
  const d = new Date(Number(yyyy), mm, Number(gg));
  if (oraStr) {
    const [hh, min] = oraStr.split(":").map(Number);
    if (!isNaN(hh) && !isNaN(min)) d.setHours(hh, min, 0, 0);
  }
  const now = new Date();
  if (d > now) return now;
  return d;
};


export const salvaESharePdfCapacitor = async (pdf, filename) => {
  try {
    const isNative = Capacitor.isNativePlatform();

    // 🌐 BROWSER
    if (!isNative) {
      pdf.save(filename);
      return;
    }

    // 📄 ANDROID / IOS
    const blob = pdf.output("blob");

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const file = await Filesystem.writeFile({
      path: `pdf/${filename}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true, // 🔥 FIX ERRORI DIRECTORY
    });

    // 📤 SHARE AUTOMATICO (ANDROID)
    await Share.share({
      title: "Documento PDF",
      text: filename,
      url: file.uri,
      dialogTitle: "Condividi PDF",
    });

    alert("PDF salvato e condiviso");
  } catch (err) {
    console.error("PDF SAVE ERROR:", err);
    alert("Errore salvataggio PDF:\n" + (err?.message || err));
  }
};


export const PdfHeader = async (pdfObj) => {
  const pdf = pdfObj || new jsPDF("p", "mm", "a4");

  const config = await loadConfigAzienda();

  let startY = 10; // posizione di partenza per il contenuto sotto header

  // Logo a sinistra
  if (config.logoBase64) {
    const imgProps = pdf.getImageProperties(`data:image/png;base64,${config.logoBase64}`);
    const imgWidth = 50;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    pdf.addImage(`data:image/png;base64,${config.logoBase64}`, "PNG", 14, startY, imgWidth, imgHeight);
    startY += imgHeight + 5; // aggiungi margine sotto il logo
  }

  // Dati azienda a destra
  pdf.setFontSize(10);
  pdf.text(`${config.ragioneSociale || ""}`, 140, 15);
  pdf.text(`${config.indirizzo || ""}`, 140, 20);
  pdf.text(`${config.capCitta || ""}`, 140, 25);
  pdf.text(`P.IVA: ${config.piva || ""}`, 140, 30);

  startY += 25; // margine extra sotto header

  return { pdf, startY };
};
