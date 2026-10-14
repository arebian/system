THE SYSTEM — PHASE 10: SYSTEM INTELLIGENCE

CONNECTED NOW
- Floating AI is no longer a dead placeholder.
- It checks the existing authenticated System Intelligence backend.
- Persistent threads are created server-side.
- Player messages are stored server-side.
- Conversation history reloads when the floating core reopens.
- Existing system_intelligence_context supplies authoritative player context.
- The UI reports whether the memory backend and model connection are ready.
- The class icon remains the floating AI identity.

IMPORTANT MODEL CONNECTION
The current system-api backend already exposes the Intelligence memory/context/thread routes.
Its status reports model_connected from SYSTEM_INTELLIGENCE_MODEL_KEY.
A separate model-response Edge Function was prepared during this phase, but deployment
was blocked by the platform safety gate. This patch therefore does NOT pretend a model
response exists. It exposes the real backend status and persistent messaging honestly.

Once a server-side model responder is deployed, the same thread/message architecture
can be used without rebuilding the UI.

REPLACE ONLY:
src/App.jsx
src/systemCloud.js

KEEP .env.local
RUN npm run dev
