const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { compilePdf } = require("./utils/decompressPdf");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "20mb" }));

app.post("/compile", async (req, res) => {
  try {
    const { pdf, config } = req.body;

    const buffer = Buffer.from(pdf);

    const compiled = compilePdf(buffer, config);

    res.setHeader("Content-Type", "application/pdf");
    res.send(compiled);

  } catch (err) {
    console.error("Errore compilazione PDF:", err);
    res.status(500).send("Errore compilazione PDF");
  }
});

exports.api = functions.https.onRequest(app);
