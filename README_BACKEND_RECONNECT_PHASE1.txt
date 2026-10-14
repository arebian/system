THE SYSTEM — STABLE BACKEND RECONNECT PHASE 1

THIS IS A SURGICAL PATCH ON TOP OF THE FINAL RECOVERY BUILD.

WHAT CHANGED
- Login/boot now prefers the authenticated Supabase Edge Function:
  system-api -> bootstrap
- system-api v5 prepares authoritative player state before returning it.
- Profile, attributes and routine are mapped into the legacy UI shape.
- Additional backend state is cached under profile.backendState for later phases.
- If system-api bootstrap fails, the app automatically falls back to the old
  direct profiles/attributes cloud read.
- Existing localStorage fallback is retained.

WHAT DID NOT CHANGE
- Quest buttons/actions
- Workout completion
- Boss actions
- Skill completion
- GPS
- Inventory
- Music/audio
- Options/profile UI
- System Intelligence UI
- Existing saveProfile write behavior

WHY
This phase changes READ AUTHORITY first without risking gameplay actions.

FILES CHANGED
src/App.jsx
src/systemCloud.js

INSTALL
Use this as a full replacement project OR replace only the two files above.

Keep your existing .env.local.

Run:
npm install
npm run dev

EXPECTED RESULT
The app should look exactly the same.
After sign-in, player state should be prepared/read through system-api v5.
If that service fails, the current stable fallback still opens the app.
