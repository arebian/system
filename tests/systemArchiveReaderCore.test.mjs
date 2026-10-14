import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const core = await importStandaloneModule("../src/systemArchiveReaderCore.js");

test("the native Archive reader normalizes provider paragraphs", () => {
  assert.deepEqual(
    core.archiveTextParagraphs("First line\r\ncontinues.\n\nSecond paragraph."),
    ["First line continues.", "Second paragraph."],
  );
});

test("the native Archive reader creates fixed pages without dropping text", () => {
  const source = [
    "Opening paragraph.",
    "word ".repeat(360).trim(),
    "Closing paragraph.",
  ].join("\n\n");

  const pages = core.paginateArchiveText(source, 500);
  const reconstructed = pages.join("\n\n");

  assert.ok(pages.length > 2);
  assert.match(reconstructed, /Opening paragraph\./);
  assert.match(reconstructed, /Closing paragraph\./);
  assert.equal(reconstructed.split(/\s+/).length, source.split(/\s+/).length);
});
