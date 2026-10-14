import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=60",
    },
  });

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const RESPONSE_CACHE = new Map<string, { value: any; expiresAt: number }>();
const ARCHIVE_TEXT_CACHE = new Map<string, { value: any; expiresAt: number }>();

// Only titles in the authoritative Mage catalog can ask this function to
// retrieve a public-domain text. The browser supplies a reader key, never an
// arbitrary URL, so this endpoint cannot become an authenticated fetch proxy.
const ARCHIVE_READER_EBOOKS: Record<string, string> = Object.freeze({
  "make-your-bed": "935",
  "the-alchemist": "2274",
  "the-art-of-war": "132",
  "richest-man-in-babylon": "1570",
  "tuesdays-with-morrie": "17476",
  "who-moved-my-cheese": "17396",
  "atomic-habits": "148",
  "ikigai": "19994",
  "compound-effect": "236",
  "psychology-of-money": "215",
  "the-little-prince": "205",
  "deep-work": "41838",
  "i-will-teach-you-to-be-rich": "19598",
  "mans-search-for-meaning": "23",
  "obstacle-is-the-way": "43",
  "why-we-sleep": "1497",
  "essentialism": "37134",
  "grit": "910",
  "outlive": "1228",
  "simple-path-to-wealth": "1404",
  "thinking-in-bets": "2852",
  "intelligent-investor": "833",
  "laws-of-human-nature": "174",
  "antifragile": "1232",
  "meditations": "2680",
  "thinking-fast-and-slow": "35",
  "security-analysis": "3300",
  "behave": "2701",
  "poor-charlies-almanack": "1184",
  "beginning-of-infinity": "1727",
  "brothers-karamazov": "28054",
});

function consumeRateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);

  if (!bucket || now >= bucket.resetAt) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now();
  const hit = RESPONSE_CACHE.get(key);
  if (hit && now < hit.expiresAt) return hit.value as T;

  const value = await loader();
  RESPONSE_CACHE.set(key, { value, expiresAt: now + ttlMs });

  if (RESPONSE_CACHE.size > 120) {
    const oldest = RESPONSE_CACHE.keys().next().value;
    if (oldest) RESPONSE_CACHE.delete(oldest);
  }

  return value;
}

function cleanText(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function fetchJson(url: URL, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.error_description ||
        payload?.message ||
        `UPSTREAM_${response.status}`;
      throw Object.assign(new Error(message), {
        status: response.status,
        upstream: payload,
      });
    }

    return payload;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("UPSTREAM_TIMEOUT"), { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPlainText(url: URL, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "text/plain,text/*;q=0.9,*/*;q=0.1",
      },
    });

    if (!response.ok) {
      throw Object.assign(new Error(`UPSTREAM_${response.status}`), {
        status: response.status,
      });
    }

    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > 3_000_000) {
      throw Object.assign(new Error("ARCHIVE_TEXT_TOO_LARGE"), { status: 413 });
    }

    const text = await response.text();
    if (text.length < 500 || /^\s*(?:<!doctype\s+html|<html)/i.test(text) || !text.includes("*** START OF") || !text.includes("*** END OF")) {
      throw Object.assign(new Error("ARCHIVE_TEXT_UNAVAILABLE"), { status: 502 });
    }
    if (text.length > 3_000_000) {
      throw Object.assign(new Error("ARCHIVE_TEXT_TOO_LARGE"), { status: 413 });
    }

    return text;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("UPSTREAM_TIMEOUT"), { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function cachedArchiveText<T>(key: string, loader: () => Promise<T>) {
  const now = Date.now();
  const hit = ARCHIVE_TEXT_CACHE.get(key);
  if (hit && now < hit.expiresAt) return hit.value as T;

  const value = await loader();
  ARCHIVE_TEXT_CACHE.set(key, { value, expiresAt: now + 10 * 60_000 });

  // Keep Edge isolate memory predictable: the reader only needs a tiny
  // working set, and each title is fetched again on cache expiry.
  if (ARCHIVE_TEXT_CACHE.size > 3) {
    const oldest = ARCHIVE_TEXT_CACHE.keys().next().value;
    if (oldest) ARCHIVE_TEXT_CACHE.delete(oldest);
  }

  return value;
}

function normalizeYoutubeItem(item: any) {
  const videoId = cleanText(item?.id?.videoId, 64);
  if (!videoId) return null;

  const snippet = item?.snippet || {};
  const thumb =
    snippet?.thumbnails?.high?.url ||
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.default?.url ||
    "";

  return {
    type: "tutorial",
    provider: "YOUTUBE",
    video_id: videoId,
    title: cleanText(snippet?.title, 240),
    description: cleanText(snippet?.description, 700),
    channel: cleanText(snippet?.channelTitle, 160),
    published_at: cleanText(snippet?.publishedAt, 64),
    thumbnail: cleanText(thumb, 500),
    embed_url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
  };
}

function normalizeBook(item: any) {
  const info = item?.volumeInfo || {};
  const access = item?.accessInfo || {};
  const sale = item?.saleInfo || {};
  const images = info?.imageLinks || {};
  const id = cleanText(item?.id, 128);
  if (!id) return null;

  const viewability = cleanText(access?.viewability, 64).toUpperCase();
  const embeddable = Boolean(access?.embeddable);

  return {
    type: "book",
    provider: "GOOGLE_BOOKS",
    volume_id: id,
    title: cleanText(info?.title, 240),
    subtitle: cleanText(info?.subtitle, 240),
    authors: Array.isArray(info?.authors)
      ? info.authors.map((v: unknown) => cleanText(v, 140)).filter(Boolean).slice(0, 8)
      : [],
    publisher: cleanText(info?.publisher, 160),
    published_date: cleanText(info?.publishedDate, 64),
    description: cleanText(info?.description, 1800),
    page_count: clampInt(info?.pageCount, 0, 100000, 0),
    categories: Array.isArray(info?.categories)
      ? info.categories.map((v: unknown) => cleanText(v, 120)).filter(Boolean).slice(0, 10)
      : [],
    language: cleanText(info?.language, 24),
    thumbnail:
      cleanText(images?.extraLarge, 500) ||
      cleanText(images?.large, 500) ||
      cleanText(images?.medium, 500) ||
      cleanText(images?.small, 500) ||
      cleanText(images?.thumbnail, 500) ||
      cleanText(images?.smallThumbnail, 500),
    embeddable,
    viewability,
    public_domain: Boolean(access?.publicDomain),
    epub_available: Boolean(access?.epub?.isAvailable),
    pdf_available: Boolean(access?.pdf?.isAvailable),
    access_view_status: cleanText(access?.accessViewStatus, 64),
    country: cleanText(access?.country, 8),
    is_ebook: Boolean(sale?.isEbook),
    reader_mode: embeddable ? "GOOGLE_EMBED" : "METADATA_ONLY",
  };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function openLibraryWorkKey(value: unknown) {
  const candidate = cleanText(value, 128);
  const match = candidate.match(/(?:^|\/)(works\/OL\d+W)$/i);
  return match ? `/${match[1]}` : "";
}

function openLibraryEditionKey(value: unknown) {
  const candidate = cleanText(value, 128);
  const match = candidate.match(/(?:^|\/)(?:books\/)?(OL\d+M)$/i);
  return match ? match[1].toUpperCase() : "";
}

function internetArchiveIdentifier(value: unknown) {
  const candidate = cleanText(value, 180);
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(candidate)
    ? candidate
    : "";
}

function isTrueFlag(value: unknown) {
  if (value === true || value === 1) return true;
  return ["true", "1", "yes"].includes(
    cleanText(value, 16).toLowerCase(),
  );
}

function normalizeArchivePdfFile(value: unknown) {
  const file = asRecord(value);
  const name = cleanText(file?.name, 512);
  const format = cleanText(file?.format, 160).toLowerCase();
  const lowerName = name.toLowerCase();

  if (!name || !/^[^/\\]+\.pdf$/i.test(name)) return null;
  if (isTrueFlag(file?.private)) return null;
  if (/abbyy|chocr|djvu|scandata|_text\.pdf$/i.test(`${lowerName} ${format}`)) {
    return null;
  }

  const size = Math.max(0, Number(file?.size) || 0);
  const score =
    (/text pdf|pdf/i.test(format) ? 20 : 0) +
    (/full|complete|original/i.test(lowerName) ? 3 : 0) +
    (size > 0 ? 1 : 0);

  return {
    name,
    size,
    score,
  };
}

function openLibraryCoverUrl(value: unknown) {
  const coverId = cleanText(value, 64);
  return /^\d+$/.test(coverId)
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : "";
}

function firstValidOpenLibraryEdition(item: Record<string, any>) {
  const nestedEditions = asRecord(item?.editions);
  const candidates = [
    ...asList(item?.edition_key),
    ...asList(nestedEditions?.docs).map((edition) => asRecord(edition)?.key),
  ];

  for (const candidate of candidates) {
    const edition = openLibraryEditionKey(candidate);
    if (edition) return edition;
  }

  return "";
}

function firstInternetArchiveIdentifier(
  item: Record<string, any>,
  availability: Record<string, any>,
) {
  const candidates = [
    availability?.identifier,
    availability?.ia,
    item?.lending_identifier,
    ...asList(item?.ia),
  ];

  for (const candidate of candidates) {
    const identifier = internetArchiveIdentifier(candidate);
    if (identifier) return identifier;
  }

  return "";
}

function normalizeOpenLibraryBook(item: any) {
  const source = asRecord(item);
  const availability = asRecord(source?.availability);
  const workKey = openLibraryWorkKey(source?.key);
  const editionKey = firstValidOpenLibraryEdition(source);
  const identifier = firstInternetArchiveIdentifier(source, availability);
  const nestedEditions = asRecord(source?.editions);
  const nestedEditionDocs = asList(nestedEditions?.docs).map(asRecord);
  const nestedPublicAccess = nestedEditionDocs.some(
    (edition) => cleanText(edition?.ebook_access, 32).toLowerCase() === "public",
  );
  const publicAccess =
    availability?.is_readable === true ||
    source?.public_scan_b === true ||
    source?.public_scan === true ||
    cleanText(source?.ebook_access, 32).toLowerCase() === "public" ||
    nestedPublicAccess;
  const status = cleanText(availability?.status, 64).toUpperCase();
  const isBorrowable = /LEND|BORROW|CHECKED OUT/.test(status);
  const sourceUrl = editionKey
    ? `https://openlibrary.org/books/${encodeURIComponent(editionKey)}`
    : workKey
      ? `https://openlibrary.org${workKey}`
      : "";
  const embedUrl = publicAccess && identifier
    ? `https://archive.org/embed/${encodeURIComponent(identifier)}`
    : "";
  const directUrl = embedUrl
    ? `https://archive.org/details/${encodeURIComponent(identifier)}/mode/1up`
    : identifier && isBorrowable
      ? `https://archive.org/details/${encodeURIComponent(identifier)}/mode/1up`
      : sourceUrl;
  const authorNames = asList(source?.author_name)
    .map((author) => cleanText(author, 140))
    .filter(Boolean)
    .slice(0, 8);
  const readableHere = Boolean(embedUrl);

  if (!cleanText(source?.title, 240)) return null;

  return {
    type: "book",
    provider: "OPEN_LIBRARY",
    open_library_key: workKey || null,
    edition_key: editionKey || null,
    title: cleanText(source?.title, 240),
    authors: authorNames,
    first_publish_year: clampInt(source?.first_publish_year, 0, 3000, 0),
    thumbnail: openLibraryCoverUrl(source?.cover_i),
    availability_status: status || (readableHere ? "FULL ACCESS" : "CATALOG"),
    is_readable: readableHere,
    embeddable: readableHere,
    reader_mode: readableHere
      ? "OPEN_LIBRARY_EMBED"
      : isBorrowable
        ? "OPEN_LIBRARY_BORROW"
        : "OPEN_LIBRARY_RECORD",
    access_label: readableHere
      ? "READ HERE"
      : isBorrowable
        ? "OPEN BORROW PAGE"
        : sourceUrl
          ? "VIEW OPEN LIBRARY RECORD"
          : "CATALOG ONLY",
    embed_url: embedUrl || null,
    direct_url: directUrl || null,
    source_url: sourceUrl || null,
    internet_archive_id: identifier || null,
  };
}

async function youtubeSearch(payload: any) {
  const key = cleanText(Deno.env.get("YOUTUBE_API_KEY"), 512);
  if (!key) {
    return {
      configured: false,
      items: [],
      warning: "YOUTUBE_API_KEY_MISSING",
    };
  }

  const query = cleanText(payload?.query, 180);
  if (!query) throw new Error("QUERY_REQUIRED");

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(clampInt(payload?.max_results, 1, 8, 6)));
  url.searchParams.set("order", "relevance");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("videoSyndicated", "true");
  url.searchParams.set("relevanceLanguage", cleanText(payload?.language, 8) || "en");
  url.searchParams.set("regionCode", cleanText(payload?.region_code, 8) || "KE");
  url.searchParams.set("key", key);

  const cacheKey = `youtube:${query}:${url.searchParams.get("maxResults")}:${url.searchParams.get("regionCode")}:${url.searchParams.get("relevanceLanguage")}`;
  const data = await cached(cacheKey, 5 * 60_000, () => fetchJson(url));
  const items = (Array.isArray(data?.items) ? data.items : [])
    .map(normalizeYoutubeItem)
    .filter(Boolean);

  return {
    configured: true,
    provider: "YOUTUBE",
    query,
    items,
    next_page_token: cleanText(data?.nextPageToken, 256) || null,
  };
}

async function googleBooksSearch(payload: any) {
  const query = cleanText(payload?.query, 220);
  if (!query) throw new Error("QUERY_REQUIRED");

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(clampInt(payload?.max_results, 1, 20, 10)));
  url.searchParams.set("printType", "books");
  url.searchParams.set("projection", "full");
  url.searchParams.set("orderBy", "relevance");

  const key = cleanText(Deno.env.get("GOOGLE_BOOKS_API_KEY"), 512);
  if (key) url.searchParams.set("key", key);

  const cacheKey = `books:${query}:${url.searchParams.get("maxResults")}`;
  const data = await cached(cacheKey, 10 * 60_000, () => fetchJson(url));
  const items = (Array.isArray(data?.items) ? data.items : [])
    .map(normalizeBook)
    .filter(Boolean);

  return {
    configured: true,
    provider: "GOOGLE_BOOKS",
    query,
    items,
    total_items: clampInt(data?.totalItems, 0, 100000000, items.length),
  };
}

async function googleBookLookup(payload: any) {
  const id = cleanText(payload?.volume_id, 128);
  if (!id) throw new Error("VOLUME_ID_REQUIRED");

  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`);
  const key = cleanText(Deno.env.get("GOOGLE_BOOKS_API_KEY"), 512);
  if (key) url.searchParams.set("key", key);

  const data = await cached(`book:${id}`, 30 * 60_000, () => fetchJson(url));
  return {
    configured: true,
    provider: "GOOGLE_BOOKS",
    book: normalizeBook(data),
  };
}

async function openLibraryResolve(payload: any) {
  const title = cleanText(payload?.title, 220);
  const author = cleanText(payload?.author, 160);
  if (!title) throw new Error("TITLE_REQUIRED");

  const maxResults = clampInt(payload?.max_results, 1, 20, 10);
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("title", title);
  if (author) url.searchParams.set("author", author);
  url.searchParams.set("limit", String(maxResults));
  // `availability` asks Open Library for its cached Internet Archive access
  // data. We only expose a same-app reader when that data confirms public
  // access; lending and catalog records remain links to their provider page.
  url.searchParams.set(
    "fields",
    "key,title,author_name,cover_i,first_publish_year,edition_key,ia,public_scan_b,ebook_access,has_fulltext,availability,editions,editions.key,editions.title,editions.ebook_access",
  );

  const cacheKey = `open-library:${title}:${author}:${maxResults}`;
  const data = await cached(cacheKey, 30 * 60_000, () => fetchJson(url));
  const items = (Array.isArray(data?.docs) ? data.docs : [])
    .map(normalizeOpenLibraryBook)
    .filter(Boolean);

  return {
    configured: true,
    provider: "OPEN_LIBRARY",
    query: [title, author].filter(Boolean).join(" — "),
    items,
    total_items: clampInt(data?.numFound ?? data?.num_found, 0, 100000000, items.length),
  };
}

async function archivePdfLookup(payload: any) {
  const identifier = internetArchiveIdentifier(payload?.identifier);
  if (!identifier) throw new Error("ARCHIVE_IDENTIFIER_REQUIRED");

  const data = await cached(
    `archive-metadata:${identifier}`,
    30 * 60_000,
    () => fetchJson(new URL(`https://archive.org/metadata/${encodeURIComponent(identifier)}`), 8000),
  );
  const metadata = asRecord(data?.metadata);
  const restricted =
    isTrueFlag(metadata?.["access-restricted"]) ||
    isTrueFlag(metadata?.access_restricted) ||
    isTrueFlag(metadata?.["access-restricted-item"]);

  if (restricted) {
    return {
      configured: true,
      provider: "INTERNET_ARCHIVE",
      identifier,
      pdf_url: null,
      access: "RESTRICTED",
    };
  }

  const pdf = asList(data?.files)
    .map(normalizeArchivePdfFile)
    .filter(Boolean)
    .sort((left: any, right: any) => right.score - left.score || right.size - left.size)[0] || null;

  return {
    configured: true,
    provider: "INTERNET_ARCHIVE",
    identifier,
    pdf_url: pdf
      ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(pdf.name)}`
      : null,
    file_name: pdf?.name || null,
    access: pdf ? "PUBLIC_PDF" : "NO_PDF",
  };
}

async function archiveText(payload: any) {
  const readerKey = cleanText(payload?.reader_key, 96).toLowerCase();
  const ebookNumber = ARCHIVE_READER_EBOOKS[readerKey];

  if (!ebookNumber) {
    throw Object.assign(new Error("ARCHIVE_READER_NOT_FOUND"), { status: 404 });
  }

  return cachedArchiveText(`gutenberg-text:${readerKey}`, async () => {
    const urls = [
      `https://www.gutenberg.org/cache/epub/${ebookNumber}/pg${ebookNumber}.txt`,
      `https://www.gutenberg.org/ebooks/${ebookNumber}.txt.utf-8`,
      `https://www.gutenberg.org/files/${ebookNumber}/${ebookNumber}-0.txt`,
    ];
    for (const url of urls) {
      try {
        return {provider:"PROJECT_GUTENBERG", reader_key:readerKey, ebook_number:ebookNumber,
          source_url:`https://www.gutenberg.org/ebooks/${ebookNumber}`, text:await fetchPlainText(new URL(url), 7000)};
      } catch { /* Try a known format for the same verified edition only. */ }
    }
    throw Object.assign(new Error("ARCHIVE_TEXT_UNAVAILABLE"), {status:502});
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "AUTH_REQUIRED" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "INVALID_SESSION" }, 401);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action = cleanText(body?.action, 64);
  const payload = body?.payload || {};

  const actionLimit = action === "book_lookup"
    ? 60
    : action === "archive_text"
      ? 8
      : 30;
  const rate = consumeRateLimit(`${userData.user.id}:${action}`, actionLimit);
  if (!rate.allowed) {
    return json(
      {
        error: "RATE_LIMITED",
        code: "RATE_LIMITED",
        details: { retry_after_seconds: rate.retryAfterSeconds },
      },
      429,
    );
  }

  try {
    if (action === "tutorial_search") {
      return json({ data: await youtubeSearch(payload) });
    }
    if (action === "book_search") {
      return json({ data: await googleBooksSearch(payload) });
    }
    if (action === "book_lookup") {
      return json({ data: await googleBookLookup(payload) });
    }
    if (action === "open_library_resolve") {
      return json({ data: await openLibraryResolve(payload) });
    }
    if (action === "archive_pdf_lookup") {
      return json({ data: await archivePdfLookup(payload) });
    }
    if (action === "archive_text") {
      return json({ data: await archiveText(payload) });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error: any) {
    console.error("SYSTEM CONTENT API FAILED", action, error);
    const code = cleanText(error?.message, 180) || "CONTENT_API_FAILED";
    const upstreamStatus = Number(error?.status || 0);
    return json(
      {
        error: code,
        code,
        details: upstreamStatus ? { upstream_status: upstreamStatus } : null,
      },
      upstreamStatus === 429
        ? 429
        : upstreamStatus === 504
          ? 504
          : upstreamStatus === 404
            ? 404
            : upstreamStatus === 413
              ? 413
          : 502,
    );
  }
});
