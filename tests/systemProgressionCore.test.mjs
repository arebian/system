import test from 'node:test';
import assert from 'node:assert/strict';
import { xpRequired, getRank } from '../src/systemProgressionCore.js';
test('the XP display follows the live server curve', () => {
  // Values queried from the live system_xp_required on 2026-09-24.
  for (const [level,required] of [[1,10],[2,31],[10,417],[25,1839],[50,5654],[80,12106],[100,17378]]) assert.equal(xpRequired(level),required);
  assert.equal(xpRequired(1),10);
  assert.equal(xpRequired(2),31);
});
test('rank changes happen after each inclusive level boundary', () => {
  for (const [lower,upper,rank] of [[1,10,'E'],[11,25,'D'],[26,40,'C'],[41,60,'B'],[61,80,'A'],[81,100,'S']]) {
    assert.equal(getRank(lower),`${rank}-RANK`);
    assert.equal(getRank(upper),`${rank}-RANK`);
  }
});
