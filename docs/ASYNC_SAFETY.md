# Async Safety — THE SYSTEM

## Core rules

1. Progression mutations must be idempotent.
2. React Strict Mode may run effects more than once; backend uniqueness is still required.
3. A pending UI button must not be the only duplicate-prevention mechanism.
4. Local state is presentation/cache, not progression authority.
5. External content APIs must timeout and degrade cleanly.
6. AI failure must never block core gameplay.

## External API fallback chain

```text
System Intelligence
  -> OpenAI via protected Edge Function
  -> built-in server guidance if model unavailable
  -> on-device AI if cloud route fails
  -> deterministic fallback text
```

Tutorials/books are supplementary. A failed content API must not break quests, training, Inventory, Archive progress, or authentication.

## Caching

Caching is allowed for non-authoritative content and analytics.

Do not cache successful progression mutations in a way that can replay them as if they happened again.

## Timeouts

A hanging third-party request should become a controlled degraded state. Never keep a loading indicator forever.
