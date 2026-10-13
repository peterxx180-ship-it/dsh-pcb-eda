import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PluginController,POLICY_FILE} from '../src/controller.ts'
import {MANAGER_NAME} from '../src/state.ts'
// @ts-expect-error repository utility is JavaScript
import {switchSnapshot,restoreSwitches} from '../../../scripts/update-bundled-plugins-kicad.mjs'

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'switch-controller-')),packages=join(root,'packages'),profile=join(root,'profile')
 await mkdir(profile);await mkdir(packages)
 for(const [folder,name,alias] of [['auth','@huaqiu/dsh-auth','@huaqiu/dsh-auth'],['drc','@huaqiu/dsh-kicad-drc','dsh-kicad-drc'],['new','@local/new','@local/new'],['manager',MANAGER_NAME,MANAGER_NAME]]){
  await mkdir(join(packages,folder!));await writeFile(join(packages,folder!,'package.json'),JSON.stringify({name,dsh:{bundle:{patch:'cordis.patch.yml'}}}));await writeFile(join(packages,folder!,'cordis.patch.yml'),`- insert:\n    - name: '${alias}'\n`)
 }
 await mkdir(join(packages,'utility'));await writeFile(join(packages,'utility','package.json'),JSON.stringify({name:'utility'}))
 await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'@huaqiu/dsh-auth':'link:auth',[MANAGER_NAME]:'link:manager'},dsh:{profile:{bundles:['core','@huaqiu/dsh-auth',MANAGER_NAME]}}}))
 const make=(name:string)=>({options:{name,id:name},disabled:false,async update(input:{disabled:boolean}){this.disabled=input.disabled}})
 const entries=[make('@huaqiu/dsh-auth'),make('@huaqiu/dsh-auth'),make('dsh-kicad-drc'),make(MANAGER_NAME)]
 let installations=0
 const install=async()=>{installations++;const path=join(profile,'package.json'),manifest=JSON.parse(await readFile(path,'utf8'));manifest.dependencies['@local/new']='link:new';manifest.dsh.profile.bundles.push('@local/new');await writeFile(path,JSON.stringify(manifest))}
 const controller=new PluginController({entries:()=>entries},packages,profile,install)
 return {root,packages,profile,entries,controller,install,get installations(){return installations}}
}
test('unified catalog covers every plugin; disables all matching origins, persists and restores after updates',async()=>{
 const f=await fixture();assert.equal((await f.controller.list()).length,4)
 await f.controller.setEnabled('@huaqiu/dsh-auth',false)
 assert.ok(f.entries.slice(0,2).every(e=>e.disabled))
 const manifest=JSON.parse(await readFile(join(f.profile,'package.json'),'utf8'));assert.ok(!manifest.dsh.profile.bundles.includes('@huaqiu/dsh-auth'))
 f.entries.slice(0,2).forEach(e=>e.disabled=false)
 await f.controller.reconcile();assert.ok(f.entries.slice(0,2).every(e=>e.disabled))
 assert.equal((await f.controller.list()).find(p=>p.name==='@huaqiu/dsh-auth')!.enabled,false)
 await f.controller.setEnabled('@huaqiu/dsh-kicad-drc',false);assert.equal(f.entries[2]!.disabled,true)
 await assert.rejects(f.controller.setEnabled(MANAGER_NAME,false),/cannot disable itself/)
 await assert.rejects(f.controller.setEnabled('missing',true),/not in the catalog/)
})
test('enable registers absent plugin once; legacy disabled choices migrate and failure rolls back',async()=>{
 const f=await fixture();assert.equal((await f.controller.setEnabled('@local/new',true)).restartRequired,true);await f.controller.setEnabled('@local/new',true);assert.equal(f.installations,1)
 const legacy=join(f.root,'legacy.json');await writeFile(legacy,JSON.stringify({disabled:['@huaqiu/dsh-auth']}))
 const controller=new PluginController({entries:()=>f.entries},f.packages,f.profile,f.install,legacy)
 await controller.reconcile();assert.equal(f.entries[0]!.disabled,true)
 await controller.setEnabled('@huaqiu/dsh-auth',true);await controller.reconcile();assert.equal(f.entries[0]!.disabled,false)
 const original=f.entries[1]!.update;f.entries[1]!.update=async()=>{throw new Error('loader failed')}
 await assert.rejects(controller.setEnabled('@huaqiu/dsh-auth',false),/loader failed/)
 f.entries[1]!.update=original
 assert.equal(f.entries[0]!.disabled,false)
 const policy=JSON.parse(await readFile(join(f.profile,POLICY_FILE),'utf8'));assert.equal(policy.enabled['@huaqiu/dsh-auth'],true)
})
test('bulk update preserves disabled switches and prior bundle choices',async()=>{
 const f=await fixture();await f.controller.setEnabled('@huaqiu/dsh-auth',false)
 const choices=switchSnapshot(f.profile)
 const path=join(f.profile,'package.json'),manifest=JSON.parse(await readFile(path,'utf8'))
 manifest.dsh.profile.bundles.push('@huaqiu/dsh-auth','newly-installed');manifest.dependencies['newly-installed']='link:new'
 await writeFile(path,JSON.stringify(manifest));restoreSwitches(f.profile,choices)
 const after=JSON.parse(await readFile(path,'utf8'))
 assert.ok(!after.dsh.profile.bundles.includes('@huaqiu/dsh-auth'));assert.ok(after.dsh.profile.bundles.includes('core'));assert.ok(after.dsh.profile.bundles.includes('newly-installed'))
})
