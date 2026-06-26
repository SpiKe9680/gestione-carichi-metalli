import pako from "pako";

export function decompressPdfStreams(pdfBuffer) {
  const pdfText = pdfBuffer.toString("binary");
  const streamRegex = /stream([\s\S]*?)endstream/g;

  let match;
  let output = pdfText;

  while ((match = streamRegex.exec(pdfText)) !== null) {
    const full = match[0];
    const content = match[1].trimStart();

    try {
      const compressed = Buffer.from(content, "binary");
      const decompressed = pako.inflate(compressed, { to: "string" });

      const newStream = `stream\n${decompressed}\nendstream`;
      output = output.replace(full, newStream);
    } catch {
      // stream non compresso → lo lasciamo così
    }
  }

  return Buffer.from(output, "binary");
}
