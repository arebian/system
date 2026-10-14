/* =========================================================
   THE SYSTEM 2.9.2 — GRAND ARCHIVE RECOVERY SHELF

   When the authoritative Mage Archive RPC is delayed, this shelf preserves
   the same curated in-app editions. It remains non-authoritative: it never
   grants official Archive XP, Knowledge Rank, or completion.
   ========================================================= */

import {
  MAGE_ARCHIVE_CURATED_FALLBACK_BOOKS,
} from "./systemArchiveReaderCatalog.js";

export const MAGE_ARCHIVE_FALLBACK_BOOKS =
  MAGE_ARCHIVE_CURATED_FALLBACK_BOOKS;

const RANKS = ["E", "D", "C", "B", "A", "S"];

export function archiveRankIndex(rank) {
  const index = RANKS.indexOf(String(rank || "E").toUpperCase());
  return index < 0 ? 0 : index;
}

export function fallbackArchiveBooks(knowledgeRank = "E", localProgress = {}) {
  const allowed = archiveRankIndex(knowledgeRank);
  const progress = localProgress && typeof localProgress === "object" ? localProgress : {};

  return MAGE_ARCHIVE_FALLBACK_BOOKS.map((book) => ({
    ...book,
    unlocked: archiveRankIndex(book.rank) <= allowed,
    fallback: true,
    progress: progress[book.id] || null,
  }));
}
