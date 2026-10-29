import {localDate, nutrients, scaled} from "./nutrition.js";
export const referenceAmount=unit=>["g","ml"].includes(unit)?100:1;
export function relativeDate(offset=0,today=localDate()){
 const d=new Date(today+"T12:00:00");d.setDate(d.getDate()+offset);return localDate(d);
}
export function dateLabel(date,today=localDate()){
 for(const [offset,label] of [[0,"Heute"],[-1,"Gestern"],[-2,"Vorgestern"]])if(date===relativeDate(offset,today))return label;
 return new Intl.DateTimeFormat("de-DE",{day:"numeric",month:"long",year:"numeric"}).format(new Date(date+"T12:00:00"));
}
export function fromReference(values,unit){return scaled(values,1/referenceAmount(unit));}
export function toReference(values,unit){return scaled(values,referenceAmount(unit));}
export const missingNutrition=values=>nutrients.some(k=>values[k]==null);
