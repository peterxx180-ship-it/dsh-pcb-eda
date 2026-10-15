#!/usr/bin/env node
/**
 * Refresh every local DSH plugin into the INSTALLED KiCad HQ Edge runtime's
 * DSH home — the `kicad` target-host home — instead of the generic one.
 *
 * Why this exists:
 *   The installed KiCad ships its own edge-headless runtime. Its bundled `dsh`
 *   CLI resolves DSH_HOME to
 *
 *       <hqEdgeHome>/<version>/dsh-home/kicad
 *
 *   (host-scoped; see hq-edge `apps/server/src/dsh/dshHome.ts` — HQ Edge is
 *   bundled into `hq-eda`, `kicad` and `generic`, and one installation must
 *   never let two hosts share DSH state). Running the *installed* `dsh` shim
 *   with `plugin --profile web add <local dir>` therefore lands in the kicad
 *   host home, never the generic hq-eda one.
 *
 * What it does:
 *   1. Builds all workspace packages — plugins ship compiled `lib/` output, and
 *      the installed runtime loads that, not the TypeScript source.
 *   2. Locates the installed `dsh` shim, injects HQ_TARGET_HOST=kicad (the same
 *      host handshake KiCad's launcher uses; the bundled dsh CLI derives the
 *      home from HQ_TARGET_HOST, see hq-edge dsh-cli.ts), drops any inherited
 *      DSH_HOME override, and verifies via `dsh --hq-paths` that the resolved
 *      home is .../dsh-home/kicad. Aborts otherwise, so this update can never
 *      land in the generic hq-eda home — even though the registry-owned shim
 *      may currently point at a generic runtime ("last installed wins").
 *   3. Runs `dsh plugin --profile web add <dir>` for every local DSH plugin
 *      EXCEPT `dsh-hqsch`, which belongs to the generic/schematic host and is
 *      skipped while targeting kicad. (Unlike launch-dsh.mjs, dsh-eda-host IS
 *      included: kicad is an embedded host and needs a live link to its local
 *      host bridge; the standalone official dsh that launch-dsh targets ships
 *      its own.)
 *
 * Usage:
 *   pnpm update-bundled-plugins:kicad
 *
 * Prerequisites: KiCad Huaqiu (with the bundled edge-headless runtime) is
 * installed, so that `C:\Program Files\Common Files\KiCad\bin\dsh.cmd` (or the
 * `dsh` on PATH) exists. Do NOT set DSH_HOME in the shell — this script strips
 * it and targets the kicad host home explicitly via HQ_TARGET_HOST.
 */

'use strict';

import { execSync, execFileSync } from 'node:child_process';
import { existsSync,readFileSync,writeFileSync,renameSync,copyFileSync,mkdirSync,rmSync,accessSync,constants,lstatSync,readdirSync,readlinkSync,symlinkSync,statSync } from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import { dshPlugins, repoRoot } from './utils/packages.mjs';

const PROFILE = 'web';
const {join}=path;
export const HOST_HELPER_SOURCE="/* Loaded by the installed HQ Edge host before it generates its overlay. */\nconst fs = require('node:fs');\nconst path = require('node:path');\nfunction resolveProfileOverrides(profileDir, plugins) {\n  const filename = path.join(profileDir, 'package.json');\n  if (!fs.existsSync(filename)) return new Map();\n  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));\n  const overrides = new Map();\n  for (const plugin of plugins) {\n    const spec = manifest.dependencies?.[plugin.packageName];\n    if (typeof spec !== 'string' || !spec.startsWith('link:')) continue;\n    const directory = path.resolve(profileDir, spec.slice(5));\n    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));\n    if (pkg.name !== plugin.packageName || !pkg.dsh?.bundle?.patch ||\n        !fs.existsSync(path.join(directory, pkg.dsh.bundle.patch)) ||\n        !pkg.main || !fs.existsSync(path.join(directory, pkg.main))) {\n      throw new Error(`Invalid KiCad local plugin override: ${plugin.packageName} at ${directory}`);\n    }\n    overrides.set(plugin.packageName, {directory, enabled: (manifest.dsh?.profile?.bundles ?? []).includes(plugin.packageName)});\n  }\n  return overrides;\n}\nfunction overlayConfigPatches(plugins, overrides) {\n  let result = '';\n  for (const plugin of plugins) {\n    if (!overrides.get(plugin.packageName)?.enabled || !plugin.config) continue;\n    result += `- id: ${JSON.stringify(plugin.entryId)}\\n  config:\\n`;\n    for (const [key,value] of Object.entries(plugin.config)) result += `    ${key}: ${JSON.stringify(value)}\\n`;\n  }\n  return result;\n}\nmodule.exports = {resolveProfileOverrides, overlayConfigPatches};\n";
export function switchSnapshot(profileDir){
 let manifest={};
 try{manifest=JSON.parse(readFileSync(join(profileDir,'package.json'),'utf8'))}
 catch(error){if(error.code!=='ENOENT')throw error}
 const choices=Object.fromEntries(Object.keys(manifest.dependencies??{}).map(name=>[name,(manifest.dsh?.profile?.bundles??[]).includes(name)]))
 try{
  const policy=JSON.parse(readFileSync(join(profileDir,'kicad-plugin-state.json'),'utf8'))
  if(policy.version!==1||!policy.enabled||typeof policy.enabled!=='object'||Object.values(policy.enabled).some(value=>typeof value!=='boolean'))throw new Error('Invalid plugin switch policy')
  Object.assign(choices,policy.enabled)
 }catch(error){if(error.code!=='ENOENT')throw error}
 return choices
}
export function restoreSwitches(profileDir,choices){
 if(!existsSync(join(profileDir,'package.json'))){
  if(Object.keys(choices).length)throw new Error('Profile manifest missing while restoring plugin switches');
  return;
 }
 const path=join(profileDir,'package.json'),manifest=JSON.parse(readFileSync(path,'utf8'))
 const bundles=new Set(manifest.dsh?.profile?.bundles??[])
 for(const [name,enabled] of Object.entries(choices)){
  if(!Object.hasOwn(manifest.dependencies??{},name))continue
  if(enabled)bundles.add(name);else bundles.delete(name)
 }
 manifest.dsh??={};manifest.dsh.profile??={};manifest.dsh.profile.bundles=[...bundles]
 const temp=path+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(manifest,null,2)+'\n');renameSync(temp,path)
}

export function patchedHostSource(source) {
 const marker='// DSH_LOCAL_OVERRIDES_V1';
 if(!source.includes(marker)) {
  const old='const desiredOverlay = buildHqPluginOverlay(plugins, disabledIds);';
  const link='path8.join(bundleDir, path8.basename(plugin.sourceDir))\n      );';
  if(source.split(old).length!==2 || source.split(link).length!==2)throw new Error('Unsupported HQ Edge host layout; local override patch not applied');
  source=source.replace(old,`${marker}
    const overrideProfileDir = path8.join(dshHome, "profiles", "web");
    const {resolveProfileOverrides, overlayConfigPatches} = require("./kicad-local-overrides.cjs");
    const localOverrides = resolveProfileOverrides(overrideProfileDir, plugins);
    const desiredOverlay = buildHqPluginOverlay(plugins.filter(p => !localOverrides.has(p.packageName)), disabledIds) + overlayConfigPatches(plugins, localOverrides);`);
  source=source.replace(link,'localOverrides.get(plugin.packageName)?.directory ?? path8.join(bundleDir, path8.basename(plugin.sourceDir))\n      );');
 }
 return source;
}
export function patchKicadHost(installRoot) {
 const target=join(installRoot,'bin/hq-edge-server.cjs');
 const source=readFileSync(target,'utf8'),next=patchedHostSource(source);
 if(source!==next){
  const backup=target+'.before-local-overrides';
  if(!existsSync(backup))copyFileSync(target,backup);
  writeFileSync(target,next);
 }
 writeFileSync(join(installRoot,'bin/kicad-local-overrides.cjs'), HOST_HELPER_SOURCE);
}

/** Temporary write probes never rewrite existing settings or runtime files. */
function probeWritable(directory) {
 let parent=directory;
 while(!existsSync(parent)){
  const next=path.dirname(parent);if(next===parent)throw new Error(`No existing parent directory for ${directory}`);parent=next;
 }
 const probe=join(parent,`.dsh-update-probe-${randomUUID()}`);
 try{writeFileSync(probe,'',{flag:'wx'});}finally{if(existsSync(probe))rmSync(probe);}
}

export function preflightInstall(resolved,plugins,{built=true}={}) {
 for(const key of ['installRoot','dshHome','profileDir'])if(!path.isAbsolute(resolved[key]??''))throw new Error(`Invalid launcher path: ${key}`);
 if(path.resolve(resolved.profileDir)!==path.resolve(resolved.dshHome,'profiles',PROFILE))throw new Error('Launcher profileDir does not match the KiCad web profile');
 const bin=join(resolved.installRoot,'bin');
 for(const file of ['hq-edge-server.cjs','dsh-cli.cjs',process.platform==='win32'?'node.exe':'node']){
  if(!existsSync(join(bin,file)))throw new Error(`Missing KiCad runtime file: ${join(bin,file)}`);
 }
 patchedHostSource(readFileSync(join(bin,'hq-edge-server.cjs'),'utf8'));
 accessSync(join(bin,'hq-edge-server.cjs'),constants.W_OK);
 if(existsSync(join(bin,'kicad-local-overrides.cjs')))accessSync(join(bin,'kicad-local-overrides.cjs'),constants.W_OK);
 probeWritable(bin);probeWritable(resolved.profileDir);
 if(!plugins.length)throw new Error('No local DSH plugins discovered under packages/.');
 for(const dir of plugins){
  const pkg=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
  if(!pkg.name||!pkg.main||!pkg.dsh?.bundle?.patch)throw new Error(`Invalid plugin manifest: ${dir}`);
  for(const file of [pkg.dsh.bundle.patch,...(built ? [pkg.main, ...(pkg.dsh.client ? ['lib/client.js'] : [])] : [])]){
   if(!existsSync(join(dir,file)))throw new Error(`Incomplete plugin build: ${pkg.name}: ${file}`);
  }
 }
 // Parse existing switch policy before any runtime/profile mutation.
 return switchSnapshot(resolved.profileDir);
}

function removeOwnedTree(target,parent){
 const rel=path.relative(path.resolve(parent),path.resolve(target));
 if(!rel||rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw new Error(`Refusing to remove outside backup/profile parent: ${target}`);
 rmSync(target,{recursive:true,force:true});
}

function copyProfileTree(source,destination,links=[],rel=''){
 mkdirSync(join(destination,rel),{recursive:true});
 for(const name of readdirSync(join(source,rel))){
  const key=join(rel,name),from=join(source,key),info=lstatSync(from);
  if(info.isSymbolicLink()){
   let directory=true;try{directory=statSync(from).isDirectory();}catch{}
   links.push({key,target:readlinkSync(from),directory});
  }else if(info.isDirectory())copyProfileTree(source,destination,links,key);
  else if(info.isFile())copyFileSync(from,join(destination,key));
  else throw new Error(`Unsupported profile file type: ${from}`);
 }
 return links;
}
function restoreProfileTree(backup,profile,links){
 copyProfileTree(backup,profile);
 for(const link of links){
  const target=join(profile,link.key);mkdirSync(path.dirname(target),{recursive:true});
  symlinkSync(link.target,target,process.platform==='win32'&&link.directory?'junction':link.directory?'dir':'file');
 }
}

/** Snapshot profile including links (without following them) and patched runtime files. */
export function installationTransaction(resolved,action) {
 const profile=resolved.profileDir;
 if(existsSync(profile)&&lstatSync(profile).isSymbolicLink())throw new Error('Profile directory must not be a junction during an update');
 const backup=join(resolved.dshHome,'plugin-update-backups',randomUUID());mkdirSync(backup,{recursive:true});
 const profileExisted=existsSync(profile);
 const links=profileExisted?copyProfileTree(profile,join(backup,'profile')):[];
 const targets=['hq-edge-server.cjs','hq-edge-server.cjs.before-local-overrides','kicad-local-overrides.cjs'].map(name=>join(resolved.installRoot,'bin',name));
 const files=targets.map((target,i)=>{
  const existed=existsSync(target);if(existed)copyFileSync(target,join(backup,`runtime-${i}`));return {target,existed,backup:join(backup,`runtime-${i}`)};
 });
 writeFileSync(join(backup,'recovery.json'),JSON.stringify({profile,profileExisted,files,links},null,2));
 try{
  const result=action();
  removeOwnedTree(backup,join(resolved.dshHome,'plugin-update-backups'));
  return result;
 }catch(error){
  const failures=[];
  try{removeOwnedTree(profile,path.dirname(profile));if(profileExisted)restoreProfileTree(join(backup,'profile'),profile,links);}catch(e){failures.push(e.message);}
  for(const file of files)try{if(file.existed)copyFileSync(file.backup,file.target);else rmSync(file.target,{force:true});}catch(e){failures.push(e.message);}
  throw new Error(`${error.message}\n${failures.length?'Rollback incomplete: '+failures.join('; '):'Runtime and profile restored to their previous state.'}\nRecovery backup: ${backup}`,{cause:error});
 }
}

export function verifyInstalledPlugins(resolved,plugins) {
 const installed=JSON.parse(readFileSync(join(resolved.profileDir,'package.json'),'utf8'));
 const modules=[];
 for(const dir of plugins){
  const pkg=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
  const spec=installed.dependencies?.[pkg.name];
  if(typeof spec!=='string'||!spec.startsWith('link:')||path.resolve(resolved.profileDir,spec.slice(5))!==path.resolve(dir))throw new Error(`Plugin link registration missing: ${pkg.name}`);
  modules.push(join(dir,pkg.main));
 }
 const executable=join(resolved.installRoot,'bin',process.platform==='win32'?'node.exe':'node');
 execFileSync(executable,['--input-type=module','-e',`import {pathToFileURL} from 'node:url';for(const file of JSON.parse(process.argv[1]))await import(pathToFileURL(file).href);`,JSON.stringify(modules)],{
  env:{...childEnv(),DSH_HOME:resolved.dshHome},windowsHide:true,timeout:60000,maxBuffer:2000000,stdio:['ignore','pipe','pipe'],
 });
}



/**
 * Plugins that must NOT be added to the kicad profile:
 *  - dsh-hqsch: schematic-host plugin set, excluded when targeting kicad.
 *
 * NOTE: dsh-eda-host IS added here, unlike scripts/launch-dsh.mjs — that flow
 * targets the standalone official dsh, which ships its own host bridge; this
 * flow targets the EMBEDDED kicad runtime, whose dsh-eda-host must itself be a
 * live link to the local source under development.
 */
const SKIP_DIR_SUBSTRINGS = ['dsh-hqsch'];

/**
 * Child environment for every installed-`dsh` invocation.
 *
 * HQ_TARGET_HOST=kicad is what makes the bundled dsh CLI derive the
 * .../dsh-home/kicad tree instead of the generic one (see hq-edge
 * apps/server/src/dsh/dsh-cli.ts: `parseTargetHost(env.HQ_TARGET_HOST)`). An
 * inherited DSH_HOME would override host resolution entirely, so it is
 * deliberately stripped — the --hq-paths guard below then proves where we land.
 */
function childEnv() {
  const env = { ...process.env, HQ_TARGET_HOST: 'kicad' };
  delete env.DSH_HOME;
  return env;
}

function run(cmd, args = [], options = {}) {
  const quotedCmd = /\s/.test(cmd) ? `"${cmd}"` : cmd;
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a));
  console.log(`> ${quotedCmd} ${quoted.join(' ')}`);
  execSync(`${quotedCmd} ${quoted.join(' ')}`, {
    stdio: 'inherit',
    shell: true, // needed for .cmd shims on Windows
    env: childEnv(),
    cwd: repoRoot,
    windowsHide: true,
    ...options,
  });
}

/**
 * Locate the installed KiCad `dsh` shim.
 *
 * The installer drops a stable shim at <Common Files>\KiCad\bin\dsh.cmd, which
 * itself resolves the newest bundled edge-headless runtime via the registry.
 * Honour HQ_KICAD_DSH_CMD for one-off overrides; fall back to `dsh` on PATH.
 */
function locateDshCmd() {
  const candidates = [];
  if (process.env.HQ_KICAD_DSH_CMD) candidates.push(process.env.HQ_KICAD_DSH_CMD);
  if (process.platform === 'win32') {
    for (const root of [process.env['ProgramW6432'], process.env['ProgramFiles'], process.env['CommonProgramW6432'], process.env['CommonProgramFiles']]) {
      if (root) candidates.push(path.join(root, 'Common Files', 'KiCad', 'bin', 'dsh.cmd'));
      if (root) candidates.push(path.join(root, 'KiCad', 'bin', 'dsh.cmd'));
    }
  }
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Last resort: whatever `dsh` resolves to on PATH.
  try {
    const which = process.platform === 'win32' ? 'where dsh' : 'which dsh';
    const found = execSync(which, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (found) return found;
  } catch {
    // not on PATH either
  }
  throw new Error(
    'Installed KiCad `dsh` shim not found.\n' +
      '  Expected C:\\Program Files\\Common Files\\KiCad\\bin\\dsh.cmd (or `dsh` on PATH).\n' +
      '  Install KiCad Huaqiu, or set HQ_KICAD_DSH_CMD to the shim explicitly.',
  );
}

/**
 * Ask the installed runtime where it would put DSH state, and assert it is the
 * kicad host home. This is the guard that keeps "update-bundled-plugins:kicad"
 * from ever writing into the generic hq-eda home.
 */
function assertTargetsKicadHome(dshCmd) {
  let stdout;
  try {
    stdout = execSync(`"${dshCmd}" --hq-paths`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: childEnv(),
    });
  } catch (e) {
    throw new Error(
      `Could not query "${dshCmd}" --hq-paths: ${e.message}\n` +
        '  The installed runtime may be older than the bundled dsh launcher.',
    );
  }
  const res = JSON.parse(stdout);
  const home = (res.dshHome || '').replace(/\\/g, '/');
  if (!home.endsWith('/dsh-home/kicad')) {
    throw new Error(
      `Refusing to update plugins: with HQ_TARGET_HOST=kicad the installed dsh\n` +
        `  still resolves DSH_HOME to:\n    ${res.dshHome}\n` +
        '  which is NOT the kicad host home (expected .../dsh-home/kicad).\n' +
        '  This usually means a DSH_HOME override is set in this shell (this script\n' +
        '  strips it, but an outer wrapper may re-inject it). Unset DSH_HOME and retry.',
    );
  }
  return res;
}

function main() {
  let stage='locate KiCad runtime';
  try {
    const dshCmd=locateDshCmd(),resolved=assertTargetsKicadHome(dshCmd);
    const plugins=dshPlugins().map(p=>p.dir).filter(dir=>!SKIP_DIR_SUBSTRINGS.some(sub=>dir.includes(sub)));
    console.log(`KiCad runtime: ${resolved.installRoot}\nKiCad profile: ${resolved.profileDir}`);
    stage='installation preflight';
    preflightInstall(resolved,plugins,{built:false});
    const runtimeNode=join(resolved.installRoot,'bin',process.platform==='win32'?'node.exe':'node');
    const version=execFileSync(runtimeNode,['--version'],{encoding:'utf8',windowsHide:true}).trim();
    const match=/^v(\d+)\.(\d+)\./.exec(version);
    if(!match||Number(match[1])<22||(Number(match[1])===22&&Number(match[2])<19))throw new Error(`KiCad runtime Node 22.19+ is required; found ${version}`);
    run('pnpm',['--version']);
    if(process.argv.includes('--check-only')){
      preflightInstall(resolved,plugins);
      console.log('PASS: runtime layout, permissions, profile policy and compiled plugin files. No installation performed.');
      return;
    }
    stage='workspace build';
    run('pnpm',['-r','build']);
    const choices=preflightInstall(resolved,plugins);
    stage='backup runtime and profile';
    installationTransaction(resolved,()=>{
      stage='patch KiCad host';
      patchKicadHost(resolved.installRoot);
      for(const dir of plugins){
        stage=`register ${path.basename(dir)}`;
        console.log(`Registering ${path.basename(dir)}`);
        execFileSync(join(resolved.installRoot,'bin',process.platform==='win32'?'node.exe':'node'),[
          join(resolved.installRoot,'bin','dsh-cli.cjs'),'plugin','--profile',PROFILE,'add',dir,
        ],{env:{...childEnv(),DSH_HOME:resolved.dshHome},cwd:repoRoot,stdio:'inherit',windowsHide:true});
      }
      stage='restore plugin switches';
      restoreSwitches(resolved.profileDir,choices);
      stage='verify registration and module imports';
      verifyInstalledPlugins(resolved,plugins);
    });
    console.log(`Done. ${plugins.length} plugin links and Node module imports verified. Restart KiCad (do not reset the agent).`);
  }catch(error){
    throw new Error(`KiCad plugin update failed during ${stage}: ${error.message}`,{cause:error});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
