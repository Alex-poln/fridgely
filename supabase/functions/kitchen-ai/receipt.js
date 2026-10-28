export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 4096;
export const receiptSchema = {
  type: "object",
  properties: {
    note: { type: "string" },
    // Das Limit wird im Prompt und in validateReceipt geprüft. maxItems: 60
    // führt mit diesem Schema bei Gemini 3.5 Flash-Lite zu HTTP 400.
    items: { type: "array", items: {
      type: "object",
      properties: {
        name: { type: "string" }, quantity: { type: ["number", "null"] },
        unit: { type: ["string", "null"], enum: ["g", "ml", "Stück", null] },
        fridge: { type: "boolean" }, uncertain: { type: "boolean" }, note: { type: "string" },
      },
      required: ["name", "quantity", "unit", "fridge", "uncertain", "note"],
    } },
  },
  required: ["items", "note"],
};
export async function readBody(req) {
  if (!req.body) throw Error("Leere Anfrage.");
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw Error("Bild zu groß. Bitte maximal 5 MB auswählen.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
export function validateReceiptImage(image) {
  if (!image || !["image/jpeg", "image/png", "image/webp"].includes(image.mimeType) ||
      typeof image.data !== "string" || !image.data.length ||
      image.data.length > 4 * Math.ceil(MAX_IMAGE_BYTES / 3) ||
      image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data))
    throw Error("Bitte ein gültiges JPG-, PNG- oder WebP-Bild bis 5 MB auswählen.");
  const bytes = atob(image.data);
  const matches = image.mimeType === "image/jpeg" ? bytes.startsWith("\xff\xd8\xff")
    : image.mimeType === "image/png" ? bytes.startsWith("\x89PNG\r\n\x1a\n")
    : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  if (bytes.length > MAX_IMAGE_BYTES || !matches) throw Error("Bildformat ist ungültig.");
}
export function validateReceipt(raw) {
  const text = (value, max) => {
    if (typeof value !== "string" || value.length > max) throw Error("Ungültiger Bontext von der KI.");
    return value.trim();
  };
  if (!Array.isArray(raw?.items) || raw.items.length > 60) throw Error("Ungültige Bonliste von der KI.");
  return { note: text(raw.note, 1000), items: raw.items.map((item) => {
    if (!item || typeof item.fridge !== "boolean" || typeof item.uncertain !== "boolean" ||
        ![null, "g", "ml", "Stück"].includes(item.unit) ||
        (item.quantity !== null && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 0.001 || item.quantity > 10000000)))
      throw Error("Ungültige Bonposition von der KI.");
    const name = text(item.name, 100);
    if (!name) throw Error("Produktname fehlt in der KI-Antwort.");
    return { name, quantity: item.quantity, unit: item.unit, fridge: item.fridge,
      uncertain: item.uncertain || item.quantity === null || item.unit === null, note: text(item.note, 500) };
  }) };
}
