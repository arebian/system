/* =========================================================
   THE SYSTEM 2.8.4 — EXTERNAL API PURE CONTRACT HELPERS
   No Supabase/client state in this module so it can be tested
   with Node's built-in test runner.
   ========================================================= */

export function normalizeExternalQuery(value, maxLength = 220) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function clampExternalResultCount(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function buildTutorialSearchRequest(query, options = {}) {
  const clean = normalizeExternalQuery(query, 180);
  if (!clean) return null;

  return {
    action: "tutorial_search",
    payload: {
      query: clean,
      max_results: clampExternalResultCount(options.maxResults, 1, 8, 6),
      region_code: normalizeExternalQuery(options.regionCode || "KE", 8).toUpperCase(),
      language: normalizeExternalQuery(options.language || "en", 8).toLowerCase(),
    },
  };
}

export function buildBookSearchRequest(query, options = {}) {
  const clean = normalizeExternalQuery(query, 220);
  if (!clean) return null;

  return {
    action: "book_search",
    payload: {
      query: clean,
      max_results: clampExternalResultCount(options.maxResults, 1, 20, 10),
    },
  };
}

export function buildBookLookupRequest(volumeId) {
  const clean = normalizeExternalQuery(volumeId, 128);
  if (!clean) return null;

  return {
    action: "book_lookup",
    payload: {
      volume_id: clean,
    },
  };
}

export function buildOpenLibraryResolveRequest(title, author = "", options = {}) {
  const cleanTitle = normalizeExternalQuery(title, 220);
  if (!cleanTitle) return null;

  return {
    action: "open_library_resolve",
    payload: {
      title: cleanTitle,
      author: normalizeExternalQuery(author, 160),
      max_results: clampExternalResultCount(options.maxResults, 1, 20, 10),
    },
  };
}

export function buildArchivePdfLookupRequest(identifier) {
  const clean = normalizeExternalQuery(identifier, 180);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(clean)) {
    return null;
  }

  return {
    action: "archive_pdf_lookup",
    payload: {
      identifier: clean,
    },
  };
}

export function buildArchiveTextRequest(readerKey) {
  const clean = normalizeExternalQuery(readerKey, 96).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) {
    return null;
  }

  return {
    action: "archive_text",
    payload: {
      reader_key: clean,
    },
  };
}
