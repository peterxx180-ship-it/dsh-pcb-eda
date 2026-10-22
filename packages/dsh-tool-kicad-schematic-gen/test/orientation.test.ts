import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chooseOrientation} from '../src/schematic/orientation.ts'

const pin=(n:string,x:number,y:number,a:number,length=2.54)=>`(pin passive line (at ${x} ${y} ${a}) (length ${length}) (name "${n}") (number "${n}"))`
const source=`(symbol "Offset" (symbol "Offset_1_1" ${pin('A',20,10,0)} ${pin('B',30,10,180)}))`
test('pair rotation uses actual role pins despite an offset symbol origin',()=>{
 assert.equal(chooseOrientation(source,{from:'A',to:'B',direction:'right'}),0)
 assert.equal(chooseOrientation(source,{from:'A',to:'B',direction:'down'}),270)
 assert.equal(chooseOrientation(source,{from:'A',to:'B',direction:'left'}),180)
 assert.equal(chooseOrientation(source,{from:'A',to:'B',direction:'up'}),90)
 assert.equal(chooseOrientation(source,{from:'A',to:'B',direction:'right'},1,'y'),180)
})
test('connector facing uses pin direction, not its position relative to the origin',()=>{
 assert.equal(chooseOrientation(source,{pins:['A'],facing:'right'}),180)
 assert.equal(chooseOrientation(source,{pins:['B'],facing:'right'}),0)
 assert.equal(chooseOrientation(source,{pins:['A'],facing:'down'}),90)
 assert.throws(()=>chooseOrientation(source,{pins:['A','B'],facing:'right'}),/UNSATISFIED/)
})
test('unknown, ambiguous, wrong-unit and zero-length facing pins fail explicitly',()=>{
 assert.throws(()=>chooseOrientation(source,{pins:['missing'],facing:'right'}),/PIN_INVALID/)
 assert.throws(()=>chooseOrientation(source,{pins:['A'],facing:'right'},2),/PIN_INVALID/)
 assert.throws(()=>chooseOrientation(`(symbol "P" (symbol "P_1_1" ${pin('A',0,0,0,0)}))`,{pins:['A'],facing:'right'}),/zero-length/)
 assert.throws(()=>chooseOrientation(source,{from:'A',to:'A',direction:'down'}),/UNSATISFIED/)
})
