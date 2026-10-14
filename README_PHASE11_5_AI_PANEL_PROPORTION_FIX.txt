THE SYSTEM — PHASE 11.5
SYSTEM INTELLIGENCE PANEL PROPORTION FIX

WHY IT LOOKED SQUEEZED
The scroll fix worked, but the panel inherited the old narrow floating width.
That made long AI answers wrap too aggressively and made the panel look tall/thin.

FIX
- Desktop AI panel widened to 430–560px.
- Larger screens target ~540px.
- Better text measure and line-height.
- More padding around chat messages.
- User/system messages get cleaner readable widths.
- Chat history gets more vertical breathing room.
- Input area resized proportionally.
- Mobile panel still collapses safely to screen width.
- Existing AI reply + scroll logic is unchanged.

REPLACE ONLY
src/App.jsx
src/systemCloud.js

RUN
npm run dev
