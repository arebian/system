# THE SYSTEM 2.8.3 — Architecture

## Runtime layers

```text
PLAYER
  |
  v
React / Vite UI
  |-- App.jsx                  orchestration + current feature components
  |-- styles/system.css        global visual system
  |-- systemAI.js              deterministic recommendations
  |-- systemAwareness.js       local active-time / trend awareness
  |-- systemExternal.js        protected external API client
  |-- systemExternalCore.js    pure request-contract helpers
  |
  +-------------------------+
                            |
                            v
                     Supabase Auth/JWT
                            |
              +-------------+-------------+
              |                           |
              v                           v
         system-api v8          system-intelligence-responder
     authoritative progress          AI reasoning / tools
              |                           |
              |                    +------+------+ 
              |                    |             |
              |                    v             v
              |                 OpenAI      YouTube / Google Books / Open Library
              |
              v
      PostgreSQL / RLS / RPC
```

## Authority boundary

Only the authoritative Supabase progression path may finalize:

- XP
- level changes
- quest completion
- penalties
- Boss damage/completion
- official rewards
- official Archive progression

AI, Awareness, local caches and tutorial/book APIs may advise or display content but cannot finalize progression. Open Library / Internet Archive resolution is display-only: its direct reader URL never grants Archive XP, rank, or book completion.

## Player action flow

```text
PLAYER ACTION
    |
    +--> UI intent
           |
           +--> non-authoritative analysis? --> systemAI/systemAwareness
           |
           +--> tutorial/book discovery? ----> systemExternal --> protected Edge Function
           |
           +--> progression mutation? -------> systemCloud --> system-api/RPC
                                                    |
                                                    v
                                               authoritative DB
                                                    |
                                                    v
                                               confirmed UI state
```

## Refactoring strategy

2.5.1 deliberately does not perform a giant component rewrite. The previous 39K-line App.jsx included roughly 16K lines of embedded CSS; extracting that CSS reduces the JSX file substantially without changing gameplay behavior.

Future component extraction should proceed one feature at a time with tests added before each move.
