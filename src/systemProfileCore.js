import { buildFoundationProfileData } from "./systemFoundationScan.js";
import { normalizeFuelState } from "./systemFuel.js";
import { createClassAttributeBaseline } from "./systemAttributesCore.js";

export const PATHS = {
  ASSASSIN: {
    name: "ASSASSIN",
    icon: "🗡️",
    accent: "#ef4444",
    secondary: "#991b1b",
    darkBg: "#050405",
    darkPanel: "#100708",
    lightBg: "#fff4f4",
    lightPanel: "#fffafa",
    bonus: "SPEED",
    description:
      "Speed, precision, agility and explosive control.",
    identity:
      "Move before hesitation can catch you.",
  },

  TANK: {
    name: "TANK",
    icon: "🛡️",
    accent: "#b7793f",
    secondary: "#6f4426",
    darkBg: "#090705",
    darkPanel: "#17110c",
    lightBg: "#f8f1e8",
    lightPanel: "#fffaf4",
    bonus: "STRENGTH",
    description:
      "Strength, resilience and physical durability.",
    identity:
      "Become the person who can endure what others cannot.",
  },

  MAGE: {
    name: "MAGE",
    icon: "🔮",
    accent: "#a855f7",
    secondary: "#6d28d9",
    darkBg: "#07040d",
    darkPanel: "#13091d",
    lightBg: "#f8f2ff",
    lightPanel: "#fdfaff",
    bonus: "INTELLIGENCE",
    description:
      "Knowledge, focus, memory and mental power.",
    identity:
      "Knowledge becomes your weapon.",
  },

  RANGER: {
    name: "RANGER",
    icon: "🏹",
    accent: "#22c55e",
    secondary: "#166534",
    darkBg: "#030805",
    darkPanel: "#07160d",
    lightBg: "#effcf3",
    lightPanel: "#fbfffc",
    bonus: "ENDURANCE",
    description:
      "Endurance, mobility and relentless consistency.",
    identity:
      "You win through consistency when others stop.",
  },

  COMMANDER: {
    name: "COMMANDER",
    icon: "⚔️",
    accent: "#f59e0b",
    secondary: "#92400e",
    darkBg: "#090704",
    darkPanel: "#171107",
    lightBg: "#fff8e7",
    lightPanel: "#fffdf7",
    bonus: "DISCIPLINE",
    description:
      "Leadership, discipline and balanced development.",
    identity:
      "You do what needs to be done.",
  },
};

export function normalizeProfile(profile) {
  const path =
    PATHS[profile?.path]
      ? profile.path
      : "COMMANDER";

  const foundationScan =
    profile?.foundationScan &&
    typeof profile.foundationScan ===
      "object" &&
    !Array.isArray(
      profile.foundationScan
    )
      ? {
          ...buildFoundationProfileData(
            profile.foundationScan,
            profile.foundationScan
              .selectedFuelGoal
          ),
          completedAt:
            typeof profile.foundationScan
              .completedAt === "string"
              ? profile.foundationScan
                  .completedAt
              : "",
        }
      : null;

  const normalizedFuel =
    normalizeFuelState(
      profile?.fuel
    );

  const fuel =
    !normalizedFuel.goal &&
    foundationScan?.selectedFuelGoal
      ? normalizeFuelState({
          ...normalizedFuel,
          goal:
            foundationScan
              .selectedFuelGoal,
          calorieTarget:
            foundationScan
              .estimatedCalorieTarget,
          proteinTarget:
            foundationScan
              .estimatedProteinTarget,
        })
      : normalizedFuel;

  return {
    name:
      profile?.name ||
      "PLAYER",

    age:
      Number(profile?.age) ||
      18,

    gender:
      ["MALE", "FEMALE"].includes(
        String(
          profile?.gender || ""
        ).toUpperCase()
      )
        ? String(
            profile.gender
          ).toUpperCase()
        : "UNSPECIFIED",

    path,

    fingerprint:
      profile?.fingerprint ||
      createFingerprint(
        profile?.name || "PLAYER",
        profile?.age || 18,
        path
      ),

    level:
      Number(profile?.level) ||
      1,

    xp:
      Number(profile?.xp) ||
      0,

    streak:
      Number(profile?.streak) ||
      0,

    momentum:
      Number(profile?.momentum) ||
      0,

    attributes: {
      ...createAttributes(path),
      ...(profile?.attributes || {}),
    },

    completed:
      Array.isArray(profile?.completed)
        ? profile.completed
        : [],

    questLog:
      Array.isArray(profile?.questLog)
        ? profile.questLog
        : [],

    workoutLog:
      Array.isArray(profile?.workoutLog)
        ? profile.workoutLog
        : [],

    totalWorkouts:
      Number(profile?.totalWorkouts) ||
      0,

    totalDistance:
      Number(profile?.totalDistance) ||
      0,

    dailyCompleted:
      profile?.dailyCompleted &&
      typeof profile.dailyCompleted ===
        "object"
        ? profile.dailyCompleted
        : {},

    sleepSchedule:
      normalizeSleepSchedule(
        profile?.sleepSchedule
      ),

    wakeProofs:
      profile?.wakeProofs &&
      typeof profile.wakeProofs ===
        "object"
        ? profile.wakeProofs
        : {},

    questProofs:
      profile?.questProofs &&
      typeof profile.questProofs ===
        "object"
        ? profile.questProofs
        : {},

    // Fuel logging, the offline Archive recovery shelf and Class Training
    // activity are personal UI records. They are intentionally not used to
    // calculate XP, level, attributes or Must Quest outcomes.
    fuel,

    // The Foundation Scan is personal planning data. It may guide Fuel,
    // Training and Adaptive recommendations, but never alters official XP,
    // attributes, timers or quest outcomes.
    foundationScan,

    archiveFallback:
      profile?.archiveFallback &&
      typeof profile.archiveFallback ===
        "object"
        ? {
            activeBookId:
              String(
                profile.archiveFallback
                  .activeBookId ||
                ""
              ),
            progress:
              profile.archiveFallback
                .progress &&
              typeof profile.archiveFallback
                .progress === "object"
                ? profile.archiveFallback
                    .progress
                : {},
          }
        : {
            activeBookId: "",
            progress: {},
          },

    classTrainingLog:
      Array.isArray(
        profile?.classTrainingLog
      )
        ? profile.classTrainingLog.slice(
            0,
            50
          )
        : [],

    eventScanState:
      profile?.eventScanState &&
      typeof profile.eventScanState ===
        "object"
        ? profile.eventScanState
        : {
            date: "",
            scans: 0,
            lastScanAt: "",
            eventFound: false,
          },

    gpsSessions:
      Array.isArray(profile?.gpsSessions)
        ? profile.gpsSessions
        : [],

    activeGpsMission:
      profile?.activeGpsMission &&
      typeof profile.activeGpsMission ===
        "object"
        ? profile.activeGpsMission
        : null,

    mustState:
      profile?.mustState &&
      typeof profile.mustState ===
        "object"
        ? profile.mustState
        : {},

    skillProgress:
      profile?.skillProgress &&
      typeof profile.skillProgress ===
        "object"
        ? profile.skillProgress
        : {},

    bossQuests:
      Array.isArray(profile?.bossQuests)
        ? profile.bossQuests
        : [],

    customInventory:
      Array.isArray(profile?.customInventory)
        ? profile.customInventory
        : [],

    rewards:
      Array.isArray(profile?.rewards)
        ? profile.rewards
        : [],

    performanceLogs:
      Array.isArray(profile?.performanceLogs)
        ? profile.performanceLogs
        : [],

    wealthLogs:
      Array.isArray(profile?.wealthLogs)
        ? profile.wealthLogs
        : [],

    masteryLogs:
      Array.isArray(profile?.masteryLogs)
        ? profile.masteryLogs
        : [],

    masteredSkills:
      profile?.masteredSkills &&
      typeof profile.masteredSkills ===
        "object"
        ? profile.masteredSkills
        : {},

    goals:
      Array.isArray(profile?.goals)
        ? profile.goals
        : [],

    proofs:
      Array.isArray(profile?.proofs)
        ? profile.proofs
        : [],

    history:
      Array.isArray(profile?.history)
        ? profile.history
        : [],

    cloudAchievements:
      Array.isArray(
        profile?.cloudAchievements
      )
        ? profile.cloudAchievements
        : [],

    adaptiveDirective:
      profile?.adaptiveDirective &&
      typeof profile.adaptiveDirective ===
        "object"
        ? profile.adaptiveDirective
        : null,

    pendingConsequences:
      Array.isArray(
        profile?.pendingConsequences
      )
        ? profile.pendingConsequences
        : [],

    evolution:
      profile?.evolution &&
      typeof profile.evolution ===
        "object"
        ? profile.evolution
        : {
            awakened: false,
            title: "",
            emblem: "",
            awakenedAt: "",
          },
  };
}

export function createFingerprint(
  name,
  age,
  path
) {
  const raw =
    name +
    "-" +
    age +
    "-" +
    path +
    "-SYSTEM";

  const hex = hashString(raw)
    .toString(16)
    .toUpperCase()
    .padStart(8, "0");

  return (
    "SYS-" +
    hex.slice(0, 4) +
    "-" +
    hex.slice(4, 8)
  );
}

export function todayKey(
  value = new Date()
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

export function uid(prefix = "SYS") {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export const SHIFT_PRESETS = {
  EARLY: { label: "EARLY SHIFT", sleep: "22:30", wake: "06:30" },
  NORMAL: { label: "NORMAL DAY", sleep: "23:30", wake: "07:30" },
  LATE: { label: "LATE SHIFT", sleep: "03:00", wake: "11:00" },
  OFF: { label: "OFF DAY", sleep: "00:30", wake: "08:30" },
  CUSTOM: { label: "CUSTOM • 8H", sleep: "23:00", wake: "07:00" },
};

export function normalizeSleepSchedule(schedule) {
  const mode =
    SHIFT_PRESETS[
      schedule?.mode
    ]
      ? schedule.mode
      : "NORMAL";

  const preset =
    SHIFT_PRESETS[
      mode
    ];

  const sleep =
    schedule?.sleep ||
    preset.sleep;

  const wake =
    mode ===
    "CUSTOM"
      ? addMinutesToClock(
          sleep,
          8 * 60
        )
      : schedule?.wake ||
        preset.wake;

  return {
    mode,
    sleep,
    wake,
    sleepDurationHours:
      8,
    verificationMinutes:
      Math.min(
        30,
        Math.max(
          5,
          Number(
            schedule?.verificationMinutes
          ) || 10
        )
      ),
    updatedAt:
      schedule?.updatedAt ||
      "",
  };
}

export function formatClockLabel(value) {
  const [hourRaw, minuteRaw] =
    String(value || "00:00").split(":").map(Number);

  const hour = Number.isFinite(hourRaw) ? hourRaw : 0;
  const minute = Number.isFinite(minuteRaw) ? minuteRaw : 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return (
    displayHour +
    ":" +
    String(minute).padStart(2, "0") +
    " " +
    suffix
  );
}

export function getWakeWindow(schedule, now = new Date()) {
  const clean = normalizeSleepSchedule(schedule);
  const [wakeHour, wakeMinute] = clean.wake.split(":").map(Number);

  let start = new Date(now);
  start.setHours(wakeHour, wakeMinute, 0, 0);

  let end = new Date(
    start.getTime() + clean.verificationMinutes * 60 * 1000
  );

  if (now.getTime() > end.getTime()) {
    start.setDate(start.getDate() + 1);
    end = new Date(
      start.getTime() + clean.verificationMinutes * 60 * 1000
    );
  }

  return { start, end, schedule: clean };
}

export function scheduleDailyQuest(profile, now = new Date()) {
  const schedule = normalizeSleepSchedule(profile.sleepSchedule);
  const window = getWakeWindow(schedule, now);

  return {
    ...DAILY_QUEST,
    task:
      "Wake at your committed time: " +
      formatClockLabel(schedule.wake) +
      ". Verify within " +
      schedule.verificationMinutes +
      " minutes. No snooze and no returning to bed.",
    message:
      "Discipline is not waking up early. Discipline is keeping the schedule you committed to.",
    wakeWindow: window,
  };
}

export function createAttributes(path) {
  return createClassAttributeBaseline(
    path
  );
}

export function hashString(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash =
      (hash << 5) -
      hash +
      value.charCodeAt(i);

    hash |= 0;
  }

  return Math.abs(hash);
}

export function addMinutesToClock(
  value,
  minutesToAdd
) {
  const [
    hourRaw,
    minuteRaw,
  ] = String(
    value || "00:00"
  )
    .split(":")
    .map(Number);

  const hour =
    Number.isFinite(hourRaw)
      ? hourRaw
      : 0;

  const minute =
    Number.isFinite(minuteRaw)
      ? minuteRaw
      : 0;

  const dayMinutes =
    24 * 60;

  let total =
    (
      hour * 60 +
      minute +
      minutesToAdd
    ) %
    dayMinutes;

  if (total < 0) {
    total +=
      dayMinutes;
  }

  return (
    String(
      Math.floor(
        total / 60
      )
    ).padStart(
      2,
      "0"
    ) +
    ":" +
    String(
      total % 60
    ).padStart(
      2,
      "0"
    )
  );
}

export const DAILY_QUEST = {
  name: "NO-SNOOZE PROTOCOL",
  task:
    "When your alarm rings, get up. No snooze. No returning to bed.",
  message:
    "The first victory happens before the day has a chance to negotiate with you.",
  xp: 10,
  category: "DISCIPLINE",
};
