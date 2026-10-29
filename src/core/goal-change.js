import { goalTargets, targetColumns } from "./nutrition.js";
// Serialize callers in the UI. Restore prior targets if the second write fails.
export async function persistGoal(save, current, profile, goal, automatic=false) {
 const nextProfile=automatic?{...profile,protein_per_kg:null}:profile;
 const targets=goalTargets(nextProfile,goal);
 const values={...targetColumns(targets),...(automatic?{protein_per_kg:null}:{})};
 let updated=profile;
 if(profile.id)updated=await save("nutrition_profiles",values,profile.id);
 try {
  const next=await save("goals",{goal},current.id);
  return {current:next,profile:updated,targets};
 } catch(error) {
  if(profile.id) {
   const restore=Object.fromEntries(Object.keys(values).map(k=>[k,profile[k]??null]));
   try {await save("nutrition_profiles",restore,profile.id);}
   catch {throw Error("Ziel konnte nicht vollständig gespeichert werden. Bitte erneut auswählen, um Ziel und Tageswerte abzugleichen.");}
  }
  throw error;
 }
}
