/** Parent-owned scheduling ledger; never launches agents or edits circuit files. */
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const states = new Set(['pending', 'running', 'generated', 'verified', 'blocked']);
const complete = module => ['generated', 'verified'].includes(module.status);
const fail = message => { throw new Error(message); };

export function validatePlan(plan) {
  if (plan.version !== 1 || !Number.isInteger(plan.maxConcurrent) || plan.maxConcurrent < 1
      || !Array.isArray(plan.modules) || !plan.modules.length) fail('Invalid plan version, concurrency or modules');
  const ids = new Set();
  const files = new Set();
  const refs = new Set();
  for (const module of plan.modules) {
    if (!/^[a-z][a-z0-9-]*$/.test(module.id) || ids.has(module.id)) fail(`Invalid/duplicate module id: ${module.id}`);
    ids.add(module.id);
    if (!states.has(module.status) || !Array.isArray(module.dependsOn)
        || !Array.isArray(module.usesInterfaces) || !Array.isArray(module.files) || !module.files.length
        || !module.references || !module.ports || !module.layout) fail(`Incomplete module: ${module.id}`);
    for (const file of module.files) {
      const normalized = file.replaceAll('\\', '/');
      if (isAbsolute(file) || !/^scripts\/modules\/[a-zA-Z0-9_./-]+\.mjs$/.test(normalized)
          || normalized.split('/').some(part => part === '..' || part === '.')
          || normalized.includes('//')) fail(`Module file must stay in scripts/modules: ${file}`);
      const key = normalized.toLowerCase();
      if (files.has(key)) fail(`Multiple owners for file: ${file}`);
      files.add(key);
    }
    for (const ref of Object.values(module.references)) {
      if (typeof ref !== 'string' || !/^[A-Za-z]+[1-9]\d*$/.test(ref) || refs.has(ref.toUpperCase())) fail(`Invalid/duplicate reference: ${ref}`);
      refs.add(ref.toUpperCase());
    }
    for (const endpoint of Object.values(module.ports)) {
      if (!endpoint || !Object.values(module.references).includes(endpoint.reference)
          || typeof endpoint.pin !== 'string' || !endpoint.pin) fail(`Invalid port in ${module.id}`);
    }
    for (const key of ['origin', 'size']) {
      const point = module.layout[key];
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)
          || (key === 'size' && point.some(value => value <= 0))) fail(`Invalid layout ${key}: ${module.id}`);
    }
  }
  const modules = new Map(plan.modules.map(module => [module.id, module]));
  for (const module of plan.modules) for (const id of module.usesInterfaces) {
    if (!modules.has(id) || id === module.id) fail(`Invalid interface dependency: ${id}`);
  }
  const visited = new Set();
  const active = new Set();
  function visit(id) {
    if (!modules.has(id)) fail(`Unknown dependency: ${id}`);
    if (active.has(id)) fail(`Dependency cycle: ${id}`);
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of modules.get(id).dependsOn) visit(dependency);
    active.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  if (plan.modules.filter(module => module.status === 'running').length > plan.maxConcurrent) fail('Running tasks exceed maxConcurrent');
  return plan;
}

export function queueStatus(plan) {
  validatePlan(plan);
  const modules = new Map(plan.modules.map(module => [module.id, module]));
  const running = plan.modules.filter(module => module.status === 'running').map(module => module.id);
  const slots = Math.max(0, plan.maxConcurrent - running.length);
  const ready = plan.interfacesFrozen === true ? plan.modules.filter(module => module.status === 'pending'
    && module.dependsOn.every(id => complete(modules.get(id)))).map(module => module.id) : [];
  return { interfacesFrozen: plan.interfacesFrozen === true, slots, running, ready: ready.slice(0, slots),
    counts: Object.fromEntries([...states].map(status => [status, plan.modules.filter(module => module.status === status).length])) };
}

export function transition(plan, action, id, detail) {
  validatePlan(plan);
  const module = plan.modules.find(item => item.id === id);
  if (!module) fail(`Unknown module: ${id}`);
  if (action === 'start') {
    if (!queueStatus(plan).ready.includes(id)) fail(`Module is not dispatchable: ${id}`);
    module.status = 'running';
    module.startedAt = new Date().toISOString();
    delete module.result;
    delete module.runtimeId;
  } else if (action === 'bind') {
    if (module.status !== 'running' || !detail) fail('bind requires running module and returned runtime id');
    module.runtimeId = detail;
  } else if (action === 'generated' || action === 'blocked') {
    if (module.status !== 'running' || !detail) fail(`${action} requires running module and result path/reason`);
    module.status = action;
    module.result = detail;
    module.finishedAt = new Date().toISOString();
  } else if (action === 'verified') {
    if (module.status !== 'generated' || !detail) fail('verified requires generated module and evidence path');
    module.status = 'verified';
    module.evidence = detail;
  } else if (action === 'retry' || action === 'invalidate') {
    // Local repair affects only this task; interface changes also invalidate consumers.
    const affected = new Set([id]);
    if (action === 'invalidate') {
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of plan.modules) if (!affected.has(item.id)
            && [...item.dependsOn, ...item.usesInterfaces].some(dependency => affected.has(dependency))) {
          affected.add(item.id);
          changed = true;
        }
      }
    }
    if (!detail || plan.modules.some(item => affected.has(item.id) && item.status === 'running')) fail('Stop affected writers before retry/invalidate; supply reason');
    for (const item of plan.modules) if (affected.has(item.id)) {
      item.status = 'pending';
      item.reason = detail;
      for (const key of ['runtimeId', 'result', 'evidence', 'startedAt', 'finishedAt']) delete item[key];
    }
    if (action === 'invalidate') plan.interfacesFrozen = false;
  } else fail(`Unknown action: ${action}`);
  return queueStatus(plan);
}

function main() {
  const [file, action = 'status', id, detail] = process.argv.slice(2);
  if (!file) fail('usage: node module-queue.mjs <module-plan.json> [status|start|bind|generated|blocked|verified|retry|invalidate] [module-id] [runtime-id|evidence-path|reason]');
  const path = resolve(file);
  const plan = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const result = action === 'status' ? queueStatus(plan) : transition(plan, action, id, detail);
  if (action !== 'status') {
    // Only the parent writes this ledger; children never race to claim work.
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporary, path);
  }
  console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
