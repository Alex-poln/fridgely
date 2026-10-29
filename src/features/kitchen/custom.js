import { list, save } from "../../core/data.js";
import { esc, dialog, closeDialog, busy, toast } from "../../core/ui.js";
import { nutrients, labels, productNutrition } from "../../core/nutrition.js";
export async function customEditor(meal={},after=()=>{}) {
  const products=await list("products");
  dialog(`<h2>${meal.id?"Gericht bearbeiten":"Eigenes Gericht"}</h2><form class="stack">
    <label>Name<input name="title" maxlength="150" required value="${esc(meal.name)}" placeholder="Haferflocken mit Milch"></label>
    <label>Portionen im gesamten Gericht<input name="servings" type="number" min="0.01" max="1000" step="any" required value="${meal.servings||1}"></label>
    <div class="stack" id="custom-ingredients"></div><button type="button" class="btn secondary" id="add-ingredient">Zutat hinzufügen</button>
    <button type="button" class="text-link" id="calculate-meal">Nährwerte aus Zutaten berechnen</button><p class="help">Nährwerte pro Portion. Alternativ selbst eintragen. Unbekannte Werte bleiben leer.</p>
    <div class="form-grid">${nutrients.map(k=>`<label>${labels[k]} (${k==="kcal"?"kcal":"g"})<input name="${k}" type="number" min="0" max="${k==="kcal"?100000:10000}" step="any" value="${meal[k]??""}"></label>`).join("")}</div>
    <label>Zubereitung (optional)<textarea name="steps" maxlength="20000">${esc(meal.steps)}</textarea></label>
    <button type="submit" class="btn">Gericht speichern</button></form>`,el=>{
    const f=el.querySelector("form"),rows=el.querySelector("#custom-ingredients");
    const add=(i={})=>{const row=document.createElement("div");row.className="ingredient-editor";
      row.innerHTML=`<label>Zutat<select required>${products.map(p=>`<option value="${p.id}" ${i.product_id===p.id?"selected":""}>${esc(p.name)} (${esc(p.unit)})</option>`).join("")}</select></label><label>Menge<input type="number" min="0.001" max="10000000" step="any" required value="${i.quantity||100}"></label><button type="button" class="icon-button" aria-label="Zutat entfernen">×</button>`;
      row.querySelector("button").onclick=()=>row.remove();rows.append(row);};
    (meal.ingredients||[]).forEach(add);
    el.querySelector("#add-ingredient").onclick=()=>{if(!products.length){toast("Lege zuerst Produkte an oder trage Nährwerte direkt ein.");return;}if(rows.children.length<100)add();};
    const ingredients=()=>[...rows.children].map(row=>{const p=products.find(p=>p.id===row.querySelector("select").value);if(!p)throw Error("Bitte ein vorhandenes Produkt wählen.");return {product_id:p.id,name:p.name,unit:p.unit,quantity:Number(row.querySelector("input").value)};});
    el.querySelector("#calculate-meal").onclick=()=>{if(!f.reportValidity())return;const items=ingredients();if(!items.length){toast("Füge zuerst Zutaten hinzu.");return;}
      const data=items.map(i=>productNutrition(products.find(p=>p.id===i.product_id),i.quantity));
      for(const k of nutrients)f.elements[k].value=data.some(p=>p[k]==null)?"":data.reduce((s,p)=>s+p[k],0)/Number(f.servings.value);
    };
    f.onsubmit=e=>{e.preventDefault();busy(f.querySelector('[type="submit"]'),async()=>{
      const values={name:f.elements.namedItem("title").value.trim(),servings:Number(f.servings.value),ingredients:ingredients(),steps:f.steps.value,nutrition_source:"manual"};
      for(const k of nutrients)values[k]=f.elements[k].value===""?null:Number(f.elements[k].value);
      await save("custom_meals",values,meal.id);closeDialog();await after();
    });};
  });
}
