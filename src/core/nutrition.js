export const nutrients = ["kcal", "protein", "carbs", "fat"];
export const labels = { kcal: "Kalorien", protein: "Eiweiß", carbs: "Kohlenhydrate", fat: "Fett" };
export const meals = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snack: "Snacks" };
export function localDate(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
export function ageOn(birth, today = localDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || "")) return null;
  const [y,m,d] = birth.split("-").map(Number), [ty,tm,td] = today.split("-").map(Number);
  return ty-y-(tm<m || (tm===m && td<d) ? 1 : 0);
}
export function estimateNeeds(p, today = localDate()) {
  const age = ageOn(p.birth_date, today);
  if (age === null || age < 18 || age > 100 || !["male","female"].includes(p.formula_sex)
      || !(p.weight_kg >= 30 && p.weight_kg <= 300) || !(p.height_cm >= 120 && p.height_cm <= 230)
      || !(p.activity_factor >= 1 && p.activity_factor <= 2.5)) return null;
  const resting = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * age + (p.formula_sex === "male" ? 5 : -161);
  const factor = Number(p.protein_per_kg);
  return { kcal: Math.round(resting * p.activity_factor), protein: factor >= .5 && factor <= 3 ? Math.round(p.weight_kg * factor) : null };
}
export function scaled(values, amount) {
  if (!Number.isFinite(amount) || amount <= 0) throw Error("Bitte eine gültige Menge eingeben.");
  return Object.fromEntries(nutrients.map(k => [k, values[k] == null ? null : Number(values[k]) * amount]));
}
export function productNutrition(product, amount) {
  return scaled(product, amount / (product.unit === "Stück" ? 1 : 100));
}
export function recipeNutrition(recipe, products) {
  if (recipe.nutrition_per_serving) return recipe.nutrition_per_serving;
  const d = recipe.content;
  if (!d.ingredients?.length || !(d.servings > 0)) return Object.fromEntries(nutrients.map(k => [k,null]));
  const items = d.ingredients.map(i => {
    const p = products.find(p => (p.id === i.product_id || (!i.product_id && p.name.toLocaleLowerCase("de") === i.name.toLocaleLowerCase("de"))) && p.unit === i.unit);
    const values=Object.fromEntries(nutrients.map(k=>[k,p?.[k] ?? i.nutrition?.[k] ?? null]));
    return productNutrition({...values,unit:i.unit},i.quantity);
  });
  return Object.fromEntries(nutrients.map(k => [k, items.some(i => i[k] == null) ? null : items.reduce((sum,i) => sum + i[k],0) / d.servings]));
}
export function dailyTotals(entries) {
  return Object.fromEntries(nutrients.map(k => [k, { value: entries.reduce((sum,e) => sum + Number(e[k] ?? 0),0), incomplete: entries.some(e => e[k] == null) }]));
}

export function defaultProtein(goal, age) { return goal === "muscle" ? 1.6 : age >= 65 ? 1 : 0.8; }
export function macroTargets(kcal, protein) {
 if (!(kcal>0) || !(protein>0) || !Number.isFinite(kcal+protein)) return null;
 const fat=Math.round(kcal*0.30/9), carbs=Math.round((kcal-protein*4-fat*9)/4);
 return carbs>=0 ? {kcal,protein:Math.round(protein),fat,carbs} : null;
}
export function dateFromParts(day,month,year) {
 if (![day,month,year].every(v=>/^[0-9]+$/.test(String(v)))) return null;
 const d=Number(day),m=Number(month),y=Number(year),date=new Date(y,m-1,d,12);
 return y>=1900 && y<=2100 && date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? localDate(date) : null;
}

export function goalTargets(profile, goal = "balanced", today = localDate()) {
 const factor=profile.protein_per_kg ?? defaultProtein(goal,ageOn(profile.birth_date,today));
 const estimate=estimateNeeds({...profile,protein_per_kg:factor},today);
 if(!estimate) return null;
 const bmi=profile.weight_kg/((profile.height_cm/100)**2);
 if(goal==="lose" && bmi<18.5) return null;
 const multiplier={balanced:1,lose:.9,gain:1.1,muscle:1.05}[goal] ?? 1;
 return macroTargets(Math.round(estimate.kcal*multiplier),estimate.protein);
}
export function targetColumns(t) {
 return {kcal_target:t?.kcal??null,protein_target_g:t?.protein??null,carbs_target_g:t?.carbs??null,fat_target_g:t?.fat??null};
}
export function ingredientTotals(items, servings=1) {
 if(!(servings>0)) throw Error("Bitte gültige Portionen eingeben.");
 const values=items.map(i=>productNutrition({...i.nutrition,unit:i.unit},i.quantity));
 // Each ingredient's reference unit must accompany its nutrition snapshot.
 return Object.fromEntries(nutrients.map(k=>[k,!items.length||values.some(v=>v[k]==null)?null:values.reduce((sum,v)=>sum+v[k],0)/servings]));
}
