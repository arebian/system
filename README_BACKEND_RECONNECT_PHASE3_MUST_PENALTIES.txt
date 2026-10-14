THE SYSTEM — BACKEND RECONNECT PHASE 3

MUST timers and failure penalties are server-authoritative.
Replace only src/App.jsx and src/systemCloud.js. Keep .env.local. Run npm run dev.

The server owns accepted_at/expires_at. Only ACCEPTED expired quests receive a one-time penalty. The client no longer subtracts XP itself. Expiry is reconciled every minute and at bootstrap.
