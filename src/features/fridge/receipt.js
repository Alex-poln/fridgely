import { ai, rpc } from "../../core/data.js";
import { requireUser } from "../../core/supabase.js";
import { esc, dialog, closeDialog, toast } from "../../core/ui.js";

export async function receiptImporter(after) {
  await requireUser();
  dialog(`<h2>Kassenbon scannen</h2>
    <p>Fotografiere den ganzen Bon gut lesbar oder wähle ein Bild aus. Das Foto wird zur Erkennung an die KI gesendet und nicht im Vorrat gespeichert.</p>
    <form id="receipt-upload">
      <label>Bild auswählen (JPG, PNG, WebP · bis 5 MB)<input name="file" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <label>Mit der Kamera fotografieren<input name="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label>
      <p class="help">Es wird jeweils das zuletzt ausgewählte Bild verwendet. Bitte keine Zahlungsdaten mitfotografieren.</p>
      <p id="receipt-status" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">Produkte erkennen</button>
    </form><div id="receipt-review"></div>`, (el) => {
    const upload = el.querySelector("#receipt-upload");
    const status = el.querySelector("#receipt-status");
    const review = el.querySelector("#receipt-review");
    let selectedFile, working = false;
    const onCancel = (event) => { if (working) event.preventDefault(); };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", () => el.removeEventListener("cancel", onCancel), { once: true });
    function lock(value) {
      working = value;
      el.querySelectorAll("button,input,select").forEach((control) => control.disabled = value);
      el.setAttribute("aria-busy", String(value));
    }
    for (const field of [upload.elements.file, upload.elements.camera]) {
      field.onchange = () => {
        selectedFile = field.files[0];
        const other = field === upload.elements.file ? upload.elements.camera : upload.elements.file;
        other.value = "";
        review.replaceChildren();
        status.textContent = selectedFile ? `Ausgewählt: ${selectedFile.name}` : "";
      };
    }
    upload.onsubmit = async (event) => {
      event.preventDefault();
      if (working) return;
      review.replaceChildren();
      if (!selectedFile || !["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type) || selectedFile.size > 5 * 1024 * 1024 || !selectedFile.size) {
        status.textContent = "Bitte ein JPG-, PNG- oder WebP-Bild bis 5 MB auswählen.";
        return;
      }
      lock(true);
      status.textContent = "Der Bon wird gelesen …";
      try {
        const bytes = await selectedFile.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(Error("Das Bild konnte nicht gelesen werden."));
          reader.readAsDataURL(selectedFile);
        });
        const result = await ai("receipt", { image: { mimeType: selectedFile.type, data } });
        if (!Array.isArray(result.items)) throw Error("Ungültige Antwort der Bon-Erkennung.");
        status.textContent = result.items.length ? `${result.items.length} Positionen erkannt. Bitte prüfen.` : "Keine Lebensmittel erkannt. Bitte ein schärferes Foto versuchen.";
        renderReview(result, hash);
      } catch (error) { status.textContent = error.message; }
      finally { lock(false); syncFields(); }
    };
    function syncFields() {
      review.querySelectorAll("[data-row]").forEach(row => {
        const selected = row.querySelector('[name="selected"]').checked;
        row.querySelectorAll("input:not([type=checkbox]),select").forEach(control => control.disabled = !selected);
      });
    }
    function renderReview(result, hash) {
      review.innerHTML = `<p class="help">${esc(result.note)}</p>`;
      if (!result.items.length) return;
      review.innerHTML += `<h3>Was darf in den Kühlschrank?</h3>
        <p class="help">Kühlschrank-Vorschläge sind vorausgewählt. Fehlende Mengen bitte ergänzen. Haltbarkeit und Nährwerte bleiben offen. Vorhandene Produkte werden bei gleichem Namen und gleicher Einheit wiederverwendet; jede Position wird als neue Charge hinzugefügt.</p>
        <form id="receipt-items">${result.items.map((item, index) => `<fieldset data-row class="receipt-row">
          <legend>Position ${index + 1}${item.uncertain ? " · Bitte besonders prüfen" : ""}</legend>
          <label class="receipt-toggle"><input type="checkbox" role="switch" name="selected" ${item.fridge ? "checked" : ""}> Reinlegen</label>
          <div class="form-grid"><label class="full">Produktname<input name="name" maxlength="100" required value="${esc(item.name)}"></label>
          <label>Menge<input name="quantity" type="number" min="0.001" max="10000000" step="any" required value="${esc(item.quantity)}" placeholder="Bitte ergänzen"></label>
          <label>Einheit<select name="unit" required><option value="">Bitte wählen</option>${["g", "ml", "Stück"].map(unit => `<option ${unit === item.unit ? "selected" : ""}>${unit}</option>`).join("")}</select></label></div>
          <p class="help">${esc(item.note)}${item.quantity === null || item.unit === null ? " Menge oder Einheit nicht sicher erkannt." : ""}</p>
        </fieldset>`).join("")}
        <p class="help">Dasselbe Bild wird nur einmal übernommen. Ein neues Foto desselben Bons kann nicht sicher als Duplikat erkannt werden.</p>
        <p id="receipt-save-status" role="status" aria-live="polite"></p>
        <button class="btn" type="submit">Ausgewählte Produkte hinzufügen</button>
      </form>`;
      review.querySelectorAll('[name="selected"]').forEach(control => control.onchange = syncFields);
      review.querySelector("form").onsubmit = async event => {
        event.preventDefault();
        if (working) return;
        const message = review.querySelector("#receipt-save-status");
        const items = [...review.querySelectorAll("[data-row]")]
          .filter(row => row.querySelector('[name="selected"]').checked)
          .map(row => ({ name: row.querySelector('[name="name"]').value.trim(),
            quantity: Number(row.querySelector('[name="quantity"]').value), unit: row.querySelector('[name="unit"]').value }));
        if (!items.length || items.some(item => !item.name)) { message.textContent = "Bitte mindestens ein Produkt mit Namen auswählen."; return; }
        lock(true);
        message.textContent = "Die ausgewählten Produkte werden gespeichert …";
        try {
          const count = await rpc("import_receipt", { receipt_hash: hash, items });
          closeDialog();
          toast(count === 0 ? "Dieses Bild wurde bereits übernommen. Es wurde nichts doppelt hinzugefügt." : `${count} Positionen in den Kühlschrank gelegt.`);
          await after();
        } catch (error) { message.textContent = error.message; }
        finally { lock(false); syncFields(); }
      };
    }
  });
}
