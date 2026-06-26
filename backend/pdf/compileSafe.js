import pako from "pako";

export function processPdf(pdfBuffer, replacements) {
  let pdfText = pdfBuffer.toString("binary");

  console.log("🔍 INIZIO PROCESSAMENTO PDF...");
  console.log("🔍 TAG DA SOSTITUIRE:", replacements);

  const streamRegex = /stream([\s\S]*?)endstream/g;
  let match;
  let foundAny = false;

  while ((match = streamRegex.exec(pdfText)) !== null) {
    const full = match[0];
    const content = match[1].trimStart();

    let decompressed = null;

    try {
      const compressed = Buffer.from(content, "binary");
      decompressed = pako.inflate(compressed, { to: "string" });

      console.log("🔍 STREAM DECOMPRESSO:");
      console.log(decompressed.substring(0, 300));

    } catch {
      continue;
    }

    if (!decompressed.includes("#@#")) continue;

    console.log("🎯 STREAM CONTIENE HASHTAG!");
    foundAny = true;

    let replaced = decompressed;
    for (const key in replacements) {
      const value = replacements[key] || "";
      const regex = new RegExp(`#@#${key}#@#`, "g");

      if (decompressed.includes(`#@#${key}#@#`)) {
        console.log(`🔁 SOSTITUZIONE: ${key} → ${value}`);
      }

      replaced = replaced.replace(regex, value);
    }

    console.log("✅ STREAM DOPO REPLACE:");
    console.log(replaced.substring(0, 300));

    const recompressed = pako.deflate(replaced);
    const newStream = `stream\n${Buffer.from(recompressed).toString("binary")}\nendstream`;

    pdfText = pdfText.replace(full, newStream);
  }

  if (!foundAny) {
    console.log("⚠️ NESSUNO STREAM CONTENEVA HASHTAG!");
  }

  console.log("🏁 FINE PROCESSAMENTO PDF");

  return Buffer.from(pdfText, "binary");
}
