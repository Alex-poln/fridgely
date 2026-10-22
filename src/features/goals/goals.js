import { list, save } from "../../core/data.js";
import { configured } from "../../core/supabase.js";
import { icon, toast, busy, setupNotice } from "../../core/ui.js";
export async function mount(root) {
  root.querySelector("#notice").innerHTML = setupNotice(configured);
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
      current.id = saved.id;
      toast(
        "Deine Ziele sind gespeichert. Neue KI-Rezepte berücksichtigen sie.",
      );
    });
  };
}
