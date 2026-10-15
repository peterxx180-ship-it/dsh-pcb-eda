/** Validate the private KiCad extensions independently of public npm release gates. */
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {join} from 'node:path'
import {repoRoot,dshPlugins,publishablePackages} from '../../../scripts/utils/packages.mjs'
const names=['dsh-plugin-manager','dsh-tool-kicad-schematic-gen']
for(const name of names){
 const dir=join(repoRoot,'packages',name),pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'))
 assert.equal(pkg.name,`@local/${name}`);assert.equal(pkg.private,true)
 assert.ok(dshPlugins().some(p=>p.name===pkg.name));assert.ok(!publishablePackages().some(p=>p.name===pkg.name))
 for(const file of [pkg.main,pkg.types,'lib/client.js',pkg.dsh.bundle.patch])await access(join(dir,file))
 assert.ok((await readFile(join(dir,pkg.dsh.bundle.patch),'utf8')).includes(pkg.name))
}
const base=join(repoRoot,'packages/dsh-tool-kicad-schematic-gen')
await access(join(base,'lib/builder.js'))
const skill=await readFile(join(base,'skills/kicad-schematic-design/SKILL.md'),'utf8')
assert.ok(skill.includes('search_hqsch_parts'));assert.ok(skill.includes('delivery: true'))
const reference=await readFile(join(base,'skills/kicad-schematic-design/references/programming.md'),'utf8')
assert.ok(reference.includes('DSH_SCHEMATIC_PLUGIN_DIR'));assert.ok(!reference.includes('D:/kicad/'))
const manager=await readFile(join(repoRoot,'packages/dsh-plugin-manager/cordis.patch.yml'),'utf8')
assert.ok(!/[A-Za-z]:[\\/]/.test(manager), 'Manager patch must not contain machine-specific paths')
const library=await import(new URL('../../dsh-tool-kicad-schematic-gen/lib/index.js',import.meta.url))
const tools=[]
library.apply({get:()=>undefined,effect:fn=>fn(),skills:{registerProvider:()=>()=>{}},tools:{register:t=>{tools.push(t);return()=>{}}}},library.resolveConfig())
assert.equal(tools.length,13)
console.log('PASS: two private plugins, client bundles, 13 tools, migrated skill paths and updater discovery.')
