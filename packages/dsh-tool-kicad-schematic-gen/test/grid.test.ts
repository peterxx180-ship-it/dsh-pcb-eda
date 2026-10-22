import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {snapPoint,inspectGrid} from '../src/schematic/grid.ts'
import {Schematic} from '../src/schematic/builder.ts'

test('grid snapping validates input and handles negative and noisy coordinates',()=>{
 assert.deepEqual(snapPoint([10,-15]),[10.16,-15.24])
 assert.deepEqual(snapPoint([63.239999999999995,1.27]),[63.5,1.27])
 assert.deepEqual(snapPoint([0.64,-0.64],0.635),[0.635,-0.635])
 for(const step of [0,-1,NaN,Infinity])assert.throws(()=>snapPoint([0,0],step))
})
test('report includes pins and electrical endpoints, excludes decorative text, bounds output without mutation',()=>{
 const objects:any[]=[{type:'symbol',uuid:'s',reference:'U1',at:[2.54,2.54],pins:[{number:'1',at:[3.175,2.54]}]},
  {type:'wire',uuid:'w',from:[3.175,2.54],to:[5.08,2.54]},
  {type:'text',uuid:'t',at:[0.1,0.2]}]
 const before=JSON.stringify(objects),r=inspectGrid(objects,1.27,1)
 assert.equal(r.total,2);assert.deepEqual(r.counts,{pin:1,wire:1});assert.equal(r.issues[0]!.pin,'1')
 assert.equal(r.issues.length,1);assert.equal(r.truncated,true);assert.equal(JSON.stringify(objects),before)
 assert.equal(inspectGrid(objects,0.635).total,0)
})
test('region placement snaps against the sheet origin and reports off-grid pins without moving connected wires',async()=>{
 const root=await mkdtemp(join(tmpdir(),'schematic-grid-'))
 try{
  const library=join(root,'pins.kicad_sym')
  await writeFile(library,'(kicad_symbol_lib (version 20211014) (generator test) (symbol "Pins" (property "Reference" "U" (at 0 0 0) (effects (font (size 1 1)))) (symbol "Pins_1_1" (pin input line (at 0.635 0 0) (length 2.54) (name "IN" (effects (font (size 1 1)))) (number "1" (effects (font (size 1 1))))))))')
  const sch=new Schematic({projectName:'grid',title:'grid',paper:'A4',templateDir:fileURLToPath(new URL('../skills/kicad-schematic-design/templates',import.meta.url))})
  const region=sch.region({name:'offset',description:'test',origin:[10,10],size:[50,50]})
  region.addSymbol({libraryPath:library,libId:'Pins:Pins',reference:'U1',at:region.snap([5,5])})
  assert.deepEqual(sch.pinCatalog()[0]!.at,[15.24,15.24])
  const pin=sch.pin('U1','1');sch.wire({reference:'U1',pin:'1'},[20.32,pin[1]])
  const before=sch.render().schematic,report=sch.gridReport()
  assert.equal(report.counts.symbol,undefined);assert.equal(report.counts.pin,1);assert.equal(report.counts.wire,1)
  assert.deepEqual(sch.pin('U1','1'),pin)
  const saved=sch.save(join(root,'out'));assert.equal(saved.grid.total,2)
  const normalize=(s:string)=>s.replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g,'UUID')
  assert.equal(normalize(sch.render().schematic),normalize(before))
 }finally{await rm(root,{recursive:true,force:true})}
})
