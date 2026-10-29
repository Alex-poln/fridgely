import test from "node:test";
import assert from "node:assert/strict";
import {persistGoal} from "../src/core/goal-change.js";
const p={id:"p",birth_date:"1995-04-10",formula_sex:"male",height_cm:180,weight_kg:80,activity_factor:1.4,kcal_target:2400,protein_target_g:64,carbs_target_g:300,fat_target_g:80};
test("Goal selection persists targets and goal without submitting preferences",async()=>{
 const calls=[];const save=async(table,data,id)=>{calls.push({table,data,id});return {...(table==="goals"?{diet:"Vegan"}:p),...data,id};};
 const next=await persistGoal(save,{id:"g",goal:"balanced"},p,"muscle");
 assert.equal(calls[0].table,"nutrition_profiles");assert.equal(calls[0].data.protein_target_g,128);
 assert.deepEqual(calls[1],{table:"goals",data:{goal:"muscle"},id:"g"});
 assert.equal(next.current.diet,"Vegan");assert.equal(next.profile.protein_target_g,128);
});
test("Manual protein stays explicit; switching to automatic clears override",async()=>{
 const save=async(t,v,id)=>({...p,...v,id});
 const custom={...p,protein_per_kg:2};
 assert.equal((await persistGoal(save,{id:"g"},custom,"muscle")).profile.protein_target_g,160);
 const automatic=await persistGoal(save,{id:"g"},custom,"muscle",true);
 assert.equal(automatic.profile.protein_per_kg,null);assert.equal(automatic.profile.protein_target_g,128);
});
test("Failed goal write restores previous targets and reports failure",async()=>{
 const calls=[];const save=async(t,v,id)=>{calls.push({t,v,id});if(t==="goals")throw Error("offline");return {...p,...v};};
 await assert.rejects(persistGoal(save,{id:"g"},p,"gain"),/offline/);
 assert.equal(calls.length,3);assert.equal(calls[2].v.kcal_target,2400);assert.equal(calls[2].v.protein_target_g,64);
});
test("Failed target write never saves a different goal",async()=>{
 let calls=0;await assert.rejects(persistGoal(async()=>{calls++;throw Error("offline");},{id:"g"},p,"gain"),/offline/);assert.equal(calls,1);
});
