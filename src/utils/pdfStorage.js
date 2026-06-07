import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const salvaESharePdfCapacitor = async (pdf, filename) => {
  try {
    const safeFilename = filename.replace(/\s+/g, "_");

    // 🌐 WEB
    if (!Capacitor.isNativePlatform()) {
      pdf.save(safeFilename);
      return;
    }

    // 📄 ANDROID / IOS
    const base64 = pdf.output("datauristring").split(",")[1];

    const path = `pdf_${Date.now()}_${safeFilename}`;

    const savedFile = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache, // 🔥 IMPORTANTISSIMO
    });

    await Share.share({
      title: safeFilename,
      text: "Documento PDF",
      url: savedFile.uri, // 🔥 file vero
      dialogTitle: "Condividi PDF",
    });

    // 🧹 cleanup opzionale (dopo share)
    setTimeout(() => {
      Filesystem.deleteFile({
        path,
        directory: Directory.Cache,
      }).catch(() => {});
    }, 5000);

  } catch (err) {
  const msg = (err?.message || "").toLowerCase();

  const isShareCanceled =
    msg.includes("canceled") ||
    msg.includes("cancelled") ||
    err?.code === "USER_CANCELLED" ||
    err?.code === "Share canceled";

  if (isShareCanceled) {
    console.log("Share annullata dall'utente");
    return;
  }

  console.error("PDF Errore nel Salvataggio: ", err);
  alert("Errore PDF:\n" + (err?.message || err));
}
};