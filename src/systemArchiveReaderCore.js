/* =========================================================
   THE SYSTEM 2.9.2 — NATIVE ARCHIVE READER

   Project Gutenberg does not publish a PDF for every public-domain title.
   THE SYSTEM therefore renders the verified full text as fixed in-app pages
   instead of embedding a provider website or inventing a PDF URL.
   ========================================================= */

export const ARCHIVE_READER_PAGE_CHARACTERS = 1000;

function normalizedText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function splitLongParagraph(paragraph, maxCharacters) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const word of words) {
    const next = current ? current + " " + word : word;

    if (current && next.length > maxCharacters) {
      chunks.push(current);
      current = word;
      continue;
    }

    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function archiveTextParagraphs(value) {
  const text = normalizedText(value);
  if (!text) return [];

  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

export function paginateArchiveText(
  value,
  maxCharacters = ARCHIVE_READER_PAGE_CHARACTERS,
) {
  const safeLimit = Math.max(500, Math.min(2400, Number(maxCharacters) || 1000));
  const paragraphs = archiveTextParagraphs(value);
  if (!paragraphs.length) return [];

  const pages = [];
  let page = [];
  let pageLength = 0;

  const addParagraph = (paragraph) => {
    const separator = page.length ? 2 : 0;

    if (page.length && pageLength + separator + paragraph.length > safeLimit) {
      pages.push(page.join("\n\n"));
      page = [];
      pageLength = 0;
    }

    page.push(paragraph);
    pageLength += (page.length > 1 ? 2 : 0) + paragraph.length;
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= safeLimit) {
      addParagraph(paragraph);
      continue;
    }

    for (const chunk of splitLongParagraph(paragraph, safeLimit)) {
      addParagraph(chunk);
    }
  }

  if (page.length) {
    pages.push(page.join("\n\n"));
  }

  return pages;
}
