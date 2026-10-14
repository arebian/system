import test from "node:test";
import assert from "node:assert/strict";
import * as archive from "../src/systemArchiveFallback.js";

test("Archive recovery shelf has real visible E-rank books", () => {
  const books = archive.fallbackArchiveBooks("E");
  assert.ok(books.length >= 10);
  assert.ok(books.some((book) => book.rank === "E" && book.unlocked));
});

test("Archive recovery shelf retains local reading progress", () => {
  const books = archive.fallbackArchiveBooks("D", {
    "fallback-atomic-habits": { status: "ACTIVE", current_page: 21 },
  });
  const activeBook = books.find((book) => book.id === "fallback-atomic-habits");
  assert.equal(activeBook.progress.current_page, 21);
  assert.equal(activeBook.unlocked, true);
});
