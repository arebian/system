import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SYSTEM_PUBLIC_DOMAIN_EDITIONS,
} from "../src/systemArchiveReaderCatalog.js";

const source = await readFile(
  new URL(
    "../supabase/functions/system-content-api/index.ts",
    import.meta.url,
  ),
  "utf8",
);

test("the protected Archive reader backend allowlists every curated title", () => {
  assert.match(source, /ARCHIVE_READER_EBOOKS/);
  assert.match(source, /action === "archive_text"/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(source, /-images\.pdf/);

  for (const edition of Object.values(SYSTEM_PUBLIC_DOMAIN_EDITIONS)) {
    const expected = `"${edition.key}": "${edition.ebookNumber}"`;
    assert.ok(
      source.includes(expected),
      `${edition.key} must map to its verified Gutenberg text`,
    );
  }
});
