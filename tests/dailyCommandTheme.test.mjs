import test from "node:test";
import assert from "node:assert/strict";
import { PATHS } from "../src/systemProfileCore.js";
import { normalizeDailyPillarDirectives } from "../src/systemDailyCommandCore.js";

test("light palettes preserve a distinct class atmosphere without near-white panels", () => {
  const classes = Object.values(PATHS);
  assert.equal(new Set(classes.map((item) => item.lightBg)).size, 5);
  assert.equal(new Set(classes.map((item) => item.lightPanel)).size, 5);
  for (const item of classes) {
    assert.notEqual(item.lightBg.toLowerCase(), "#ffffff");
    assert.notEqual(item.lightPanel.toLowerCase(), "#ffffff");
  }
});

test("Daily Command always exposes the same three ordered pillar directives", () => {
  const result = normalizeDailyPillarDirectives({
    pillar_directives: [
      { pillar: "MENTAL", title: "FOCUS", status: "ACCEPTED", completed_missions: 2, xp: 30, cement: 1 },
      { pillar: "DISCIPLINE", title: "NO ZERO DAY", status: "COMPLETED", completed_missions: 3, xp: 40, cement: 2 },
    ],
  });
  assert.deepEqual(result.map((item) => item.pillar), ["DISCIPLINE", "PHYSICAL", "MENTAL"]);
  assert.equal(result[0].status, "COMPLETED");
  assert.equal(result[1].status, "SYNCING");
  assert.equal(result[2].completedMissions, 2);
});
