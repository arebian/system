import test from "node:test";
import assert from "node:assert/strict";
import { importStandaloneModule } from "./module-loader.mjs";

const core = await importStandaloneModule("../src/systemExternalCore.js");

test("empty tutorial queries are rejected before an API call", () => {
  assert.equal(core.buildTutorialSearchRequest("   "), null);
});

test("tutorial result count is clamped", () => {
  const req = core.buildTutorialSearchRequest("pull up", { maxResults: 999 });
  assert.equal(req.payload.max_results, 8);
  assert.equal(req.payload.region_code, "KE");
});

test("book search trims and clamps input", () => {
  const req = core.buildBookSearchRequest("  discipline  ", { maxResults: 0 });
  assert.equal(req.payload.query, "discipline");
  assert.equal(req.payload.max_results, 1);
});

test("book lookup rejects an empty volume id", () => {
  assert.equal(core.buildBookLookupRequest(""), null);
});

test("Open Library lookups are title based and keep provider limits bounded", () => {
  assert.equal(core.buildOpenLibraryResolveRequest("  "), null);

  const req = core.buildOpenLibraryResolveRequest(
    "  Meditations  ",
    "  Marcus Aurelius  ",
    { maxResults: 999 },
  );

  assert.deepEqual(req, {
    action: "open_library_resolve",
    payload: {
      title: "Meditations",
      author: "Marcus Aurelius",
      max_results: 20,
    },
  });
});

test("Archive PDF lookup only accepts a safe Internet Archive identifier", () => {
  assert.equal(core.buildArchivePdfLookupRequest("  "), null);
  assert.equal(core.buildArchivePdfLookupRequest("bad/path"), null);

  assert.deepEqual(
    core.buildArchivePdfLookupRequest("richestmaninbabl00clas"),
    {
      action: "archive_pdf_lookup",
      payload: {
        identifier: "richestmaninbabl00clas",
      },
    },
  );
});

test("Archive text lookup only accepts a catalog reader key", () => {
  assert.equal(core.buildArchiveTextRequest("  "), null);
  assert.equal(core.buildArchiveTextRequest("reader/key"), null);
  assert.equal(core.buildArchiveTextRequest("../../outside"), null);

  assert.deepEqual(
    core.buildArchiveTextRequest("  the-alchemist  "),
    {
      action: "archive_text",
      payload: {
        reader_key: "the-alchemist",
      },
    },
  );
});
