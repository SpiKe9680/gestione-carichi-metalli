import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const salvaESharePdfCapacitor = async (pdf, filename) => {
  try {
    const isNative = Capacitor.isNativePlatform();

    // 🔥 nome file sicuro per Android
    const safeFilename = filename
      .replace(/\s+/g, "_")
      .replace(/\//g, "-")
      .replace(/:/g, "-");

    // 🌐 WEB
    if (!isNative) {
      pdf.save(safeFilename);
      return;
    }

    // 🔥 genera blob (NO datauristring)
    const blob = pdf.output("blob");

    // 🔥 blob → base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 🔥 path corretto con estensione .pdf
    const path = `${Date.now()}_${safeFilename}.pdf`;

    // 🔥 scrittura file
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
    });

    // 🔥 recupera URI CORRETTO (fix definitivo Android)
    const fileUriResult = await Filesystem.getUri({
      directory: Directory.Cache,
      path,
    });

    // 🔥 SHARE (NO modifiche all'url!)
    await Share.share({
      title: safeFilename,
      text: "Documento PDF",
      url: fileUriResult.uri,
      dialogTitle: "Condividi PDF",
    });

    // 🧹 cleanup
    setTimeout(() => {
      Filesystem.deleteFile({
        path,
        directory: Directory.Cache,
      }).catch(() => {});
    }, 8000);

  } catch (err) {
    const msg = (err?.message || "").toLowerCase();

    const isShareCanceled =
      msg.includes("canceled") ||
      msg.includes("cancelled") ||
      err?.code === "USER_CANCELLED" ||
      err?.code === "Share canceled";

    if (isShareCanceled) {
      console.log("Share annullata");
      return;
    }

    console.error("PDF ERROR:", err);
    alert("Errore PDF:\n" + (err?.message || err));
  }
};