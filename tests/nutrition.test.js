import test from "node:test";
import assert from "node:assert/strict";
import { ageOn,estimateNeeds,scaled,productNutrition,recipeNutrition,dailyTotals,localDate } from "../src/core/nutrition.js";
test("Age respects birthday, including year boundaries",()=>{
  assert.equal(ageOn("2000-10-30","2026-10-29"),25);
  assert.equal(ageOn("2000-10-29","2026-10-29"),26);
  assert.equal(ageOn(null),null);
});
test("Mifflin calculation and protein factor; targets are not auto-adjusted for weight loss",()=>{
  const p={birth_date:"2000-01-01",weight_kg:80,height_cm:180,formula_sex:"male",activity_factor:1.4,protein_per_kg:1.6};
  assert.deepEqual(estimateNeeds(p,"2026-01-01"),{kcal:2520,protein:128});
  assert.equal(estimateNeeds({...p,formula_sex:"female"},"2026-01-01").kcal,2288);
  assert.equal(estimateNeeds({...p,birth_date:"2012-01-01"},"2026-01-01"),null);
  assert.equal(estimateNeeds({...p,activity_factor:null},"2026-01-01"),null);
});
test("g and ml scale per 100, pieces per one, missing values stay unknown",()=>{
  assert.equal(productNutrition({unit:"g",kcal:400,protein:10},50).kcal,200);
  assert.equal(productNutrition({unit:"ml",kcal:60},250).kcal,150);
  assert.equal(productNutrition({unit:"Stück",kcal:80},2).kcal,160);
  assert.equal(productNutrition({unit:"g",kcal:null},50).kcal,null);
  assert.throws(()=>scaled({},0));
});
test("Recipes divide total ingredient nutrition by portions",()=>{
  const r={content:{servings:2,ingredients:[{product_id:"oats",quantity:100,unit:"g"}]}};
  const p=[{id:"oats",name:"Haferflocken",unit:"g",kcal:400,protein:14,carbs:60,fat:7}];
  assert.equal(recipeNutrition(r,p).kcal,200);
  assert.equal(recipeNutrition(r,[]).kcal,null);
  assert.equal(recipeNutrition({...r,content:{...r.content,ingredients:[]}},p).kcal,null);
});
test("Diary shows missing values instead of a complete zero",()=>{
  assert.deepEqual(dailyTotals([{kcal:200},{kcal:null}]).kcal,{value:200,incomplete:true});
  assert.deepEqual(dailyTotals([]).kcal,{value:0,incomplete:false});
  assert.equal(localDate(new Date(2026,9,29,23,55)),"2026-10-29");
});
