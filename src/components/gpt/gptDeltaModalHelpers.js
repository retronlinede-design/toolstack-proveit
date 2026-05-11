export function cleanGptPreviewText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replaceAll("ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â", "-")
    .replaceAll("ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“", "-")
    .replaceAll("Ã¢â‚¬â€", "-")
    .replaceAll("Ã¢â‚¬â€œ", "-")
    .replaceAll("Ã¢â‚¬â„¢", "'")
    .replaceAll("Ã¢â‚¬Ëœ", "'")
    .replaceAll("Ã¢â‚¬Å“", "\"")
    .replaceAll("Ã¢â‚¬Â", "\"")
    .replaceAll("Ã‚", "")
    .replace(/\uFFFD/g, "");
}
