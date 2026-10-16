import { supabase } from "./supabaseClient.js";

const messages = {
  REVIEW_KEY_MISSING: "Quest review is not configured yet. The app owner needs to connect its AI service. Your proof is saved here.",
  REVIEW_AUTH_FAILED: "The AI service rejected its connection key. The app owner needs to update it. Your proof is still here.",
  REVIEW_QUOTA_EXHAUSTED: "The AI service has run out of credits. The app owner needs to restore its quota. Your proof is still here.",
  REVIEW_MODEL_UNAVAILABLE: "The configured AI model is unavailable to this app. Your proof is still here.",
  REVIEW_ACCESS_DENIED: "The AI service has denied this app access. Your proof is still here.",
  REVIEW_PROVIDER_RATE_LIMITED: "The AI service is busy. Wait a moment, then retry with the same proof.",
  REVIEW_REQUEST_REJECTED: "The AI service could not process this review. Your proof is still here; the app owner needs to check the service configuration.",
  REVIEW_TIMEOUT: "The AI review took too long. Your proof is still here; please retry.",
  REVIEW_UNAVAILABLE: "Quest review is temporarily unavailable. Your proof is still here; please retry.",
  REVIEW_RESPONSE_INVALID: "The review could not be completed. Please retry without changing your proof.",
  REVIEW_RATE_LIMITED: "You have reached the hourly review limit. Your proof is preserved; try again later.",
  REVIEW_ATTACHMENT_INVALID: "That attachment could not be verified. Select your original file and retry.",
  REVIEW_IMAGE_FORMAT_UNSUPPORTED: "Photo review supports JPG, PNG and WebP images. Please select one of those formats.",
  QUEST_SERVER_ACTIVITY_REQUIRED: "This quest needs its server-verified timer or GPS activity. A written explanation cannot replace that requirement.",
  WEEKLY_PLAN_EXPIRED: "This plan has expired. Adjust your situation to prepare a fresh one.",
  ACTIVE_BOSS_EXISTS: "An active boss already exists. Refresh its status to continue that mission.",
  WEEKLY_COOLDOWN: "Your next weekly boss opens seven days after the previous assignment.",
  RAID_KEY_REQUIRED: "Earn the Raid Entry Key at Level 5 with a three-day daily streak.",
  WEEKLY_RECIPE_ADAPTATION_REQUIRED: "This recipe needs an ingredient adaptation. The current recipe cannot be assigned with those restrictions. Clear this only if it does not apply, or choose the outfit boss.",
  WEEKLY_FREEZER_REQUIRED: "This full-week lunch batch needs a freezer for the later portions. Choose a different boss if a freezer is unavailable.",
  WEEKLY_FREEZER_OR_PANTRY_REQUIRED: "A full week of wet breakfasts needs freezer space. Choose the ready-to-eat pantry option or a different boss.",
};

export async function livingSystemAction(action, payload = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const result = await supabase.functions.invoke("system-api", { body: { action, payload }, signal: controller.signal });
    let data = result.data;
    if (result.error) {
      try { data = await result.error.context?.json(); } catch { /* Preserve the public fallback. */ }
      if (!data?.error) throw new Error("The System could not connect. Your input has been preserved; please retry.");
    }
    if (data?.error) {
      const code = String(data.error);
      const error = new Error(messages[code] || (code === "UNKNOWN_ACTION" || code === "BACKEND_UPDATE_REQUIRED"
        ? "This feature needs its backend update before it can be used." : "The System could not complete that action. Please refresh its status and retry."));
      error.code = code;
      throw error;
    }
    return data?.data;
  } finally { clearTimeout(timer); }
}

export async function reviewQuestOnBackend({ title, assignedFor, proof }) {
  return livingSystemAction("review_quest", { title, assigned_for: assignedFor, proof });
}
