import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/SystemGame.jsx", import.meta.url), "utf8");
const bossGateStart = source.indexOf("function BossGate({");
const bossGateEnd = source.indexOf("\nexport function ", bossGateStart + 1);
const bossGate = source.slice(
  bossGateStart,
  bossGateEnd === -1 ? source.length : bossGateEnd,
);

test("Boss Gate owns the Raid Entry Key value it renders", () => {
  assert.ok(bossGateStart >= 0, "BossGate component is present");
  assert.match(
    bossGate,
    /const raidEntryKeyDetected =\s*hasRaidEntryKey\(profile\);/,
  );
  assert.match(bossGate, /raidEntryKeyDetected/);
});
