THE SYSTEM — PHASE 11.4
SYSTEM INTELLIGENCE SCROLL FIX

FIX
- AI panel now uses a fixed-height grid layout.
- Header, status, intro message and input stay visible.
- Conversation history is the only region that scrolls.
- Mouse wheel / trackpad scrolling works.
- Mobile inertial scrolling is enabled.
- Horizontal overflow is blocked.
- Custom scrollbar added.
- Existing AI reply logic from Phase 11.3 is unchanged.

REPLACE ONLY:
src/App.jsx
src/systemCloud.js

RUN:
npm run dev
