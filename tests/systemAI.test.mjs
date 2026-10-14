import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const ai = await importStandaloneModule("../src/systemAI.js");

function baseProfile(overrides = {}) {
  return {
    path: "MAGE",
    level: 8,
    xp: 120,
    streak: 4,
    momentum: 3,
    attributes: {
      STRENGTH: 11,
      SPEED: 13,
      ENDURANCE: 15,
      INTELLIGENCE: 32,
      FOCUS: 27,
      DISCIPLINE: 18,
      WEALTH: 16,
      CHARISMA: 14,
      CREATIVITY: 20,
      RECOVERY: 7,
    },
    questLog: [],
    workoutLog: [],
    masteryLogs: [],
    performanceLogs: [],
    wealthLogs: [],
    history: [],
    mustState: {},
    pendingConsequences: [],
    ...overrides,
  };
}

test("player analysis detects strongest and weakest attributes", () => {
  const analysis = ai.analyzePlayerProfile(baseProfile());
  assert.equal(analysis.strengths[0], "INTELLIGENCE");
  assert.equal(analysis.weaknesses[0], "RECOVERY");
});

test("quest recommendations favor a current weakness", () => {
  const profile = baseProfile();
  const quests = [
    { name: "Recovery Reset", category: "RECOVERY", difficulty: "NORMAL", xp: 30 },
    { name: "Strength Block", category: "STRENGTH", difficulty: "NORMAL", xp: 30 },
  ];

  const results = ai.recommendQuests(profile, quests, 2);
  assert.equal(results[0].name, "Recovery Reset");
  assert.match(results[0].reason, /RECOVERY/i);
});

test("level forecast uses the supplied authoritative XP curve adapter", () => {
  const profile = baseProfile({
    level: 8,
    xp: 120,
    history: [
      { date: new Date().toISOString(), detail: "+80 XP" },
    ],
  });

  const forecast = ai.predictNextLevelXp(profile, {
    xpRequired: () => 500,
  });

  assert.equal(forecast.xpNeeded, 380);
});

test("full analytics does not mutate the source profile", () => {
  const profile = baseProfile();
  const before = structuredClone(profile);
  ai.getFullAnalytics(profile, { questCatalog: [] });
  assert.deepEqual(profile, before);
});
