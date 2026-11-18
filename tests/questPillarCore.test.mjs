import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: [new URL("../supabase/functions/_shared/questPillarCore.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const core = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const { expectedDailyPillarForQuestCategory, questTasksMatchPillar } = core;

test("daily parent categories map to the exact mission pillars", () => {
  assert.equal(expectedDailyPillarForQuestCategory("DISCIPLINE"), "DISCIPLINE");
  assert.equal(expectedDailyPillarForQuestCategory("PHYSICAL"), "PHYSICAL");
  assert.equal(expectedDailyPillarForQuestCategory("FOCUS"), "MENTAL");
  assert.equal(expectedDailyPillarForQuestCategory("MENTAL"), "MENTAL");
  assert.equal(expectedDailyPillarForQuestCategory("WEALTH"), null);
});

test("a daily quest accepts exactly its own three mission tasks", () => {
  const ids = ["d1", "d2", "d3"];
  const rows = ids.map(id => ({ id, pillar: "DISCIPLINE" }));
  assert.equal(questTasksMatchPillar(rows, ids, "DISCIPLINE"), true);
});

test("a daily quest rejects mixed or cross-pillar mission tasks", () => {
  const ids = ["m1", "m2", "m3"];
  assert.equal(questTasksMatchPillar([
    { id: "m1", pillar: "MENTAL" },
    { id: "m2", pillar: "MENTAL" },
    { id: "m3", pillar: "PHYSICAL" },
  ], ids, "MENTAL"), false);
  assert.equal(questTasksMatchPillar([
    { id: "m1", pillar: "MENTAL" },
    { id: "m2", pillar: "MENTAL" },
  ], ids, "MENTAL"), false);
  assert.equal(questTasksMatchPillar([
    { id: "m1", pillar: "MENTAL" },
    { id: "m2", pillar: "MENTAL" },
    { id: "m3", pillar: "MENTAL" },
  ], ["m1", "m2", "m2"], "MENTAL"), false);
});
