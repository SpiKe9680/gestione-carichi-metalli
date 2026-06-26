export function replaceHashtags(pdfBuffer, replacements) {
  let text = pdfBuffer.toString("utf8");

  for (const key in replacements) {
    const value = replacements[key] || "";
    const regex = new RegExp(`#@#${key}#@#`, "g");
    text = text.replace(regex, value);
  }

  return Buffer.from(text, "utf8");
}
