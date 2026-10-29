import test from "node:test";
import assert from "node:assert/strict";
import {thinking} from "../src/core/nussi.js";
test("Overlapping KI callers share one blocking overlay and restore only after all finish",()=>{
 const previous=globalThis.document;let created=0,shown=0,closed=0,removed=0,cancel;
 globalThis.document={body:{append(){}},createElement(tag){assert.equal(tag,"dialog");created++;return {setAttribute(){},addEventListener(name,fn){if(name==="cancel")cancel=fn;},showModal(){shown++;},close(){closed++;},remove(){removed++;}};}};
 try{
  const stop1=thinking(null,"Rezept"),stop2=thinking(null,"Nährwerte");
  assert.equal(created,1);assert.equal(shown,1);
  let prevented=false;cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  stop1();stop1();assert.equal(closed,0);stop2();assert.equal(closed,1);assert.equal(removed,1);
  const stop3=thinking(null,"Erneut");assert.equal(created,2);stop3();assert.equal(removed,2);
 }finally{globalThis.document=previous;}
});
