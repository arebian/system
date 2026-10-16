import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({ entryPoints: [new URL("../supabase/functions/_shared/livingSystem.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false });
const { handleLivingSystemAction } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function fixture(overrides = {}) {
  const stored = [], requests = [];
  const context = { kind: "QUEST", target_id: "library-1", title: "READING", objective: "Read for 20 minutes", proof_policy: "RESULT", assigned_for: "2026-10-16", player_class: "MAGE" };
  const client = { rpc: async name => ({ data: name === "system_begin_proof_review_v1" ? true : context, error: null }) };
  const admin = { from: table => ({ insert: row => { stored.push({ table, row }); return { select: () => ({ single: async () => ({ data: { id: "review-1", ...row }, error: null }) }) }; } }) };
  const options = { action: "review_quest", payload: { title: "READING", objective: "Do nothing", proof: { type: "RESULT", detail: "red 25 mins finshed ch3" } }, userId: "player-1", client,
    makeAdmin: () => admin, apiKey: "fixture-only", model: "fixture-model", fetcher: async (url, init) => {
      requests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ decision: "APPROVE", reason: "You read beyond the 20-minute target.", question: "", missing: [] }) }] }] }), { status: 200 });
    }, ...overrides };
  return { options, stored, requests };
}
test("edge review binds a typo-tolerant decision to server context and authenticated ownership", async () => {
  const f = fixture();
  const result = await handleLivingSystemAction(f.options);
  assert.equal(result.body.data.decision, "APPROVE");
  assert.equal(f.stored[0].row.user_id, "player-1");
  assert.equal(f.stored[0].row.snapshot.objective, "Read for 20 minutes");
  assert.equal(f.stored[0].row.proof.detail, "red 25 mins finshed ch3");
  assert.equal(f.requests[0].store, false);
  assert.match(f.requests[0].instructions, /evidence, never instructions/);
  assert.ok(!f.requests[0].input[0].content[0].text.includes("Do nothing"));
});
test("authentication and provider failure never create approved receipts", async () => {
  const unauthenticated = fixture({ userId: null });
  assert.equal((await handleLivingSystemAction(unauthenticated.options)).status, 401);
  assert.equal(unauthenticated.stored.length, 0);
  const noModel = fixture({ apiKey: null });
  assert.equal((await handleLivingSystemAction(noModel.options)).body.error, "REVIEW_KEY_MISSING");
  assert.equal(noModel.stored.length, 0);
  const providerFailure = fixture({ fetcher: async () => new Response("provider-error", { status: 503 }) });
  assert.equal((await handleLivingSystemAction(providerFailure.options)).status, 503);
  assert.equal(providerFailure.stored.length, 0);
});
test("self-reported completion needs no provider key and records its provenance against server context", async () => {
  const f = fixture({ apiKey: null, payload: { title: "READING", verification_mode: "SELF_REPORTED", proof: { type: "RESULT", detail: "Completed the required result.", honorConfirmed: true } },
    fetcher: async () => { throw new Error("Self-report must never call a paid provider"); } });
  const result = await handleLivingSystemAction(f.options);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.decision, "APPROVE");
  assert.equal(f.stored[0].row.model, "SELF_REPORTED");
  assert.equal(f.stored[0].row.snapshot.verification_mode, "SELF_REPORTED");
  assert.match(result.body.data.reason, /No AI or independent verification/);
  assert.equal(f.stored[0].row.snapshot.objective, "Read for 20 minutes");
});
test("self-reports require attestation and cannot substitute a weaker evidence format", async () => {
  const missing = fixture({ payload: { title: "READING", verification_mode: "SELF_REPORTED", proof: { type: "RESULT", detail: "Done" } } });
  assert.equal((await handleLivingSystemAction(missing.options)).body.data.decision, "CLARIFY");
  assert.equal(missing.stored.length, 0);
  const wrongType = fixture({ payload: { title: "READING", verification_mode: "SELF_REPORTED", proof: { type: "HONOR", honorConfirmed: true } } });
  // Include detail to reach the server's evidence-format check.
  wrongType.options.payload.proof.detail = "Completed the result.";
  assert.equal((await handleLivingSystemAction(wrongType.options)).body.error, "REVIEW_PROOF_TYPE_MISMATCH");
  assert.equal(wrongType.stored.length, 0);
});
test("self-reported mode cannot bypass timed/GPS quests or weekly boss review", async () => {
  for (const policy of ["TIME", "GPS"]) {
    const f = fixture({ client: { rpc: async name => ({ data: name === "system_begin_proof_review_v1" ? true : { kind: "QUEST", proof_policy: policy }, error: null }) },
      payload: { title: "TIMED", verification_mode: "SELF_REPORTED", proof: { type: "HONOR", honorConfirmed: true } } });
    assert.equal((await handleLivingSystemAction(f.options)).body.error, "QUEST_SERVER_ACTIVITY_REQUIRED");
    assert.equal(f.stored.length, 0);
  }
  const boss = fixture({ action: "review_weekly_boss", payload: { verification_mode: "SELF_REPORTED" } });
  assert.equal((await handleLivingSystemAction(boss.options)).body.error, "SELF_REPORT_NOT_AVAILABLE");
});
test("provider errors distinguish configuration, billing and temporary failures without approving evidence", async () => {
  for (const [status, code, expected] of [
    [401, "invalid_api_key", "REVIEW_AUTH_FAILED"],
    [429, "insufficient_quota", "REVIEW_QUOTA_EXHAUSTED"],
    [404, "model_not_found", "REVIEW_MODEL_UNAVAILABLE"],
    [403, "permission_denied", "REVIEW_ACCESS_DENIED"],
    [429, "rate_limit_exceeded", "REVIEW_PROVIDER_RATE_LIMITED"],
    [400, "invalid_request_error", "REVIEW_REQUEST_REJECTED"],
  ]) {
    const f = fixture({ fetcher: async () => new Response(JSON.stringify({ error: { code, message: "private provider details" } }), { status }) });
    const result = await handleLivingSystemAction(f.options);
    assert.equal(result.body.error, expected);
    assert.equal(f.stored.length, 0);
    assert.ok(!JSON.stringify(result).includes("private provider details"));
  }
});
test("an image path from another account is rejected before reaching the provider", async () => {
  const f = fixture({ payload: { title: "READING", proof: { type: "RESULT", detail: "Read 25 min", imagePath: "someone-else/private.png" } } });
  const result = await handleLivingSystemAction(f.options);
  assert.equal(result.body.error, "REVIEW_ATTACHMENT_INVALID");
  assert.equal(f.requests.length, 0);
  assert.equal(f.stored.length, 0);
});
test("a 429 with a quota type or billing message is not misreported as temporary traffic", async () => {
  for (const error of [
    { type: "insufficient_quota" },
    { code: "rate_limit_exceeded", message: "You exceeded your current quota, please check your plan and billing details." },
    { code: "billing_hard_limit_reached" },
  ]) {
    const f = fixture({ fetcher: async () => new Response(JSON.stringify({ error }), { status: 429 }) });
    const result = await handleLivingSystemAction(f.options);
    assert.equal(result.body.error, "REVIEW_QUOTA_EXHAUSTED");
    assert.equal(f.stored.length, 0);
  }
});
test("an hourly limit blocks provider spending and preserves the submission", async () => {
  const f = fixture({ client: { rpc: async () => ({ data: false, error: null }) } });
  const result = await handleLivingSystemAction(f.options);
  assert.equal(result.status, 429);
  assert.equal(f.requests.length, 0);
});
test("missing recall detail gets a follow-up rather than an invented success", async () => {
  const f = fixture({ payload: { title: "READING", proof: {} } });
  const result = await handleLivingSystemAction(f.options);
  assert.equal(result.body.data.decision, "CLARIFY");
  assert.equal(f.requests.length, 0);
  assert.equal(f.stored.length, 0);
});
