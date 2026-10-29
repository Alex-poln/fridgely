import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {validateRecipes} from "../supabase/functions/kitchen-ai/validation.js";
test("Actual Gemini recipe schema avoids rejected array expansion limits; server still enforces count",async()=>{
 const source=await readFile(new URL("../supabase/functions/kitchen-ai/index.ts",import.meta.url),"utf8");
 const schema=runInNewContext(source.slice(source.indexOf("const recipeSchema"),source.indexOf("Deno.serve"))+";recipeSchema");
 function check(node){assert.equal(node.maxItems,undefined);assert.equal(node.minItems,undefined);for(const value of Object.values(node))if(value&&typeof value==="object")check(value);}
 check(schema);
 assert.throws(()=>validateRecipes({recipes:[]},[],1),/gültigen/);
 assert.throws(()=>validateRecipes({recipes:[{},{},{},{}]},[],1),/gültigen/);
 assert.equal(schema.properties.recipes.items.properties.ingredients.items.properties.unit.enum.join(","),"g,ml,Stück");
});
