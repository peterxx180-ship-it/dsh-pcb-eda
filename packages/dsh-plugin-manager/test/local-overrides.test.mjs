import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {HOST_HELPER_SOURCE,patchKicadHost,switchSnapshot,restoreSwitches} from '../../../scripts/update-bundled-plugins-kicad.mjs';
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
