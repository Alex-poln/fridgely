import { list, save } from "../../core/data.js";
import { db } from "../../core/supabase.js";
import { esc, dialog, closeDialog, busy, toast, fmt } from "../../core/ui.js";
import { estimateNeeds, localDate } from "../../core/nutrition.js";
export async function profileEditor(onboarding=false) {
  const p=(await list("nutrition_profiles"))[0] || {};
  return new Promise(resolve=>{
    dialog(`<h2>${onboarding?"Hey, ich bin Nussi!":"Dein Profil"}</h2><p>${onboarding?"Wie darf ich dich nennen? Deine Körperdaten sind freiwillig und können später ergänzt werden.":"Deine Angaben und Tagesziele."}</p>
    <form id="profile-form" class="stack"><label>Name<input name="display_name" maxlength="80" value="${esc(p.display_name)}"></label>
    <div class="form-grid"><label>Geburtsdatum<input type="date" name="birth_date" max="${localDate()}" value="${esc(p.birth_date)}"></label>
    <label>Formelparameter<select name="formula_sex"><option value="">Keine Angabe</option><option value="female" ${p.formula_sex==="female"?"selected":""}>Weiblich</option><option value="male" ${p.formula_sex==="male"?"selected":""}>Männlich</option></select></label>
    <label>Größe (cm)<input name="height_cm" type="number" min="50" max="250" step="0.1" value="${p.height_cm??""}"></label>
    <label>Gewicht (kg)<input name="weight_kg" type="number" min="10" max="500" step="0.1" value="${p.weight_kg??""}"></label></div>
    <label>Alltag und Bewegung<select name="activity_factor"><option value="">Bitte auswählen</option>${[[1.2,"Überwiegend sitzend, wenig Bewegung"],[1.4,"Sitzend mit regelmäßiger Bewegung"],[1.6,"Aktiver Alltag / regelmäßiger Sport"],[1.8,"Sehr aktiver Alltag"],[2,"Körperlich anstrengender Alltag"]].map(([v,l])=>`<option value="${v}" ${Number(p.activity_factor)===v?"selected":""}>${l}</option>`).join("")}</select></label>
    <label>Eiweiß pro kg (optional)<input name="protein_per_kg" type="number" min="0.5" max="3" step="0.1" value="${p.protein_per_kg??""}" placeholder="Zum Beispiel 1,6 bei Muskelaufbau"></label>
    <p class="help">Bei gesunden sportlich aktiven Erwachsenen sind häufig 1,4–2,0 g/kg sinnvoll. Mehr ist nicht automatisch besser.</p>
    <p id="estimate-result" class="help" aria-live="polite"></p><button type="button" class="btn secondary" id="use-estimate">Schätzung als Tagesziele übernehmen</button>
    <details><summary>Berechnung und Quellen</summary><p class="help">Mifflin–St Jeor × Aktivitätsfaktor: eine grobe Schätzung des Erhaltungsbedarfs für Erwachsene, kein automatisch gesetztes Abnehmziel. Für Schwangerschaft, Stillzeit oder medizinische Besonderheiten nicht geeignet. Werte bleiben anpassbar.</p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">Kalorienformel</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/28642676/" target="_blank" rel="noopener">Eiweiß und Sport</a></details>
    <div class="form-grid">${[["kcal_target","Kalorien (kcal)",10000],["protein_target_g","Eiweiß (g)",500],["carbs_target_g","Kohlenhydrate (g)",1500],["fat_target_g","Fett (g)",500]].map(([k,l,max])=>`<label>${l}<input type="number" name="${k}" min="${k==="kcal_target"||k==="protein_target_g"?0.1:0}" max="${max}" step="0.1" value="${p[k]??""}" placeholder="Kein Ziel"></label>`).join("")}</div>
    <button class="btn" type="submit">Speichern</button>${onboarding?'<button class="text-link" type="button" id="skip-profile">Später ergänzen</button>':""}</form>`,el=>{
      const f=el.querySelector("form"), numbers=["height_cm","weight_kg","activity_factor","protein_per_kg","kcal_target","protein_target_g","carbs_target_g","fat_target_g"];
      const values=()=>({display_name:f.display_name.value.trim(),birth_date:f.birth_date.value||null,formula_sex:f.formula_sex.value||null,...Object.fromEntries(numbers.map(k=>[k,f.elements[k].value===""?null:Number(f.elements[k].value)])),onboarding_completed_at:p.onboarding_completed_at||new Date().toISOString()});
      const recalc=()=>{const n=estimateNeeds(values());el.querySelector("#use-estimate").disabled=!n;el.querySelector("#estimate-result").textContent=n?`Geschätzter Erhaltungsbedarf: ${fmt(n.kcal)} kcal${n.protein!==null?" · Eiweiß: "+fmt(n.protein)+" g":""}.`:"Für die Schätzung benötigen wir vollständige Körperdaten und Aktivität (ab 18 Jahren).";};
      f.addEventListener("input",recalc);recalc();
      el.querySelector("#use-estimate").onclick=()=>{const n=estimateNeeds(values());if(n){f.kcal_target.value=n.kcal;if(n.protein!==null)f.protein_target_g.value=n.protein;}};
      f.onsubmit=e=>{e.preventDefault();busy(f.querySelector('[type="submit"]'),async()=>{
        const v=values();await save("nutrition_profiles",v,p.id);
        const {error}=await (await db()).auth.updateUser({data:{display_name:v.display_name}});
        if(error)toast("Profil gespeichert. Namensabgleich beim nächsten Login.");
        closeDialog();
      });};
      el.querySelector("#skip-profile")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{await save("nutrition_profiles",{onboarding_completed_at:new Date().toISOString()},p.id);closeDialog();}));
      el.addEventListener("close",()=>resolve(),{once:true});
    });
  });
}
export async function firstProfile() {
  const p=(await list("nutrition_profiles"))[0];
  if(!p?.onboarding_completed_at) await profileEditor(true);
}
