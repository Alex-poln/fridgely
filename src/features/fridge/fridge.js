import { list, save, remove, rpc, imageUrl } from "../../core/data.js";
import { configured, requireUser } from "../../core/supabase.js";
import {
  esc,
  icon,
  empty,
  fmt,
  busy,
  toast,
  dialog,
  closeDialog,
  setupNotice,
} from "../../core/ui.js";
import { expiry, positive } from "../../core/domain.js";
import { productEditor } from "../products/products.js";
import { receiptImporter } from "./receipt.js";
export async function mount(root) {
  root.querySelector("#notice").innerHTML = setupNotice(configured);
  let stock = [],
    products = [],
    filter = "all";
  const grid = root.querySelector("#stock");
  async function reload() {
    [stock, products] = await Promise.all([
      list("inventory"),
      list("products"),
    ]);
    const recipes = [];
    root.querySelector("#total").textContent = stock.length;
    root.querySelector("#soon").textContent = stock.filter((s) => {
      const d = expiry(s.expires_on).days;
      return d !== null && d >= 0 && d <= 3;
    }).length;
    root.querySelector("#recipes-count").textContent = recipes.length;
    root.querySelector(".toolbar").hidden = !stock.length;
    root.querySelector(".stock-summary").hidden = !stock.length;
    root.querySelector(".page-heading .actions").hidden = !stock.length;
    root.querySelector("#recipe-shortcut").hidden = stock.length < 3;
    await render();
  }
  async function render() {
    const q = root.querySelector("#search").value.toLocaleLowerCase("de");
    const rows = stock
      .map((s) => ({
        ...s,
        product: products.find((p) => p.id === s.product_id),
      }))
      .filter((s) => s.product?.name.toLocaleLowerCase("de").includes(q))
      .filter((s) => {
        const d = expiry(s.expires_on).days;
        return (
          filter === "all" ||
          (filter === "soon" && d !== null && d >= 0 && d <= 3) ||
          (filter === "expired" && d !== null && d < 0)
        );
      })
      .sort((a, b) =>
        (a.expires_on || "9999").localeCompare(b.expires_on || "9999"),
      );
    grid.innerHTML = rows.length
      ? rows
          .map((s) => {
            const p = s.product;
            const exp = expiry(s.expires_on);
            return `<article class="card"><div class="product-visual" data-image="${s.id}">${icon("nutrition")}</div><div class="card-top"><h3>${esc(p.name)}</h3><button class="icon-button" data-edit="${s.id}" aria-label="${esc(p.name)} ändern">${icon("edit")}</button></div><p>${esc(p.category)}</p><span class="badge ${exp.tone}">${icon("schedule")} ${esc(exp.label)}</span><div class="quantity"><strong>${fmt(s.quantity)} ${esc(s.unit)}</strong><div class="stepper"><button class="icon-button" data-adjust="${s.id}" data-sign="-1" aria-label="Menge von ${esc(p.name)} reduzieren">${icon("remove")}</button><button class="icon-button" data-adjust="${s.id}" data-sign="1" aria-label="Menge von ${esc(p.name)} erhöhen">${icon("add")}</button></div></div></article>`;
          })
          .join("")
      : stock.length
        ? empty("search", "Keine passenden Lebensmittel", "Ändere deine Suche oder den Filter.") + '<button class="btn secondary" id="reset-filter">Alle anzeigen</button>'
        : '<section class="empty-state stock-empty"><h2>Noch keine Lebensmittel</h2><p>Scanne einen Bon oder füge etwas selbst hinzu.</p><div class="actions"><button class="btn" id="empty-scan">Kassenbon scannen</button><button class="btn secondary" id="empty-add">Lebensmittel hinzufügen</button></div></section>';
    grid.querySelector("#empty-scan")?.addEventListener("click", () => root.querySelector("#scan-receipt").click());
    grid.querySelector("#empty-add")?.addEventListener("click", () => root.querySelector("#add").click());
    grid.querySelector("#reset-filter")?.addEventListener("click", () => { root.querySelector("#search").value = ""; root.querySelector('[data-filter="all"]').click(); });
    root.querySelector("#filter-help").hidden = filter !== "soon" || !stock.length;
    grid
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            editor(stock.find((s) => s.id === b.dataset.edit)).catch((e) =>
              toast(e.message),
            )),
      );
    grid.querySelectorAll("[data-adjust]").forEach(
      (b) =>
        (b.onclick = () => {
          const s = stock.find((x) => x.id === b.dataset.adjust);
          const sign = Number(b.dataset.sign);
          dialog(
            `<h2>${sign > 0 ? "Menge hinzufügen" : "Menge entnehmen"}</h2><form><label>Menge in ${esc(s.unit)}<input name="amount" type="number" min="0.001" step="any" ${sign < 0 ? `max="${s.quantity}"` : ""} required autofocus></label><p class="help">Aktueller Bestand: ${fmt(s.quantity)} ${esc(s.unit)}. Bei null wird die Charge entfernt.</p><button class="btn" style="margin-top:16px">Bestätigen</button></form>`,
            (el) => {
              const f = el.querySelector("form");
              f.onsubmit = (e) => {
                e.preventDefault();
                busy(f.querySelector("button"), async () => {
                  await rpc("adjust_inventory", {
                    lot_id: s.id,
                    delta: sign * positive(f.amount.value),
                  });
                  closeDialog();
                  await reload();
                });
              };
            },
          );
        }),
    );
    await Promise.all(
      rows
        .filter((s) => s.product.image_path)
        .map(async (s) => {
          try {
            const url = await imageUrl(s.product.image_path);
            const el = grid.querySelector(`[data-image="${s.id}"]`);
            if (el) {
              const img = new Image();
              img.alt = s.product.name;
              img.src = url;
              el.replaceChildren(img);
            }
          } catch {}
        }),
    );
  }
  async function editor(lot = {}) {
    await requireUser();
    if (!products.length) {
      toast("Erstelle zuerst ein Produkt für deinen Vorrat.");
      await productEditor({}, async () => {
        await reload();
        await editor();
      });
      return;
    }
    dialog(
      `<h2>${lot.id ? "Charge bearbeiten" : "In den Kühlschrank legen"}</h2><form class="form-grid"><label class="full">Produkt<select name="product_id" ${lot.id ? "disabled" : ""}>${products.map((p) => `<option value="${p.id}" ${lot.product_id === p.id ? "selected" : ""}>${esc(p.name)} (${esc(p.unit)})</option>`).join("")}</select></label>${!lot.id ? '<label>Menge<input name="quantity" type="number" min="0.001" step="any" required></label>' : '<p class="help full">Mengen über die + / − Tasten ändern. So werden parallele Änderungen sicher berücksichtigt.</p>'}<label>Ablaufdatum<input name="expires_on" type="date" value="${esc(lot.expires_on)}"></label><label class="full">Datumstyp<select name="date_type"><option value="best_before" ${lot.date_type !== "use_by" ? "selected" : ""}>Mindesthaltbarkeitsdatum</option><option value="use_by" ${lot.date_type === "use_by" ? "selected" : ""}>Zu verbrauchen bis</option></select></label><div class="full actions"><button class="btn" type="submit">${lot.id ? "Speichern" : "Hineinlegen"}</button>${lot.id ? '<button type="button" id="delete-lot" class="btn danger">Charge entfernen</button>' : '<button type="button" class="btn secondary" id="create-product">Neues Produkt</button>'}</div></form>`,
      (el) => {
        const f = el.querySelector("form");
        f.onsubmit = (e) => {
          e.preventDefault();
          busy(f.querySelector("[type=submit]"), async () => {
            const p = products.find((p) => p.id === f.product_id.value);
            const values = {
              expires_on: f.expires_on.value || null,
              date_type: f.date_type.value,
            };
            if (!lot.id)
              Object.assign(values, {
                product_id: p.id,
                unit: p.unit,
                quantity: positive(f.quantity.value),
              });
            await save("inventory", values, lot.id);
            closeDialog();
            await reload();
          });
        };
        el.querySelector("#create-product")?.addEventListener("click", () => {
          closeDialog();
          productEditor({}, async () => {
            await reload();
            await editor();
          }).catch((e) => toast(e.message));
        });
        el.querySelector("#delete-lot")?.addEventListener("click", () => {
          closeDialog();
          dialog(
            `<h2>Charge vollständig entfernen?</h2><p>Du entfernst ${fmt(lot.quantity)} ${esc(lot.unit)} aus deinem Vorrat.</p><button class="btn danger" id="confirm">Entfernen</button>`,
            (d) =>
              (d.querySelector("#confirm").onclick = (e) =>
                busy(e.currentTarget, async () => {
                  await remove("inventory", lot.id);
                  closeDialog();
                  await reload();
                })),
          );
        });
      },
    );
  }
  root.querySelector("#add").onclick = () =>
    editor().catch((e) => toast(e.message));
  root.querySelector("#scan-receipt").onclick = () =>
    receiptImporter(reload).catch((e) => toast(e.message));
  root.querySelector("#search").oninput = render;
  root.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        root
          .querySelectorAll("[data-filter]")
          .forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        render();
      }),
  );
  await reload();
}

