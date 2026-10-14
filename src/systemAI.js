import { xpRequired as serverXpRequired } from "./systemProgressionCore.js";
import { getClassAttributeBlueprint } from "./systemAttributesCore.js";

/* =========================================================
   THE SYSTEM 2.3 — ADAPTIVE INTELLIGENCE
   Deterministic player analysis + recommendation engine.

   IMPORTANT:
   - This module does not award XP.
   - This module does not complete quests.
   - This module does not mutate authoritative progression.
   - Supabase/system-api remains the source of truth.
   ========================================================= */

const ANALYSIS_CACHE = new Map();
const CACHE_TTL_MS = 45 * 1000;

export const CLASS_BONUSES = {
  ASSASSIN: {
    strongStats: getClassAttributeBlueprint("ASSASSIN").core,
    trainingFocus: "Quick, precise execution",
    preferredQuestTypes: getClassAttributeBlueprint("ASSASSIN").core,
    uniqueAbilities: ["SHADOW STRIKE", "QUICK REFLEXES"],
  },
  TANK: {
    strongStats: getClassAttributeBlueprint("TANK").core,
    trainingFocus: "Sustained effort and resilience",
    preferredQuestTypes: getClassAttributeBlueprint("TANK").core,
    uniqueAbilities: ["IRON DEFENSE", "LAST STAND"],
  },
  MAGE: {
    strongStats: getClassAttributeBlueprint("MAGE").core,
    trainingFocus: "Deep work and strategic learning",
    preferredQuestTypes: getClassAttributeBlueprint("MAGE").core,
    uniqueAbilities: ["ARCANE KNOWLEDGE", "DEEP SYNTHESIS"],
  },
  RANGER: {
    strongStats: getClassAttributeBlueprint("RANGER").core,
    trainingFocus: "Consistency and adaptability",
    preferredQuestTypes: getClassAttributeBlueprint("RANGER").core,
    uniqueAbilities: ["KEEN EYE", "STEADY PACE"],
  },
  COMMANDER: {
    strongStats: getClassAttributeBlueprint("COMMANDER").core,
    trainingFocus: "Leadership and execution",
    preferredQuestTypes: getClassAttributeBlueprint("COMMANDER").core,
    uniqueAbilities: ["COMMAND AURA", "STRATEGIC MIND"],
  },
};

const DIFFICULTY_WEIGHT = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
  ELITE: 4,
  EPIC: 4,
  BOSS: 5,
};

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function validDate(value) {
  const d = new Date(value || 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

function dayKey(value) {
  const d = validDate(value);
  if (!d) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function daysAgo(value, now = new Date()) {
  const d = validDate(value);
  if (!d) return Infinity;
  return Math.max(0, (now.getTime() - d.getTime()) / 86400000);
}

function difficultyForQuest(quest = {}) {
  const explicit = String(quest.difficulty || "").toUpperCase();
  if (DIFFICULTY_WEIGHT[explicit]) return explicit;

  const xp = safeNumber(quest.xp);
  if (xp >= 180) return "EPIC";
  if (xp >= 100) return "HARD";
  if (xp >= 45) return "NORMAL";
  return "EASY";
}

function questCategory(quest = {}) {
  return String(
    quest.category ||
    quest.statFocus ||
    quest.stat_focus ||
    "DISCIPLINE"
  ).toUpperCase();
}

function catalogMap(questCatalog = []) {
  const map = new Map();
  for (const quest of questCatalog || []) {
    const key = String(quest?.name || quest?.title || "").trim().toUpperCase();
    if (key) map.set(key, quest);
  }
  return map;
}

function inferCompletionCategory(entry, catalog) {
  const explicit = String(entry?.category || "").trim().toUpperCase();
  if (explicit) return explicit;
  const key = String(entry?.name || entry?.title || "").trim().toUpperCase();
  return questCategory(catalog.get(key) || {});
}

function uniqueActiveDays(profile, windowDays = 7, now = new Date()) {
  const dates = [];
  const sources = [
    ...(Array.isArray(profile?.questLog) ? profile.questLog : []),
    ...(Array.isArray(profile?.workoutLog) ? profile.workoutLog : []),
    ...(Array.isArray(profile?.masteryLogs) ? profile.masteryLogs : []),
    ...(Array.isArray(profile?.performanceLogs) ? profile.performanceLogs : []),
    ...(Array.isArray(profile?.wealthLogs) ? profile.wealthLogs : []),
    ...(Array.isArray(profile?.history) ? profile.history : []),
  ];

  for (const entry of sources) {
    const raw =
      entry?.date ||
      entry?.createdAt ||
      entry?.created_at ||
      entry?.completedAt ||
      entry?.completed_at ||
      entry?.verifiedAt;
    if (daysAgo(raw, now) <= windowDays - 0.0001) {
      const key = dayKey(raw);
      if (key) dates.push(key);
    }
  }

  return new Set(dates);
}

function failedAttempts(profile, windowDays = 7, now = new Date()) {
  let count = 0;

  for (const state of Object.values(profile?.mustState || {})) {
    if (!state?.failed) continue;
    const raw =
      state.failedAt ||
      state.expiresAt ||
      state.acceptedAt ||
      state.date;
    if (!raw || daysAgo(raw, now) <= windowDays) count += 1;
  }

  for (const item of Array.isArray(profile?.pendingConsequences)
    ? profile.pendingConsequences
    : []) {
    const raw = item?.date || item?.createdAt || item?.created_at;
    if (!raw || daysAgo(raw, now) <= windowDays) count += 1;
  }

  return count;
}

function recentQuestCompletions(profile, windowDays = 7, now = new Date()) {
  return (Array.isArray(profile?.questLog) ? profile.questLog : []).filter(
    (entry) => daysAgo(entry?.date || entry?.verifiedAt, now) <= windowDays
  );
}

function parseXpFromHistory(profile, windowDays = 14, now = new Date()) {
  let total = 0;
  for (const entry of Array.isArray(profile?.history) ? profile.history : []) {
    if (daysAgo(entry?.date, now) > windowDays) continue;
    const text = `${entry?.detail || ""} ${entry?.title || ""}`;
    const matches = [...text.matchAll(/\+(\d+)\s*XP/gi)];
    for (const match of matches) total += safeNumber(match[1]);
  }
  return total;
}

function attributeEntries(profile) {
  return Object.entries(profile?.attributes || {})
    .map(([name, value]) => ({
      name: String(name).toUpperCase(),
      value: safeNumber(value),
    }))
    .filter((item) => item.name);
}

function profileSignature(profile, questCatalog = []) {
  return JSON.stringify([
    profile?.path,
    safeNumber(profile?.level, 1),
    safeNumber(profile?.xp),
    safeNumber(profile?.streak),
    safeNumber(profile?.momentum),
    profile?.questLog?.length || 0,
    profile?.workoutLog?.length || 0,
    profile?.history?.length || 0,
    profile?.pendingConsequences?.length || 0,
    Object.entries(profile?.attributes || {}).sort(),
    (questCatalog || []).map((q) => [
      q?.name || q?.title,
      q?.category,
      q?.xp,
      q?.difficulty,
    ]),
  ]);
}

/* =========================================================
   1. PLAYER PROFILE ANALYSIS
   ========================================================= */

export function analyzePlayerProfile(profile, options = {}) {
  const now = options.now || new Date();
  const questCatalog = options.questCatalog || [];
  const catalog = catalogMap(questCatalog);

  const attrs = attributeEntries(profile);
  const sorted = [...attrs].sort((a, b) => b.value - a.value);
  const strengths = sorted.slice(0, Math.min(3, sorted.length));
  const weaknesses = [...sorted].reverse().slice(0, Math.min(3, sorted.length));

  const recent = recentQuestCompletions(profile, 7, now);
  const failures = failedAttempts(profile, 7, now);
  const attempts = recent.length + failures;
  const completionRate =
    attempts > 0 ? Math.round((recent.length / attempts) * 100) : 0;

  const activeDays7 = uniqueActiveDays(profile, 7, now).size;
  const activeDays14 = uniqueActiveDays(profile, 14, now).size;
  const consistency = Math.round((activeDays7 / 7) * 100);

  const categoryCounts = new Map();
  for (const entry of recentQuestCompletions(profile, 30, now)) {
    const category = inferCompletionCategory(entry, catalog);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }
  const preferredCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  const knownXp = parseXpFromHistory(profile, 14, now);
  const catalogXp = recentQuestCompletions(profile, 14, now).reduce(
    (sum, entry) => {
      const q = catalog.get(String(entry?.name || "").toUpperCase());
      return sum + safeNumber(q?.xp);
    },
    0
  );
  const estimatedXp14 = Math.max(knownXp, catalogXp);
  const averageXpPerActiveDay =
    activeDays14 > 0 ? Math.round(estimatedXp14 / activeDays14) : 0;

  const averageAttribute =
    attrs.length > 0
      ? Math.round(
          attrs.reduce((sum, item) => sum + item.value, 0) / attrs.length
        )
      : 0;

  return {
    class: String(profile?.path || "COMMANDER").toUpperCase(),
    level: safeNumber(profile?.level, 1),
    xp: safeNumber(profile?.xp),
    streak: safeNumber(profile?.streak),
    momentum: safeNumber(profile?.momentum),
    stats: Object.fromEntries(attrs.map((item) => [item.name, item.value])),
    strengths: strengths.map((item) => item.name),
    strengthDetails: strengths,
    weaknesses: weaknesses.map((item) => item.name),
    weaknessDetails: weaknesses,
    preferredCategories,
    completionRate,
    averageXpPerDay: averageXpPerActiveDay,
    averageAttribute,
    recentPerformance: {
      completedThisWeek: recent.length,
      failedThisWeek: failures,
      activeDays: activeDays7,
      consistency,
      momentum: safeNumber(profile?.momentum),
    },
  };
}

/* =========================================================
   2. QUEST RECOMMENDATIONS
   Blueprint weighting:
   base 50
   +20 class match
   +15 preference
   +25 weakness
   +10..15 difficulty fit
   +10 level alignment
   +5 streak
   x0.5 recent-repeat penalty
   ========================================================= */

function matchDifficulty(questDifficulty, suggestedDifficulty) {
  const q = DIFFICULTY_WEIGHT[questDifficulty] || 2;
  const s = DIFFICULTY_WEIGHT[suggestedDifficulty] || 2;
  const delta = Math.abs(q - s);
  if (delta === 0) return 15;
  if (delta === 1) return 10;
  if (delta === 2) return 4;
  return 0;
}

function wasRecentlyCompleted(profile, questName, now = new Date()) {
  const target = String(questName || "").toUpperCase();
  return (profile?.questLog || []).some(
    (entry) =>
      String(entry?.name || "").toUpperCase() === target &&
      daysAgo(entry?.date || entry?.verifiedAt, now) <= 2
  );
}

function getRecommendationReason(quest, analysis) {
  const category = questCategory(quest);
  const classBonus = Array.isArray(quest?.classBonus)
    ? quest.classBonus
    : Array.isArray(quest?.class_bonus)
      ? quest.class_bonus
      : [];

  if (analysis.weaknesses.includes(category)) {
    return `Targets current weakness: ${category}`;
  }
  if (classBonus.includes(analysis.class)) {
    return `Strong ${analysis.class} class alignment`;
  }
  if (analysis.preferredCategories.includes(category)) {
    return `Matches recent progression pattern: ${category}`;
  }
  return `Maintains balanced ${category} progression`;
}

export function recommendQuests(profile, questCatalog = [], limit = 5, options = {}) {
  const analysis = options.analysis || analyzePlayerProfile(profile, {
    ...options,
    questCatalog,
  });
  const suggestedDifficulty =
    options.suggestedDifficulty ||
    suggestOptimalDifficulty(profile, {
      ...options,
      analysis,
      questCatalog,
    }).recommendedDifficulty;
  const now = options.now || new Date();

  return (questCatalog || [])
    .map((quest) => {
      let score = 50;
      const category = questCategory(quest);
      const difficulty = difficultyForQuest(quest);
      const classBonus = Array.isArray(quest?.classBonus)
        ? quest.classBonus
        : Array.isArray(quest?.class_bonus)
          ? quest.class_bonus
          : [];

      if (classBonus.includes(analysis.class)) score += 20;
      if (analysis.preferredCategories.includes(category)) score += 15;
      if (analysis.weaknesses.includes(category)) score += 25;

      score += matchDifficulty(difficulty, suggestedDifficulty);

      const minLevel = safeNumber(quest?.minLevel || quest?.unlock || 1, 1);
      if (analysis.level >= minLevel) score += 10;

      if (analysis.streak > 0) score += 5;

      if (wasRecentlyCompleted(profile, quest?.name || quest?.title, now)) {
        score *= 0.5;
      }

      const rawScore = Math.round(score);
      const matchScore = Math.max(1, Math.min(99, Math.round(rawScore / 1.25)));
      const difficultyGap = Math.abs(
        (DIFFICULTY_WEIGHT[difficulty] || 2) -
        (DIFFICULTY_WEIGHT[suggestedDifficulty] || 2)
      );
      const difficultyFit =
        difficultyGap === 0
          ? "EXACT"
          : difficultyGap === 1
            ? "NEAR"
            : "OFF-TARGET";
      const classMatch = classBonus.includes(analysis.class);
      const weaknessTarget = analysis.weaknesses.includes(category);
      const preferenceMatch = analysis.preferredCategories.includes(category);

      return {
        ...quest,
        category,
        difficulty,
        rawScore,
        matchScore,
        reason: getRecommendationReason(quest, analysis),
        targetAttribute: category,
        difficultyFit,
        expectedBenefit: {
          attribute: category,
          xp: safeNumber(quest?.xp),
          pressure: difficulty,
        },
        recommendationSignals: {
          classMatch,
          weaknessTarget,
          preferenceMatch,
          difficultyFit,
          recentlyCompleted: wasRecentlyCompleted(
            profile,
            quest?.name || quest?.title,
            now
          ),
        },
      };
    })
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, limit);
}

/* =========================================================
   3. ADAPTIVE DIFFICULTY
   ========================================================= */

export function suggestOptimalDifficulty(profile, options = {}) {
  const analysis =
    options.analysis ||
    analyzePlayerProfile(profile, options);

  const completionRate = analysis.completionRate;
  const consistency = analysis.recentPerformance.consistency;

  let recommendedDifficulty = "NORMAL";
  let reason = "Maintain the current challenge while more data is collected.";
  let confidence = 0.55;

  if (completionRate >= 90 && consistency >= 80) {
    recommendedDifficulty = "HARD";
    reason = "High completion and consistency support a harder directive.";
    confidence = 0.95;
  } else if (completionRate >= 70 && consistency >= 60) {
    recommendedDifficulty = "NORMAL";
    reason = "Current performance supports steady progression at normal difficulty.";
    confidence = 0.85;
  } else if (
    (completionRate > 0 && completionRate < 50) ||
    (analysis.recentPerformance.completedThisWeek > 0 && consistency < 35)
  ) {
    recommendedDifficulty = "EASY";
    reason = "Rebuild completion consistency before increasing pressure.";
    confidence = 0.72;
  } else if (analysis.recentPerformance.completedThisWeek === 0) {
    recommendedDifficulty = "EASY";
    reason = "No recent quest clears detected. Restart with a low-friction win.";
    confidence = 0.68;
  }

  return {
    recommendedDifficulty,
    reason,
    confidence,
    nextMilestone:
      recommendedDifficulty === "EASY"
        ? "NORMAL"
        : recommendedDifficulty === "NORMAL"
          ? "HARD"
          : "ELITE",
  };
}

/* =========================================================
   4. PERSONALIZED TRAINING PATH
   ========================================================= */

export function generateTrainingPath(profile, focus = "BALANCED", options = {}) {
  const analysis =
    options.analysis ||
    analyzePlayerProfile(profile, options);

  const cleanFocus = ["WEAKNESS", "STRENGTH", "BALANCED"].includes(
    String(focus).toUpperCase()
  )
    ? String(focus).toUpperCase()
    : "BALANCED";

  let trainingPlan = [];

  if (cleanFocus === "WEAKNESS") {
    trainingPlan = analysis.weaknesses.map((stat, index) => ({
      stat,
      priority: index === 0 ? "CRITICAL" : "HIGH",
      recommendedFrequency: "DAILY",
      reason: `${stat} is currently one of your lowest attributes.`,
    }));
  } else if (cleanFocus === "STRENGTH") {
    trainingPlan = analysis.strengths.map((stat) => ({
      stat,
      priority: "MEDIUM",
      recommendedFrequency: "3x / WEEK",
      reason: `${stat} is an existing advantage. Maintain the edge.`,
    }));
  } else {
    trainingPlan = [
      ...analysis.weaknesses.slice(0, 2).map((stat, index) => ({
        stat,
        priority: index === 0 ? "HIGH" : "MEDIUM",
        recommendedFrequency: "DAILY",
        reason: `Bring ${stat} closer to your overall attribute average.`,
      })),
      ...analysis.strengths.slice(0, 1).map((stat) => ({
        stat,
        priority: "LOW",
        recommendedFrequency: "2x / WEEK",
        reason: `Maintain ${stat} while weaker dimensions catch up.`,
      })),
    ];
  }

  return {
    focus: cleanFocus,
    duration: "30 DAYS",
    expectedProgress: {
      current: analysis.averageAttribute,
      expected30Day: analysis.averageAttribute + 4,
      expected90Day: analysis.averageAttribute + 12,
    },
    trainingPlan,
    milestones: [
      {
        day: 7,
        goal: "Record activity on 5 of the next 7 days",
        reward: "MOMENTUM CHECKPOINT",
      },
      {
        day: 30,
        goal: `Raise ${analysis.weaknesses[0] || "your weakest attribute"} through verified actions`,
        reward: "TRAINING PATH CLEARED",
      },
      {
        day: 90,
        goal: "Reduce the gap between strongest and weakest attributes",
        reward: "BALANCE MILESTONE",
      },
    ],
  };
}

/* =========================================================
   5. LEVEL FORECAST
   Uses the app's real xpRequired() callback when supplied.
   ========================================================= */

export function predictNextLevelXp(profile, options = {}) {
  const analysis =
    options.analysis ||
    analyzePlayerProfile(profile, options);

  const currentLevel = safeNumber(profile?.level, 1);
  const currentXp = safeNumber(profile?.xp);
  const requiredTotal =
    typeof options.xpRequired === "function"
      ? safeNumber(options.xpRequired(currentLevel), 1)
      : serverXpRequired(currentLevel);

  const xpNeeded = Math.max(0, requiredTotal - currentXp);
  const averageXpPerDay = analysis.averageXpPerDay;

  if (averageXpPerDay <= 0) {
    return {
      currentLevel,
      xpNeeded,
      averageXpPerDay: 0,
      predictions: null,
      status: "COLLECTING DATA",
      streakBonus: analysis.streak > 0 ? `${analysis.streak} DAY STREAK` : null,
    };
  }

  const realisticDays = Math.max(1, Math.ceil(xpNeeded / averageXpPerDay));

  return {
    currentLevel,
    xpNeeded,
    averageXpPerDay,
    status: "FORECAST ACTIVE",
    predictions: {
      optimistic: {
        daysToLevel: Math.max(1, Math.ceil(realisticDays * 0.7)),
        condition: "If output rises above your recent average",
      },
      realistic: {
        daysToLevel: realisticDays,
        condition: `At roughly ${averageXpPerDay} verified XP per active day`,
      },
      conservative: {
        daysToLevel: Math.max(1, Math.ceil(realisticDays * 1.5)),
        condition: "If activity drops below your recent pace",
      },
    },
    streakBonus: analysis.streak > 0 ? `${analysis.streak} DAY STREAK` : null,
  };
}

/* =========================================================
   6. CLASS-SPECIFIC RECOMMENDATIONS
   ========================================================= */

export function getClassSpecificRecommendations(profile, questCatalog = [], options = {}) {
  const analysis =
    options.analysis ||
    analyzePlayerProfile(profile, {
      ...options,
      questCatalog,
    });

  const classInfo =
    CLASS_BONUSES[analysis.class] ||
    CLASS_BONUSES.COMMANDER;

  const classSpecificQuests = (questCatalog || [])
    .filter((quest) => {
      const bonus = Array.isArray(quest?.classBonus)
        ? quest.classBonus
        : Array.isArray(quest?.class_bonus)
          ? quest.class_bonus
          : [];
      return bonus.includes(analysis.class);
    })
    .slice(0, 3);

  return {
    class: analysis.class,
    ...classInfo,
    nextSkillToUnlock: classInfo.uniqueAbilities[0],
    classSpecificQuests,
  };
}

/* =========================================================
   7. SMART ALERTS
   ========================================================= */

export function generateSmartAlert(profile, options = {}) {
  const analysis =
    options.analysis ||
    analyzePlayerProfile(profile, options);

  const alerts = [];

  if (analysis.streak === 0) {
    alerts.push({
      type: "STREAK_LOST",
      severity: "HIGH",
      message: "STREAK AT ZERO. SECURE ONE VERIFIED WIN TODAY.",
      action: "OPEN_QUESTS",
    });
  }

  if (analysis.weaknesses.length > 0) {
    alerts.push({
      type: "WEAKNESS_TRAINING",
      severity: "MEDIUM",
      message: `${analysis.weaknesses[0]} IS CURRENTLY YOUR LOWEST DIMENSION.`,
      action: "RECOMMEND_QUESTS",
    });
  }

  if (analysis.level > 0 && analysis.level % 10 === 0) {
    alerts.push({
      type: "MILESTONE",
      severity: "LOW",
      message: `LEVEL ${analysis.level} MILESTONE CONFIRMED.`,
      action: "OPEN_PROGRESS",
    });
  }

  if (
    analysis.recentPerformance.consistency < 50 &&
    analysis.recentPerformance.completedThisWeek > 0
  ) {
    alerts.push({
      type: "CONSISTENCY",
      severity: "MEDIUM",
      message: `7-DAY ACTIVITY CONSISTENCY IS ${analysis.recentPerformance.consistency}%.`,
      action: "OPEN_QUESTS",
    });
  }

  if (safeNumber(profile?.momentum) <= 1 && analysis.recentPerformance.completedThisWeek > 0) {
    alerts.push({
      type: "MOMENTUM",
      severity: "MEDIUM",
      message: "MOMENTUM IS LOW. COMPLETE A SMALL DIRECTIVE BEFORE ADDING PRESSURE.",
      action: "OPEN_QUESTS",
    });
  }

  return alerts
    .sort((a, b) => {
      const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (weight[b.severity] || 0) - (weight[a.severity] || 0);
    })
    .slice(0, 5);
}

/* =========================================================
   8. FULL ANALYTICS
   One profile analysis per refresh; all downstream systems reuse it.
   ========================================================= */

export function getFullAnalytics(profile, options = {}) {
  const questCatalog = options.questCatalog || [];
  const signature = profileSignature(profile, questCatalog);
  const cached = ANALYSIS_CACHE.get(signature);

  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  const analysis = analyzePlayerProfile(profile, {
    ...options,
    questCatalog,
  });
  const difficulty = suggestOptimalDifficulty(profile, {
    ...options,
    questCatalog,
    analysis,
  });
  const quests = recommendQuests(
    profile,
    questCatalog,
    options.limit || 5,
    {
      ...options,
      analysis,
      suggestedDifficulty: difficulty.recommendedDifficulty,
    }
  );
  const training = generateTrainingPath(
    profile,
    options.focus || "BALANCED",
    {
      ...options,
      questCatalog,
      analysis,
    }
  );
  const levelPrediction = predictNextLevelXp(profile, {
    ...options,
    questCatalog,
    analysis,
  });
  const classRecommendations = getClassSpecificRecommendations(
    profile,
    questCatalog,
    {
      ...options,
      analysis,
    }
  );
  const alerts = generateSmartAlert(profile, {
    ...options,
    questCatalog,
    analysis,
  });

  const data = {
    generatedAt: new Date().toISOString(),
    profile: analysis,
    recommendations: {
      quests,
      difficulty,
      training,
      class: classRecommendations,
    },
    analytics: {
      levelPrediction,
      alerts,
    },
  };

  ANALYSIS_CACHE.set(signature, {
    time: Date.now(),
    data,
  });

  if (ANALYSIS_CACHE.size > 20) {
    const first = ANALYSIS_CACHE.keys().next().value;
    ANALYSIS_CACHE.delete(first);
  }

  return data;
}

export function clearAdaptiveIntelligenceCache() {
  ANALYSIS_CACHE.clear();
}
