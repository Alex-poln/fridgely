import test from "node:test";
import assert from "node:assert/strict";
import {defaultProtein,macroTargets,dateFromParts} from "../src/core/nutrition.js";
test("Protein defaults follow goal and age",()=>{assert.equal(defaultProtein("muscle",25),1.6);assert.equal(defaultProtein("balanced",25),.8);assert.equal(defaultProtein("balanced",70),1);});
test("Macro allocation includes fat and carbs and preserves energy within rounding",()=>{const t=macroTargets(2700,170);assert.deepEqual(t,{kcal:2700,protein:170,fat:90,carbs:303});assert.ok(Math.abs(t.protein*4+t.fat*9+t.carbs*4-t.kcal)<=4);assert.equal(macroTargets(200,170),null);assert.equal(macroTargets(0,100),null);});
test("Typed dates reject overflow and allow leap years",()=>{assert.equal(dateFromParts("29","02","2024"),"2024-02-29");assert.equal(dateFromParts("29","02","2025"),null);assert.equal(dateFromParts("31","04","2000"),null);assert.equal(dateFromParts("","",""),null);assert.equal(dateFromParts("1","1","2000"),"2000-01-01");});
