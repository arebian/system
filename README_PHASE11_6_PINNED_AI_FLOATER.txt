THE SYSTEM — PHASE 11.6
PINNED SYSTEM INTELLIGENCE FLOATER

FIX
- System Intelligence launcher is now position: fixed.
- It stays bottom-right of the viewport while the player scrolls.
- It is no longer tied to page/document position.
- The open AI panel expands upward from the pinned launcher.
- High z-index keeps it above Dashboard/Training/Inventory/Journey content.
- Pointer-events are isolated so the wrapper does not block page clicks.
- Mobile uses safe-area aware bottom spacing.
- Existing AI, scroll and panel-width fixes remain unchanged.

REPLACE ONLY:
src/App.jsx

systemCloud.js is unchanged.

RUN:
npm run dev
