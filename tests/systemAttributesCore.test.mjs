import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateClassAlignment,
  createClassAttributeBaseline,
  getAttributeTier,
  normalizeAttributeCredit,
  sortAttributesForClass,
} from "../src/systemAttributesCore.js";

test("Mage baseline centers Intelligence and Focus instead of Strength", () => {
  const mage = createClassAttributeBaseline("MAGE");
  assert.ok(mage.INTELLIGENCE > mage.STRENGTH);
  assert.ok(mage.FOCUS > mage.STRENGTH);
  assert.equal(getAttributeTier("MAGE", "INTELLIGENCE"), "CORE");
  assert.equal(getAttributeTier("MAGE", "STRENGTH"), "OPEN");
});

test("class alignment gives an exact baseline a stronger score than a flat legacy map", () => {
  const mage = createClassAttributeBaseline("MAGE");
  const flat = Object.fromEntries(Object.keys(mage).map((name) => [name, 10]));
  assert.ok(calculateClassAlignment("MAGE", mage).score > calculateClassAlignment("MAGE", flat).score);
});

test("attribute sorting puts class core stats before supporting and open stats", () => {
  const values = {
    STRENGTH: 8,
    INTELLIGENCE: 15,
    FOCUS: 13,
    CREATIVITY: 11,
    DISCIPLINE: 9,
  };
  const ordered = sortAttributesForClass(values, "MAGE").map(([name]) => name);
  assert.deepEqual(ordered.slice(0, 3), ["INTELLIGENCE", "FOCUS", "CREATIVITY"]);
});

test("credit normalization never exposes more available credits than the ledger granted", () => {
  const credit = normalizeAttributeCredit({
    id: "credit-1",
    source_title: "Cognitive Strike",
    source_category: "LEARNING",
    credits_awarded: 2,
    credits_spent: 99,
    eligible_attributes: ["INTELLIGENCE", "FOCUS", "INVALID"],
  });
  assert.equal(credit.available, 0);
  assert.deepEqual(credit.eligibleAttributes, ["INTELLIGENCE", "FOCUS"]);
});
