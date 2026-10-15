import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync,realpathSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {HOST_HELPER_SOURCE,patchKicadHost,switchSnapshot,restoreSwitches,preflightInstall,installationTransaction} from '../../../scripts/update-bundled-plugins-kicad.mjs';
const helperModule={exports:{}};
new Function('require','module',HOST_HELPER_SOURCE)(createRequire(import.meta.url),helperModule);
const helper=helperModule.exports;
test('local overrides survive host relinking, suppress duplicate overlays, retain auth endpoint and disabled choices',()=>{
 const root=mkdtempSync(join(tmpdir(),'kicad-overrides-'));
 try{
  const profile=join(root,'profile'),dir=join(root,'auth');mkdirSync(profile);mkdirSync(dir);
  const plugin={packageName:'@huaqiu/auth',entryId:'auth',config:{hqEdgeBaseUrl:'http://localhost:1234'}};
  writeFileSync(join(dir,'package.json'),JSON.stringify({name:plugin.packageName,main:'index.js',dsh:{bundle:{patch:'cordis.patch.yml'}}}));
  writeFileSync(join(dir,'index.js'),'');writeFileSync(join(dir,'cordis.patch.yml'),'[]');
  const manifest={dependencies:{[plugin.packageName]:'link:'+dir},dsh:{profile:{bundles:[plugin.packageName]}}};
  writeFileSync(join(profile,'package.json'),JSON.stringify(manifest));
  let overrides=helper.resolveProfileOverrides(profile,[plugin]);
  assert.equal(overrides.get(plugin.packageName).directory,dir);
  assert.equal([plugin].filter(p=>!overrides.has(p.packageName)).length,0);
  assert.match(helper.overlayConfigPatches([plugin],overrides),/id: "auth"/);
  assert.match(helper.overlayConfigPatches([plugin],overrides),/hqEdgeBaseUrl/);
  writeFileSync(join(profile,'kicad-plugin-state.json'),JSON.stringify({version:1,enabled:{[plugin.packageName]:false}}));
  restoreSwitches(profile,switchSnapshot(profile));
  overrides=helper.resolveProfileOverrides(profile,[plugin]);
  assert.equal(overrides.get(plugin.packageName).enabled,false);
  assert.equal(helper.overlayConfigPatches([plugin],overrides),'');
  rmSync(join(dir,'cordis.patch.yml'));
  assert.throws(()=>helper.resolveProfileOverrides(profile,[plugin]),/Invalid KiCad local plugin override/);
 }finally{rmSync(root,{recursive:true,force:true})}
});

function installationFixture(root){
 const installRoot=join(root,'runtime'),dshHome=join(root,'dsh-home','kicad'),profileDir=join(dshHome,'profiles','web');
 mkdirSync(join(installRoot,'bin'),{recursive:true});mkdirSync(dshHome,{recursive:true});
 for(const file of ['hq-edge-server.cjs','dsh-cli.cjs',process.platform==='win32'?'node.exe':'node'])writeFileSync(join(installRoot,'bin',file),file==='hq-edge-server.cjs'?'// DSH_LOCAL_OVERRIDES_V1\noriginal host':'');
 const plugin=join(root,'workspace','packages','sample');mkdirSync(join(plugin,'lib'),{recursive:true});
 writeFileSync(join(plugin,'package.json'),JSON.stringify({name:'sample',main:'lib/index.js',dsh:{bundle:{patch:'cordis.patch.yml'}}}));
 writeFileSync(join(plugin,'cordis.patch.yml'),'[]');writeFileSync(join(plugin,'lib/index.js'),'export const name="sample";');
 return {resolved:{installRoot,dshHome,profileDir},plugins:[plugin]};
}

test('preflight supports a first installation and rejects unsupported hosts before changing files',()=>{
 const root=mkdtempSync(join(tmpdir(),'kicad-preflight-'));
 try{
  const {resolved,plugins}=installationFixture(root);
  assert.deepEqual(switchSnapshot(resolved.profileDir),{});
  restoreSwitches(resolved.profileDir,{});
  assert.deepEqual(preflightInstall(resolved,plugins),{});
  assert.equal(existsSync(resolved.profileDir),false);
  assert.deepEqual(readdirSync(resolved.dshHome),[]);
  writeFileSync(join(resolved.installRoot,'bin/hq-edge-server.cjs'),'incompatible host');
  assert.throws(()=>preflightInstall(resolved,plugins),/Unsupported/);
  assert.equal(readFileSync(join(resolved.installRoot,'bin/hq-edge-server.cjs'),'utf8'),'incompatible host');
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('failed updates restore the complete profile, previous links and runtime without following junctions',()=>{
 const root=mkdtempSync(join(tmpdir(),'kicad-rollback-'));
 try{
  const {resolved,plugins}=installationFixture(root),profile=resolved.profileDir;
  mkdirSync(join(profile,'node_modules'),{recursive:true});
  writeFileSync(join(profile,'package.json'),'original profile');
  writeFileSync(join(profile,'pnpm-lock.yaml'),'original lock');
  symlinkSync(plugins[0],join(profile,'node_modules','sample'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>installationTransaction(resolved,()=>{
   writeFileSync(join(profile,'package.json'),'updated');
   writeFileSync(join(profile,'new-file'),'added');
   rmSync(join(profile,'node_modules','sample'));
   writeFileSync(join(resolved.installRoot,'bin/hq-edge-server.cjs'),'patched');
   writeFileSync(join(resolved.installRoot,'bin/kicad-local-overrides.cjs'),'new helper');
   throw new Error('simulated registration failure');
  }),/previous state/);
  assert.equal(readFileSync(join(profile,'package.json'),'utf8'),'original profile');
  assert.equal(readFileSync(join(profile,'pnpm-lock.yaml'),'utf8'),'original lock');
  assert.equal(existsSync(join(profile,'new-file')),false);
  assert.equal(realpathSync(join(profile,'node_modules','sample')),realpathSync(plugins[0]));
  assert.equal(readFileSync(join(resolved.installRoot,'bin/hq-edge-server.cjs'),'utf8'),'// DSH_LOCAL_OVERRIDES_V1\noriginal host');
  assert.equal(existsSync(join(resolved.installRoot,'bin/kicad-local-overrides.cjs')),false);
  assert.ok(existsSync(join(plugins[0],'lib/index.js')));
  assert.equal(readdirSync(join(resolved.dshHome,'plugin-update-backups')).length,1);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('first-install failure removes the new profile and successful update removes its temporary backup',()=>{
 const root=mkdtempSync(join(tmpdir(),'kicad-first-install-'));
 try{
  const {resolved}=installationFixture(root);
  assert.throws(()=>installationTransaction(resolved,()=>{
   mkdirSync(resolved.profileDir,{recursive:true});writeFileSync(join(resolved.profileDir,'package.json'),'partial');throw new Error('first install failed');
  }),/previous state/);
  assert.equal(existsSync(resolved.profileDir),false);
  const backups=readdirSync(join(resolved.dshHome,'plugin-update-backups')).length;
  installationTransaction(resolved,()=>{mkdirSync(resolved.profileDir,{recursive:true});writeFileSync(join(resolved.profileDir,'package.json'),'complete');});
  assert.equal(readFileSync(join(resolved.profileDir,'package.json'),'utf8'),'complete');
  assert.equal(readdirSync(join(resolved.dshHome,'plugin-update-backups')).length,backups);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('runtime patch is guarded, backed up and idempotent',()=>{
 const root=mkdtempSync(join(tmpdir(),'kicad-host-'));
 try{
  mkdirSync(join(root,'bin'));const target=join(root,'bin/hq-edge-server.cjs');
  const original='const desiredOverlay = buildHqPluginOverlay(plugins, disabledIds);\nlink(\npath8.join(bundleDir, path8.basename(plugin.sourceDir))\n      );';
  writeFileSync(target,original);patchKicadHost(root);const once=readFileSync(target,'utf8');
  assert.equal(readFileSync(target+'.before-local-overrides','utf8'),original);
  assert.match(once,/plugins.filter/);assert.match(once,/localOverrides.get/);
  patchKicadHost(root);assert.equal(readFileSync(target,'utf8'),once);
  writeFileSync(target,'unsupported version');assert.throws(()=>patchKicadHost(root),/Unsupported/);
  assert.equal(readFileSync(target,'utf8'),'unsupported version');
 }finally{rmSync(root,{recursive:true,force:true})}
});
