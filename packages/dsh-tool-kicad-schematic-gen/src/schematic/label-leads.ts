import type {FlatPoint} from './flat.ts'

interface LabelTarget {
 pin(reference:string,number:string):FlatPoint
 wire(from:FlatPoint,to:FlatPoint,via?:FlatPoint[]):unknown
 label(name:string,at:FlatPoint,angle?:number):unknown
}
/** Explicit, reusable label fanout. Caller chooses outward direction and clear lanes.
 * Coordinates stay in the target's coordinate system (sheet or region).
 * This does not infer pin orientation, avoid obstacles or validate connectivity.
 */
export function attachPinLabel(target:LabelTarget,spec:{reference:string;pin:string;net:string;direction:'left'|'right'|'up'|'down';length?:number;lane?:number;pitch?:number}){
 const {reference,pin,net,direction,length=5.08,lane=0,pitch=2.54}=spec
 const axis:Record<string,FlatPoint>={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]},v=axis[direction]
 if(!v||!net.trim()||!Number.isFinite(length)||length<=0||!Number.isInteger(lane)||!Number.isFinite(pitch)||pitch<=0)throw new Error('Label lead needs a net, outward direction, positive length/pitch and integer lane')
 const start=target.pin(reference,pin),round=(n:number)=>Math.round(n*1e6)/1e6
 const elbow:FlatPoint=[round(start[0]+v[0]*length),round(start[1]+v[1]*length)]
 const end:FlatPoint=[round(elbow[0]-v[1]*lane*pitch),round(elbow[1]+v[0]*lane*pitch)]
 target.wire(start,end,lane?[elbow]:[])
 // Keep text horizontal; left-growing labels face away from a left exit.
 const label=target.label(net,end,direction==='left'?180:0)
 return {at:end,label}
}
