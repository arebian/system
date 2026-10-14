THE SYSTEM — BACKEND RECONNECT PHASE 4: TRAINING

WHAT MOVED TO BACKEND
- Workout availability / skill requirement validation
- Workout completion record
- XP reward
- Attribute reward
- Boss damage
- Journey event
- Achievement/title/Boss orchestration through system-api

ANTI-DUPLICATE
The backend rejects a second completion of the same workout within 30 seconds.

CLIENT
The visible Training UI remains unchanged.
Cloud workout IDs map directly to workout_templates IDs.
After completion, the app reloads authoritative state and hydrates structured Boss state.

NO LOCAL PROGRESSION
The migrated completeWorkout function no longer calls:
- addXP()
- direct attribute increments
- bossDamageFromTraining()
- direct Boss HP mutation

REPLACE ONLY
src/App.jsx
src/systemCloud.js

KEEP
.env.local
all public assets

RUN
npm run dev

TEST
1. Open Training → Workouts.
2. Complete an unlocked workout.
3. XP/attributes should update.
4. If a Boss is active, its HP should change after refresh.
5. Click Complete again immediately: the backend should reject the duplicate.
6. Try a locked workout: backend should reject it even if the client UI were bypassed.
