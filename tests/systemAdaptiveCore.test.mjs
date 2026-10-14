import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const core = await importStandaloneModule("../src/systemAdaptiveCore.js");

test("Adaptive dimensions put the weakest real-world signal first", () => {
  const dimensions = core.calculateAdaptiveDimensions(
    {
      workoutLog: [{ date: "2026-09-01T10:00:00.000Z" }],
      wealthLogs: [{ date: "2026-09-12T10:00:00.000Z" }],
      masteryLogs: [{ date: "2026-09-12T10:00:00.000Z" }],
      attributes: { FOCUS: 24, RECOVERY: 24 },
    },
    Date.parse("2026-09-13T10:00:00.000Z"),
  );

  assert.equal(dimensions[0].category, "PHYSICAL");
  assert.equal(dimensions[0].score, 30);
});

test("Adaptive selection rejects Must and incompatible class directives", () => {
  const profile = { path: "MAGE", level: 1 };

  assert.equal(
    core.isCompatibleAdaptiveCandidate(
      {
        quest_type: "MUST",
        category: "PHYSICAL",
        class_affinity: [],
      },
      profile,
    ),
    false,
  );

  assert.equal(
    core.isCompatibleAdaptiveCandidate(
      {
        quest_type: "STANDARD",
        category: "PHYSICAL",
        class_affinity: ["RANGER"],
      },
      profile,
    ),
    false,
  );
});

test("Adaptive fallback keeps the selected directive compatible and Standard", () => {
  const selected = core.chooseAdaptiveFallbackCandidate(
    [
      {
        code: "ranger_only",
        quest_type: "STANDARD",
        category: "PHYSICAL",
        class_affinity: ["RANGER"],
        health_value: 9,
      },
      {
        code: "must_move",
        quest_type: "MUST",
        category: "PHYSICAL",
        class_affinity: [],
        health_value: 9,
      },
      {
        code: "mage_move",
        quest_type: "STANDARD",
        category: "PHYSICAL",
        class_affinity: [],
        health_value: 5,
      },
    ],
    { path: "MAGE", level: 1 },
    ["PHYSICAL", "FOCUS"],
  );

  assert.equal(selected.code, "mage_move");
});

test("Adaptive rotation excludes a directive completed in the prior seven days", () => {
  const now = Date.parse("2026-09-16T12:00:00.000Z");
  const candidates = [
    {
      code: "recent_focus",
      title: "FOCUS RESET",
      quest_type: "STANDARD",
    },
    {
      code: "fresh_focus",
      title: "RECALL CHAIN",
      quest_type: "STANDARD",
    },
  ];

  const available = core.withoutRecentAdaptiveCandidates(
    candidates,
    {
      questLog: [
        {
          code: "recent_focus",
          name: "FOCUS RESET",
          date: "2026-09-11T12:00:00.000Z",
        },
      ],
    },
    now,
    7,
  );

  assert.deepEqual(
    available.map((candidate) => candidate.code),
    ["fresh_focus"],
  );
});
