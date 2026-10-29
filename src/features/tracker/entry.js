import { db, requireUser, result } from "../../core/supabase.js";
import { rpc, ai, save } from "../../core/data.js";
import { esc, dialog, closeDialog, busy, toast, fmt } from "../../core/ui.js";
import { meals, nutrients, labels, localDate, scaled, productNutrition, dateFromParts } from "../../core/nutrition.js";
import {referenceAmount,relativeDate,dateLabel,fromReference,toReference,missingNutrition} from "../../core/food-entry.js";
export function logFood({product,lot,recipe,meal,nutrition,entry,date=localDate(),mealType="breakfast",after=()=>{}}={}) {
 const source=product||meal||recipe;
 let unit=entry?.unit||product?.unit||(recipe||meal?"Portion":"g");
 const d={name:entry?.name||product?.name||meal?.name||recipe?.content.title||"",amount:entry?.quantity||Math.min(referenceAmount(unit),lot?.quantity||Infinity),date:entry?.entry_date||date,meal:entry?.meal_type||mealType};
 let base=entry?scaled(entry,1/Number(entry.quantity)):product?productNutrition(product,1):nutrition||meal||{};
 let provenance=entry?.nutrition_source||product?.nutrition_source||meal?.nutrition_source||"manual",step=0,dirty=false,customDate=false;
 const request=entry?.request_id||crypto.randomUUID();
 dialog('<div id="entry-wizard"></div>',el=>{
  const box=el.querySelector("#entry-wizard");
  function read(){
   const f=box.querySelector("form");if(!f.reportValidity())return false;
   if(step===0){d.name=f.elements.title.value.trim();d.amount=Number(f.amount.value);if(f.elements.unit)unit=f.elements.unit.value;}
   if(step===1)d.meal=f.elements.meal.value;
   if(step===2&&customDate){const value=dateFromParts(f.day.value,f.month.value,f.year.value);if(!value){toast("Bitte ein gültiges Datum eingeben.");return false;}d.date=value;}
   if(step===3){
    const values=Object.fromEntries(nutrients.map(k=>[k,f.elements[k].value===""?null:Number(f.elements[k].value)]));
    const next=fromReference(values,unit);
    if(nutrients.some(k=>next[k]!==base[k])){dirty=true;provenance="manual";}
    base=next;
   }
   return true;
  }
  async function submit(){
   const u=await requireUser(),totals=scaled(base,d.amount);
   if(product&&dirty&&!entry)await save("products",{...toReference(base,unit),nutrition_source:provenance},product.id);
   const common={p_request_id:request,p_quantity:d.amount,p_entry_date:d.date,p_meal_type:d.meal};
   if(product&&lot&&!entry)await rpc("log_product_consumption",{...common,p_product_id:product.id,p_inventory_id:lot.id});
   else if((recipe||meal)&&!entry)await rpc("log_dish_consumption",{...common,p_source_type:recipe?"recipe":"custom_meal",p_source_id:source.id,p_nutrition:totals});
   else {
    const values={user_id:u.id,request_id:request,entry_date:d.date,meal_type:d.meal,name:d.name,quantity:d.amount,unit,source_type:entry?.source_type||(product?"product":"manual"),source_id:entry?.source_id||product?.id||null,nutrition_source:provenance,...totals};
    const client=await db();await result(entry?client.from("food_entries").update(values).eq("id",entry.id):client.from("food_entries").upsert(values,{onConflict:"user_id,request_id"}));
   }
   closeDialog();toast("Im Tagebuch eingetragen.");await after();
  }
  function render(){
   const titles=["Was hast du gegessen?","Welche Mahlzeit?","An welchem Tag?","Deine Nährwerte","Alles richtig?"];
   let content="";
   if(step===0)content=`<label>Name<input name="title" maxlength="200" required value="${esc(d.name)}" ${source?"readonly":""}></label>${!source&&!entry?`<label>Einheit<select name="unit">${["g","ml","Stück","Portion"].map(u=>`<option ${u===unit?"selected":""}>${u}</option>`).join("")}</select></label>`:""}<label>Wie viel? (${esc(unit)})<input name="amount" type="number" inputmode="decimal" min="0.001" max="${lot?.quantity||10000000}" step="any" required value="${d.amount}"></label>`;
   if(step===1)content='<div class="wizard-choices">'+Object.entries(meals).map(([k,v])=>`<label><input type="radio" name="meal" value="${k}" ${d.meal===k?"checked":""}><span>${v}</span></label>`).join("")+'</div>';
   if(step===2){
    const [y,m,dn]=d.date.split("-");
    content=`<div class="wizard-choices">${[[0,"Heute"],[-1,"Gestern"],[-2,"Vorgestern"]].map(([offset,label])=>`<button type="button" class="btn ${!customDate&&d.date===relativeDate(offset)?"":"secondary"}" data-day="${offset}" aria-pressed="${!customDate&&d.date===relativeDate(offset)}">${label}</button>`).join("")}<button type="button" class="btn secondary" id="other-day">Anderen Tag wählen</button></div>${customDate?`<div class="birth-fields"><label>Tag<input name="day" inputmode="numeric" maxlength="2" value="${dn}" required></label><label>Monat<input name="month" inputmode="numeric" maxlength="2" value="${m}" required></label><label>Jahr<input name="year" inputmode="numeric" maxlength="4" value="${y}" required></label></div>`:`<p>${dateLabel(d.date)}</p>`}`;
   }
   if(step===3){
    const values=toReference(base,unit);
    content=`<p><strong>Pro ${referenceAmount(unit)} ${esc(unit)}</strong>${["g","ml"].includes(unit)?" · wie auf der Verpackung":""}</p><p class="help">${product&&missingNutrition(base)?"Für dieses Produkt fehlen noch Nährwerte. Ergänze sie von der Packung oder lass sie schätzen.":product?"Gespeicherte Produktwerte. Du kannst sie hier korrigieren.":"Deine verzehrte Menge wird automatisch umgerechnet."}</p><div class="nutrition-fields">${nutrients.map(k=>`<label>${labels[k]} (${k==="kcal"?"kcal":"g"})<input name="${k}" type="number" inputmode="decimal" min="0" max="${k==="kcal"?10000:1000}" step="any" value="${values[k]??""}" placeholder="Noch unbekannt"></label>`).join("")}</div><p class="help">Gegessen: ${fmt(d.amount)} ${esc(unit)}. ${product?"Ergänzungen werden auch im Produkt gespeichert.":""}</p><button type="button" class="btn secondary" id="estimate">Mit KI schätzen</button><p class="help">Der Name wird an die KI gesendet. Schätzwerte bitte prüfen.</p>`;
   }
   if(step===4){const t=scaled(base,d.amount);content=`<p><strong>${esc(d.name)}</strong> · ${fmt(d.amount)} ${esc(unit)}</p><p>${meals[d.meal]} · ${dateLabel(d.date)}</p><div class="wizard-targets">${nutrients.map(k=>`<div><small>${labels[k]}</small><strong>${t[k]==null?"Unbekannt":fmt(t[k])+" "+(k==="kcal"?"kcal":"g")}</strong></div>`).join("")}</div>${missingNutrition(t)?'<label class="check"><input type="checkbox" required><span>Mit unvollständigen Nährwerten eintragen. Fehlende Werte zählen nicht zu den Tagessummen.</span></label>':""}<p class="help">${entry?"Ändert nur den Tagebucheintrag.":lot?"Diese Menge wird vom Vorrat abgezogen.":recipe||meal?"Nur diese Portionen werden gebucht. Bereits beim Kochen abgezogene Zutaten werden nicht doppelt abgezogen.":"Dieser Eintrag verändert deinen Vorrat nicht."}</p>`;}
   box.innerHTML=`<p class="wizard-progress">Schritt ${step+1} von 5</p><h2>${titles[step]}</h2><form class="wizard-form">${content}<div class="wizard-actions"><button class="btn secondary" type="button" id="back" ${step===0?"disabled":""}>Zurück</button><button class="btn" type="submit">${step===4?"Eintragen":"Weiter"}</button></div></form>`;
   box.querySelector("#back").onclick=()=>{if(step===4||read()){step--;render();}};
   box.querySelector("form").onsubmit=e=>{e.preventDefault();try{if(!read())return;if(step===4)busy(e.submitter,submit);else{step++;render();}}catch(error){toast(error.message);}};
   box.querySelector('[name="unit"]')?.addEventListener("change",e=>{
    d.name=box.querySelector('[name="title"]').value;unit=e.target.value;d.amount=referenceAmount(unit);base={};dirty=false;render();
   });
   box.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{d.date=relativeDate(Number(b.dataset.day));customDate=false;render();});
   box.querySelector("#other-day")?.addEventListener("click",()=>{customDate=true;render();});
   box.querySelector("#estimate")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{
    if(!read())return;
    const estimate=await ai("nutrition",{name:d.name.slice(0,100),unit:unit==="Portion"?"Stück":unit});
    base=fromReference(estimate,unit);provenance="ai";dirty=true;render();toast("KI-Schätzung eingetragen. Bitte prüfen.");
   }));
   el.scrollTop=0;
  }render();
 });
}
