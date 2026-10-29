import { db, requireUser, result } from "../../core/supabase.js";
import { rpc, ai } from "../../core/data.js";
import { esc, dialog, closeDialog, busy, toast, fmt } from "../../core/ui.js";
import { meals, nutrients, labels, localDate, scaled, productNutrition, dateFromParts } from "../../core/nutrition.js";
export function logFood({product,lot,recipe,meal,nutrition,entry,date=localDate(),mealType="breakfast",after=()=>{}}={}) {
 const source=product||meal||recipe, unit=entry?.unit||product?.unit||"Portion";
 const d={name:entry?.name||product?.name||meal?.name||recipe?.content.title||"",amount:entry?.quantity||(product&&unit!=="Stück"?100:1),date:entry?.entry_date||date,meal:entry?.meal_type||mealType};
 let base=entry?scaled(entry,1/Number(entry.quantity)):product?productNutrition(product,1):nutrition||meal||{};
 let provenance=entry?.nutrition_source||product?.nutrition_source||meal?.nutrition_source||"calculated", step=0;
 const request=entry?.request_id||crypto.randomUUID();
 dialog('<div id="entry-wizard"></div>',el=>{
  const box=el.querySelector("#entry-wizard");
  function read(){
   const f=box.querySelector("form");if(!f.reportValidity())return false;
   if(step===0){d.name=f.elements.title.value.trim();d.amount=Number(f.amount.value);}
   if(step===1)d.meal=f.elements.meal.value;
   if(step===2){const value=dateFromParts(f.day.value,f.month.value,f.year.value);if(!value){toast("Bitte ein gültiges Datum eingeben.");return false;}d.date=value;}
   if(step===3&&!product){const reference=Number(f.reference.value);base=Object.fromEntries(nutrients.map(k=>[k,f.elements[k].value===""?null:Number(f.elements[k].value)/reference]));}
   return true;
  }
  async function submit(){
   const u=await requireUser(), totals=scaled(base,d.amount);
   const common={p_request_id:request,p_quantity:d.amount,p_entry_date:d.date,p_meal_type:d.meal};
   if(product&&!entry)await rpc("log_product_consumption",{...common,p_product_id:product.id,p_inventory_id:lot?.id||null});
   else if((recipe||meal)&&!entry)await rpc("log_dish_consumption",{...common,p_source_type:recipe?"recipe":"custom_meal",p_source_id:source.id,p_nutrition:totals});
   else {
    const values={user_id:u.id,request_id:request,entry_date:d.date,meal_type:d.meal,name:d.name,quantity:d.amount,unit,source_type:entry?.source_type||"manual",source_id:entry?.source_id||null,nutrition_source:provenance,...totals};
    const client=await db();await result(entry?client.from("food_entries").update(values).eq("id",entry.id):client.from("food_entries").upsert(values,{onConflict:"user_id,request_id"}));
   }
   closeDialog();toast("Im Tagebuch eingetragen.");await after();
  }
  function render(){
   const titles=["Was hast du gegessen?","Welche Mahlzeit?","An welchem Tag?","Deine Nährwerte","Alles richtig?"];
   let content="";
   if(step===0)content=`<label>Name<input name="title" maxlength="200" required value="${esc(d.name)}" ${source?"readonly":""}></label><label>Wie viel? (${esc(unit)})<input name="amount" type="number" inputmode="decimal" min="0.001" max="${lot?.quantity||10000000}" step="any" required value="${d.amount}"></label>`;
   if(step===1)content='<div class="wizard-choices">'+Object.entries(meals).map(([k,v])=>`<label><input type="radio" name="meal" value="${k}" ${d.meal===k?"checked":""}><span>${v}</span></label>`).join("")+'</div>';
   if(step===2){const [y,m,dn]=d.date.split("-");content=`<div class="birth-fields"><label>Tag<input name="day" inputmode="numeric" maxlength="2" value="${dn}" required></label><label>Monat<input name="month" inputmode="numeric" maxlength="2" value="${m}" required></label><label>Jahr<input name="year" inputmode="numeric" maxlength="4" value="${y}" required></label></div>`;}
   if(step===3){
    content=product?'<p>Die Nährwerte kommen aus deinem Produkt.</p>':`<label>Werte beziehen sich auf<input name="reference" type="number" min="0.001" step="any" value="1" required> ${esc(unit)}</label><div class="nutrition-fields">${nutrients.map(k=>`<label>${labels[k]} (${k==="kcal"?"kcal":"g"})<input name="${k}" type="number" inputmode="decimal" min="0" max="100000" step="any" value="${base[k]??""}"></label>`).join("")}</div><p class="help">Für Packungswerte 100 als Bezug eingeben. Deine gegessene Menge wird automatisch umgerechnet.</p><button type="button" class="btn secondary" id="estimate">Mit KI schätzen</button><p class="help">KI-Werte sind Schätzungen. Bei einer Portion den Namen möglichst genau beschreiben.</p>`;
   }
   if(step===4){const t=scaled(base,d.amount);content=`<p><strong>${esc(d.name)}</strong> · ${fmt(d.amount)} ${esc(unit)}</p><p>${meals[d.meal]} · ${esc(d.date)}</p><div class="wizard-targets">${nutrients.map(k=>`<div><small>${labels[k]}</small><strong>${t[k]==null?"Unbekannt":fmt(t[k])+" "+(k==="kcal"?"kcal":"g")}</strong></div>`).join("")}</div><p class="help">${entry?"Ändert nur den Tagebucheintrag, nicht bereits gebuchten Vorrat.":lot?"Diese Menge wird vom Vorrat abgezogen.":recipe||meal?"Nur die gewählten Portionen werden gebucht. Bereits beim Kochen abgezogene Zutaten werden nicht erneut abgezogen. Fehlende Zutaten blockieren die Buchung nicht.":"Dieser Eintrag verändert deinen Vorrat nicht."}</p>`;}
   box.innerHTML=`<p class="wizard-progress">Schritt ${step+1} von 5</p><h2>${titles[step]}</h2><form class="wizard-form">${content}<div class="wizard-actions"><button class="btn secondary" type="button" id="back" ${step===0?"disabled":""}>Zurück</button><button class="btn" type="submit">${step===4?"Eintragen":"Weiter"}</button></div></form>`;
   box.querySelector("#back").onclick=()=>{if(read()){step--;render();}};
   box.querySelector("form").onsubmit=e=>{e.preventDefault();if(!read())return;if(step===4)busy(e.submitter,submit);else{step++;render();}};
   box.querySelector("#estimate")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{
    if(!read())return;
    const estimate=await ai("nutrition",{name:d.name.slice(0,100),unit:unit==="Portion"?"Stück":unit});
    base=productNutrition({...estimate,unit:unit==="Portion"?"Stück":unit},1);provenance="ai";render();toast("KI-Schätzung eingetragen. Bitte prüfen.");
   }));
   el.scrollTop=0;
  }render();
 });
}
