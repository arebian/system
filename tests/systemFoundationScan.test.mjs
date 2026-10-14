import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const foundation = await importStandaloneModule("../src/systemFoundationScan.js");

const completeScan = {
  primaryFocus: "STRENGTH",
  experience: "RETURNING",
  activityLevel: "MODERATE",
  mainObstacle: "CONSISTENCY",
  dailyMinutes: 20,
  weightKg: 60,
  heightCm: 180,
  mealsPerDay: "THREE",
  equipment: "GYM",
  foodPreference: "NO_RESTRICTIONS",
  foodBudget: "BASIC",
};

test("Foundation Scan requires weight and routine fields while keeping height optional", () => {
  assert.equal(foundation.isFoundationScanReady({
    ...completeScan,
    weightKg: "",
    heightCm: "",
  }), false);
  assert.equal(foundation.isFoundationScanReady({ ...completeScan, heightCm: "" }), true);
  assert.equal(foundation.isFoundationScanReady({
    ...completeScan,
    foodBudget: "",
  }), false);
});

test("Multiple goals keep a main priority, deduplicate and preserve legacy single goals", () => {
  const data = foundation.buildFoundationProfileData({ ...completeScan, focusGoals: ["KNOWLEDGE", "STRENGTH", "CONFIDENCE", "KNOWLEDGE", "INVALID"] }, "CUT");
  assert.deepEqual(data.focusGoals, ["STRENGTH", "KNOWLEDGE", "CONFIDENCE"]);
  assert.equal(data.primaryFocus, "STRENGTH");
  assert.deepEqual(foundation.normalizeFoundationScan(completeScan).focusGoals, ["STRENGTH"]);
  assert.equal(foundation.normalizeFoundationScan({ focusGoals: ["KNOWLEDGE", "CONFIDENCE"] }).primaryFocus, "KNOWLEDGE");
});

test("Supporting goals affect class suggestions without changing the chosen priority or fuel direction", () => {
  const single = foundation.getFoundationClassSuggestions({ ...completeScan, primaryFocus: "FOCUS" });
  const multiple = foundation.getFoundationClassSuggestions({ ...completeScan, primaryFocus: "FOCUS", focusGoals: ["FOCUS", "KNOWLEDGE"] });
  assert.ok(multiple.find(item => item.path === "MAGE").score > single.find(item => item.path === "MAGE").score);
  assert.equal(foundation.getFoundationFuelRecommendation({ ...completeScan, focusGoals: ["STRENGTH", "BODY_COMPOSITION"] }).goal, "BULK");
});

test("Feet and inches convert exactly to bounded canonical centimetres", () => {
  assert.equal(foundation.foundationHeightToCm("5", "9"), 175.3);
  assert.equal(foundation.foundationHeightToCm("6", ""), 182.9);
  assert.equal(foundation.foundationHeightToCm("", ""), null);
  assert.equal(foundation.foundationHeightToCm("", "9"), null);
  assert.equal(foundation.foundationHeightToCm("5", "12"), null);
  assert.equal(foundation.foundationHeightToCm("5.5", "0"), null);
  assert.equal(foundation.foundationHeightToCm("7", "7"), null);
});

test("Foundation Scan suggests a fuel direction without taking the player's final choice", () => {
  const recommendation = foundation.getFoundationFuelRecommendation(completeScan);
  const profileData = foundation.buildFoundationProfileData(completeScan, "CUT");

  assert.equal(recommendation.goal, "BULK");
  assert.equal(profileData.recommendedFuelGoal, "BULK");
  assert.equal(profileData.selectedFuelGoal, "CUT");
  assert.equal(profileData.estimatedCalorieTarget, 1500);
  assert.equal(profileData.estimatedProteinTarget, 96);
});

test("Foundation Scan returns class ideas but does not select a class", () => {
  const suggestions = foundation.getFoundationClassSuggestions(completeScan);

  assert.equal(suggestions[0].path, "TANK");
  assert.equal(suggestions.some((item) => item.path === "RANGER"), true);
  assert.equal(Object.hasOwn(completeScan, "path"), false);
});

test("Opening directives follow the player-chosen class and stay advisory", () => {
  const plan = foundation.getFoundationOpeningPlan({
    value: completeScan,
    path: "MAGE",
    fuelGoal: "MAINTAIN",
  });

  assert.equal(plan.length, 3);
  assert.equal(plan[0].title, "DEEP-WORK BLOCK");
  assert.match(plan[1].title, /MAINTAIN/);
  assert.match(plan[2].detail, /Consistency/i);
});
