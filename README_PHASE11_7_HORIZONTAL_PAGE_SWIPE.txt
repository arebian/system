THE SYSTEM — PHASE 11.7
HORIZONTAL PAGE SWIPE NAVIGATION

BEHAVIOR
- Mac trackpad horizontal swipe moves between main System pages.
- Phone/tablet left/right swipe moves between pages.
- Page order:
  Dashboard → Attributes → Quests → Training → Progress → Inventory → Journey → System
- No wrap-around at first/last page.
- Vertical scrolling remains normal.
- Gestures beginning on inputs/buttons/links/navigation are ignored.
- Horizontally-scrollable child controls keep their own horizontal gesture.
- System Intelligence is excluded from page navigation.
- Active top navigation item automatically scrolls into view.
- A small cinematic slide transition confirms the page change.

GPS
Training remains permanently mounted from Phase 11.2, so page swiping away from
Training does NOT destroy an active GPS session.

FILES TO REPLACE
src/App.jsx

systemCloud.js is unchanged.

RUN
npm run dev
