/* =========================================================
   THE SYSTEM 2.8.4 — ADAPTIVE DIRECTIVE SAFETY HELPERS
   Pure selection logic shared by the cloud adapter and tests.
   ========================================================= */

export const ADAPTIVE_CATEGORIES = [
  "PHYSICAL",
  "WEALTH",
  "LEARNING",
  "FOCUS",
  "RECOVERY",
];

function normalized(value) {
  return String(value || "").trim().toUpperCase();
}

export function adaptiveDaysSince(value, now = Date.now()) {
  if (!value) return 999;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 999;

  return Math.max(0, (Number(now) - timestamp) / 86400000);
}

export function calculateAdaptiveDimensions(profile = {}, now = Date.now()) {
  const lastWorkout = profile.workoutLog?.[0]?.date;
  const lastWealth =
    profile.wealthLogs?.[0]?.date ||
    profile.wealthLogs?.[0]?.day;
  const lastMastery = profile.masteryLogs?.[0]?.date;
  const focusScore = Number(profile.attributes?.FOCUS || 10);
  const recoveryScore = Number(profile.attributes?.RECOVERY || 10);

  const dimensions = [
    {
      category: "PHYSICAL",
      score: adaptiveDaysSince(lastWorkout, now) <= 2
        ? 78
        : adaptiveDaysSince(lastWorkout, now) <= 5
          ? 55
          : 30,
      reason: "Movement has been quiet recently.",
    },
    {
      category: "WEALTH",
      score: adaptiveDaysSince(lastWealth, now) <= 2
        ? 80
        : adaptiveDaysSince(lastWealth, now) <= 5
          ? 58
          : 34,
      reason: "Financial tracking has been neglected.",
    },
    {
      category: "LEARNING",
      score: adaptiveDaysSince(lastMastery, now) <= 3
        ? 76
        : adaptiveDaysSince(lastMastery, now) <= 7
          ? 54
          : 36,
      reason: "Skill practice has gone quiet.",
    },
    {
      category: "FOCUS",
      score: Math.min(90, 35 + focusScore * 2),
      reason: "Focus is currently one of the weaker execution signals.",
    },
    {
      category: "RECOVERY",
      score: Math.min(90, 35 + recoveryScore * 2),
      reason: "Recovery needs protection before more load is added.",
    },
  ];

  return dimensions.sort(
    (left, right) =>
      left.score - right.score ||
      left.category.localeCompare(right.category),
  );
}

export function adaptiveCategoryOrder(dimensions = []) {
  const ordered = [];

  dimensions.forEach((dimension) => {
    const category = normalized(dimension?.category);
    if (
      ADAPTIVE_CATEGORIES.includes(category) &&
      !ordered.includes(category)
    ) {
      ordered.push(category);
    }
  });

  ADAPTIVE_CATEGORIES.forEach((category) => {
    if (!ordered.includes(category)) {
      ordered.push(category);
    }
  });

  return ordered;
}

export function isCompatibleAdaptiveCandidate(candidate, profile = {}) {
  if (normalized(candidate?.quest_type) !== "STANDARD") return false;
  if (!ADAPTIVE_CATEGORIES.includes(normalized(candidate?.category))) {
    return false;
  }

  const playerLevel = Math.max(1, Number(profile.level) || 1);
  if (Number(candidate?.min_level || 1) > playerLevel) return false;

  const affinity = Array.isArray(candidate?.class_affinity)
    ? candidate.class_affinity.map(normalized).filter(Boolean)
    : [];
  const playerClass = normalized(profile.path || profile.class);

  return affinity.length === 0 || affinity.includes(playerClass);
}

function recentQuestIdentity(entry = {}) {
  return {
    title: normalized(entry?.name || entry?.title),
    code: normalized(entry?.code || entry?.library_code),
    date:
      entry?.date ||
      entry?.verifiedAt ||
      entry?.completedAt ||
      entry?.completed_at ||
      entry?.createdAt ||
      entry?.created_at,
  };
}

export function wasAdaptiveCandidateUsedRecently(
  candidate,
  profile = {},
  now = Date.now(),
  windowDays = 7,
) {
  const title = normalized(candidate?.title || candidate?.name);
  const code = normalized(candidate?.code);
  const limit = Math.max(1, Number(windowDays) || 7);

  return (profile?.questLog || []).some((entry) => {
    const recent = recentQuestIdentity(entry);
    const usedWithinWindow = adaptiveDaysSince(recent.date, now) < limit;
    const sameTitle = Boolean(title) && recent.title === title;
    const sameCode = Boolean(code) && recent.code === code;

    return usedWithinWindow && (sameTitle || sameCode);
  });
}

export function withoutRecentAdaptiveCandidates(
  candidates = [],
  profile = {},
  now = Date.now(),
  windowDays = 7,
) {
  return candidates.filter(
    (candidate) =>
      !wasAdaptiveCandidateUsedRecently(
        candidate,
        profile,
        now,
        windowDays,
      ),
  );
}

export function chooseAdaptiveFallbackCandidate(
  candidates = [],
  profile = {},
  categoryOrder = ADAPTIVE_CATEGORIES,
) {
  const order = adaptiveCategoryOrder(
    categoryOrder.map((category) => ({ category })),
  );

  return [...candidates]
    .filter((candidate) => isCompatibleAdaptiveCandidate(candidate, profile))
    .sort((left, right) => {
      const leftPosition = order.indexOf(normalized(left?.category));
      const rightPosition = order.indexOf(normalized(right?.category));
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }

      const healthDelta = Number(right?.health_value || 0) - Number(left?.health_value || 0);
      if (healthDelta) return healthDelta;

      return normalized(left?.code).localeCompare(normalized(right?.code));
    })[0] || null;
}

export function adaptivePriority(score) {
  return Number(score) < 40 ? "HIGH" : "MEDIUM";
}
