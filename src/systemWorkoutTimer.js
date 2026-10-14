export const WORKOUT_VERIFICATION_MODES = Object.freeze({
  GPS: "GPS",
  TIMER: "TIMER",
  PERFORMANCE: "PERFORMANCE",
});

function readMetadata(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function timedStep(step) {
  return Number(step?.duration_seconds || 0) > 0;
}

export function getWorkoutVerificationMode(workout) {
  const metadata = readMetadata(workout?.metadata);
  const explicit = String(
    metadata.verification_mode || metadata.verificationMode || "",
  ).toUpperCase();

  if (Object.values(WORKOUT_VERIFICATION_MODES).includes(explicit)) {
    return explicit;
  }

  const text = [workout?.name, workout?.description]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  // Whole-word matching is intentional: the old loose RUN match incorrectly
  // turned "trunk control" in Core Foundation into a GPS session.
  if (/\b(?:RUN|WALK|JOG|HIKE|TRAIL|SPRINT|CYCLE|CYCLING|BIKE|SWIM)\b/.test(text)) {
    return WORKOUT_VERIFICATION_MODES.GPS;
  }

  if (Array.isArray(workout?.steps) && workout.steps.some(timedStep)) {
    return WORKOUT_VERIFICATION_MODES.TIMER;
  }

  return WORKOUT_VERIFICATION_MODES.PERFORMANCE;
}

export function buildTimedWorkoutPlan(steps = []) {
  const phases = [];

  steps.forEach((step, index) => {
    const workSeconds = Math.max(0, Number(step?.duration_seconds || 0));
    if (!workSeconds) return;

    const sets = Math.max(1, Number(step?.sets || 1));
    const restSeconds = Math.max(0, Number(step?.rest_seconds || 0));

    for (let set = 1; set <= sets; set += 1) {
      phases.push({
        type: "WORK",
        exercise: String(step?.exercise_name || `Movement ${index + 1}`),
        set,
        sets,
        seconds: workSeconds,
      });

      const isLastSet = set === sets;
      const hasAnotherTimedStep = steps.slice(index + 1).some(timedStep);

      if (restSeconds && (!isLastSet || hasAnotherTimedStep)) {
        phases.push({
          type: "REST",
          exercise: String(step?.exercise_name || `Movement ${index + 1}`),
          set,
          sets,
          seconds: restSeconds,
        });
      }
    }
  });

  let elapsedBefore = 0;
  return phases.map((phase) => {
    const item = { ...phase, elapsedBefore };
    elapsedBefore += phase.seconds;
    return item;
  });
}

export function getTimedWorkoutCountdown({
  startedAt,
  targetSeconds,
  serverOffsetMs = 0,
  nowMs = Date.now(),
}) {
  const startedMs = Date.parse(startedAt || "");
  const target = Math.max(0, Number(targetSeconds || 0));

  if (!Number.isFinite(startedMs) || !target) {
    return { elapsedSeconds: 0, remainingSeconds: target, complete: false };
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowMs + Number(serverOffsetMs || 0) - startedMs) / 1000),
  );
  const remainingSeconds = Math.max(0, target - elapsedSeconds);

  return {
    elapsedSeconds,
    remainingSeconds,
    complete: remainingSeconds === 0,
  };
}

export function getTimedWorkoutPhase(plan, protocolElapsedSeconds) {
  const elapsed = Math.max(0, Number(protocolElapsedSeconds || 0));

  for (const phase of plan || []) {
    const end = phase.elapsedBefore + phase.seconds;
    if (elapsed < end) {
      return {
        ...phase,
        remainingSeconds: Math.max(0, end - elapsed),
      };
    }
  }

  return null;
}
