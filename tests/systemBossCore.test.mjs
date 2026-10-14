import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const core = await importStandaloneModule("../src/systemBossCore.js");

test("Raid Entry Key detection is safe for incomplete profiles", () => {
  assert.equal(core.hasRaidEntryKey(), false);
  assert.equal(core.hasRaidEntryKey({}), false);
  assert.equal(core.hasRaidEntryKey({ backendState: {} }), false);
});

test("Raid Entry Key detection accepts authoritative and local inventory entries", () => {
  assert.equal(
    core.hasRaidEntryKey({
      customInventory: [{ name: "Raid Entry Key" }],
    }),
    true,
  );

  assert.equal(
    core.hasRaidEntryKey({
      backendState: {
        inventory: [{ item_catalog: { slug: "raid-entry-key" } }],
      },
    }),
    true,
  );
});
