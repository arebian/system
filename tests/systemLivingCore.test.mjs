import test from "node:test";
import assert from "node:assert/strict";
import { achievementEvents, appendAchievements } from "../src/systemAchievementCore.js";
import { buildWeeklyPlan } from "../supabase/functions/_shared/weeklyBossCore.js";
import { normalizeReviewProof, guardReviewDecision, responseText } from "../supabase/functions/_shared/questReviewCore.js";
import { canReuseApprovedReview } from "../src/systemReviewCore.js";

test("proof recovery reuses only fresh approvals for the same target and evidence", () => {
  const now = Date.parse("2026-10-16T15:00:00Z");
  const cached = { key: "evidence", target: "boss-1", review: { id: "receipt-1", decision: "APPROVE", expires_at: "2026-10-16T15:30:00Z" } };
  assert.equal(canReuseApprovedReview(cached, "evidence", "boss-1", now), true);
  assert.equal(canReuseApprovedReview(cached, "changed", "boss-1", now), false);
  assert.equal(canReuseApprovedReview(cached, "evidence", "boss-2", now), false);
  assert.equal(canReuseApprovedReview(cached, "evidence", "boss-1", now + 1800000), false);
  assert.equal(canReuseApprovedReview(cached, "evidence", "boss-1", now + 1796000), false);
  assert.equal(canReuseApprovedReview({ ...cached, review: { ...cached.review, expires_at: undefined } }, "evidence", "boss-1", now), false);
  assert.equal(canReuseApprovedReview({ ...cached, review: { ...cached.review, decision: "CLARIFY" } }, "evidence", "boss-1", now), false);
});

const player = (level = 4, more = {}) => ({ fingerprint: "hunter-test", level, attributes: { DISCIPLINE: 10, RECOVERY: 10 }, bossQuests: [], ...more });
test("initial hydration and a different player do not create achievements", () => {
  assert.deepEqual(achievementEvents(null, player(50)), []);
  assert.deepEqual(achievementEvents(player(4), player(5, { fingerprint: "someone-else" })), []);
});
test("ordinary levels, rank boundaries and ascension have distinct celebrations", () => {
  assert.equal(achievementEvents(player(4), player(5))[0].kind, "LEVEL");
  assert.equal(achievementEvents(player(10), player(11))[0].kind, "RANK");
  assert.equal(achievementEvents(player(100), player(101))[0].kind, "ASCENSION");
  assert.deepEqual(achievementEvents(player(5), player(4)), []);
});
test("only actual attribute changes appear; a level does not invent rewards", () => {
  assert.deepEqual(achievementEvents(player(4), player(5))[0].gains, []);
  assert.deepEqual(achievementEvents(player(4), player(5, { attributes: { DISCIPLINE: 14, RECOVERY: 10 } }))[0].gains, [{ name: "DISCIPLINE", delta: 4 }]);
});
test("boss victory celebrates a known active boss once, without replaying history", () => {
  const boss = { id: "BOSS-7", status: "ACTIVE", name: "PREPARE YOUR FUEL", xp: 250 };
  const before = player(5, { bossQuests: [boss] });
  const after = player(5, { bossQuests: [{ ...boss, status: "COMPLETE" }] });
  const events = achievementEvents(before, after);
  assert.equal(events[0].kind, "BOSS");
  assert.equal(appendAchievements(events, events, new Set()).length, 1);
  assert.equal(appendAchievements([], events, new Set([events[0].id])).length, 0);
  assert.deepEqual(achievementEvents(player(5), after), []);
  assert.deepEqual(achievementEvents(after, after), []);
});
test("weekly output scales to days and people and provides finished-result objectives", () => {
  const plan = buildWeeklyPlan({ need: "BREAKFAST", days: 7, people: 2, storage: "FREEZER" }, 10);
  assert.equal(plan.target_count, 14);
  assert.ok(plan.supplies.includes("840 g oats"));
  assert.match(plan.objective, /14 prepared breakfasts/);
  assert.match(plan.steps[2].detail, /freeze the later-week portions immediately/);
  assert.deepEqual(plan.reward.attributes, { DISCIPLINE: 4, RECOVERY: 2 });
});
test("a plan cannot promise a fridge-only week or silently ignore dietary restrictions", () => {
  assert.throws(() => buildWeeklyPlan({ need: "LUNCH", storage: "FRIDGE" }), /FREEZER_REQUIRED/);
  assert.throws(() => buildWeeklyPlan({ need: "BREAKFAST", storage: "FRIDGE" }), /FREEZER_OR_PANTRY/);
  assert.throws(() => buildWeeklyPlan({ avoids: "oat allergy" }), /ADAPTATION_REQUIRED/);
  assert.throws(() => buildWeeklyPlan({ need: "SELL_SOMETHING" }), /NEED_INVALID/);
  assert.throws(() => buildWeeklyPlan({ days: 100 }), /PORTIONS_INVALID/);
});
test("pantry breakfasts and wardrobe batches remain usable without a freezer or extra spending", () => {
  const pantry = buildWeeklyPlan({ need: "BREAKFAST", storage: "PANTRY" });
  assert.match(pantry.objective, /ready-to-eat, shelf-stable/);
  const outfits = buildWeeklyPlan({ need: "OUTFITS", days: 5, people: 1 });
  assert.equal(outfits.target_count, 5);
  assert.match(outfits.steps[0].detail, /do not buy anything/);
  assert.match(outfits.notes[0], /Drying can take longer/);
});
test("typos remain evidence rather than being rejected by a character count", () => {
  const proof = normalizeReviewProof({ type: "RESULT", detail: " red 25 mins " });
  assert.equal(proof.detail, "red 25 mins");
  assert.equal(guardReviewDecision({ decision: "APPROVE", reason: "Reading target met.", missing: [] }, { proof_policy: "RESULT" }, proof).decision, "APPROVE");
});
test("model approvals cannot bypass required files, open boss steps or reported missing work", () => {
  const approve = { decision: "APPROVE", reason: "Complete.", missing: [] };
  assert.equal(guardReviewDecision(approve, { proof_policy: "PHOTO" }, normalizeReviewProof({ detail: "done" })).decision, "CLARIFY");
  assert.equal(guardReviewDecision(approve, { kind: "WEEKLY_PREPARATION", proof_policy: "RESULT", remaining_checkpoints: 1 }, normalizeReviewProof({ detail: "7 breakfasts ready" })).decision, "INCOMPLETE");
  assert.equal(guardReviewDecision({ ...approve, missing: ["10 more minutes"] }, { proof_policy: "RESULT" }, normalizeReviewProof({ detail: "Read ten minutes" })).decision, "CLARIFY");
  assert.equal(guardReviewDecision(approve, { proof_policy: "HONOR" }, normalizeReviewProof({})).decision, "CLARIFY");
});
test("incomplete provider responses cannot become proof receipts", () => {
  assert.throws(() => responseText({ status: "incomplete", output: [] }), /INCOMPLETE/);
  assert.throws(() => guardReviewDecision({ decision: "YES", reason: "yes" }, {}, {}), /INVALID/);
});
