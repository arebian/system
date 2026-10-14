import { supabase } from "./supabaseClient.js";
import { loadBundledArchiveText, archiveTextIsValid } from "./systemArchiveText.js";
import { reportSystemError } from "./systemErrorReporter.js";
import {
  buildBookLookupRequest,
  buildBookSearchRequest,
  buildArchivePdfLookupRequest,
  buildArchiveTextRequest,
  buildOpenLibraryResolveRequest,
  buildTutorialSearchRequest,
} from "./systemExternalCore.js";

const DEFAULT_TIMEOUT_MS = 15000;
const CACHE = new Map();

const CACHE_TTL = {
  tutorials: 5 * 60 * 1000,
  books: 10 * 60 * 1000,
  bookLookup: 30 * 60 * 1000,
  openLibrary: 30 * 60 * 1000,
  archivePdf: 30 * 60 * 1000,
};

function cacheRead(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;

  if (Date.now() >= hit.expiresAt) {
    CACHE.delete(key);
    return null;
  }

  return hit.value;
}

function cacheWrite(key, value, ttlMs) {
  CACHE.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  if (CACHE.size > 80) {
    const oldest = CACHE.keys().next().value;
    CACHE.delete(oldest);
  }

  return value;
}

async function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("SYSTEM_EXTERNAL_TIMEOUT");
      error.code = "SYSTEM_EXTERNAL_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function invokeProtectedFunction(name, body = {}, options = {}) {
  const result = await withTimeout(
    supabase.functions.invoke(name, {
      body,
    }),
    Number(options.timeoutMs || DEFAULT_TIMEOUT_MS),
  );

  const { data, error } = result || {};

  if (error) {
    void reportSystemError(error, name === "system-intelligence-responder" ? "AI" : "ARCHIVE");
    throw error;
  }

  if (data?.error) {
    const failure = new Error(data.error);
    failure.code = data.code || "SYSTEM_EXTERNAL_API_ERROR";
    failure.details = data.details || null;
    void reportSystemError(failure, name === "system-intelligence-responder" ? "AI" : "ARCHIVE");
    throw failure;
  }

  return data?.data ?? data;
}

export async function askSystemIntelligenceApi({
  message,
  threadId = null,
  awareness = null,
  playerContext = null,
}) {
  return invokeProtectedFunction(
    "system-intelligence-responder",
    {
      message,
      thread_id: threadId || null,
      awareness: awareness || null,
      player_context: playerContext || null,
    },
    { timeoutMs: 30000 },
  );
}

export async function searchSystemTutorials(query, options = {}) {
  const request = buildTutorialSearchRequest(query, options);
  if (!request) return [];

  const key = `tutorial:${JSON.stringify(request.payload)}`;
  const cached = cacheRead(key);
  if (cached) return cached;

  const data = await invokeProtectedFunction("system-content-api", request);
  const items = Array.isArray(data?.items) ? data.items : [];
  return cacheWrite(key, items, CACHE_TTL.tutorials);
}

export async function searchSystemBooks(query, options = {}) {
  const request = buildBookSearchRequest(query, options);
  if (!request) return [];

  const key = `book-search:${JSON.stringify(request.payload)}`;
  const cached = cacheRead(key);
  if (cached) return cached;

  const data = await invokeProtectedFunction("system-content-api", request);
  const items = Array.isArray(data?.items) ? data.items : [];
  return cacheWrite(key, items, CACHE_TTL.books);
}

export async function getSystemBook(volumeId) {
  const request = buildBookLookupRequest(volumeId);
  if (!request) return null;

  const key = `book:${request.payload.volume_id}`;
  const cached = cacheRead(key);
  if (cached) return cached;

  const data = await invokeProtectedFunction("system-content-api", request);
  const book = data?.book || null;

  if (book) {
    cacheWrite(key, book, CACHE_TTL.bookLookup);
  }

  return book;
}

export async function resolveSystemOpenLibraryBook(
  { title, author = "" } = {},
  options = {},
) {
  const request = buildOpenLibraryResolveRequest(title, author, options);
  if (!request) return [];

  const key = `open-library:${JSON.stringify(request.payload)}`;
  const cached = cacheRead(key);
  if (cached) return cached;

  const data = await invokeProtectedFunction("system-content-api", request);
  const items = Array.isArray(data?.items) ? data.items : [];
  return cacheWrite(key, items, CACHE_TTL.openLibrary);
}

export async function resolveSystemArchivePdf(identifier) {
  const request = buildArchivePdfLookupRequest(identifier);
  if (!request) return null;

  const key = `archive-pdf:${request.payload.identifier}`;
  const cached = cacheRead(key);
  if (cached) return cached;

  const data = await invokeProtectedFunction("system-content-api", request);
  return cacheWrite(key, data || null, CACHE_TTL.archivePdf);
}

export async function loadSystemArchiveText(readerKey) {
  const request = buildArchiveTextRequest(readerKey);
  if (!request) return null;

  const key = `archive-text:${readerKey}`;
  const cached = cacheRead(key);
  if (cached) return cached;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const local = await loadBundledArchiveText(readerKey, {signal:controller.signal});
    return cacheWrite(key, local, 60 * 60 * 1000);
  } catch {
    // A missing bundle from an incomplete deployment can recover through the
    // authenticated, same-edition source resolver. Never embed an error page.
  } finally { clearTimeout(deadline); }

  const data = await invokeProtectedFunction(
    "system-content-api",
    request,
    { timeoutMs: 30000 },
  );

  if (!archiveTextIsValid(data?.text)) {
    const error = new Error("ARCHIVE_TEXT_UNAVAILABLE");
    error.code = "ARCHIVE_TEXT_UNAVAILABLE";
    throw error;
  }

  return cacheWrite(key, data, 60 * 60 * 1000);
}

export function clearSystemExternalCache() {
  CACHE.clear();
}
