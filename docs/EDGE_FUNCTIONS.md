# Edge Function Contracts — THE SYSTEM

## system-api v9

Source: `supabase/functions/system-api/index.ts`, recovered from deployed version 9 on 2026-10-14.

Purpose: authoritative game/progression mutations.

Never route AI-generated progression directly around this authority layer.

## system-intelligence-responder

### Input

```json
{
  "message": "string",
  "thread_id": "string | null",
  "awareness": "object | null"
}
```

### Output

```json
{
  "data": {
    "thread_id": "string",
    "online": true,
    "model_connected": true,
    "mode": "OPENAI_RESPONSES_API",
    "model": "string | null",
    "answer": "string",
    "resources": [],
    "configuration": {
      "openai": true,
      "youtube": true,
      "google_books": true
    },
    "warning": null
  }
}
```

### Safety

- valid Supabase JWT required
- AI does not award XP
- AI does not complete quests
- AI does not apply penalties
- OpenAI request has a timeout
- best-effort per-user rate limiting is active
- built-in guidance remains the fallback

## system-content-api

### tutorial_search

```json
{
  "action": "tutorial_search",
  "payload": {
    "query": "pull up proper form",
    "max_results": 3,
    "region_code": "KE",
    "language": "en"
  }
}
```

Returns normalized embeddable YouTube video metadata.

### book_search

```json
{
  "action": "book_search",
  "payload": {
    "query": "intitle:Atomic Habits inauthor:James Clear",
    "max_results": 10
  }
}
```

Returns normalized Google Books records. `embeddable` and `viewability` must be respected by the reader.

### book_lookup

```json
{
  "action": "book_lookup",
  "payload": {
    "volume_id": "GOOGLE_BOOKS_VOLUME_ID"
  }
}
```

### open_library_resolve

```json
{
  "action": "open_library_resolve",
  "payload": {
    "title": "Meditations",
    "author": "Marcus Aurelius",
    "max_results": 10
  }
}
```

Returns normalized Open Library records. `embeddable` is true only for a
confirmed publicly readable Internet Archive identifier; `embed_url` is then a
trusted `archive.org/embed/...` URL. Lending and catalog records may expose a
direct provider link but must not be represented as an in-app full reader.

### Resilience

- valid JWT required
- upstream fetch timeout
- short-lived server-side response cache
- best-effort per-user rate limit
- upstream 429 is surfaced as 429
- timeout is surfaced as a controlled upstream error
- Open Library results are cached for 30 minutes and require no provider key
