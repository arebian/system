const CLASSES = new Set(["ASSASSIN", "TANK", "MAGE", "RANGER", "COMMANDER"]);
const ATTRIBUTES = new Set([
  "STRENGTH", "SPEED", "ENDURANCE", "INTELLIGENCE", "FOCUS",
  "DISCIPLINE", "WEALTH", "CHARISMA", "CREATIVITY", "RECOVERY",
]);
const RANKS = new Set(["E", "D", "C", "B", "A", "S", "SS", "SSS"]);
const FUEL_GOALS = new Set(["CUT", "MAINTAIN", "BULK"]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clampInt(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function enumValue(value, allowed, fallback = "") {
  const candidate = String(value ?? "").trim().toUpperCase();
  return allowed.has(candidate) ? candidate : fallback;
}

function safeAttributeList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => enumValue(item, ATTRIBUTES)).filter(Boolean))].slice(0, 6);
}

export function cleanGuidanceSnapshot(raw) {
  const source = record(raw);
  const rawBoss = record(source.active_boss);
  const rawMusts = Array.isArray(source.active_musts) ? source.active_musts : [];
  const hasBoss = Object.keys(rawBoss).length > 0;
  const mustCount = Math.min(4, rawMusts.length);

  return {
    class: enumValue(source.class || source.path, CLASSES),
    level: clampInt(source.level, 1, 100000, 1),
    xp: clampInt(source.xp, 0, 100000000, 0),
    streak: clampInt(source.streak, 0, 100000, 0),
    momentum: clampInt(source.momentum, 0, 100000, 0),
    completedQuests: clampInt(source.completed_quests, 0, 1000000, 0),
    fuelGoal: enumValue(source.fuel_goal, FUEL_GOALS),
    dailyMinutes: clampInt(source.daily_minutes, 0, 180, 0),
    fuelToday: {
      calories: clampInt(record(source.fuel_today).calories, 0, 30000, 0),
      protein: clampInt(record(source.fuel_today).protein, 0, 3000, 0),
      calorieTarget: clampInt(source.calorie_target, 0, 10000, 0),
      proteinTarget: clampInt(source.protein_target, 0, 1000, 0),
    },
    raidEntryKeyDetected: source.raid_entry_key_detected === true,
    activeBoss: hasBoss
      ? {
          name: "ACTIVE BOSS",
          rank: enumValue(rawBoss.rank, RANKS, "UNKNOWN"),
          hp: clampInt(rawBoss.hp, 0, 100000000, 0),
          maxHp: clampInt(rawBoss.max_hp, 0, 100000000, 0),
        }
      : null,
    activeMusts: Array.from({ length: mustCount }, (_, index) => ({
      name: `ACTIVE DIRECTIVE ${index + 1}`,
      expiresAt: "",
    })),
  };
}


const QUEST_CATEGORIES = new Set([
  "DISCIPLINE", "PHYSICAL", "MENTAL", "SOCIAL", "INTELLECT",
  "SPIRITUAL", "WEALTH", "SYSTEM", "CLASS",
]);
const QUEST_STATUSES = new Set([
  "ASSIGNED", "ACCEPTED", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED",
]);
const QUEST_TYPES = new Set(["DAILY", "CLASS", "MUST", "STANDARD", "ADAPTIVE", "BOSS"]);

function cleanClock(value) {
  const candidate = String(value ?? "").trim().slice(0, 5);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : "";
}

function cleanFoundationPlan(raw) {
  const source = record(raw);
  const goals = Array.isArray(source.focusGoals)
    ? [...new Set(source.focusGoals.map(value =>
        enumValue(value, new Set(["STRENGTH", "BODY_COMPOSITION", "FITNESS", "FOCUS", "CONFIDENCE", "KNOWLEDGE"]))
      ).filter(Boolean))].slice(0, 6)
    : [];
  return {
    primaryFocus: enumValue(source.primaryFocus, new Set(["STRENGTH", "BODY_COMPOSITION", "FITNESS", "FOCUS", "CONFIDENCE", "KNOWLEDGE"])),
    focusGoals: goals,
    experience: enumValue(source.experience, new Set(["NEW", "RETURNING", "REGULAR", "EXPERIENCED"])),
    activityLevel: enumValue(source.activityLevel, new Set(["LOW", "MODERATE", "ACTIVE", "VERY_ACTIVE"])),
    mainObstacle: enumValue(source.mainObstacle, new Set(["CONSISTENCY", "TIME", "ENERGY", "DISTRACTIONS", "CONFIDENCE"])),
    dailyMinutes: clampInt(source.dailyMinutes, 0, 180, 0),
    equipment: enumValue(source.equipment, new Set(["BODYWEIGHT", "HOME", "GYM", "OUTDOOR"])),
  };
}

function cleanFuelPlan(raw) {
  const source = record(raw);
  return {
    goal: enumValue(source.goal, FUEL_GOALS),
    calorieTarget: clampInt(source.calorieTarget, 0, 5000, 0),
    proteinTarget: clampInt(source.proteinTarget, 0, 250, 0),
  };
}

// Database rows can still contain player-authored text. Only send bounded,
// allowlisted facts to the model; never forward profile_data, metadata,
// quest titles, boss names, or event descriptions.
export function cleanServerContext(raw) {
  const source = record(raw);
  const profile = record(source.profile || source.player);
  const profileData = record(profile.profile_data);
  const rawAttributes = record(source.attributes || profile.attributes);
  const rawRoutine = record(source.routine);
  const rawBoss = record(source.active_boss || source.activeBoss);
  const rawQuests = Array.isArray(source.active_quests || source.activeQuests)
    ? (source.active_quests || source.activeQuests)
    : [];

  const attributes = {};
  for (const key of [
    "strength", "speed", "endurance", "intelligence", "focus",
    "discipline", "wealth", "charisma", "creativity", "recovery",
  ]) {
    attributes[key] = clampInt(rawAttributes[key], 0, 1000000, 0);
  }

  const byStatus = {};
  const byCategory = {};
  const byType = {};
  for (const item of rawQuests.slice(0, 100)) {
    const quest = record(item);
    const status = enumValue(quest.status, QUEST_STATUSES);
    const category = enumValue(quest.category, QUEST_CATEGORIES);
    const type = enumValue(quest.quest_type || quest.type, QUEST_TYPES);
    if (status) byStatus[status] = (byStatus[status] || 0) + 1;
    if (category) byCategory[category] = (byCategory[category] || 0) + 1;
    if (type) byType[type] = (byType[type] || 0) + 1;
  }

  const boss = Object.keys(rawBoss).length
    ? {
        rank: enumValue(rawBoss.rank, RANKS),
        status: enumValue(rawBoss.status, new Set(["ACTIVE", "COMPLETED", "FAILED", "RESOLVED"])),
        hp: clampInt(rawBoss.hp, 0, 100000000, 0),
        maxHp: clampInt(rawBoss.max_hp ?? rawBoss.maxHp, 0, 100000000, 0),
      }
    : null;

  return {
    profile: {
      name: "PLAYER",
      path: enumValue(profile.class || profile.path, CLASSES, "COMMANDER"),
      class: enumValue(profile.class || profile.path, CLASSES, "COMMANDER"),
      level: clampInt(profile.level, 1, 100000, 1),
      xp: clampInt(profile.xp, 0, 100000000, 0),
      streak: clampInt(profile.streak, 0, 100000, 0),
      momentum: clampInt(profile.momentum, 0, 100000, 0),
    },
    attributes,
    routine: {
      sleepTime: cleanClock(rawRoutine.sleep_time || rawRoutine.sleepTime),
      wakeTime: cleanClock(rawRoutine.wake_time || rawRoutine.wakeTime),
      verificationMinutes: clampInt(rawRoutine.verification_minutes ?? rawRoutine.verificationMinutes, 1, 120, 10),
    },
    active_boss: boss,
    active_quests: {
      total: Math.min(100, rawQuests.length),
      byStatus,
      byCategory,
      byType,
    },
    foundation_plan: cleanFoundationPlan(profileData.foundationScan || source.foundation_plan),
    fuel_plan: cleanFuelPlan(profileData.fuel || source.fuel_plan),
  };
}

export function cleanAwarenessContext(raw) {
  const source = record(raw);
  if (!Object.keys(source).length) return null;
  const activeSeconds = clampInt(source.activeTodaySeconds, 0, 86400, 0);
  const ascension = String(source.ascensionReadinessSignals ?? "").match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
  const numerator = ascension ? clampInt(ascension[1], 0, 100, 0) : 0;
  const denominator = ascension ? clampInt(ascension[2], 0, 100, 0) : 0;

  return {
    activeNow: source.activeNow === true,
    activeTodaySeconds: activeSeconds,
    activeTodayLabel: `${Math.floor(activeSeconds / 60)} min`,
    sevenDayActiveDays: clampInt(source.sevenDayActiveDays, 0, 7, 0),
    pendingMustQuests: clampInt(source.pendingMustQuests, 0, 4, 0),
    weakestAttribute: enumValue(source.weakestAttribute, ATTRIBUTES),
    trendStatus: source.trendStatus === "ACTIVE" ? "ACTIVE" : "COLLECTING",
    improving: safeAttributeList(source.improving),
    declining: safeAttributeList(source.declining),
    ascensionReadinessSignals: `${numerator}/${denominator}`,
  };
}
