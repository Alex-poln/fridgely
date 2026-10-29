import test from "node:test";
import assert from "node:assert/strict";
import {recipeNutrition,scaled} from "../src/core/nutrition.js";
import {validateRecipes} from "../supabase/functions/kitchen-ai/validation.js";
const ingredient={name:"Haferflocken",product_id:null,quantity:100,unit:"g",nutrition:{kcal:400,protein:14,carbs:60,fat:8}};
const raw=ingredients=>({recipes:[{title:"Frühstück",description:"Mit Milch",minutes:5,note:"",steps:["Vermischen"],ingredients}]});
test("Validated AI ingredient estimates survive saving and yield per-portion macros",()=>{
 const content=validateRecipes(raw([ingredient,{name:"Milch",product_id:null,quantity:200,unit:"ml",nutrition:{kcal:50,protein:3,carbs:5,fat:2}}]),[],2)[0];
 const recipe={content:JSON.parse(JSON.stringify(content))};
 assert.deepEqual(recipeNutrition(recipe,[]),{kcal:250,protein:10,carbs:35,fat:6});
 assert.deepEqual(scaled(recipeNutrition(recipe,[]),2),{kcal:500,protein:20,carbs:70,fat:12});
});
test("Known product values override guesses per nutrient, including real zero",()=>{
 const content=validateRecipes(raw([ingredient]),[],1)[0];
 const products=[{id:"p",name:"Haferflocken",unit:"g",kcal:380,protein:12,carbs:null,fat:0}];
 assert.deepEqual(recipeNutrition({content},products),{kcal:380,protein:12,carbs:60,fat:0});
});
test("Malformed AI nutrition is rejected and legacy missing values stay unknown",()=>{
 assert.throws(()=>validateRecipes(raw([{...ingredient,nutrition:{...ingredient.nutrition,kcal:-1}}]),[],1),/Nährwerte/);
 const {nutrition,...legacy}=ingredient;
 assert.deepEqual(recipeNutrition({content:validateRecipes(raw([legacy]),[],1)[0]},[]),{kcal:null,protein:null,carbs:null,fat:null});
});
