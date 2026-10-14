import test from 'node:test';
import assert from 'node:assert/strict';
import { isClassCompatible, specialCountdown, recordingMimeType, tankSetError } from '../src/systemClassSpecialCore.js';
import { CLASS_BONUSES } from '../src/systemAI.js';
import { getClassAttributeBlueprint } from '../src/systemAttributesCore.js';
import { findClassTrainingSkill } from '../src/systemClassTraining.js';

test('every class recommends its actual core attributes', () => {
  for (const path of ['COMMANDER','MAGE','TANK','ASSASSIN','RANGER']) {
    assert.deepEqual(CLASS_BONUSES[path].strongStats, getClassAttributeBlueprint(path).core);
  }
});
test('foundation workouts obey class affinity even without prerequisites', () => {
  const core = ['MAGE','RANGER','COMMANDER'];
  assert.equal(isClassCompatible(core, 'TANK'), false);
  assert.equal(isClassCompatible(core, 'MAGE'), true);
  assert.equal(isClassCompatible('{"RANGER","ASSASSIN"}', 'assassin'), true);
  assert.equal(isClassCompatible('RANGER,COMMANDER', 'TANK'), false);
  assert.equal(isClassCompatible([], 'TANK'), true);
});
test('focus countdown uses server time and expires without allowing a claim', () => {
  const start = Date.parse('2026-09-23T09:00:00Z');
  const session = { started_at: new Date(start).toISOString(), expires_at: new Date(start+86400000).toISOString(), target_seconds: 1500, status: 'ACTIVE' };
  assert.equal(specialCountdown(session, start+10000, 5000).seconds, 1485);
  assert.equal(specialCountdown(session, start+1499999).ready, false);
  assert.equal(specialCountdown(session, start+1500000).ready, true);
  assert.equal(specialCountdown(session, start+86400000).ready, false);
  assert.equal(specialCountdown(session, start+86400000).expired, true);
});
test('camera recording falls back to MP4 on browsers without WebM support', () => {
  assert.equal(recordingMimeType({ isTypeSupported: (type) => type === 'video/mp4' }), 'video/mp4');
  assert.equal(recordingMimeType({}), '');
});
test('Tank rejects missing, negative and nonnumeric training sets', () => {
  const sets = Array.from({ length: 3 }, () => ({ reps: '12', load_kg: '0' }));
  const note = 'Kept a controlled pace and adjusted my stance.';
  assert.equal(tankSetError('Bodyweight squat', sets, note), '');
  for (const bad of ['', '-2', 'NaN', '1.5', '101']) assert.notEqual(tankSetError('Squat', [{ reps: bad, load_kg: '0' },...sets.slice(1)], note), '');
  assert.notEqual(tankSetError('Squat', sets.slice(1), note), '');
});
test('a planning skill cannot be selected as Commander video Charisma proof', () => {
  assert.equal(findClassTrainingSkill([{ name: 'DAILY COMMAND PLAN', class_affinity: ['COMMANDER'], primary_attribute: 'DISCIPLINE', category: 'LEADERSHIP' }], 'COMMANDER', ['leadership']), null);
});
