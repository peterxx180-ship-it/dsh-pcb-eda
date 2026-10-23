import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { queueStatus, transition, validatePlan } from '../skills/kicad-schematic-design/scripts/module-queue.mjs';

const sample = JSON.parse(readFileSync(new URL('../skills/kicad-schematic-design/assets/modular-design/module-plan.json', import.meta.url)));
const plan = () => structuredClone(sample);

test('bounded dispatch uses output dependencies but not frozen interface dependencies', () => {
  const value = plan();
  value.maxConcurrent = 1;
  assert.deepEqual(queueStatus(value).ready, ['input']);
  transition(value, 'start', 'input');
  assert.throws(() => transition(value, 'start', 'output'), /not dispatchable/);
  transition(value, 'generated', 'input', 'input-result.json');
  assert.deepEqual(queueStatus(value).ready, ['output']);
  value.modules[1].dependsOn = ['input'];
  transition(value, 'retry', 'input', 'repair');
  assert.deepEqual(queueStatus(value).ready, ['input']);
  value.interfacesFrozen = false;
  assert.deepEqual(queueStatus(value).ready, []);
});

test('dependency cycles and unknown dependencies fail before dispatch', () => {
  const value = plan();
  value.modules[0].dependsOn = ['output'];
  value.modules[1].dependsOn = ['input'];
  assert.throws(() => validatePlan(value), /cycle/);
  value.modules[0].dependsOn = ['missing'];
  assert.throws(() => validatePlan(value), /Unknown dependency/);
});

test('file ownership, reference uniqueness and endpoint ownership are validated', () => {
  for (const mutate of [
    p => { p.modules[1].files = ['scripts/modules/INPUT.mjs']; },
    p => { p.modules[1].files = ['scripts/modules/../shared/parts.mjs']; },
    p => { p.modules[1].references.resistor = 'R1'; },
    p => { p.modules[1].ports.signal.reference = 'R99'; },
  ]) {
    const value = plan();
    mutate(value);
    assert.throws(() => validatePlan(value));
  }
});

test('interface invalidation follows consumers, stops active writers and unfreezes contract', () => {
  const value = plan();
  transition(value, 'start', 'output');
  assert.throws(() => transition(value, 'invalidate', 'input', 'new pin'), /Stop affected writers/);
  assert.equal(value.modules[0].status, 'pending');
  transition(value, 'generated', 'output', 'output-result.json');
  transition(value, 'verified', 'output', 'report.json');
  transition(value, 'invalidate', 'input', 'new pin');
  assert.equal(value.interfacesFrozen, false);
  assert.equal(value.modules[1].status, 'pending');
  assert.equal(value.modules[1].evidence, undefined);
});

test('generation, verification and local retry retain separate evidence states', () => {
  const value = plan();
  transition(value, 'start', 'input');
  transition(value, 'bind', 'input', 'job-123');
  assert.throws(() => transition(value, 'verified', 'input', 'report.json'), /requires generated/);
  transition(value, 'blocked', 'input', 'startup failed');
  assert.equal(queueStatus(value).slots, 3);
  transition(value, 'retry', 'input', 'retry startup');
  assert.equal(value.modules[0].runtimeId, undefined);
  assert.equal(value.interfacesFrozen, true);
  assert.equal(value.modules[1].status, 'pending');
});

test('CLI persists state and rejects excess concurrent starts without changing ledger', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kicad-module-queue-'));
  try {
    const path = join(directory, 'module-plan.json');
    const value = plan();
    value.maxConcurrent = 1;
    writeFileSync(path, JSON.stringify(value));
    const script = fileURLToPath(new URL('../skills/kicad-schematic-design/scripts/module-queue.mjs', import.meta.url));
    const run = (...args) => spawnSync(process.execPath, [script, path, ...args], { encoding: 'utf8' });
    assert.equal(run('start', 'input').status, 0);
    const before = readFileSync(path, 'utf8');
    assert.equal(run('start', 'output').status, 1);
    assert.equal(readFileSync(path, 'utf8'), before);
    assert.equal(run('generated', 'input', 'result.json').status, 0);
    assert.deepEqual(JSON.parse(run('status').stdout).ready, ['output']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
