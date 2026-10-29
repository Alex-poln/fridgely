import { list, save, ai } from "../../core/data.js";
import { esc, dialog, closeDialog, busy, toast, fmt } from "../../core/ui.js";
import { nutrients, labels, ingredientTotals } from "../../core/nutrition.js";
export async function customEditor(meal={},after=()=>{}) {
 const products=await list("products");
 const d={name:meal.name||"",servings:meal.servings||1,steps:meal.steps||"",ingredients:structuredClone(meal.ingredients||[])};
 for(const i of d.ingredients) if(!i.nutrition){const p=products.find(p=>p.id===i.product_id);i.nutrition=Object.fromEntries(nutrients.map(k=>[k,p?.[k]??null]));}
 let step=0, editing=null, draft={}, estimated=meal.nutrition_source==="ai";
 dialog('<div id="dish-wizard"></div>',el=>{
  const box=el.querySelector("#dish-wizard");
  function render(){
   if(editing!==null){renderIngredient();return;}
   let content="";
   if(step===0)content=`<label>Wie heißt dein Gericht?<input name="title" maxlength="150" required value="${esc(d.name)}" placeholder="Haferflocken mit Milch"></label>`;
   if(step===1)content=`<label>Wie viele Portionen ergibt es?<input name="servings" type="number" min="0.01" max="1000" step="any" required value="${d.servings}"></label>`;
   if(step===2)content=`<div class="stack">${d.ingredients.map((i,n)=>`<div class="dish-row"><span>${esc(i.name)} · ${fmt(i.quantity)} ${esc(i.unit)}</span><button type="button" class="text-link" data-edit="${n}">Ändern</button><button type="button" class="icon-button" data-remove="${n}" aria-label="Zutat entfernen">×</button></div>`).join("")}</div><button type="button" class="btn secondary" id="add">Zutat hinzufügen</button>`;
   if(step===3){const t=ingredientTotals(d.ingredients,d.servings);content=`<p>Nährwerte pro Portion · ${fmt(d.servings)} Portionen insgesamt</p><div class="wizard-targets">${nutrients.map(k=>`<div><small>${labels[k]}</small><strong>${t[k]==null?"Unbekannt":fmt(t[k])+" "+(k==="kcal"?"kcal":"g")}</strong></div>`).join("")}</div><button class="btn secondary" type="button" id="estimate">Fehlende Nährwerte mit KI schätzen</button><p class="help">Eine Anfrage je unvollständiger Zutat. Vorhandene Werte bleiben erhalten. Mengen werden anschließend exakt zusammengerechnet. ${estimated?"Enthält KI-Schätzungen.":""}</p><label>Zubereitung (optional)<textarea name="steps" maxlength="20000">${esc(d.steps)}</textarea></label>`;}
   box.innerHTML=`<p class="wizard-progress">Eigenes Gericht · ${step+1} / 4</p><h2>${["Dein Gericht","Portionen","Deine Zutaten","Dein Überblick"][step]}</h2><form class="wizard-form">${content}<div class="wizard-actions"><button class="btn secondary" id="back" type="button" ${step===0?"disabled":""}>Zurück</button><button class="btn" type="submit">${step===3?"Gericht speichern":"Weiter"}</button></div></form>`;
   const read=()=>{const f=box.querySelector("form");if(!f.reportValidity())return false;if(step===0)d.name=f.elements.title.value.trim();if(step===1)d.servings=Number(f.servings.value);if(step===3)d.steps=f.steps.value;return true;};
   box.querySelector("#back").onclick=()=>{if(read()){step--;render();}};
   box.querySelector("#add")?.addEventListener("click",()=>{if(d.ingredients.length>=30){toast("Maximal 30 Zutaten.");return;}editing=d.ingredients.length;draft={name:"",quantity:100,unit:"g",nutrition:{}};render();});
   box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{editing=Number(b.dataset.edit);draft=structuredClone(d.ingredients[editing]);render();});
   box.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{d.ingredients.splice(Number(b.dataset.remove),1);render();});
   box.querySelector("#estimate")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{
    read();
    for(const i of d.ingredients){
     if(nutrients.every(k=>i.nutrition?.[k]!=null))continue;
     const answer=await ai("nutrition",{name:i.name,unit:i.unit});
     i.nutrition ||= {};
     for(const k of nutrients)if(i.nutrition[k]==null)i.nutrition[k]=answer[k]??null;
     estimated=true;
    }
    render();toast("Nährwerte berechnet. KI-Schätzungen bitte prüfen.");
   }));
   box.querySelector("form").onsubmit=e=>{e.preventDefault();if(!read())return;if(step===2&&!d.ingredients.length){toast("Bitte mindestens eine Zutat hinzufügen.");return;}if(step<3){step++;render();return;}busy(e.submitter,async()=>{
    await save("custom_meals",{...d,...ingredientTotals(d.ingredients,d.servings),nutrition_source:estimated?"ai":"calculated"},meal.id);closeDialog();await after();
   });};
   el.scrollTop=0;
  }
  function renderIngredient(){
   box.innerHTML=`<h2>Zutat hinzufügen</h2><form class="wizard-form"><label>Aus deinen Produkten (optional)<select name="product"><option value="">Selbst eingeben</option>${products.map(p=>`<option value="${p.id}" ${draft.product_id===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><label>Zutat<input name="title" maxlength="100" required value="${esc(draft.name)}" placeholder="Paprika"></label><div class="nutrition-fields"><label>Menge<input name="quantity" type="number" min="0.001" max="10000000" step="any" required value="${draft.quantity}"></label><label>Einheit<select name="unit">${["g","ml","Stück"].map(u=>`<option ${u===draft.unit?"selected":""}>${u}</option>`).join("")}</select></label></div><details><summary>Nährwerte selbst eingeben</summary><p class="help">Pro 100 g / 100 ml, bei Stück pro Stück.</p><div class="nutrition-fields">${nutrients.map(k=>`<label>${labels[k]}<input name="${k}" type="number" min="0" max="100000" step="any" value="${draft.nutrition?.[k]??""}"></label>`).join("")}</div></details><div class="wizard-actions"><button type="button" class="btn secondary" id="cancel">Zurück</button><button class="btn" type="submit">Zutat übernehmen</button></div></form>`;
   const f=box.querySelector("form");
   f.product.onchange=()=>{const p=products.find(p=>p.id===f.product.value);if(p){draft={product_id:p.id,name:p.name,quantity:Number(f.quantity.value)||100,unit:p.unit,nutrition:Object.fromEntries(nutrients.map(k=>[k,p[k]??null]))};renderIngredient();}else{draft.product_id=null;}};
   box.querySelector("#cancel").onclick=()=>{editing=null;render();};
   f.onsubmit=e=>{e.preventDefault();d.ingredients[editing]={product_id:f.product.value||null,name:f.elements.title.value.trim(),quantity:Number(f.quantity.value),unit:f.unit.value,nutrition:Object.fromEntries(nutrients.map(k=>[k,f.elements[k].value===""?null:Number(f.elements[k].value)]))};editing=null;render();};
  }
  render();
 });
}
