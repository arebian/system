import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const timer = await importStandaloneModule("../src/systemWorkoutTimer.js");

test("Core Foundation is timer verified; trunk never becomes GPS", () => {
  assert.equal(
    timer.getWorkoutVerificationMode({
      name: "Core Foundation",
      description: "Build trunk control for advanced calisthenics.",
      steps: [{ duration_seconds: 25 }],
    }),
    "TIMER",
  );
});

test("an outdoor run stays GPS verified", () => {
  assert.equal(
    timer.getWorkoutVerificationMode({ name: "Runner Base", description: "20 minute run" }),
    "GPS",
  );
});

test("timed plan expands sets and rest without a final rest", () => {
  const plan = timer.buildTimedWorkoutPlan([
    { exercise_name: "Plank", duration_seconds: 30, sets: 2, rest_seconds: 10 },
  ]);
  assert.deepEqual(
    plan.map((item) => [item.type, item.seconds]),
    [["WORK", 30], ["REST", 10], ["WORK", 30]],
  );
});

test("countdown respects a server clock offset", () => {
  const state = timer.getTimedWorkoutCountdown({
    startedAt: "2026-09-14T12:00:00.000Z",
    targetSeconds: 1200,
    serverOffsetMs: 5000,
    nowMs: Date.parse("2026-09-14T12:05:00.000Z"),
  });
  assert.equal(state.elapsedSeconds, 305);
  assert.equal(state.remainingSeconds, 895);
});

test("phase lookup returns the active work or rest countdown", () => {
  const plan = timer.buildTimedWorkoutPlan([
    { exercise_name: "Hollow Hold", duration_seconds: 25, sets: 2, rest_seconds: 10 },
  ]);
  assert.equal(timer.getTimedWorkoutPhase(plan, 26).type, "REST");
  assert.equal(timer.getTimedWorkoutPhase(plan, 26).remainingSeconds, 9);
});
