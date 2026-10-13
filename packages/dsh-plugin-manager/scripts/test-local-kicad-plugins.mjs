import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const tests=[]
const selected=process.argv[2]==='--package'?process.argv[3]:undefined
for(const pkg of await readdir(join(root,'packages'))){
 if(!['dsh-plugin-manager','dsh-tool-kicad-schematic-gen'].includes(pkg))continue
 if(selected && selected!==pkg)continue
 try{for(const file of await readdir(join(root,'packages',pkg,'test'))){
  if(/\.test\.(?:ts|js|mjs)$/.test(file))tests.push(join(root,'packages',pkg,'test',file))
 }}catch(error){if(error.code!=='ENOENT')throw error}
}
if(!tests.length){if(selected){console.log(`No unit tests for ${selected}; run root checks and the live flow test.`);process.exit(0)}throw new Error('No tests found')}
const run=spawnSync(process.execPath,['--import','tsx','--test',...tests],{cwd:root,stdio:'inherit'})
process.exit(run.status??1)
