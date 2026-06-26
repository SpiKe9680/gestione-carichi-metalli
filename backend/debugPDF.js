import fs from "fs";
import pako from "pako";

export function debugPdf(pdfBuffer) {
  console.log("=====================================");
  console.log("🔍 DEBUG PDF — ANALISI COMPLETA STREAMS");
  console.log("📦 Dimensione PDF:", pdfBuffer.length, "bytes");
  console.log("=====================================");

  const pdfText = pdfBuffer.toString("binary");

  const streamRegex = /(\d+ \d+ obj[\s\S]*?stream[\s\S]*?endstream)/g;
  let match;
  let index = 0;

  while ((match = streamRegex.exec(pdfText)) !== null) {
    index++;

    const fullObj = match[1];

    console.log("\n-------------------------------------");
    console.log(`📌 OGGETTO #${index}`);
    console.log("-------------------------------------");

    // Logga l'header dell'oggetto
    const header = fullObj.split("stream")[0];
    console.log("📄 HEADER OGGETTO:");
    console.log(header);

    // Estrai il contenuto dello stream
    const streamContent = fullObj.split("stream")[1].split("endstream")[0];

    console.log("\n📦 STREAM RAW (prime 200 chars):");
    console.log(streamContent.substring(0, 200));

    // Prova a decomprimere
    try {
      const compressed = Buffer.from(streamContent.trim(), "binary");
      const decompressed = pako.inflate(compressed, { to: "string" });

      console.log("\n🟢 STREAM DECOMPRESSO (prime 500 chars):");
      console.log(decompressed.substring(0, 500));

      // Cerca tag
      if (decompressed.includes("#@#")) {
        console.log("🔥🔥🔥 TROVATO TAG NELLO STREAM!");
        const lines = decompressed.split("\n");
        lines.forEach((l, i) => {
          if (l.includes("#@#")) {
            console.log(`👉 [RIGA ${i}]`, l);
          }
        });
      } else {
        console.log("⚪ Nessun tag trovato in questo stream.");
      }

    } catch (err) {
      console.log("\n🔴 STREAM NON COMPRESSO O NON DECOMPRIMIBILE");
      console.log("Errore:", err.message);
    }
  }

  console.log("\n=====================================");
  console.log("🏁 FINE DEBUG PDF");
  console.log("=====================================");
}
