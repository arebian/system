import test from "node:test";
import assert from "node:assert/strict";
import { isIdentityReady, normalizeIdentity, SYSTEM_IDENTITY_PILLARS } from "../src/systemIdentityCore.js";

test("identity catalog exposes seven distinct pillars", () => {
  assert.equal(SYSTEM_IDENTITY_PILLARS.length, 7);
  assert.equal(new Set(SYSTEM_IDENTITY_PILLARS.map(item => item.value)).size, 7);
});

test("normalizes primary and up to two unique supporting pillars", () => {
  const identity = normalizeIdentity({
    primary: " wealth ",
    secondary: ["DISCIPLINE", "INTELLECT", "SOCIAL", "DISCIPLINE"],
  });
  assert.deepEqual(identity, {
    primary: "WEALTH",
    secondary: ["DISCIPLINE", "INTELLECT"],
    updatedAt: "",
  });
});

test("rejects unknown primary pillars and clears supporting pillars", () => {
  assert.deepEqual(normalizeIdentity({
    primary: "UNKNOWN",
    secondary: ["DISCIPLINE"],
  }), {
    primary: "",
    secondary: [],
    updatedAt: "",
  });
});

test("does not allow the primary pillar to be repeated as a supporting pillar", () => {
  const identity = normalizeIdentity({
    primary: "PHYSICAL",
    secondary: ["PHYSICAL", "MENTAL"],
  });
  assert.deepEqual(identity.secondary, ["MENTAL"]);
  assert.equal(isIdentityReady(identity), true);
});

test("empty identity remains valid for existing profiles", () => {
  assert.equal(isIdentityReady(null), false);
  assert.deepEqual(normalizeIdentity(null), {
    primary: "",
    secondary: [],
    updatedAt: "",
  });
});
