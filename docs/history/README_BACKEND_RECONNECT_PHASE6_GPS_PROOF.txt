THE SYSTEM — BACKEND RECONNECT PHASE 6: GPS + PROOF

SYSTEM API
- system-api upgraded to v8.
- start_gps and finish_gps are authoritative.
- new finish_gps_workout route handles GPS workouts without double Boss damage.

GPS
- A backend GPS session is created before browser tracking starts.
- The browser still gathers coordinates, but the backend owns verification.
- Target distance/time is checked server-side.
- Verified generic GPS creates a VERIFIED GPS proof_record automatically.
- Verified GPS can be used by endurance skill mastery.
- GPS workouts award workout XP/attribute once and Boss damage once.
- GPS quest missions complete the quest through the authoritative quest route.
- Failed/unverified GPS never awards a local reward.

PHYSICAL SKILL PROOF
- Mastery modal now accepts an image.
- Image is uploaded to the private proofs bucket.
- A backend proof_record is created and linked to the skill.
- Client-submitted images begin as PENDING.
- PENDING proof does NOT master the skill.
- Physical skill mastery still requires independent VERIFIED proof.
- Notes/numbers alone remain insufficient.

REPLACE ONLY
src/App.jsx
src/systemCloud.js

KEEP
.env.local
public assets

RUN
npm run dev
