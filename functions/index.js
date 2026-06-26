const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const JSZip = require("jszip");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));

// ======================================================
// FUNZIONE: sostituisce i tag dentro content.xml dell’ODT
// ======================================================
async function replaceTagsInOdtBuffer(odtBuffer, replacements) {
  const zip = await JSZip.loadAsync(odtBuffer);
  const contentXml = await zip.file("content.xml").async("string");

  let newContent = contentXml;

  for (const [tag, cfg] of Object.entries(replacements)) {
    const value = cfg?.value || "";
    const placeholder = `#@#${tag}#@#`;
    newContent = newContent.replaceAll(placeholder, value);
  }

  zip.file("content.xml", newContent);

  const newOdtBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return newOdtBuffer;
}

// ======================================================
// FUNZIONE: converte ODT → PDF con LibreOffice headless
// ======================================================
async function convertOdtToPdf(odtBuffer) {
  const tmpDir = path.join("/tmp", "odt_convert");
  await fs.mkdir(tmpDir, { recursive: true });

  const odtPath = path.join(tmpDir, `doc_${Date.now()}.odt`);
  const pdfPath = odtPath.replace(".odt", ".pdf");

  await fs.writeFile(odtPath, odtBuffer);

  await new Promise((resolve, reject) => {
    exec(
      `soffice --headless --convert-to pdf "${odtPath}" --outdir "${tmpDir}"`,
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

  const pdfBuffer = await fs.readFile(pdfPath);

  // pulizia file temporanei
  try {
    await fs.unlink(odtPath);
    await fs.unlink(pdfPath);
  } catch {}

  return pdfBuffer;
}

// ======================================================
// ENDPOINT: compila ODT → PDF
// ======================================================
app.post("/compileOdt", async (req, res) => {
  try {
    const { odt, replacements } = req.body;

    if (!odt || !replacements) {
      return res.status(400).send("Dati mancanti (odt, replacements)");
    }

    const odtBuffer = Buffer.from(odt);

    console.log("=====================================");
    console.log("📥 ODT RICEVUTO, bytes:", odtBuffer.length);
    console.log("🧩 REPLACEMENTS:", replacements);
    console.log("=====================================");

    const compiledOdt = await replaceTagsInOdtBuffer(odtBuffer, replacements);
    const finalPdf = await convertOdtToPdf(compiledOdt);

    console.log("📤 PDF FINALE GENERATO, bytes:", finalPdf.length);
    console.log("=====================================");

    res.setHeader("Content-Type", "application/pdf");
    res.send(finalPdf);
  } catch (err) {
    console.error("❌ ERRORE BACKEND ODT:", err);
    res.status(500).send("Errore durante la compilazione ODT/PDF");
  }
});

// ======================================================
// ENDPOINT: anteprima ODT → PDF (senza sostituzioni)
// ======================================================
app.post("/previewOdt", async (req, res) => {
  try {
    const { odt } = req.body;

    if (!odt) {
      return res.status(400).send("Dati mancanti (odt)");
    }

    const odtBuffer = Buffer.from(odt);

    console.log("📥 Anteprima ODT ricevuto, bytes:", odtBuffer.length);

    const pdfBuffer = await convertOdtToPdf(odtBuffer);

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ ERRORE ANTEPRIMA ODT:", err);
    res.status(500).send("Errore durante la generazione anteprima PDF");
  }
});

// ======================================================
// ESPORTA LA CLOUD FUNCTION
// ======================================================
exports.api = functions.https.onRequest(app);
