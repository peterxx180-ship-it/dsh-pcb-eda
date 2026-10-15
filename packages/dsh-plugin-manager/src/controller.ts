/** One directory-based catalog and persisted switch policy for all loader origins. */
import {readFile,writeFile,rename} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {catalog,MANAGER_NAME,type LocalPlugin} from './state.ts'
import type {Loader,LoaderEntry} from './loader.ts'

export interface PluginRow extends LocalPlugin { active:boolean; restartRequired:boolean }
export interface SwitchPolicy {version:1;enabled:Record<string,boolean>}
export const POLICY_FILE='kicad-plugin-state.json'
async function json(path:string){return JSON.parse(await readFile(path,'utf8'))}
async function atomic(path:string,value:unknown){const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temp,path)}
export async function readPolicy(profileDir:string):Promise<SwitchPolicy>{
 try{
  const policy=await json(join(profileDir,POLICY_FILE))
  if(policy.version!==1||!policy.enabled||typeof policy.enabled!=='object'||Array.isArray(policy.enabled)||Object.values(policy.enabled).some(v=>typeof v!=='boolean'))throw new Error('Invalid plugin switch policy')
  return policy
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return {version:1,enabled:{}}}
}
export class PluginController {
 private pending:Promise<unknown>=Promise.resolve()
 constructor(private loader:Loader,private pluginsDir:string,private profileDir:string,private install:(folder:string)=>Promise<void>,private legacyState?:string){}
 private serialize<T>(fn:()=>Promise<T>):Promise<T>{const next=this.pending.then(fn);this.pending=next.catch(()=>{});return next}
 private async entries(plugin:LocalPlugin):Promise<LoaderEntry[]>{
  const pkg=await json(join(this.pluginsDir,plugin.folder,'package.json'))
  const patch=await readFile(join(this.pluginsDir,plugin.folder,pkg.dsh.bundle.patch),'utf8')
  const aliases=new Set([plugin.name,...[...patch.matchAll(/^\s*(?:-\s*)?name:\s*['"]?([^'"\s#]+)['"]?\s*$/gm)].map(m=>m[1]!)])
  return [...this.loader.entries()].filter(entry=>aliases.has(entry.options.name))
 }
 private async policy(){
  const policy=await readPolicy(this.profileDir)
  if(this.legacyState){
   try{const legacy=await json(this.legacyState);for(const name of legacy.disabled??[])if(typeof name==='string'&&!Object.hasOwn(policy.enabled,name))policy.enabled[name]=false}
   catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  }
  return policy
 }
 async list():Promise<PluginRow[]>{return this.serialize(async()=>{
  const policy=await this.policy(),plugins=await catalog(this.pluginsDir,this.profileDir)
  return Promise.all(plugins.map(async plugin=>{
   const entries=await this.entries(plugin),active=entries.some(entry=>!entry.disabled)
   const enabled=plugin.protected?true:policy.enabled[plugin.name]??(entries.length?active:plugin.enabled)
   return {...plugin,installed:plugin.installed||entries.length>0,enabled,active,restartRequired:enabled!==active}
  }))
 })}
 async reconcile(){return this.serialize(async()=>{
  const policy=await this.policy(),plugins=await catalog(this.pluginsDir,this.profileDir)
  for(const plugin of plugins){
   if(plugin.protected||!Object.hasOwn(policy.enabled,plugin.name))continue
   for(const entry of await this.entries(plugin))if(entry.disabled===policy.enabled[plugin.name])await entry.update({disabled:!policy.enabled[plugin.name]})
  }
  await atomic(join(this.profileDir,POLICY_FILE),policy)
 })}
 async setEnabled(name:unknown,enabled:unknown){return this.serialize(async()=>{
  if(typeof name!=='string'||typeof enabled!=='boolean')throw new Error('Invalid switch request')
  if(name===MANAGER_NAME)throw new Error('The plugin manager cannot disable itself')
  const plugin=(await catalog(this.pluginsDir,this.profileDir)).find(row=>row.name===name)
  if(!plugin)throw new Error('Plugin is not in the catalog')
  let entries=await this.entries(plugin),installed=false
  if(enabled&&!entries.length&&!plugin.installed){await this.install(join(this.pluginsDir,plugin.folder));installed=true;entries=await this.entries(plugin)}
  const policy=await this.policy(),before={version:1 as const,enabled:{...policy.enabled}}
  const manifestPath=join(this.profileDir,'package.json'),manifest=await json(manifestPath),oldManifest=JSON.parse(JSON.stringify(manifest))
  if(manifest.dependencies?.[name]){
   const bundles=manifest.dsh?.profile?.bundles
   if(!Array.isArray(bundles))throw new Error('Invalid profile bundles')
   manifest.dsh.profile.bundles=enabled?[...new Set([...bundles,name])]:bundles.filter((bundle:string)=>bundle!==name)
  }
  const runtime=entries.map(entry=>({entry,disabled:entry.disabled}))
  try{
   for(const entry of entries)if(entry.disabled===enabled)await entry.update({disabled:!enabled})
   policy.enabled[name]=enabled
   await atomic(manifestPath,manifest)
   await atomic(join(this.profileDir,POLICY_FILE),policy)
  }catch(error){
   const rollbacks=await Promise.allSettled(runtime.filter(item=>item.entry.disabled!==item.disabled).map(item=>item.entry.update({disabled:item.disabled})))
   await atomic(manifestPath,oldManifest);await atomic(join(this.profileDir,POLICY_FILE),before)
   if(rollbacks.some(result=>result.status==='rejected'))throw new Error('Switch failed and runtime rollback was incomplete; saved choices restored. Restart KiCad.',{cause:error})
   throw error
  }
  return {changed:installed||before.enabled[name]!==enabled||runtime.some(item=>item.disabled===enabled),restartRequired:enabled&&!entries.length}
 })}
}
