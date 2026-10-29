import test from "node:test";
import assert from "node:assert/strict";
import {referenceAmount,fromReference,toReference,relativeDate,dateLabel,missingNutrition} from "../src/core/food-entry.js";
import {scaled} from "../src/core/nutrition.js";
test("Packaging always uses 100 g/ml while servings and pieces use one",()=>{
 for(const unit of ["g","ml"])assert.equal(referenceAmount(unit),100);
 for(const unit of ["Stück","Portion"])assert.equal(referenceAmount(unit),1);
});
test("100 ml label values survive back/forward and scale to consumed amount",()=>{
 const pack={kcal:40,protein:3,carbs:5,fat:1};
 let base=fromReference(pack,"ml");
 for(let i=0;i<5;i++)base=fromReference(toReference(base,"ml"),"ml");
 assert.deepEqual(toReference(base,"ml"),pack);
 assert.deepEqual(scaled(base,250),{kcal:100,protein:7.5,carbs:12.5,fat:2.5});
 assert.deepEqual(scaled(base,50),{kcal:20,protein:1.5,carbs:2.5,fat:.5});
});
test("Unknown scanned nutrition is not silently treated as zero; water zeros are valid",()=>{
 assert.equal(missingNutrition(fromReference({},"g")),true);
 const water={kcal:0,protein:0,carbs:0,fat:0};
 assert.equal(missingNutrition(fromReference(water,"ml")),false);
 assert.deepEqual(scaled(fromReference(water,"ml"),500),water);
});
test("Date presets cross month, year and DST boundaries using calendar days",()=>{
 assert.equal(relativeDate(-1,"2026-01-01"),"2025-12-31");
 assert.equal(relativeDate(-2,"2026-03-30"),"2026-03-28");
 assert.equal(dateLabel("2026-10-29","2026-10-29"),"Heute");
 assert.equal(dateLabel("2026-10-28","2026-10-29"),"Gestern");
 assert.equal(dateLabel("2026-10-27","2026-10-29"),"Vorgestern");
});
