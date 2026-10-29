import { db, requireUser, result } from "../../core/supabase.js";
import { rpc } from "../../core/data.js";
import { esc, dialog, closeDialog, busy, toast } from "../../core/ui.js";
import { meals, nutrients, labels, localDate, scaled, productNutrition } from "../../core/nutrition.js";
export function logFood({ product, lot, recipe, meal, nutrition, entry, date = localDate(), mealType = "breakfast", after = () => {} } = {}) {
  const source = product || meal || recipe;
  const title = entry?.name || product?.name || meal?.name || recipe?.content.title || "";
  const base = nutrition || meal || {};
  const unit = entry?.unit || product?.unit || "Portion";
  const request = entry?.request_id || crypto.randomUUID();
  dialog(`<h2>${entry ? "Eintrag bearbeiten" : "Gegessen"}</h2><form class="stack" id="food-form">
    <label>Name<input name="title" maxlength="200" required value="${esc(title)}" ${source ? "readonly" : ""}></label>
    <div class="form-grid"><label>Datum<input type="date" name="date" value="${esc(entry?.entry_date || date)}" required></label>
    <label>Mahlzeit<select name="meal">${Object.entries(meals).map(([k,v]) => `<option value="${k}" ${k===(entry?.meal_type || mealType) ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
    <label>Menge (${esc(unit)})<input name="amount" type="number" min="0.001" max="${lot?.quantity || 10000000}" step="any" value="${entry?.quantity || (product && unit !== "Stück" ? 100 : 1)}" required></label>
    <p class="help">Nährwerte für die eingetragene Menge. Leere Werte bleiben unbekannt.</p>
    <div class="form-grid">${nutrients.map(k => `<label>${labels[k]} (${k==="kcal"?"kcal":"g"})<input name="${k}" type="number" min="0" max="${k==="kcal"?1000000:100000}" step="any" value="${entry?.[k] ?? ""}" ${product ? "readonly" : ""}></label>`).join("")}</div>
    ${lot ? '<p class="help">Diese Menge wird gleichzeitig aus deinem Vorrat abgezogen.</p>' : '<p class="help">Dieser Eintrag verändert deinen Vorrat nicht.</p>'}
    <button class="btn" type="submit">Eintragen</button></form>`, el => {
    const f=el.querySelector("form");
    const update=()=> { const amount=Number(f.amount.value); if (!(amount>0)) return;
      const values=product ? productNutrition(product,amount) : scaled(base,amount);
      for(const k of nutrients) f.elements[k].value=values[k] ?? "";
    };
    if(source && !entry) { update(); f.amount.oninput=update; }
    if(entry) f.amount.oninput=()=>{const amount=Number(f.amount.value);if(amount>0){const values=scaled(entry,amount/Number(entry.quantity));for(const k of nutrients)f.elements[k].value=values[k]??"";}};
    f.onsubmit=e=>{e.preventDefault();busy(f.querySelector('[type="submit"]'),async()=>{
      const u=await requireUser();
      const amount=Number(f.amount.value);
      if(product && !entry) await rpc("log_product_consumption",{
        p_request_id:request,p_product_id:product.id,p_quantity:amount,
        p_entry_date:f.date.value,p_meal_type:f.meal.value,p_inventory_id:lot?.id || null
      });
      else {
        const values={user_id:u.id,request_id:request,entry_date:f.date.value,meal_type:f.meal.value,
          name:f.elements.namedItem("title").value.trim(),quantity:amount,unit,source_type:entry?.source_type || (recipe?"recipe":meal?"custom_meal":"manual"),
          source_id:entry?.source_id || source?.id || null,nutrition_source:entry?.nutrition_source || (recipe?"calculated":meal?.nutrition_source || "manual")};
        for(const k of nutrients) values[k]=f.elements[k].value===""?null:Number(f.elements[k].value);
        const client=await db();
        await result(entry ? client.from("food_entries").update(values).eq("id",entry.id) : client.from("food_entries").upsert(values,{onConflict:"user_id,request_id"}));
      }
      closeDialog();toast("Im Tagebuch eingetragen.");await after();
    });};
  });
}
