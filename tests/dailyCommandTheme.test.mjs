import test from "node:test";
import assert from "node:assert/strict";
import { PATHS } from "../src/systemProfileCore.js";

test("light palettes preserve a distinct class atmosphere without near-white panels", () => {
  const classes = Object.values(PATHS);
  assert.equal(new Set(classes.map((item) => item.lightBg)).size, 5);
  assert.equal(new Set(classes.map((item) => item.lightPanel)).size, 5);
  for (const item of classes) {
    assert.notEqual(item.lightBg.toLowerCase(), "#ffffff");
    assert.notEqual(item.lightPanel.toLowerCase(), "#ffffff");
  }
});
