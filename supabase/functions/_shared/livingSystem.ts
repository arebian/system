import { normalizeReviewProof, REVIEW_INSTRUCTIONS, REVIEW_SCHEMA, guardReviewDecision, responseText } from "./questReviewCore.js";
import { buildWeeklyPlan } from "./weeklyBossCore.js";

export const LIVING_ACTIONS = new Set(["review_quest", "review_quest_objective", "weekly_boss_status", "prepare_weekly_boss", "accept_weekly_boss", "review_weekly_boss", "complete_weekly_boss", "weekly_boss_checkpoint", "retire_weekly_boss"]);

class PublicFailure extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

async function rpc(client: any, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (["PGRST202", "42P01", "42883"].includes(error.code)) throw new PublicFailure("BACKEND_UPDATE_REQUIRED", 503);
    const allowed = /^(AUTH_REQUIRED|PROFILE_NOT_READY|QUEST_[A-Z_]+|OBJECTIVE_[A-Z_]+|REVIEW_[A-Z_]+|WEEKLY_[A-Z_]+|RAID_KEY_REQUIRED|ACTIVE_BOSS_EXISTS)$/;
    throw new PublicFailure(allowed.test(error.message) ? error.message : "SYSTEM_ACTION_FAILED");
  }
  return data;
}

function logSafeReviewDiagnostic(event: string, details: Record<string, unknown> = {}) {
  console.error("[system-review]", { event, ...details });
}

async function reasonAboutProof({ snapshot, proof, apiKey, model, imageUrl, fetcher }: any) {
  if (!apiKey) {
    logSafeReviewDiagnostic("provider_not_configured", { reason: "OPENAI_API_KEY_MISSING" });
    throw new PublicFailure("REVIEW_UNAVAILABLE", 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 24000);
  try {
    const content: any[] = [{ type: "input_text", text: JSON.stringify({ server_objective: snapshot, player_evidence: proof }) }];
    if (imageUrl) content.push({ type: "input_image", image_url: imageUrl, detail: "low" });
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, max_output_tokens: 1600,
        instructions: REVIEW_INSTRUCTIONS, input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "quest_review", strict: true, schema: REVIEW_SCHEMA } } }),
    });
    if (!response.ok) {
      logSafeReviewDiagnostic("provider_http_error", {
        status: response.status,
        model: String(model || "").slice(0, 80),
        request_id: response.headers?.get?.("x-request-id") || null,
        retry_after: response.headers?.get?.("retry-after") || null,
      });
      throw new PublicFailure("REVIEW_UNAVAILABLE", 503);
    }

    let providerBody: unknown;
    try {
      providerBody = await response.json();
    } catch (error: any) {
      logSafeReviewDiagnostic("provider_invalid_json", {
        model: String(model || "").slice(0, 80),
        error_name: String(error?.name || "JSON_PARSE_ERROR").slice(0, 80),
      });
      throw new PublicFailure("REVIEW_UNAVAILABLE", 503);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText(providerBody));
    } catch (error: any) {
      logSafeReviewDiagnostic("provider_invalid_payload", {
        model: String(model || "").slice(0, 80),
        error_name: String(error?.name || "PAYLOAD_PARSE_ERROR").slice(0, 80),
      });
      throw new PublicFailure("REVIEW_UNAVAILABLE", 503);
    }

    try {
      return guardReviewDecision(parsed, snapshot, proof);
    } catch (error: any) {
      logSafeReviewDiagnostic("review_validation_failed", {
        model: String(model || "").slice(0, 80),
        error_name: String(error?.name || "REVIEW_VALIDATION_ERROR").slice(0, 80),
        error_code: String(error?.code || "").slice(0, 80) || null,
      });
      if (error instanceof PublicFailure) throw error;
      throw new PublicFailure("REVIEW_UNAVAILABLE", 503);
    }
  } catch (error: any) {
    if (error instanceof PublicFailure) throw error;
    logSafeReviewDiagnostic("provider_request_failed", {
      model: String(model || "").slice(0, 80),
      error_name: String(error?.name || "UNKNOWN_ERROR").slice(0, 80),
    });
    throw new PublicFailure("REVIEW_UNAVAILABLE", 503);
  } finally { clearTimeout(timeout); }
}

// Exported orchestration accepts dependencies so auth boundaries and failure modes
// can be exercised without a live provider or a production database.
export async function handleLivingSystemAction({ action, payload, userId, client, makeAdmin, apiKey, model, fetcher = fetch }: any) {
  try {
    if (!userId) throw new PublicFailure("AUTH_REQUIRED", 401);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new PublicFailure("INVALID_PAYLOAD");
    if (action === "weekly_boss_status") return { status: 200, body: { data: await rpc(client, "system_weekly_boss_status_v1") } };
    if (action === "accept_weekly_boss") return { status: 200, body: { data: await rpc(client, "system_accept_weekly_boss_v1", { p_plan_id: payload.plan_id }) } };
    if (action === "complete_weekly_boss") return { status: 200, body: { data: await rpc(client, "system_complete_weekly_boss_v1", { p_boss_id: payload.boss_id, p_review_id: payload.review_id }) } };
    if (action === "retire_weekly_boss") return { status: 200, body: { data: await rpc(client, "system_retire_weekly_boss_v1", { p_boss_id: payload.boss_id }) } };
    if (action === "weekly_boss_checkpoint") return { status: 200, body: { data: await rpc(client, "system_set_boss_objective", { p_objective_id: payload.objective_id, p_complete: payload.complete === true }) } };
    if (!await rpc(client, "system_begin_proof_review_v1")) throw new PublicFailure("REVIEW_RATE_LIMITED", 429);
    if (action === "prepare_weekly_boss") {
      const status = await rpc(client, "system_weekly_boss_status_v1");
      if (!status.has_key) throw new PublicFailure("RAID_KEY_REQUIRED", 403);
      if (status.active) throw new PublicFailure("ACTIVE_BOSS_EXISTS");
      if (!status.can_assign) throw new PublicFailure("WEEKLY_COOLDOWN");
      const { data: profile, error } = await client.from("profiles").select("level").eq("id", userId).single();
      if (error || !profile) throw new PublicFailure("PROFILE_NOT_READY");
      let plan;
      try { plan = buildWeeklyPlan(payload.intake, profile.level); }
      catch (error) { throw new PublicFailure(error instanceof Error ? error.message : "WEEKLY_PLAN_INVALID"); }
      const { data, error: saveError } = await makeAdmin().from("system_weekly_boss_plans")
        .insert({ user_id: userId, plan }).select("id,plan,expires_at").single();
      if (saveError) {
        logSafeReviewDiagnostic("weekly_plan_persist_failed", {
          error_code: String(saveError.code || "").slice(0, 80) || null,
          status: Number(saveError.status || 0) || null,
        });
        throw new PublicFailure("BACKEND_UPDATE_REQUIRED", 503);
      }
      return { status: 200, body: { data } };
    }
    let proof = normalizeReviewProof(payload.proof);
    let snapshot: any;
    if (action === "review_quest") {
      if (!String(payload.title || "").trim() || String(payload.title).length > 160) throw new PublicFailure("QUEST_TITLE_INVALID");
      snapshot = await rpc(client, "system_quest_review_context_v1", { p_title: payload.title, p_assigned_for: payload.assigned_for || null });
      if (["TIME", "GPS"].includes(snapshot.proof_policy)) throw new PublicFailure("QUEST_SERVER_ACTIVITY_REQUIRED");
    } else if (action === "review_quest_objective") {
      const objectiveId = String(payload.objective_id || "").trim();
      if (!/^[a-f0-9-]{36}$/i.test(objectiveId)) throw new PublicFailure("OBJECTIVE_ID_INVALID");
      const { data: objective, error: objectiveError } = await client.from("user_quest_objectives")
        .select("id,user_id,user_quest_id,title_snapshot,objective_snapshot,pillar,difficulty,duration_minutes,proof_type,status")
        .eq("id", objectiveId).eq("user_id", userId).maybeSingle();
      if (objectiveError || !objective) throw new PublicFailure("OBJECTIVE_NOT_FOUND", 404);
      if (objective.status !== "ACCEPTED") throw new PublicFailure("OBJECTIVE_NOT_ACCEPTED");
      const objectiveProofType = String(objective.proof_type || "").toUpperCase();
      let verifiedTimer: any = null;
      if (objectiveProofType === "TIMER") {
        const timerSessionId = String(payload.timer_session_id || "").trim();
        if (!/^[a-f0-9-]{36}$/i.test(timerSessionId)) throw new PublicFailure("OBJECTIVE_TIMER_REQUIRED");
        const { data: timerSession, error: timerError } = await client.from("user_quest_objective_timer_sessions")
          .select("id,objective_id,user_id,started_at,finished_at,elapsed_seconds,status")
          .eq("id", timerSessionId).eq("objective_id", objectiveId).eq("user_id", userId).maybeSingle();
        if (timerError || !timerSession || timerSession.status !== "COMPLETED" || !timerSession.finished_at) throw new PublicFailure("OBJECTIVE_TIMER_NOT_VERIFIED");
        if (Number(timerSession.elapsed_seconds || 0) < Number(objective.duration_minutes || 0) * 60) throw new PublicFailure("OBJECTIVE_TIMER_DURATION_NOT_MET");
        verifiedTimer = timerSession;
        proof = { ...proof, type: "RESULT", detail: [proof.detail, `Server-verified timer completed for ${timerSession.elapsed_seconds} seconds; required duration was ${Number(objective.duration_minutes) * 60} seconds.`].filter(Boolean).join("\\n\\n"), note: "Timer duration verified by the server." };
      }
      const { data: parent, error: parentError } = await client.from("user_quests")
        .select("id,status,expires_at").eq("id", objective.user_quest_id).eq("user_id", userId).maybeSingle();
      if (parentError || !parent) throw new PublicFailure("QUEST_NOT_FOUND", 404);
      if (!["ASSIGNED", "ACCEPTED"].includes(parent.status) || (parent.expires_at && new Date(parent.expires_at).getTime() < Date.now())) throw new PublicFailure("QUEST_NOT_OPEN");
      snapshot = {
        kind: "QUEST_OBJECTIVE", target_id: objective.id, title: objective.title_snapshot,
        objective: objective.objective_snapshot, pillar: objective.pillar, difficulty: objective.difficulty,
        duration_minutes: objective.duration_minutes, proof_policy: objectiveProofType === "HONOR" ? "HONOR" : objectiveProofType === "PHOTO" ? "PHOTO" : "RESULT",
        verified_timer: verifiedTimer ? { elapsed_seconds: verifiedTimer.elapsed_seconds, started_at: verifiedTimer.started_at, finished_at: verifiedTimer.finished_at } : null,
      };
    } else if (action === "review_weekly_boss") {
      const state = await rpc(client, "system_weekly_boss_status_v1");
      const boss = state.active;
      if (!boss || String(boss.id) !== String(payload.boss_id) || boss.metadata?.kind !== "WEEKLY_PREPARATION") throw new PublicFailure("WEEKLY_BOSS_NOT_FOUND", 404);
      if (new Date(boss.deadline).getTime() < new Date(state.server_now).getTime()) throw new PublicFailure("WEEKLY_BOSS_NOT_ACTIVE");
      const plan = boss.metadata.weekly_plan;
      snapshot = { kind: "WEEKLY_PREPARATION", target_id: String(boss.id), title: boss.title,
        objective: plan.objective, proof_policy: "RESULT", target_count: plan.target_count, unit: plan.unit,
        coverage_days: plan.coverage_days, remaining_checkpoints: boss.objectives.filter((o: any) => !o.is_complete).length };
    } else throw new PublicFailure("UNKNOWN_ACTION");
    const precheck = guardReviewDecision({ decision: "APPROVE", reason: "Evidence supplied.", question: "", missing: [] }, snapshot, proof);
    if (precheck.decision !== "APPROVE") return { status: 200, body: { data: precheck } };
    const admin = makeAdmin();
    let imageUrl: string | null = null;
    if (proof.imagePath) {
      if (!proof.imagePath.startsWith(`${userId}/`) || proof.imagePath.includes("..") || !/^[a-f0-9-]{36}\/[a-zA-Z0-9._-]+$/i.test(proof.imagePath)) throw new PublicFailure("REVIEW_ATTACHMENT_INVALID");
      const { data, error } = await admin.storage.from("proofs").createSignedUrl(proof.imagePath, 120);
      if (error || !data?.signedUrl) throw new PublicFailure("REVIEW_ATTACHMENT_INVALID");
      if (/\.(png|jpe?g|webp)$/i.test(proof.imagePath)) imageUrl = data.signedUrl;
    }
    if (snapshot.proof_policy === "PHOTO" && !imageUrl) throw new PublicFailure("REVIEW_IMAGE_FORMAT_UNSUPPORTED");
    const review = await reasonAboutProof({ snapshot, proof, apiKey, model, imageUrl, fetcher });
    const { data, error } = await admin.from("system_quest_reviews").insert({
      user_id: userId, target_type: action === "review_quest" ? "QUEST" : action === "review_weekly_boss" ? "BOSS" : "OBJECTIVE", target_id: snapshot.target_id,
      assigned_for: snapshot.assigned_for || null, snapshot, proof, ...review, model,
    }).select("id,decision,reason,question,missing,expires_at").single();
    if (error) {
      logSafeReviewDiagnostic("review_persist_failed", {
        error_code: String(error.code || "").slice(0, 80) || null,
        status: Number(error.status || 0) || null,
      });
      throw new PublicFailure("BACKEND_UPDATE_REQUIRED", 503);
    }
    return { status: 200, body: { data } };
  } catch (error) {
    const failure = error instanceof PublicFailure ? error : new PublicFailure("SYSTEM_ACTION_FAILED", 500);
    return { status: failure.status, body: { error: failure.code } };
  }
}
