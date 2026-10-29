import { goalTargets, targetColumns } from "../../core/nutrition.js";
import { profileEditor } from "./profile.js";
import { esc, fmt } from "../../core/ui.js";
import { list, save } from "../../core/data.js";
import { configured } from "../../core/supabase.js";
import { icon, toast, busy, setupNotice } from "../../core/ui.js";
export async function mount(root) {
  root.querySelector("#notice").innerHTML = setupNotice(configured);
  async function showProfile() {
    const p=(await list("nutrition_profiles"))[0] || {};
    root.querySelector("#profile-summary").innerHTML='<h2>'+esc(p.display_name || "Dein Profil")+'</h2><p>'+(p.kcal_target?fmt(p.kcal_target)+" kcal":"Kein Kalorienziel")+' · '+(p.protein_target_g?fmt(p.protein_target_g)+" g Eiweiß":"Kein Eiweißziel")+'</p>';
  }
  root.querySelector("#edit-profile").onclick=()=>profileEditor().then(showProfile).catch(e=>toast(e.message));
  await showProfile();
  const current = (await list("goals"))[0] || {};
  const f = root.querySelector("form");
  const options = [
    ["balanced", "spa", "Ausgewogen essen"],
    ["lose", "trending_down", "Abnehmen"],
    ["gain", "trending_up", "Zunehmen"],
    ["muscle", "fitness_center", "Muskeln aufbauen"],
  ];
  root.querySelector("#goal-options").innerHTML = options
    .map(
      ([value, symbol, label]) =>
        `<label class="goal-option"><input type="radio" name="goal" value="${value}" ${(current.goal || "balanced") === value ? "checked" : ""}>${icon(symbol)} ${label}</label>`,
    )
    .join("");
  f.diet.value = current.diet || "Keine Einschränkung";
  f.allergies.value = current.allergies || "";
  f.preferences.value = current.preferences || "";
  f.onsubmit = (e) => {
    e.preventDefault();
    busy(f.querySelector("button"), async () => {
      const saved = await save(
        "goals",
        {
          goal: f.goal.value,
          diet: f.diet.value,
          allergies: f.allergies.value.trim(),
          preferences: f.preferences.value.trim(),
        },
        current.id,
      );
      if(current.goal!==saved.goal){
        const profile=(await list("nutrition_profiles"))[0];
        if(profile) await save("nutrition_profiles",targetColumns(goalTargets(profile,saved.goal)),profile.id);
      }
      current.id = saved.id;
      current.goal = saved.goal;
      await showProfile();
      toast(
        "Deine Ziele sind gespeichert. Neue KI-Rezepte berücksichtigen sie.",
      );
    });
  };
}
