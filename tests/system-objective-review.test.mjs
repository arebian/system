import test from "node:test";
import assert from "node:assert/strict";
import { guardReviewDecision, normalizeReviewProof } from "../supabase/functions/_shared/questReviewCore.js";

const objective = {
  kind: "QUEST_OBJECTIVE",
  title: "Focused study",
  objective: "Read one chapter and write three takeaways.",
  proof_policy: "RESULT",
};

test("objective evidence can be approved when the review finds requirements met", () => {
  const proof = normalizeReviewProof({ type: "RESULT", detail: "I read the chapter and wrote three takeaways about the key ideas." });
  const result = guardReviewDecision({ decision: "APPROVE", reason: "All requested work is described.", question: "", missing: [] }, objective, proof);
  assert.equal(result.decision, "APPROVE");
});

test("objective review asks for evidence when the player submits an empty note", () => {
  const proof = normalizeReviewProof({ type: "RESULT" });
  const result = guardReviewDecision({ decision: "APPROVE", reason: "Looks good.", question: "", missing: [] }, objective, proof);
  assert.equal(result.decision, "CLARIFY");
  assert.equal(result.missing[0], "result");
});

test("AI approval cannot override requirements it reports as missing", () => {
  const proof = normalizeReviewProof({ type: "RESULT", detail: "I did some of the work." });
  const result = guardReviewDecision({ decision: "APPROVE", reason: "Some work is done.", question: "", missing: ["three takeaways"] }, objective, proof);
  assert.equal(result.decision, "CLARIFY");
  assert.ok(result.question);
});

test("photo-required objectives cannot pass without the original attachment", () => {
  const proof = normalizeReviewProof({ type: "RESULT", detail: "I completed the task." });
  const result = guardReviewDecision({ decision: "APPROVE", reason: "Complete.", question: "", missing: [] }, { ...objective, proof_policy: "PHOTO" }, proof);
  assert.equal(result.decision, "CLARIFY");
  assert.match(result.question, /attach/i);
});
