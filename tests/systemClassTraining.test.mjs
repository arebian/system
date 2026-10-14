import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const training = await importStandaloneModule("../src/systemClassTraining.js");

test("Commander training is a private video protocol", () => {
  const protocol = training.classTrainingFor("COMMANDER");
  assert.equal(protocol.proofType, "VIDEO");
  assert.match(protocol.objective, /private/i);
  assert.equal(protocol.tutorialQuery, undefined);
  assert.match(protocol.steps.join(" "), /front camera/i);
});

test("Tank, Assassin and Ranger have distinct class-special protocols", () => {
  assert.equal(training.classTrainingFor("TANK").title, "IRON LEDGER");
  assert.equal(training.classTrainingFor("ASSASSIN").title, "SILENT TARGET");
  assert.equal(training.classTrainingFor("RANGER").title, "TRAIL MARKER");
});

test("Commander cloud skill lookup only selects a matching class skill", () => {
  const skill = training.findClassTrainingSkill(
    [
      { id: 1, name: "Public Speaking", class_affinity: "COMMANDER", progression_group: "CHARISMA" },
      { id: 2, name: "Handstand", class_affinity: "TANK", progression_group: "STRENGTH" },
    ],
    "COMMANDER",
    ["public speaking", "charisma"],
  );
  assert.equal(skill.id, 1);
});
