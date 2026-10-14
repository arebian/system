THE SYSTEM — PHASE 11.1 HOTFIX

FIXES INCLUDED

1. GPS RELIABILITY
- Requests Screen Wake Lock while a tracking session is active when supported.
- Re-acquires Wake Lock when the tab becomes visible again.
- Adds visibilitychange/pageshow recovery.
- Restarts a geolocation watch if the browser dropped it while the page was backgrounded.
- Rejects very inaccurate fixes (>90 m).
- Adds a speed sanity check during recovery to reduce impossible GPS jumps.
- Keeps server-side GPS session authority intact.
- IMPORTANT: true phone-locked / fully-backgrounded tracking is still browser-limited.
  That requires a native/PWA background-location layer later.

2. START MISSION BUTTON
- Reworked into a class-accented cinematic action button.
- Improved spacing, hierarchy, hover depth and visual emphasis.
- Removed the plain generic-button look.

3. SYSTEM INTELLIGENCE TYPOGRAPHY
- Replaced awkward display styling with a cleaner premium sans stack.
- Stronger title hierarchy.
- Monospace only for small system/status labels.
- Improved chat readability and line-height.
- Preserved class icon identity and floating layout.

FILES TO REPLACE
src/App.jsx
src/systemCloud.js

KEEP
.env.local
public assets

RUN
npm run dev

NOTE
This hotfix does not weaken the Phase 11 backend freeze.
