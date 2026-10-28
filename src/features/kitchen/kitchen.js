import { list, ai, rpc, remove } from "../../core/data.js";
import { configured } from "../../core/supabase.js";
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
import { missingIngredients } from "../../core/domain.js";
import { nussi, thinking } from "../../core/nussi.js";
export async function mount(root) {
  root.querySelector("#kitchen-nussi").innerHTML = nussi("Was kochen wir heute? Ich helfe dir, aus deinem Vorrat etwas Leckeres zu machen.");
  let stopThinking;
  root.querySelector("#notice").innerHTML = setupNotice(configured);
  const f = root.querySelector("form");
  let mode = "suggest",
    recipes = [],
    stock = [],
    products = [];
  root.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        root
          .querySelectorAll("[data-mode]")
          .forEach((x) => x.classList.toggle("active", x === b));
        root.querySelector("#wish-label").hidden = mode !== "wish";
        f.wish.required = mode === "wish";
        f.querySelector("[type=submit]").innerHTML =
          icon("auto_awesome") +
          (mode === "wish" ? " Wunschgericht prüfen" : " Rezeptideen finden");
      }),
  );
  f.onsubmit = (e) => {
    e.preventDefault();
    busy(f.querySelector("[type=submit]"), async () => {
      const submit = f.querySelector('[type="submit"]'), previous = submit.innerHTML;
      const payload = { wish: f.wish.value.trim(), servings: Number(f.servings.value) };
      const message = root.querySelector("#kitchen-error"); message.hidden = true;
      root.querySelector("#kitchen-nussi").hidden = true;
      stopThinking = thinking(root.querySelector("#kitchen-thinking"), mode === "wish" ? "Ich tüftle an deinem Wunschgericht …" : "Ich überlege, was zu deinem Vorrat passt …");
      root.querySelector("#kitchen-thinking").scrollIntoView({ block: "nearest" });
      root.querySelectorAll("form input,[data-mode]").forEach(control => control.disabled = true);
      submit.textContent = "Nussi denkt nach …";
      try {
        await ai(mode, payload);
        await reload(); toast("Nussi hat deine Rezeptideen fertig.");
      } catch (error) { message.textContent = error.message; message.hidden = false; }
      finally {
        stopThinking?.(); stopThinking = null;
        root.querySelector("#kitchen-nussi").hidden = false;
        root.querySelectorAll("form input,[data-mode]").forEach(control => control.disabled = false);
        submit.innerHTML = previous;
      }
    });
  };
  async function reload() {
    [recipes, stock, products] = await Promise.all([
      list("recipes"),
      list("inventory"),
      list("products"),
    ]);
    root.querySelector("#recipe-count").textContent =
      `${recipes.length} gespeichert`;
    const box = root.querySelector("#recipes");
    box.innerHTML = recipes.length
      ? recipes
          .map((r) => {
            const d = r.content;
            const ingredients = missingIngredients(d, stock, products);
            const missing = ingredients.some((i) => i.missing > 0);
            return `<article class="card recipe"><div class="card-top"><div><span class="eyebrow">${r.cooked_at ? "BEREITS GEKOCHT" : "DEINE REZEPTIDEE"}</span><h2>${esc(d.title)}</h2></div><button class="icon-button" data-delete="${r.id}" aria-label="Rezept löschen">${icon("delete")}</button></div><p>${esc(d.description)}</p><div class="recipe-summary"><span class="badge">${icon("group")} ${fmt(d.servings)} Portionen</span><span class="badge">${icon("schedule")} ${fmt(d.minutes)} Min.</span><span class="badge">KI-generiert · bitte prüfen</span></div><details><summary>Zutaten & Zubereitung ansehen</summary><div style="margin-top:15px">${ingredients.map((i) => `<div class="ingredient-row"><span>${esc(i.name)} · ${fmt(i.quantity)} ${esc(i.unit)}</span><span class="${i.missing > 0 ? "missing" : "success"}">${i.missing > 0 ? "Fehlen: " + fmt(i.missing) + " " + esc(i.unit) : "Im Vorrat"}</span></div>`).join("")}</div><ol>${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><p class="help">${esc(d.note || "")} Prüfe Zutaten und Zubereitung, insbesondere bei Allergien.</p></details><div class="actions"><button class="btn" data-cook="${r.id}" ${missing || r.cooked_at ? "disabled" : ""}>${icon(r.cooked_at ? "check" : "restaurant")} ${r.cooked_at ? "Bereits abgezogen" : "Gekocht – Zutaten abziehen"}</button>${missing && !r.cooked_at ? '<span class="inline-note">Ergänze die fehlenden Zutaten im Vorrat.</span>' : ""}</div></article>`;
          })
          .join("")
      : empty(
          "menu_book",
          "Deine nächste Idee wartet hier.",
          "Lass dir ein Rezept aus deinem Vorrat vorschlagen oder gib ein Wunschgericht ein.",
        );
    box.querySelectorAll("[data-cook]").forEach(
      (b) =>
        (b.onclick = () => {
          const r = recipes.find((r) => r.id === b.dataset.cook);
          dialog(
            `<h2>Wirklich gekocht?</h2><p>Die Zutaten für ${fmt(r.content.servings)} Portionen „${esc(r.content.title)}“ werden aus deinem Vorrat abgezogen. Die App verwendet zuerst die am frühesten ablaufenden Chargen.</p><button class="btn" id="confirm">Kochen bestätigen</button>`,
            (el) =>
              (el.querySelector("#confirm").onclick = (e) =>
                busy(e.currentTarget, async () => {
                  await rpc("cook_recipe", { recipe_id: r.id });
                  closeDialog();
                  toast("Zutaten wurden abgezogen. Guten Appetit!");
                  await reload();
                })),
          );
        }),
    );
    box.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () =>
          dialog(
            '<h2>Rezept löschen?</h2><p>Bereits abgezogene Zutaten werden dadurch nicht zurückgebucht.</p><button class="btn danger" id="confirm">Löschen</button>',
            (el) =>
              (el.querySelector("#confirm").onclick = (e) =>
                busy(e.currentTarget, async () => {
                  await remove("recipes", b.dataset.delete);
                  closeDialog();
                  await reload();
                })),
          )),
    );
  }
  await reload();
  return () => stopThinking?.();
}
