/* =========================================================
   THE SYSTEM 2.6 — QUEST SAFETY HELPERS
   These helpers are deliberately pure so the client-side proof UI can be
   tested without making progression authoritative in the browser.
   ========================================================= */

export const QUEST_PROOF_LABELS = {
  TIME: "TIME VERIFIED",
  PERFORMANCE: "PERFORMANCE PROOF",
  LEARNING: "LEARNING PROOF",
  RESULT: "RESULT PROOF",
  PHOTO: "PHOTO PROOF",
  VIDEO: "VIDEO PROOF",
  HONOR: "HONOR CONFIRMATION",
};

// MUST directives are deliberately a fixed server-owned window. Keeping the
// duration here lets the UI reject an old or malformed local cache instead of
// treating a 29-hour timer as trustworthy.
export const MUST_QUEST_DURATION_MS = 24 * 60 * 60 * 1000;

const LEARNING_QUESTS = new Set([
  "COGNITIVE STRIKE",
  "MEMORY FORGE",
]);

const PHOTO_QUESTS = new Set([
  "CLEAR THE FIELD",
]);

const PERFORMANCE_QUESTS = new Set([
  "SHADOW MOVEMENT",
  "HOLD THE LINE",
  "FORTRESS",
  "IRON PATIENCE",
  "KEEP MOVING",
  "OPEN TERRITORY",
  "STEADY PACE",
  "STRUCTURAL CHECK",
  "IRON FOUNDATION",
  "RECOVERY ARMOR",
  "FOOTWORK PROTOCOL",
  "QUICK BODY",
  "MOBILITY STRIKE",
  "BODY / MIND RESET",
  "COGNITIVE MOBILITY",
]);

const RESULT_QUESTS = new Set([
  "SILENT EXECUTION",
  "FIRST ORDER",
  "TACTICAL HOUR",
  "NO ZERO DAY",
  "CLOSE THE LOOP",
  "ORDER BEFORE REST",
  "FOCUS BLOCK",
  "IMPORTANT FIRST",
  "MENTAL LOCK",
]);

export function normalizeQuestName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function getQuestProofType(quest, context = "") {
  const explicit = normalizeQuestName(
    quest?.proofType ||
      quest?.proof_type ||
      quest?.metadata?.proof_type,
  );
  const name = normalizeQuestName(quest?.name);
  const type = normalizeQuestName(quest?.type || context);
  const category = normalizeQuestName(quest?.category);

  if (Object.hasOwn(QUEST_PROOF_LABELS, explicit)) return explicit;
  if (type === "PHYSICAL" || category === "PHYSICAL") return "PERFORMANCE";
  if (type === "VIDEO" || type === "RECORDING") return "VIDEO";
  if (category === "LEARNING") return "LEARNING";
  if (LEARNING_QUESTS.has(name)) return "LEARNING";
  if (PHOTO_QUESTS.has(name)) return "PHOTO";
  if (PERFORMANCE_QUESTS.has(name)) return "PERFORMANCE";
  if (RESULT_QUESTS.has(name)) return "RESULT";

  return "HONOR";
}

export function isMustStateReady(state) {
  if (!state?.accepted || !state?.acceptedAt || !state?.expiresAt) return false;
  const acceptedAt = new Date(state.acceptedAt).getTime();
  const expiresAt = new Date(state.expiresAt).getTime();
  if (!Number.isFinite(acceptedAt) || !Number.isFinite(expiresAt)) return false;

  // PostgreSQL can retain sub-millisecond precision while JavaScript parses
  // milliseconds, so tolerate at most one second of representation drift.
  return (
    Math.abs(expiresAt - acceptedAt - MUST_QUEST_DURATION_MS) <= 1000
  );
}

export function getServerClockOffsetMs(serverNow, clientNow = Date.now()) {
  const serverMilliseconds = new Date(serverNow || "").getTime();
  const clientMilliseconds = Number(clientNow);

  if (
    !Number.isFinite(serverMilliseconds) ||
    !Number.isFinite(clientMilliseconds)
  ) {
    return 0;
  }

  return serverMilliseconds - clientMilliseconds;
}

export function mustStateMatchesQuest(state, quest, assignedFor = "") {
  if (!state || !quest) return false;

  const sameName =
    normalizeQuestName(state.name) === normalizeQuestName(quest.name);
  const sameDay = !assignedFor || !state.date || String(state.date) === String(assignedFor);

  return sameName && sameDay;
}

export function buildQuestActionKey({ assignedFor = "", context = "", quest }) {
  return [assignedFor, context, normalizeQuestName(quest?.name)]
    .map((value) => String(value || "").trim().toUpperCase())
    .join(":");
}
