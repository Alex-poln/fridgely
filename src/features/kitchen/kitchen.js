import { list, ai, rpc, remove, save } from "../../core/data.js";
import { db, result } from "../../core/supabase.js";
import { esc, fmt, busy, toast, dialog, closeDialog } from "../../core/ui.js";
import { nussi, thinking } from "../../core/nussi.js";
import { recipeNutrition, nutrients, labels } from "../../core/nutrition.js";
import { logFood } from "../tracker/entry.js";
import { customEditor } from "./custom.js";
export async function mount(root) {
  let recipes=[],custom=[],products=[],mode="suggest",stopThinking;
  const profile=(await list("nutrition_profiles"))[0]||{};
  root.querySelector("#kitchen-nussi").innerHTML=nussi(profile.display_name ? "Was kochen wir heute, "+profile.display_name+"?" : "Was kochen wir heute?");
  const f=root.querySelector("#recipe-form");
  root.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;root.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("active",x===b));root.querySelector("#wish-label").hidden=mode!=="wish";f.wish.required=mode==="wish";});
  function details(r) {
    const d=r.content;
    return `<p>${esc(d.description)}</p><p class="help">${fmt(d.servings)} Portionen · ${fmt(d.minutes)} Min. · KI-Vorschlag</p><details><summary>Zutaten und Zubereitung</summary><ul>${(d.ingredients||[]).map(i=>`<li>${fmt(i.quantity)} ${esc(i.unit)} ${esc(i.name)}</li>`).join("")}</ul><ol>${(d.steps||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ol><p class="help">${esc(d.note)}</p></details>`;
  }
  async function reload() {
    [recipes,custom,products]=await Promise.all([list("recipes"),list("custom_meals"),list("products")]);
    recipes=recipes.filter(r=>r.is_saved!==false);render();
  }
  function render() {
    const q=root.querySelector("#recipe-search").value.toLocaleLowerCase("de").trim();
    root.querySelector("#recipe-count").textContent=(recipes.length+custom.length)+" gespeichert";
    const matches=s=>s.toLocaleLowerCase("de").includes(q);
    root.querySelector("#recipes").innerHTML=
      custom.filter(m=>matches(m.name)).map(m=>`<article class="card"><div class="card-top"><h2>${esc(m.name)}</h2><span class="badge">Eigenes Gericht</span></div><p>${m.kcal==null?"—":fmt(m.kcal)} kcal · ${m.protein==null?"—":fmt(m.protein)} g Eiweiß / Portion</p><details><summary>Zutaten & Zubereitung</summary><ul>${(m.ingredients||[]).map(i=>`<li>${fmt(i.quantity)} ${esc(i.unit)} ${esc(i.name)}</li>`).join("")}</ul><p>${esc(m.steps)}</p></details><div class="actions"><button class="btn" data-meal-eat="${m.id}">Gegessen</button><button class="btn secondary" data-meal-edit="${m.id}">Bearbeiten</button><button class="text-link" data-remove="${m.id}" data-table="custom_meals">Löschen</button></div></article>`).join("")+
      recipes.filter(r=>matches(r.content.title)).map(r=>`<article class="card"><h2>${esc(r.content.title)}</h2>${details(r)}<div class="actions"><button class="btn" data-recipe-eat="${r.id}">Gegessen</button><button class="btn secondary" data-cook="${r.id}" ${r.cooked_at?"disabled":""}>${r.cooked_at?"Zutaten bereits abgezogen":"Gekocht · Vorrat abziehen"}</button><button class="text-link" data-remove="${r.id}" data-table="recipes">Löschen</button></div></article>`).join("") || '<p class="empty-state">Keine passenden Rezepte oder Gerichte.</p>';
    root.querySelectorAll("[data-meal-eat]").forEach(b=>b.onclick=()=>logFood({meal:custom.find(m=>m.id===b.dataset.mealEat)}));
    root.querySelectorAll("[data-meal-edit]").forEach(b=>b.onclick=()=>customEditor(custom.find(m=>m.id===b.dataset.mealEdit),reload).catch(e=>toast(e.message)));
    root.querySelectorAll("[data-recipe-eat]").forEach(b=>b.onclick=()=>{const r=recipes.find(r=>r.id===b.dataset.recipeEat);logFood({recipe:r,nutrition:recipeNutrition(r,products)});});
    root.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>dialog('<h2>Aus der Sammlung löschen?</h2><p>Tagebucheinträge und bereits erfolgte Vorratsabzüge bleiben erhalten.</p><button class="btn danger" id="confirm">Löschen</button>',el=>{el.querySelector("#confirm").onclick=e=>busy(e.currentTarget,async()=>{await remove(b.dataset.table,b.dataset.remove);closeDialog();await reload();});}));
    root.querySelectorAll("[data-cook]").forEach(b=>b.onclick=()=>{
      const r=recipes.find(r=>r.id===b.dataset.cook);
      dialog(`<h2>Zutaten abziehen?</h2><p>Vorhandene Zutaten für ${fmt(r.content.servings)} Portionen werden abgezogen, höchstens bis zur benötigten Menge. Fehlendes wird übersprungen. Bereits gebuchte Portionen zählen mit.</p><button class="btn" id="confirm">Kochen bestätigen</button>`,el=>{el.querySelector("#confirm").onclick=e=>busy(e.currentTarget,async()=>{await rpc("cook_recipe_available",{recipe_id:r.id});closeDialog();await reload();toast("Vorrat aktualisiert. Über „Gegessen“ kannst du deine Portion eintragen.");});});
    });
  }
  function preview(rows) {
    dialog('<h2>Nussis Vorschläge</h2><p>Speichere die Ideen, die du behalten möchtest.</p><div class="stack">'+rows.map(r=>`<article class="card"><h3>${esc(r.content.title)}</h3>${details(r)}<button class="btn" data-keep="${r.id}">Zur Rezeptsammlung</button></article>`).join("")+'</div>',el=>{
      el.querySelectorAll("[data-keep]").forEach(b=>b.onclick=()=>busy(b,async()=>{
        await save("recipes",{is_saved:true},b.dataset.keep);await reload();
        b.textContent="Gespeichert";b.onclick=null;
      }));
    });
  }
  f.onsubmit=e=>{e.preventDefault();busy(f.querySelector('[type="submit"]'),async()=>{
    const error=root.querySelector("#kitchen-error");error.hidden=true;
    stopThinking=thinking(root.querySelector("#kitchen-thinking"),"Ich sammle passende Rezeptideen …");
    try {
      const response=await ai(mode,{wish:f.wish.value.trim(),note:f.note.value.trim(),servings:Number(f.servings.value)});
      const ids=(response.recipes||[]).map(r=>r.id);
      if(!ids.length)throw Error("Keine Rezeptvorschläge erhalten.");
      const client=await db();
      // Compatibility with the previous Edge Function: hide its newly inserted
      // rows before presenting them, until the updated function is deployed.
      await result(client.from("recipes").update({is_saved:false}).in("id",ids));
      const rows=await result(client.from("recipes").select("*").in("id",ids));
      await reload();preview(rows);
    } catch(e){error.textContent=e.message;error.hidden=false;}
    finally{stopThinking?.();stopThinking=null;}
  });};
  root.querySelector("#recipe-search").oninput=render;
  root.querySelector("#new-meal").onclick=()=>customEditor({},reload).catch(e=>toast(e.message));
  await reload();return()=>stopThinking?.();
}
