THE SYSTEM — PHASE 11.2 CORRECTED HOTFIX

WHY 11.1 LOOKED LIKE NOTHING CHANGED
- The visible GPS button in the actual app is START TRACKING, not START MISSION.
  The previous selector therefore never modified that button.
- MovementTracker lived inside a conditionally rendered Training page.
  Navigating away from Training unmounted the component and destroyed the GPS watch.
- The previous System Intelligence font change used a stack visually too close to
  the rest of the app.

WHAT 11.2 FIXES

GPS
- Training is now always mounted at the app level and only visually hidden.
- GPS tracking therefore continues while navigating to Dashboard, Quests,
  Inventory, Journey, etc. inside THE SYSTEM.
- Phase 11.1 wake-lock and browser visibility recovery are retained.
- True screen-off / fully background browser tracking is still limited by Safari/Chrome.

BUTTON
- The ACTUAL START TRACKING button now uses the cinematic mission style.
- If a GPS mission exists, the same button reads START MISSION.
- ACQUIRING GPS uses the same visual language.

SYSTEM INTELLIGENCE FONT
- SYSTEM INTELLIGENCE uses a visibly condensed cinematic title stack.
- Guidance labels use mono system typography.
- Conversation copy uses Avenir Next / premium readable sans.
- The title also receives a controlled class-accent gradient.

FILES TO REPLACE
src/App.jsx
src/systemCloud.js

KEEP
.env.local
public assets

RUN
npm run dev
