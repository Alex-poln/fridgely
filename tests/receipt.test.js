import test from "node:test";
import assert from "node:assert/strict";
import { validateReceipt, validateReceiptImage, readBody, MAX_IMAGE_BYTES } from "../supabase/functions/kitchen-ai/receipt.js";
const item = { name: "Milch", quantity: 1000, unit: "ml", fridge: true, uncertain: false, note: "" };
test("Bon: fehlende Mengen bleiben offen, Zusatzfelder werden entfernt", () => {
  const result = validateReceipt({ note: "", items: [{ ...item, quantity: null, expires_on: "2030-01-01" }] });
  assert.equal(result.items[0].quantity, null);
  assert.equal(result.items[0].uncertain, true);
  assert.equal("expires_on" in result.items[0], false);
  assert.deepEqual(validateReceipt({ note: "Kein Bon", items: [] }).items, []);
});
test("Bon: fehlerhafte Mengen, Einheiten, Typen und überlange Listen abweisen", () => {
  for (const patch of [{ quantity: -1 }, { quantity: Infinity }, { quantity: "1" }, { quantity: 0.0001 }, { unit: "kg" }, { fridge: "true" }, { name: " " }, { note: "x".repeat(501) }])
    assert.throws(() => validateReceipt({ note: "", items: [{ ...item, ...patch }] }));
  assert.throws(() => validateReceipt({ note: "", items: Array(61).fill(item) }));
});
test("Bon: MIME, Base64, Dateisignatur und Größenlimit prüfen", () => {
  validateReceiptImage({ mimeType: "image/png", data: btoa("\x89PNG\r\n\x1a\n") });
  for (const image of [null, { mimeType: "image/svg+xml", data: btoa("<svg/>") }, { mimeType: "image/png", data: "@@@@" }, { mimeType: "image/jpeg", data: btoa("not an image") }, { mimeType: "image/png", data: "a".repeat(4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 4) }])
    assert.throws(() => validateReceiptImage(image));
});
test("Bon: Request wird während des Lesens begrenzt", async () => {
  const request = new Request("http://localhost", { method: "POST", body: '{"mode":"receipt"}' });
  assert.equal(await readBody(request), '{"mode":"receipt"}');
  const large = new Request("http://localhost", { method: "POST", body: "x".repeat(8 * 1024 * 1024) });
  await assert.rejects(readBody(large), /zu groß/);
});
