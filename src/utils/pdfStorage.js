import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const salvaESharePdfCapacitor = async (pdf, filename) => {
  try {
    const isNative = Capacitor.isNativePlatform();
    const safeFilename = filename.replace(/\s+/g, "_");

    // 🌐 BROWSER
    if (!isNative) {
      pdf.save(safeFilename);
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
      path: `pdf/${safeFilename}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    await Share.share({
      title: "Documento PDF",
      text: safeFilename,
      url: file.uri,
      dialogTitle: "Condividi PDF",
    });

  } catch (err) {
    console.error("PDF SAVE ERROR:", err);
    alert("Errore salvataggio PDF:\n" + (err?.message || err));
  }
};