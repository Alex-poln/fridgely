import test from "node:test";
import assert from "node:assert/strict";
import {goalTargets,ingredientTotals,scaled} from "../src/core/nutrition.js";
const p={birth_date:"1995-04-10",formula_sex:"male",height_cm:180,weight_kg:80,activity_factor:1.4};
test("Goal switch recalculates from maintenance, never from stale targets",()=>{
 const base=goalTargets(p,"balanced","2026-10-29");
 const muscle=goalTargets({...p,kcal_target:9000,protein_target_g:400},"muscle","2026-10-29");
 assert.equal(muscle.kcal,Math.round(base.kcal*1.05));assert.equal(muscle.protein,128);
 const lose=goalTargets({...p,kcal_target:muscle.kcal},"lose","2026-10-29");
 assert.equal(lose.kcal,Math.round(base.kcal*.9));
 assert.deepEqual(goalTargets({...p,kcal_target:lose.kcal},"balanced","2026-10-29"),base);
});
test("Explicit protein factor survives a goal change; incomplete and underweight loss remain unset",()=>{
 assert.equal(goalTargets({...p,protein_per_kg:1.8},"muscle","2026-10-29").protein,144);
 assert.equal(goalTargets({...p,birth_date:null},"muscle"),null);
 assert.equal(goalTargets({...p,weight_kg:45},"lose"),null);
});
test("Ingredient snapshots scale 100g references to weighed quantities and portions",()=>{
 const ingredients=[
 {quantity:50,unit:"g",nutrition:{kcal:400,protein:20,carbs:60,fat:10}},
 {quantity:200,unit:"g",nutrition:{kcal:100,protein:25,carbs:0,fat:0}}
 ];
 assert.deepEqual(ingredientTotals(ingredients),{kcal:400,protein:60,carbs:30,fat:5});
 assert.deepEqual(ingredientTotals(ingredients,2),{kcal:200,protein:30,carbs:15,fat:2.5});
 assert.deepEqual(scaled(ingredientTotals(ingredients,2),.5),{kcal:100,protein:15,carbs:7.5,fat:1.25});
 assert.equal(ingredientTotals([...ingredients,{quantity:1,unit:"Stück",nutrition:{kcal:80}}]).protein,null);
 assert.equal(ingredientTotals([{quantity:2,unit:"Stück",nutrition:{kcal:80}}]).kcal,160);
});
