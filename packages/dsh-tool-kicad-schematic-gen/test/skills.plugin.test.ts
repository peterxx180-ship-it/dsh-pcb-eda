import assert from 'node:assert/strict'
import {test} from 'node:test'
import {access} from 'node:fs/promises'
import {apply} from '../src/skills.ts'
test('migrated skill resolves resources and instructs the split component flow',async()=>{
 let provider:any
 apply({effect:(fn:()=>unknown)=>fn(),skills:{registerProvider:(fn:()=>unknown)=>{provider=fn();return()=>{}}}} as never)
 const [candidate]=await provider.list()
 assert.equal(candidate.name,'kicad-schematic-design')
 assert.ok(candidate.resourceBase.path.includes('skills'))
 await access(candidate.locator)
 const skill=await provider.get(candidate,{signal:new AbortController().signal})
 assert.match(skill.content,/search_hqsch_parts/)
 assert.match(skill.content,/@local\/dsh-tool-kicad-schematic-gen/)
 assert.match(skill.content,/@huaqiu\/dsh-tool-part-search/)
 assert.match(skill.content,/manufacturer\.id/)
 assert.match(skill.content,/import_kicad_component/)
 assert.match(skill.content,/footprint: imported\.footprintId/)
 assert.ok(!skill.content.includes('@local/dsh-tool-part-search'))
 await access(new URL('../skills/kicad-schematic-design/references/component-pcb.md',import.meta.url))
 assert.ok(!skill.content.includes('search_kicad_components'))
})
