import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const core = await importStandaloneModule("../src/systemQuestCore.js");

test("Structural Check always requires performance proof", () => {
  assert.equal(
    core.getQuestProofType(
      { name: "STRUCTURAL CHECK" },
      ""
    ),
    "PERFORMANCE",
  );
});

test("a physical Must Quest remains a performance proof even without a known title", () => {
  assert.equal(
    core.getQuestProofType(
      { name: "NEW DIRECTIVE", type: "PHYSICAL" },
      "",
    ),
    "PERFORMANCE",
  );
});

test("an Adaptive physical directive uses the performance proof flow", () => {
  assert.equal(
    core.getQuestProofType(
      { name: "MOMENTUM WALK", category: "PHYSICAL" },
      "ADAPTIVE",
    ),
    "PERFORMANCE",
  );
});

test("a live quest library proof type takes priority over title heuristics", () => {
  assert.equal(
    core.getQuestProofType({
      name: "STRUCTURAL CHECK",
      proof_type: "RESULT",
    }),
    "RESULT",
  );

  assert.equal(
    core.getQuestProofType({
      name: "NEW CLASS DIRECTIVE",
      metadata: { proof_type: "LEARNING" },
    }),
    "LEARNING",
  );
});

test("Must readiness only accepts an exact 24-hour authoritative window", () => {
  assert.equal(core.isMustStateReady({ accepted: true }), false);
  assert.equal(
    core.isMustStateReady({ accepted: true, expiresAt: "not-a-date" }),
    false,
  );
  assert.equal(
    core.isMustStateReady({
      accepted: true,
      acceptedAt: "2026-09-30T10:00:00.000Z",
      expiresAt: "2026-10-01T10:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    core.isMustStateReady({
      accepted: true,
      acceptedAt: "2026-09-30T10:00:00.000Z",
      expiresAt: "2026-10-01T15:00:00.000Z",
    }),
    false,
  );
});

test("server clock offset falls back safely when a response has no server time", () => {
  assert.equal(
    core.getServerClockOffsetMs("2026-10-01T10:00:05.000Z", Date.parse("2026-10-01T10:00:00.000Z")),
    5000,
  );
  assert.equal(core.getServerClockOffsetMs("not-a-time", 0), 0);
});

test("Must state matching requires the same directive and assigned day", () => {
  const quest = { name: "STRUCTURAL CHECK" };
  assert.equal(
    core.mustStateMatchesQuest(
      { name: "Structural   Check", date: "2026-09-10" },
      quest,
      "2026-09-10",
    ),
    true,
  );
  assert.equal(
    core.mustStateMatchesQuest(
      { name: "Structural Check", date: "2026-09-09" },
      quest,
      "2026-09-10",
    ),
    false,
  );
});
