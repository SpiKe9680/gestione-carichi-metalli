const zlib = require("zlib");

function compilePdf(originalPdfBuffer, config) {
  let text = originalPdfBuffer.toString("latin1");

  // Decompressione stream PDF
  text = text.replace(
    /\/Filter\s*\/FlateDecode[\s\S]*?stream([\s\S]*?)endstream/g,
    (match, streamData) => {
      try {
        const compressed = Buffer.from(streamData.trim(), "latin1");
        const decompressed = zlib.inflateSync(compressed).toString("latin1");

        return match
          .replace("/FlateDecode", "")
          .replace(streamData, "\n" + decompressed + "\n");
      } catch {
        return match;
      }
    }
  );

  // Replace hashtag
  for (const [fieldName, cfg] of Object.entries(config)) {
    const tag = `#@#${fieldName}#@#`;
    const value = cfg.value || "";
    text = text.split(tag).join(value);
  }

  return Buffer.from(text, "latin1");
}

module.exports = { compilePdf };
