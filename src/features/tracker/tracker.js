import { db, result } from "../../core/supabase.js";
import { list, remove } from "../../core/data.js";
import { esc, fmt, dialog, closeDialog, busy, toast } from "../../core/ui.js";
import { nutrients, labels, meals, localDate, dateFromParts, dailyTotals, recipeNutrition } from "../../core/nutrition.js";
import { customEditor } from "../kitchen/custom.js";
import { logFood } from "./entry.js";
export async function mount(root) {
  const day=root.querySelector("#entry-day");day.value=localDate();
  const profile=(await list("nutrition_profiles"))[0] || {};
  root.querySelector("#tracker-greeting").textContent=profile.display_name ? "Dein Überblick, "+profile.display_name+"." : "Dein Essen im Überblick.";
  let entries=[],version=0;
  async function reload() {
    root.querySelector("#selected-day").textContent=new Intl.DateTimeFormat("de-DE",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(day.value+"T12:00:00"));
    const v=++version;
    const rows=await result((await db()).from("food_entries").select("*").eq("entry_date",day.value).order("created_at"));
    if(v!==version)return;entries=rows;
    const totals=dailyTotals(entries);
    root.querySelector("#tracker-summary").innerHTML=nutrients.map(k=>{
      const target=profile[k==="kcal"?"kcal_target":k+"_target_g"];
      return `<section class="card"><small>${labels[k]}</small><h2>${fmt(totals[k].value)}${target ? " / "+fmt(target) : ""} <small>${k==="kcal"?"kcal":"g"}</small></h2>${target?`<progress max="${target}" value="${Math.min(target,totals[k].value)}" aria-label="${labels[k]}"></progress>`:""}${totals[k].incomplete?'<small>Nicht vollständig · Nährwerte fehlen</small>':""}</section>`;
    }).join("");
    root.querySelector("#tracker-meals").innerHTML=Object.entries(meals).map(([key,label])=>{
      const rows=entries.filter(e=>e.meal_type===key);
      return `<section class="card"><div class="card-top"><h2>${label}</h2><button class="icon-button" data-add="${key}" aria-label="Zu ${label} hinzufügen">+</button></div>${rows.length?rows.map(e=>`<div class="food-row"><button class="text-link" data-edit="${e.id}">${esc(e.name)}<small>${fmt(e.quantity)} ${esc(e.unit)} · ${e.kcal==null?"—":fmt(e.kcal)} kcal</small></button><button class="icon-button" data-delete="${e.id}" aria-label="${esc(e.name)} entfernen">×</button></div>`).join(""):'<p class="help">Noch nichts eingetragen</p>'}</section>`;
    }).join("");
    root.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>pick(b.dataset.add).catch(e=>toast(e.message)));
    root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>logFood({entry:entries.find(e=>e.id===b.dataset.edit),after:reload}));
    root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>dialog('<h2>Eintrag entfernen?</h2><p>Dein Vorrat bleibt unverändert.</p><button class="btn danger" id="confirm-delete">Entfernen</button>',el=>{
      el.querySelector("#confirm-delete").onclick=e=>busy(e.currentTarget,async()=>{await remove("food_entries",b.dataset.delete);closeDialog();await reload();});
    }));
  }
  async function pick(mealType) {
    const [products,custom,recipes]=await Promise.all([list("products"),list("custom_meals"),list("recipes")]);
    const options=[...products.map(p=>({name:p.name,kind:"Produkt",args:{product:p}})),...custom.map(m=>({name:m.name,kind:"Eigenes Gericht",args:{meal:m}})),...recipes.filter(r=>r.is_saved!==false).map(r=>({name:r.content.title,kind:"Rezept",args:{recipe:r,nutrition:recipeNutrition(r,products)}}))];
    dialog('<h2>Essen hinzufügen</h2><input id="food-search" type="search" placeholder="Produkt oder Gericht suchen" aria-label="Essen suchen"><button class="btn" id="create-dish">+ Eigenes Gericht erstellen</button><button class="btn secondary" id="manual-food">Manuell eintragen</button><div class="stack" id="food-options"></div>',el=>{
      const render=()=>{const q=el.querySelector("#food-search").value.toLocaleLowerCase("de");
        el.querySelector("#food-options").innerHTML=options.map((o,i)=>({...o,i})).filter(o=>o.name.toLocaleLowerCase("de").includes(q)).map(o=>`<button class="food-choice" data-choice="${o.i}">${esc(o.name)}<small>${o.kind}</small></button>`).join("") || '<p>Kein Treffer.</p>';
        el.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{closeDialog();logFood({...options[Number(b.dataset.choice)].args,date:day.value,mealType,after:reload});});
      };
      el.querySelector("#create-dish").onclick=()=>{closeDialog();customEditor({},()=>pick(mealType)).catch(e=>toast(e.message));};
      el.querySelector("#food-search").oninput=render;
      el.querySelector("#manual-food").onclick=()=>{closeDialog();logFood({date:day.value,mealType,after:reload});};render();
    });
  }
  const change=n=>{const d=new Date(day.value+"T12:00:00");d.setDate(d.getDate()+n);day.value=localDate(d);reload().catch(e=>toast(e.message));};
  root.querySelector("#previous-day").onclick=()=>change(-1);root.querySelector("#next-day").onclick=()=>change(1);
  root.querySelector("#today").onclick=()=>{day.value=localDate();reload().catch(e=>toast(e.message));};
  root.querySelector("#selected-day").onclick=()=>{
    const [y,m,d]=day.value.split("-");
    dialog('<h2>Tag auswählen</h2><form class="stack"><div class="birth-fields"><label>Tag<input name="d" inputmode="numeric" maxlength="2" value="'+d+'" required></label><label>Monat<input name="m" inputmode="numeric" maxlength="2" value="'+m+'" required></label><label>Jahr<input name="y" inputmode="numeric" maxlength="4" value="'+y+'" required></label></div><p id="date-error" role="alert"></p><button class="btn" type="submit">Anzeigen</button></form>',el=>{
      const f=el.querySelector("form");f.onsubmit=e=>{e.preventDefault();const selected=dateFromParts(f.d.value,f.m.value,f.y.value);if(!selected){el.querySelector("#date-error").textContent="Bitte ein gültiges Datum eingeben.";return;}day.value=selected;closeDialog();reload().catch(e=>toast(e.message));};
    });
  };
  day.onchange=()=>{if(day.value)reload().catch(e=>toast(e.message));};await reload();
}
