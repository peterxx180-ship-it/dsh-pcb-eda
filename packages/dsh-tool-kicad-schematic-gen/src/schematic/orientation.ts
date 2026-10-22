import {children,parse,value} from './sexpr.ts'
type Direction='left'|'right'|'up'|'down'
export type OrientationIntent={from:string;to:string;direction:Direction}|{pins:string[];facing:Direction}
/** Real pin geometry, including selected unit and mirror; never changes pin assignments. */
export function chooseOrientation(source:string,intent:OrientationIntent,unit=1,mirror?:'x'|'y',preferred=0):0|90|180|270{
 if(!Number.isInteger(unit)||unit<1)throw new Error('ORIENTATION_INVALID: unit must be a positive integer')
 const directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]} as const
 const direction='facing' in intent?intent.facing:intent.direction,desired=directions[direction]
 if(!desired)throw new Error('ORIENTATION_INVALID: choose left/right/up/down')
 const sections=children(parse(source),'symbol').filter(s=>{
  const m=/_(\d+)_(\d+)$/u.exec(value(s));return m&&[0,unit].includes(Number(m[1]))&&[0,1].includes(Number(m[2]))
 })
 const pin=(number:string)=>{
  const matches=sections.flatMap(s=>children(s,'pin')).filter(p=>{const n=children(p,'number')[0];return n&&value(n)===number})
  if(matches.length!==1)throw new Error(`ORIENTATION_PIN_INVALID: ${number} resolves to ${matches.length} pins in unit ${unit}`)
  const p=matches[0]!,at=children(p,'at')[0],length=children(p,'length')[0]
  if(!at||!length)throw new Error('ORIENTATION_PIN_INVALID: missing pin geometry')
  const values=[Number(value(at,1)),Number(value(at,2)),Number(value(at,3)),Number(value(length))]
  if(values.some(n=>!Number.isFinite(n)))throw new Error('ORIENTATION_PIN_INVALID: invalid pin geometry')
  return values as [number,number,number,number]
 }
 const numbers='pins' in intent?intent.pins:[intent.from,intent.to]
 if(!numbers.length||numbers.some(n=>!n?.trim()))throw new Error('ORIENTATION_INVALID: provide actual pin numbers')
 const pins=numbers.map(pin)
 const transform=(x:number,y:number,angle:number)=>{
  const r=angle*Math.PI/180,rx=x*Math.cos(r)-y*Math.sin(r),ry=x*Math.sin(r)+y*Math.cos(r)
  return [mirror==='y'?-rx:rx,mirror==='x'?ry:-ry]
 }
 const pointsOut=(v:number[])=>v[0]!*desired[0]+v[1]!*desired[1]>1e-6&&Math.abs(v[0]!*desired[1]-v[1]!*desired[0])<1e-6
 for(const angle of [...new Set([preferred,0,90,180,270])]){
  if(![0,90,180,270].includes(angle))continue
  const vectors='pins' in intent?pins.map(p=>{
   if(p[3]<=0)throw new Error('ORIENTATION_PIN_INVALID: zero-length pins have no facing direction')
   const r=p[2]*Math.PI/180;return transform(-Math.cos(r),-Math.sin(r),angle)
  }):[transform(pins[1]![0]-pins[0]![0],pins[1]![1]-pins[0]![1],angle)]
  if(vectors.every(pointsOut))return angle as 0|90|180|270
 }
 throw new Error('ORIENTATION_UNSATISFIED: pins cannot satisfy this direction by rotation; choose compatible geometry or explicit layout')
}
