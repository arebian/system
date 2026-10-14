THE SYSTEM — PHASE 11.3

THIS PATCH FIXES THE TWO PROBLEMS VISIBLE IN THE SCREENSHOT.

1. ACTIVE GPS BUTTONS
- END & SAVE SESSION is no longer a white browser-style bar.
- It is now a class-accented cinematic verification control.
- DISCARD is a restrained secondary action with a subtle danger hover state.
- Mobile layout stacks cleanly.

2. SYSTEM INTELLIGENCE NOW ANSWERS
Primary response path:
- Chrome built-in Prompt API / on-device LanguageModel when available.
- The local model is initialized on user interaction.
- Player context from System Intelligence backend is supplied to the local model.
- Conversation context is kept locally for the on-device model.
- The UI reports LOCAL AI / download status.

Fallback:
- If Chrome's on-device model is unavailable, System Intelligence still answers
  common exercise/progression questions through the built-in guidance core.
- The box no longer silently stores a user message without replying.

PRIVACY
Chrome's built-in model runs on-device after the initial model download.
The Phase 11 backend authority freeze remains unchanged.

FILES
Replace:
src/App.jsx
src/systemCloud.js

Run:
npm run dev
