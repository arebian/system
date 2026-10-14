import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const fuel = await importStandaloneModule("../src/systemFuel.js");

test("Fuel goal is constrained to cut, maintain or bulk", () => {
  assert.equal(fuel.normalizeFuelGoal("bulk"), "BULK");
  assert.equal(fuel.normalizeFuelGoal("recomp"), "");
});

test("Fuel protocol changes with both class and goal", () => {
  const tankBulk = fuel.getFuelProtocol("TANK", "BULK");
  const rangerCut = fuel.getFuelProtocol("RANGER", "CUT");
  assert.notEqual(tankBulk.mealRhythm, rangerCut.mealRhythm);
  assert.match(tankBulk.mealRhythm, /4 MEALS/i);
});

test("Fuel meal plan stays class and goal specific without asking for a class", () => {
  const tankBulk = fuel.getFuelMealPlan("TANK", "BULK");
  const mageCut = fuel.getFuelMealPlan("MAGE", "CUT");

  assert.equal(tankBulk.length, 5);
  assert.equal(mageCut.length, 4);
  assert.equal(tankBulk[0].slot, "BREAKFAST");
  assert.match(tankBulk[0].title, /BUILD/i);
  assert.match(mageCut[0].title, /FOCUS/i);
});

test("Fuel daily summary totals entries and respects targets", () => {
  const summary = fuel.summarizeFuelDay(
    [
      { calories: 600, protein: 30 },
      { calories: 400, protein: 25 },
    ],
    2200,
    130,
  );
  assert.equal(summary.calories, 1000);
  assert.equal(summary.protein, 55);
  assert.equal(summary.calorieRemaining, 1200);
  assert.equal(summary.proteinRemaining, 75);
});

test("Fuel normalization drops malformed log entries", () => {
  const state = fuel.normalizeFuelState({
    goal: "CUT",
    logs: {
      "2026-09-10": [
        { id: "valid", meal: "Eggs", calories: 300, protein: 20 },
        { meal: "no id", calories: 200 },
      ],
    },
  });
  assert.equal(state.logs["2026-09-10"].length, 1);
  assert.equal(state.logs["2026-09-10"][0].meal, "Eggs");
});
