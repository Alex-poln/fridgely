import { list, save } from "../../core/data.js";
import { db } from "../../core/supabase.js";
import { esc, dialog, closeDialog, busy, toast, fmt } from "../../core/ui.js";
import { estimateNeeds, localDate, ageOn, defaultProtein, macroTargets, dateFromParts } from "../../core/nutrition.js";
import { nussi } from "../../core/nussi.js";
const fields=[["kcal_target","Kalorien","kcal",10000],["protein_target_g","Eiweiß","g",500],["carbs_target_g","Kohlenhydrate","g",1500],["fat_target_g","Fett","g",500]];
export async function profileEditor(onboarding=false) {
 const [profiles,goals]=await Promise.all([list("nutrition_profiles"),list("goals")]);
 const p=profiles[0]||{},draft={...p};let step=0;
 const factor=()=>draft.protein_per_kg??defaultProtein(goals[0]?.goal,ageOn(draft.birth_date));
 const input=(name,label,min,max)=>`<label>${label}<input name="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="0.1" value="${draft[name]??""}"></label>`;
 const choices=(name,options)=>'<div class="wizard-choices">'+options.map(([v,l])=>`<label><input type="radio" name="${name}" value="${v}" ${String(draft[name]??"")===String(v)?"checked":""}><span>${l}</span></label>`).join("")+'</div>';
 const questions=[
  ["Wie darf ich dich nennen?",()=>`<label>Dein Name<input name="display_name" maxlength="80" autocomplete="given-name" value="${esc(draft.display_name)}"></label>`],
  ["Wann hast du Geburtstag?",()=>{const [y,m,d]=(draft.birth_date||"").split("-");return `<div class="birth-fields"><label>Tag<input name="day" inputmode="numeric" maxlength="2" value="${d||""}" placeholder="TT"></label><label>Monat<input name="month" inputmode="numeric" maxlength="2" value="${m||""}" placeholder="MM"></label><label>Jahr<input name="year" inputmode="numeric" maxlength="4" value="${y||""}" placeholder="JJJJ"></label></div>`;}],
  ["Dein Geschlecht?",()=>choices("formula_sex",[["female","Weiblich"],["male","Männlich"],["","Keine Angabe"]])+'<p class="help">Die Schätzformel unterscheidet weiblich und männlich. Ohne Angabe kannst du Ziele selbst festlegen.</p>'],
  ["Wie groß bist du?",()=>input("height_cm","Größe in cm",50,250)],
  ["Wie viel wiegst du?",()=>input("weight_kg","Gewicht in kg",10,500)],
  ["Wie aktiv ist dein Alltag?",()=>choices("activity_factor",[[1.2,"Wenig Bewegung"],[1.4,"Etwas Bewegung"],[1.6,"Aktiv / regelmäßiger Sport"],[1.8,"Sehr aktiv"],[2,"Körperlich anstrengender Alltag"]])]
 ];
 return new Promise(resolve=>dialog('<div id="profile-wizard"></div>',el=>{
  el.classList.add("profile-dialog");const box=el.querySelector("#profile-wizard");
  const proposal=()=>{const estimate=estimateNeeds({...draft,protein_per_kg:factor()});return estimate&&macroTargets(Number(p.kcal_target)||estimate.kcal,Number(p.protein_target_g)||estimate.protein);};
  async function finish(useTargets) {
   const values={display_name:draft.display_name||"",birth_date:draft.birth_date||null,formula_sex:draft.formula_sex||null,height_cm:draft.height_cm??null,weight_kg:draft.weight_kg??null,activity_factor:draft.activity_factor??null,protein_per_kg:p.protein_per_kg??null,onboarding_completed_at:p.onboarding_completed_at||new Date().toISOString()};
   if(useTargets){const t=proposal();if(!t)throw Error("Für eine Berechnung fehlen gültige Angaben.");Object.assign(values,{kcal_target:t.kcal,protein_target_g:t.protein,carbs_target_g:t.carbs,fat_target_g:t.fat});}
   await save("nutrition_profiles",values,p.id);
   const {error}=await (await db()).auth.updateUser({data:{display_name:values.display_name}});
   if(error)toast("Profil gespeichert. Name wird beim nächsten Login aktualisiert.");
   closeDialog();
  }
  function read(){
   const f=box.querySelector("form");if(!f.reportValidity())return false;
   if(step===0)draft.display_name=f.elements.display_name.value.trim();
   if(step===1){const {day,month,year}=f.elements;if(day.value||month.value||year.value){const date=dateFromParts(day.value,month.value,year.value);if(!date||date>localDate()){box.querySelector("#wizard-error").textContent="Bitte ein gültiges Geburtsdatum eingeben.";return false;}draft.birth_date=date;}else draft.birth_date=null;}
   if(step===2)draft.formula_sex=f.elements.formula_sex.value||null;
   if(step>=3){const key=["height_cm","weight_kg","activity_factor"][step-3];draft[key]=f.elements[key].value?Number(f.elements[key].value):null;}
   return true;
  }
  function render(){
   if(step===questions.length){
    const t=proposal();
    box.innerHTML=`<p class="wizard-progress">Dein Überblick</p>${nussi("Alles klar"+(draft.display_name?", "+draft.display_name:"")+"!")}<h2>Deine Tagesziele</h2>${t?`<div class="wizard-targets">${[["kcal","Kalorien","kcal"],["protein","Eiweiß","g"],["carbs","Kohlenhydrate","g"],["fat","Fett","g"]].map(([k,l,u])=>`<div><small>${l}</small><strong>${fmt(t[k])} ${u}</strong></div>`).join("")}</div><p class="help">Eiweiß-Startwert: ${fmt(factor())} g/kg. Fett: 30 % der Kalorien. Kohlenhydrate: verbleibende Energie. Bestehende Kalorien- und Eiweißziele bleiben erhalten; Fett und Kohlenhydrate werden neu vorgeschlagen.</p>`:'<p>Für eine Schätzung fehlen Angaben oder dein Alter liegt außerhalb des vorgesehenen Bereichs. Du kannst dein Profil trotzdem speichern.</p>'}<details><summary>Zur Berechnung</summary><p class="help">Schätzung des Erhaltungsbedarfs für Erwachsene, kein automatisches Abnehmziel. Nicht für Schwangerschaft, Stillzeit oder medizinische Besonderheiten. Änderbar unter Einstellungen.</p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/">Kalorienformel</a> · <a href="https://www.dge.de/wissenschaft/referenzwerte/protein/">Eiweiß</a> · <a href="https://doi.org/10.2903/j.efsa.2010.1461">Fett</a></details><div class="wizard-actions"><button class="btn secondary" id="back">Zurück</button><button class="btn" id="save-profile">${t?"Ziele übernehmen":"Profil speichern"}</button></div>${t?'<button class="text-link" id="keep-targets">Nur Profil speichern</button>':""}`;
    box.querySelector("#back").onclick=()=>{step--;render();};
    box.querySelector("#save-profile").onclick=e=>busy(e.currentTarget,()=>finish(Boolean(t)));
    box.querySelector("#keep-targets")?.addEventListener("click",e=>busy(e.currentTarget,()=>finish(false)));
   }else{
    box.innerHTML=`<p class="wizard-progress">Schritt ${step+1} von ${questions.length}</p>${nussi(step===0&&onboarding?"Hey, ich bin Nussi. Wir richten dein Profil gemeinsam ein.":"Eine Frage nach der anderen. Du kannst Angaben später ergänzen.")}<h2>${questions[step][0]}</h2><form class="wizard-form">${questions[step][1]()}<p id="wizard-error" role="alert"></p><div class="wizard-actions"><button type="button" class="btn secondary" id="back" ${step===0?"disabled":""}>Zurück</button><button class="btn" type="submit">Weiter</button></div><button type="button" class="text-link" id="skip">Später ergänzen</button></form>`;
    box.querySelector("form").onsubmit=e=>{e.preventDefault();if(read()){step++;render();}};
    box.querySelector("#back").onclick=()=>{if(read()){step--;render();}};
    box.querySelector("#skip").onclick=e=>busy(e.currentTarget,()=>finish(false));
   }
   el.scrollTop=0;
  }
  el.addEventListener("close",()=>{el.classList.remove("profile-dialog");resolve();},{once:true});render();
 }));
}
export async function nutritionSettings(){
 const [profiles,goals]=await Promise.all([list("nutrition_profiles"),list("goals")]);
 const p=profiles[0]||{},factor=p.protein_per_kg??defaultProtein(goals[0]?.goal,ageOn(p.birth_date));
 dialog(`<h2>Ernährungsziele</h2><form class="stack"><label>Eiweiß pro kg Körpergewicht<input name="factor" type="number" min="0.5" max="3" step="0.1" value="${factor}" required></label><p class="help">Startwert: 1,6 bei Muskelaufbau, sonst 0,8 (ab 65 Jahren 1,0). Individuell anpassbar.</p>${fields.map(([k,l,u,max])=>`<label>${l} (${u})<input type="number" name="${k}" min="${k==="kcal_target"||k==="protein_target_g"?0.1:0}" max="${max}" step="0.1" value="${p[k]??""}"></label>`).join("")}<button type="button" class="btn secondary" id="calculate">Makros neu berechnen</button><p id="macro-feedback" class="help" role="status"></p><button class="btn" type="submit">Speichern</button></form>`,el=>{
  const f=el.querySelector("form");el.querySelector("#calculate").onclick=()=>{
   const t=macroTargets(Number(f.kcal_target.value),Number(p.weight_kg)*Number(f.factor.value));
   if(!t){el.querySelector("#macro-feedback").textContent="Bitte ein passendes Kalorienziel und ein Gewicht im Profil hinterlegen.";return;}
   f.protein_target_g.value=t.protein;f.carbs_target_g.value=t.carbs;f.fat_target_g.value=t.fat;el.querySelector("#macro-feedback").textContent="Vorschlag eingetragen. Speichern übernimmt die Werte.";
  };
  f.onsubmit=e=>{e.preventDefault();busy(f.querySelector('[type="submit"]'),async()=>{await save("nutrition_profiles",{protein_per_kg:Number(f.factor.value),...Object.fromEntries(fields.map(([k])=>[k,f.elements[k].value===""?null:Number(f.elements[k].value)]))},p.id);closeDialog();toast("Ernährungsziele gespeichert.");});};
 });
}
export async function firstProfile(){const p=(await list("nutrition_profiles"))[0];if(!p?.onboarding_completed_at)await profileEditor(true);}
