// Persönliche Stammdaten. Eine Korrektur gilt für alle künftigen Verwendungen.
import {
  list,
  save,
  remove,
  uploadImage,
  imageUrl,
  ai,
} from "../../core/data.js";
import { configured, requireUser } from "../../core/supabase.js";
import { thinking } from "../../core/nussi.js";
import {
  esc,
  icon,
  empty,
  fmt,
  toast,
  busy,
  dialog,
  closeDialog,
  setupNotice,
} from "../../core/ui.js";
export async function productEditor(product = {}, after = () => {}) {
  await requireUser();
  dialog(
    `<h2>${product.id ? "Produkt bearbeiten" : "Neues Produkt"}</h2><p class="help">Nährwerte pro 100 g, pro 100 ml oder pro Stück – passend zur gewählten Einheit.</p><form id="product-form" class="form-grid"><label class="full">Produktname<input name="name" required maxlength="100" value="${esc(product.name)}" placeholder="Produktname"></label><label>Einheit<select name="unit">${["g", "ml", "Stück"].map((u) => `<option ${product.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></label><label>Kategorie<select name="category">${["Sonstiges", "Obst & Gemüse", "Milchprodukte", "Fleisch & Fisch", "Getreide", "Getränke"].map((c) => `<option ${product.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><div class="full"><button type="button" class="btn secondary small" id="estimate">${icon("auto_awesome")} Nährwerte mit KI schätzen</button><p class="help">Der Produktname wird an die KI gesendet. Schätzwerte bitte anhand der Verpackung prüfen.</p></div>${[
      ["kcal", "Kalorien (kcal)"],
      ["protein", "Eiweiß (g)"],
      ["carbs", "Kohlenhydrate (g)"],
      ["fat", "Fett (g)"],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<input type="number" name="${key}" min="0" max="${key === "kcal" ? 10000 : 1000}" step="0.1" value="${product[key] ?? ""}" placeholder="Nicht hinterlegt"></label>`,
      )
      .join(
        "",
      )}<label class="full">Produktbild (optional)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="full">Quelle der Nährwerte<select name="nutrition_source"><option value="manual" ${product.nutrition_source !== "ai" ? "selected" : ""}>Manuell / Verpackung</option><option value="ai" ${product.nutrition_source === "ai" ? "selected" : ""}>KI-Schätzung</option></select></label><div class="full actions"><button class="btn" type="submit">Produkt speichern</button></div></form>`,
    (el) => {
      const f = el.querySelector("form");
      el.querySelector("#estimate").onclick = (e) =>
        busy(e.currentTarget, async () => {
          if (!f.elements.namedItem("name").reportValidity()) return;
          const loading = document.createElement("div");
          el.querySelector("#estimate").after(loading);
          const stop = thinking(loading, "Ich schätze die Nährwerte für dein Lebensmittel …");
          const r = await ai("nutrition", {
            name: f.elements.namedItem("name").value,
            unit: f.unit.value,
          }).finally(() => { stop(); loading.remove(); });
          for (const k of ["kcal", "protein", "carbs", "fat"])
            f.elements[k].value = r[k] ?? "";
          f.nutrition_source.value = "ai";
          toast("KI-Schätzung übernommen. Bitte vor dem Speichern prüfen.");
        });
      f.onsubmit = (e) => {
        e.preventDefault();
        busy(f.querySelector("[type=submit]"), async () => {
          const values = {
            name: f.elements.namedItem("name").value.trim(),
            unit: f.unit.value,
            category: f.category.value,
            nutrition_source: f.nutrition_source.value,
          };
          if (!values.name) throw Error("Bitte einen Produktnamen eingeben.");
          for (const k of ["kcal", "protein", "carbs", "fat"])
            values[k] =
              f.elements[k].value === "" ? null : Number(f.elements[k].value);
          let uploaded;
          try {
            if (f.image.files[0]) {
              uploaded = await uploadImage(f.image.files[0]);
              values.image_path = uploaded;
            }
            await save("products", values, product.id);
          } catch (err) {
            if (uploaded) {
              const { db } = await import("../../core/supabase.js");
              await (
                await db()
              ).storage
                .from("product-images")
                .remove([uploaded]);
            }
            throw err;
          }
          if (uploaded && product.image_path) {
            const { db } = await import("../../core/supabase.js");
            await (
              await db()
            ).storage
              .from("product-images")
              .remove([product.image_path]);
          }
          closeDialog();
          toast("Produkt gespeichert.");
          await after();
        });
      };
    },
  );
}
export async function mount(root) {
  root.querySelector("#notice").innerHTML = setupNotice(configured);
  let products = await list("products");
  const grid = root.querySelector("#products");
  async function render() {
    const q = root.querySelector("#search").value.toLocaleLowerCase("de");
    const filtered = products.filter((p) =>
      p.name.toLocaleLowerCase("de").includes(q),
    );
    root.querySelector("#count").textContent = `${products.length} Produkte`;
    grid.innerHTML = filtered.length
      ? filtered
          .map(
            (p) =>
              `<article class="card"><div class="product-visual" data-image="${p.id}">${icon("nutrition")}</div><div class="card-top"><h3>${esc(p.name)}</h3><button class="icon-button" data-edit="${p.id}" aria-label="${esc(p.name)} bearbeiten">${icon("edit")}</button></div><p>${esc(p.category)} · ${p.unit === "Stück" ? "pro Stück" : "pro 100 " + esc(p.unit)}</p><div class="recipe-summary"><span class="badge">${p.kcal == null ? "—" : fmt(p.kcal)} kcal</span><span class="badge">${p.protein == null ? "—" : fmt(p.protein)} g Eiweiß</span><span class="badge">${p.nutrition_source === "ai" ? "KI-Schätzung" : "Manuelle Werte"}</span></div><button class="text-link" data-delete="${p.id}">${icon("delete")} Produkt löschen</button></article>`,
          )
          .join("")
      : empty(
          "inventory_2",
          q ? "Kein Treffer" : "Deine Produkte haben hier Platz.",
          q
            ? "Versuche einen anderen Suchbegriff."
            : "Erstelle dein erstes Produkt. Korrigierte Nährwerte werden hier für dich gespeichert.",
        );
    grid.querySelectorAll("[data-edit]").forEach(
      (b) =>
        (b.onclick = () =>
          productEditor(
            products.find((p) => p.id === b.dataset.edit),
            reload,
          ).catch((e) => toast(e.message))),
    );
    grid.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () => {
          const p = products.find((p) => p.id === b.dataset.delete);
          dialog(
            `<h2>Produkt löschen?</h2><p>${esc(p.name)} wird aus deiner Bibliothek entfernt. Produkte mit Vorratschargen können erst nach dem Entfernen der Chargen gelöscht werden.</p><button class="btn danger" id="confirm">Löschen</button>`,
            (el) =>
              (el.querySelector("#confirm").onclick = (e) =>
                busy(e.currentTarget, async () => {
                  await remove("products", p.id);
                  if (p.image_path) {
                    const { db } = await import("../../core/supabase.js");
                    await (
                      await db()
                    ).storage
                      .from("product-images")
                      .remove([p.image_path]);
                  }
                  closeDialog();
                  await reload();
                })),
          );
        }),
    );
    await Promise.all(
      filtered
        .filter((p) => p.image_path)
        .map(async (p) => {
          try {
            const url = await imageUrl(p.image_path);
            const target = grid.querySelector(`[data-image="${p.id}"]`);
            if (target) {
              const img = new Image();
              img.alt = p.name;
              img.src = url;
              target.replaceChildren(img);
            }
          } catch {}
        }),
    );
  }
  async function reload() {
    products = await list("products");
    await render();
  }
  root.querySelector("#search").oninput = () => render();
  root.querySelector("#new-product").onclick = () =>
    productEditor({}, reload).catch((e) => toast(e.message));
  await render();
}
