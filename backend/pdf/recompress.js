import pako from "pako";

export function recompressPdfStreams(pdfBuffer) {
  const pdfText = pdfBuffer.toString("binary");
  const streamRegex = /stream([\s\S]*?)endstream/g;

  let match;
  let output = pdfText;

  while ((match = streamRegex.exec(pdfText)) !== null) {
    const full = match[0];
    const content = match[1].trimStart();

    try {
      const compressed = pako.deflate(content);
      const newStream = `stream\n${Buffer.from(compressed).toString("binary")}\nendstream`;
      output = output.replace(full, newStream);
    } catch {
      // stream non ricomprimibile → lo lasciamo così
    }
  }

  return Buffer.from(output, "binary");
}
