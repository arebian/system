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

export function cleanAwarenessContext(raw) {
  const source = record(raw);
  if (!Object.keys(source).length) return null;
  const activeSeconds = clampInt(source.activeTodaySeconds, 0, 86400, 0);
  const ascension = String(source.ascensionReadinessSignals ?? "").match(/^(\\d{1,3})\\s*\\/\\s*(\\d{1,3})$/);
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
