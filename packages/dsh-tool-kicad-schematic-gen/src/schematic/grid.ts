import type {FlatObject,FlatPoint} from './flat.ts'

export const DEFAULT_SCHEMATIC_GRID = 1.27
export function snapPoint(at:FlatPoint,step=DEFAULT_SCHEMATIC_GRID):FlatPoint {
 if(!Number.isFinite(step)||step<=0||at.length!==2||at.some(n=>!Number.isFinite(n)))throw new Error('Grid requires a positive finite step and two finite coordinates')
 return at.map(n=>Math.round(Math.round(n/step)*step*1e6)/1e6) as FlatPoint
}
export interface GridIssue {
 type:string;uuid:string;reference?:string;pin?:string;at:FlatPoint;nearest:FlatPoint
}
/** Read-only: never snap wires away from real pins or rewrite imported circuitry. */
export function inspectGrid(objects:FlatObject[],step=DEFAULT_SCHEMATIC_GRID,limit=60){
 snapPoint([0,0],step)
 const issues:GridIssue[]=[],counts:Record<string,number>={};let total=0
 const check=(o:FlatObject,at:FlatPoint|undefined,type:string,pin?:string)=>{
  if(!at)return
  const nearest=snapPoint(at,step)
  if(at.every((n,i)=>Math.abs(n-nearest[i]!)<=1e-6))return
  total++;counts[type]=(counts[type]??0)+1
  if(issues.length<limit)issues.push({type,uuid:o.uuid,...(o.reference?{reference:o.reference}:{}),...(pin?{pin}:{}),at,nearest})
 }
 for(const o of objects){
  if(o.type==='symbol'){
   check(o,o.at,'symbol');for(const p of o.pins??[])check(o,p.at,'pin',p.number)
  }else if(o.type==='wire'){
   check(o,o.from,'wire');check(o,o.to,'wire')
  }else if(['label','global_label','hierarchical_label','junction','no_connect'].includes(o.type))check(o,o.at,o.type)
 }
 return {step,total,counts,issues,truncated:total>issues.length}
}
