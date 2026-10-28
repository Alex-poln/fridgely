import { ai, rpc } from "../../core/data.js";
import { esc, icon, fmt, dialog, closeDialog, toast } from "../../core/ui.js";
import { prepareReceiptImage } from "./receipt-image.js";
import { thinking } from "../../core/nussi.js";

// Open on tap immediately; authentication is checked when requesting AI.
export async function receiptImporter(after) {
  dialog(`<div class="receipt-heading"><span class="eyebrow">VOM EINKAUF IN DEN VORRAT</span><h2 id="receipt-title">Kassenbon scannen</h2><p id="receipt-subtitle">Ein Foto. Dein Einkauf auf einen Blick.</p></div>
    <section id="receipt-upload">
      <input hidden id="receipt-camera" type="file" accept="image/*" capture="environment">
      <input hidden id="receipt-file" type="file" accept="image/*">
      <div id="receipt-pickers" class="receipt-pickers">
        <button class="receipt-camera btn" type="button" data-pick="camera">${icon("photo_camera")}<span>Bon fotografieren<small>Am besten flach und gut beleuchtet</small></span></button>
        <button class="btn secondary" type="button" data-pick="file">${icon("image")} Bild auswählen</button>
      </div>
      <div id="receipt-preview" hidden><img alt="Dein ausgewählter Kassenbon"><div class="actions"><button class="text-link" type="button" id="receipt-change">Anderes Bild</button><button class="btn" type="button" id="receipt-analyze">${icon("auto_awesome")} Produkte erkennen</button></div></div>
      <p class="help receipt-privacy">Zur Erkennung wird dein Foto an die KI gesendet.</p>
    </section>
    <div id="receipt-progress" hidden><span class="receipt-spinner" aria-hidden="true"></span><h3>Dein Einkauf wird erkannt</h3><p class="help">Einen kleinen Moment …</p></div>
    <p id="receipt-status" class="receipt-status" role="status" aria-live="polite" hidden></p>
    <section id="receipt-review" hidden></section>`, (el) => {
    el.classList.add("receipt-modal"); el.setAttribute("aria-labelledby", "receipt-title");
    const upload = el.querySelector("#receipt-upload"), review = el.querySelector("#receipt-review");
    const preview = el.querySelector("#receipt-preview"), pickers = el.querySelector("#receipt-pickers");
    const status = el.querySelector("#receipt-status"), progress = el.querySelector("#receipt-progress");
    let prepared, previewUrl, working = false, closed = false, stopThinking;
    const onCancel = event => { if (working) event.preventDefault(); };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", () => {
      closed = true;
      stopThinking?.();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      el.removeEventListener("cancel", onCancel); el.classList.remove("receipt-modal"); el.removeAttribute("aria-labelledby");
    }, { once: true });
    function message(text = "") { status.textContent = text; status.hidden = !text; }
    function lock(value) {
      working = value;
      el.querySelectorAll("button,input,select").forEach(control => control.disabled = value);
      el.setAttribute("aria-busy", String(value));
      if (!value) syncRows();
    }
    // Keep the picker inside the actual click event for mobile Safari.
    el.querySelectorAll("[data-pick]").forEach(button => button.onclick = () => {
      const input = el.querySelector(`#receipt-${button.dataset.pick}`);
      input.value = ""; input.click();
    });
    for (const input of el.querySelectorAll('input[type="file"]')) input.onchange = async () => {
      const file = input.files[0];
      if (!file || working) return;
      lock(true); message("Foto wird vorbereitet …");
      try {
        prepared = await prepareReceiptImage(file);
        if (closed) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(prepared.blob); preview.querySelector("img").src = previewUrl;
        pickers.hidden = true; preview.hidden = false; message();
      } catch (error) { message(error.message); }
      finally { if (!closed) lock(false); }
    };
    function chooseAgain() {
      review.hidden = true; review.replaceChildren(); upload.hidden = false;
      preview.hidden = true; pickers.hidden = false; prepared = null;
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      preview.querySelector("img").removeAttribute("src");
      el.querySelector("#receipt-title").textContent = "Kassenbon scannen";
      el.querySelector("#receipt-subtitle").textContent = "Ein Foto. Dein Einkauf auf einen Blick.";
      message(); el.scrollTop = 0;
    }
    el.querySelector("#receipt-change").onclick = chooseAgain;
    el.querySelector("#receipt-analyze").onclick = async () => {
      if (working || !prepared) return;
      lock(true); message(); upload.hidden = true;
      stopThinking = thinking(progress, "Ich lese deinen Bon und sortiere deinen Einkauf …");
      try {
        const result = await ai("receipt", { image: prepared.image });
        if (closed) return;
        if (!Array.isArray(result.items)) throw Error("Die Erkennung hat nicht geklappt. Bitte erneut versuchen.");
        if (!result.items.length) throw Error(result.note || "Keine Lebensmittel erkannt. Bitte fotografiere den Bon noch einmal näher.");
        renderReview(result, prepared.hash);
      } catch (error) { if (!closed) { upload.hidden = false; message(error.message); } }
      finally { stopThinking?.(); stopThinking = null; if (!closed) { lock(false); } }
    };
    function syncRows() {
      let count = 0;
      review.querySelectorAll("[data-row]").forEach(row => {
        const selected = row.querySelector('[name="selected"]').checked;
        count += Number(selected); row.classList.toggle("is-selected", selected);
        const name = row.querySelector('[name="name"]').value.trim();
        const amount = row.querySelector('[name="quantity"]').value, unit = row.querySelector('[name="unit"]').value;
        row.querySelector(".receipt-product-name").textContent = name || "Produktname ergänzen";
        row.querySelector(".receipt-amount").textContent = amount && unit ? `${fmt(amount)} ${unit}` : "Menge ergänzen";
        row.querySelector('[name="selected"]').setAttribute("aria-label", `${name || "Produkt"} reinlegen`);
      });
      const button = review.querySelector('[type="submit"]');
      if (button) { button.textContent = `${count} ${count === 1 ? "Produkt" : "Produkte"} hinzufügen`; button.disabled = working || !count; }
    }
    function renderReview(result, hash) {
      upload.hidden = true; review.hidden = false;
      el.querySelector("#receipt-title").textContent = "Dein Einkauf";
      el.querySelector("#receipt-subtitle").textContent = "Auswählen. Bei Bedarf antippen und ändern.";
      review.innerHTML = `<form id="receipt-items" novalidate><div class="receipt-list">${result.items.map((item, index) => `
        <article data-row class="receipt-product ${item.fridge ? "is-selected" : ""}">
          <div class="receipt-product-top"><button type="button" class="receipt-expand" aria-expanded="false" aria-controls="receipt-edit-${index}">
            <span class="receipt-product-copy"><strong class="receipt-product-name">${esc(item.name)}</strong><span class="receipt-amount"></span>${item.uncertain ? '<small class="receipt-uncertain">Bitte prüfen</small>' : ""}</span>${icon("expand_more")}</button>
            <label class="receipt-switch"><input type="checkbox" role="switch" name="selected" ${item.fridge ? "checked" : ""}><span aria-hidden="true"></span></label>
          </div>
          <div class="receipt-edit" id="receipt-edit-${index}" hidden>
            <div class="form-grid"><label class="full">Produktname<input name="name" maxlength="100" required value="${esc(item.name)}"></label>
            <label>Menge<input name="quantity" type="number" inputmode="decimal" min="0.001" max="10000000" step="any" required value="${esc(item.quantity)}" placeholder="z. B. 250"></label>
            <label>Einheit<select name="unit" required><option value="">Wählen</option>${["g", "ml", "Stück"].map(unit => `<option ${unit === item.unit ? "selected" : ""}>${unit}</option>`).join("")}</select></label></div>
            ${item.note ? `<p class="help">${esc(item.note)}</p>` : ""}
          </div>
        </article>`).join("")}</div>
        ${result.note ? `<p class="help">${esc(result.note)}</p>` : ""}
        <div class="receipt-review-footer"><p class="help">Haltbarkeit kannst du später ergänzen.</p><button class="btn" type="submit"></button><button class="receipt-reset text-link" type="button">Anderen Bon scannen</button></div>
      </form>`;
      review.querySelector(".receipt-reset").onclick = chooseAgain;
      review.querySelectorAll(".receipt-expand").forEach(button => button.onclick = () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
        el.querySelector(`#${button.getAttribute("aria-controls")}`).hidden = expanded;
      });
      review.querySelectorAll("input,select").forEach(control => control.addEventListener("input", syncRows));
      review.querySelector("form").onsubmit = async event => {
        event.preventDefault(); if (working) return;
        const rows = [...review.querySelectorAll("[data-row]")].filter(row => row.querySelector('[name="selected"]').checked);
        if (!rows.length) return;
        for (const row of rows) {
          const fields = [...row.querySelectorAll(".receipt-edit input,.receipt-edit select")];
          const invalid = fields.find(control => !control.checkValidity() || (control.name === "name" && !control.value.trim()));
          if (invalid) {
            row.querySelector(".receipt-edit").hidden = false; row.querySelector(".receipt-expand").setAttribute("aria-expanded", "true");
            invalid.focus(); invalid.reportValidity(); message("Bitte ergänze die markierten Produktangaben."); return;
          }
        }
        const items = rows.map(row => ({ name: row.querySelector('[name="name"]').value.trim(), quantity: Number(row.querySelector('[name="quantity"]').value), unit: row.querySelector('[name="unit"]').value }));
        lock(true); message("Dein Einkauf wird hinzugefügt …");
        try {
          const count = await rpc("import_receipt", { receipt_hash: hash, items }); closeDialog();
          toast(count === 0 ? "Dieser Bon wurde bereits hinzugefügt." : `${count} Positionen in den Kühlschrank gelegt.`); await after();
        } catch (error) { if (!closed) message(error.message); else toast(error.message); }
        finally { if (!closed) lock(false); }
      };
      syncRows(); el.scrollTop = 0;
    }
  });
}
