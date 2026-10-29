import { goalTargets, targetColumns } from "../../core/nutrition.js";
import { persistGoal } from "../../core/goal-change.js";
import { profileEditor } from "./profile.js";
import { esc, fmt, icon, toast, busy, setupNotice } from "../../core/ui.js";
import { list, save } from "../../core/data.js";
import { configured } from "../../core/supabase.js";
const options=[["balanced","spa","Ausgewogen essen"],["lose","trending_down","Abnehmen"],["gain","trending_up","Zunehmen"],["muscle","fitness_center","Muskeln aufbauen"]];
export async function mount(root) {
 root.querySelector("#notice").innerHTML=setupNotice(configured);
 let current={},profile={},pending=false;
 const f=root.querySelector("#goals-form"),status=root.querySelector("#goal-status");
 function summary(p=profile,goal=current.goal||"balanced"){
  const manual=p.protein_per_kg!=null;
  root.querySelector("#profile-summary").innerHTML=`<h2>${esc(p.display_name||"Dein Profil")}</h2><p class="goal-current">${options.find(o=>o[0]===goal)?.[2]||""}</p><div class="wizard-targets">${[["kcal_target","Kalorien","kcal"],["protein_target_g","Eiweiß","g"],["carbs_target_g","Kohlenhydrate","g"],["fat_target_g","Fett","g"]].map(([key,label,unit])=>`<div><small>${label}</small><strong>${p[key]==null?"—":fmt(p[key])+" "+unit}</strong></div>`).join("")}</div><p class="help">${manual?"Eiweiß: eigener Wert ("+fmt(p.protein_per_kg)+" g/kg).":"Eiweiß wird automatisch passend zum Ziel berechnet."}</p>${manual?'<button type="button" class="text-link" id="automatic-protein">Eiweiß automatisch anpassen</button>':""}`;
  root.querySelector("#automatic-protein")?.addEventListener("click",()=>changeGoal(current.goal||"balanced",true));
 }
 function lock(value){
  pending=value;
  f.querySelectorAll('input[name="goal"],button[type="submit"]').forEach(el=>el.disabled=value);
  root.querySelector("#edit-profile").disabled=value;
  const reset=root.querySelector("#automatic-protein");if(reset)reset.disabled=value;
 }
 function radios(){
  root.querySelector("#goal-options").innerHTML=options.map(([value,symbol,label])=>`<label class="goal-option"><input type="radio" name="goal" value="${value}" ${(current.goal||"balanced")===value?"checked":""}>${icon(symbol)} ${label}</label>`).join("");
  root.querySelectorAll('[name="goal"]').forEach(el=>el.onchange=()=>changeGoal(el.value));
 }
 async function reload(){
  const [goals,profiles]=await Promise.all([list("goals"),list("nutrition_profiles")]);current=goals[0]||{};profile=profiles[0]||{};
  radios();summary();
 }
 async function changeGoal(goal,automatic=false){
  if(pending)return;
  const preview={...profile,...targetColumns(goalTargets(automatic?{...profile,protein_per_kg:null}:profile,goal)),...(automatic?{protein_per_kg:null}:{})};
  summary(preview,goal);lock(true);status.textContent="Wird gespeichert …";
  try{
   const saved=await persistGoal(save,current,profile,goal,automatic);
   current=saved.current;profile=saved.profile;summary();
   status.textContent=saved.targets?"Gespeichert · Tagesziele aktualisiert.":"Ziel gespeichert. Für Tageswerte bitte dein Profil vervollständigen oder passende Werte selbst festlegen.";
  }catch(e){
   try{await reload();}catch{summary();radios();}
   status.textContent=e.message||"Nicht gespeichert. Bitte erneut versuchen.";
  }finally{lock(false);}
 }
 await reload();
 f.diet.value=current.diet||"Keine Einschränkung";f.allergies.value=current.allergies||"";f.preferences.value=current.preferences||"";
 root.querySelector("#edit-profile").onclick=()=>profileEditor().then(reload).catch(e=>toast(e.message));
 f.onsubmit=e=>{
  e.preventDefault();if(pending)return;
  busy(e.submitter,async()=>{
   lock(true);
   try {
   const saved=await save("goals",{goal:current.goal||"balanced",diet:f.diet.value,allergies:f.allergies.value.trim(),preferences:f.preferences.value.trim()},current.id);
   current=saved;toast("Vorlieben gespeichert.");
   }finally{lock(false);}
  });
 };
}
