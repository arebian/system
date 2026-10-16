import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfile } from "../src/systemProfileCore.js";
import { effectiveAttributes } from "../src/systemEquipmentCore.js";

test("equipment totals survive hydration and keep earned attributes separate", () => {
  const profile = normalizeProfile({ path: "RANGER", attributes: { SPEED: 12 }, equipment: { bonuses: { SPEED: 5 } } });
  assert.equal(profile.attributes.SPEED, 12);
  assert.equal(effectiveAttributes(profile).SPEED, 17);
  assert.equal(effectiveAttributes({ ...profile, equipment: null }).SPEED, 12);
});
