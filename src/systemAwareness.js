import { useEffect, useMemo, useRef, useState } from "react";

/* =========================================================
   THE SYSTEM 2.4 — SYSTEM AWARENESS

   Device-local awareness telemetry.

   PURPOSE
   - Count real active time across the whole app.
   - Pause counting while the page is hidden or the player is idle.
   - Remember day-by-day activity and profile snapshots.
   - Produce daily briefings, trend signals, recovery directives,
     activity history and hidden Ascension readiness telemetry.

   SAFETY
   - Does NOT award XP.
   - Does NOT complete quests.
   - Does NOT apply penalties.
   - Does NOT change official Level 101 unlock rules.
   ========================================================= */

const STORE_VERSION = 1;
const IDLE_AFTER_MS = 2 * 60 * 1000;
const TICK_MS = 5000;
const PERSIST_MS = 15000;
const HISTORY_DAYS = 14;
const TREND_DAYS = 7;

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dayOffsetKey(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return localDayKey(date);
}

function profileKey(profile) {
  return String(
    profile?.fingerprint ||
      `${profile?.name || "PLAYER"}-${profile?.path || "COMMANDER"}`
  );
}

function storeKey(profile) {
  return `systemAwarenessV1:${profileKey(profile)}`;
}

function emptyStore() {
  return {
    version: STORE_VERSION,
    days: {},
    firstObservedAt: new Date().toISOString(),
    lastObservedAt: new Date().toISOString(),
  };
}

function normalizeDay(day = {}) {
  return {
    activeSeconds: Math.max(0, safeNumber(day.activeSeconds)),
    interactions: Math.max(0, safeNumber(day.interactions)),
    eventCount: Math.max(0, safeNumber(day.eventCount)),
    firstSeen: day.firstSeen || null,
    lastSeen: day.lastSeen || null,
    tabs:
      day.tabs && typeof day.tabs === "object"
        ? { ...day.tabs }
        : {},
    snapshot:
      day.snapshot && typeof day.snapshot === "object"
        ? { ...day.snapshot }
        : null,
  };
}

function loadStore(profile) {
  if (typeof window === "undefined" || !profile) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(storeKey(profile)) || "null");

    if (!parsed || typeof parsed !== "object") {
      return emptyStore();
    }

    const days = {};

    for (const [key, value] of Object.entries(parsed.days || {})) {
      days[key] = normalizeDay(value);
    }

    return {
      version: STORE_VERSION,
      days,
      firstObservedAt: parsed.firstObservedAt || new Date().toISOString(),
      lastObservedAt: parsed.lastObservedAt || new Date().toISOString(),
    };
  } catch {
    return emptyStore();
  }
}

function persistStore(profile, store) {
  if (typeof window === "undefined" || !profile) {
    return;
  }

  try {
    localStorage.setItem(storeKey(profile), JSON.stringify(store));
  } catch {
    // Awareness telemetry should never block the game.
  }
}

function bossWinCount(profile) {
  return (Array.isArray(profile?.bossQuests) ? profile.bossQuests : []).filter(
    (boss) => boss?.status === "COMPLETE"
  ).length;
}

function profileSnapshot(profile) {
  if (!profile) {
    return null;
  }

  const attributes = {};

  for (const [name, value] of Object.entries(profile.attributes || {})) {
    attributes[String(name).toUpperCase()] = safeNumber(value);
  }

  return {
    recordedAt: new Date().toISOString(),
    level: safeNumber(profile.level, 1),
    xp: safeNumber(profile.xp),
    streak: safeNumber(profile.streak),
    momentum: safeNumber(profile.momentum),
    questCount: Array.isArray(profile.questLog) ? profile.questLog.length : 0,
    workoutCount: Array.isArray(profile.workoutLog) ? profile.workoutLog.length : 0,
    bossWins: bossWinCount(profile),
    attributes,
  };
}

function eventDayCounts(profile) {
  const counts = new Map();
  const sources = [
    ...(Array.isArray(profile?.questLog) ? profile.questLog : []),
    ...(Array.isArray(profile?.workoutLog) ? profile.workoutLog : []),
    ...(Array.isArray(profile?.history) ? profile.history : []),
    ...(Array.isArray(profile?.performanceLogs) ? profile.performanceLogs : []),
    ...(Array.isArray(profile?.wealthLogs) ? profile.wealthLogs : []),
  ];

  for (const item of sources) {
    const raw =
      item?.date ||
      item?.createdAt ||
      item?.created_at ||
      item?.completedAt ||
      item?.completed_at ||
      item?.verifiedAt;

    const key = localDayKey(raw);

    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

function weakestAttribute(profile) {
  const entries = Object.entries(profile?.attributes || {})
    .map(([name, value]) => ({
      name: String(name).toUpperCase(),
      value: safeNumber(value),
    }))
    .sort((a, b) => a.value - b.value);

  return entries[0] || null;
}

function attributeSpread(profile) {
  const values = Object.values(profile?.attributes || {}).map((value) =>
    safeNumber(value)
  );

  if (!values.length) {
    return 999;
  }

  return Math.max(...values) - Math.min(...values);
}

function pendingMustCount(profile) {
  return Object.values(profile?.mustState || {}).filter(
    (state) =>
      state?.accepted &&
      !state?.completed &&
      !state?.failed
  ).length;
}

function activityLevel(seconds, eventCount = 0) {
  if (seconds >= 90 * 60) return 4;
  if (seconds >= 45 * 60) return 3;
  if (seconds >= 20 * 60) return 2;
  if (seconds >= 5 * 60 || eventCount > 0) return 1;
  return 0;
}

function buildHistory(store, profile) {
  const eventCounts = eventDayCounts(profile);
  const history = [];

  for (let offset = -(HISTORY_DAYS - 1); offset <= 0; offset += 1) {
    const key = dayOffsetKey(offset);
    const stored = normalizeDay(store?.days?.[key]);
    const eventCount = Math.max(stored.eventCount, eventCounts.get(key) || 0);

    history.push({
      key,
      observed: Boolean(store?.days?.[key]),
      activeSeconds: stored.activeSeconds,
      interactions: stored.interactions,
      eventCount,
      tabs: stored.tabs,
      level: activityLevel(stored.activeSeconds, eventCount),
      snapshot: stored.snapshot,
    });
  }

  return history;
}

function buildTrends(store, profile) {
  const current = profileSnapshot(profile);
  const priorDays = [];

  for (let offset = -1; offset >= -TREND_DAYS; offset -= 1) {
    const snapshot = store?.days?.[dayOffsetKey(offset)]?.snapshot;

    if (snapshot?.attributes) {
      priorDays.push({
        key: dayOffsetKey(offset),
        snapshot,
      });
    }
  }

  const baseline = priorDays.length ? priorDays[priorDays.length - 1] : null;

  if (!current || !baseline) {
    return {
      status: "COLLECTING",
      window: null,
      attributes: [],
      improving: null,
      declining: null,
    };
  }

  const attributes = Object.entries(current.attributes || {})
    .map(([name, value]) => ({
      name,
      current: safeNumber(value),
      previous: safeNumber(baseline.snapshot.attributes?.[name]),
      delta: safeNumber(value) - safeNumber(baseline.snapshot.attributes?.[name]),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    status: "ACTIVE",
    window: `${baseline.key} → ${localDayKey()}`,
    attributes,
    improving:
      [...attributes].filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta)[0] || null,
    declining:
      [...attributes].filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta)[0] || null,
  };
}

function buildRecoveryDirective(profile, history) {
  const weakest = weakestAttribute(profile);
  const yesterday = history[history.length - 2] || null;
  const yesterdayQuiet =
    yesterday &&
    yesterday.observed &&
    yesterday.activeSeconds < 5 * 60 &&
    yesterday.eventCount === 0;
  const lowMomentum = safeNumber(profile?.momentum) <= 1;
  const streakLost = safeNumber(profile?.streak) === 0;

  if (!yesterdayQuiet && !lowMomentum && !streakLost) {
    return null;
  }

  const target = weakest?.name || "DISCIPLINE";
  const tasks = {
    RECOVERY: "Complete 10 minutes of easy walking and 5 minutes of mobility.",
    FOCUS: "Complete one protected 20-minute focus block on the most important unfinished task.",
    DISCIPLINE: "Finish one small responsibility completely before starting another task.",
    ENDURANCE: "Complete 15 minutes of continuous easy movement.",
    STRENGTH: "Complete 2 controlled rounds of squats, incline push-ups and a short plank.",
    INTELLIGENCE: "Read or study one useful concept for 15 focused minutes and record one lesson.",
    SPEED: "Complete a short movement session with clean, controlled pace rather than maximum effort.",
    WEALTH: "Complete one concrete money action: record spending, save, budget or resolve one financial task.",
    CHARISMA: "Complete one deliberate communication action you have been postponing.",
    CREATIVITY: "Produce one small finished creative output rather than planning a larger one.",
  };

  return {
    target,
    title: "RECOVERY DIRECTIVE",
    reason: streakLost
      ? "STREAK RESET DETECTED"
      : lowMomentum
        ? "MOMENTUM BELOW NORMAL RANGE"
        : "LOW ACTIVITY DETECTED YESTERDAY",
    task: tasks[target] || tasks.DISCIPLINE,
    advisory: true,
  };
}

function buildAscensionReadiness(profile, history) {
  const recentSeven = history.slice(-7);
  const activeDays = recentSeven.filter(
    (day) => day.activeSeconds >= 5 * 60 || day.eventCount > 0
  ).length;

  // These are readiness signals only. They intentionally do NOT represent
  // or alter the app's official Level 101 unlock protocol.
  const signals = [
    safeNumber(profile?.level) >= 80,
    activeDays >= 5,
    safeNumber(profile?.streak) >= 14,
    bossWinCount(profile) >= 3,
    attributeSpread(profile) <= 15,
  ];

  return {
    detected: signals.filter(Boolean).length,
    total: signals.length,
    signals: signals.map((detected, index) => ({
      id: index + 1,
      detected,
    })),
    note: "READINESS TELEMETRY ONLY — OFFICIAL ASCENSION CONDITIONS REMAIN HIDDEN.",
  };
}

function greetingForHour(hour) {
  if (hour < 5) return "SYSTEM NIGHT WATCH";
  if (hour < 12) return "GOOD MORNING";
  if (hour < 17) return "GOOD AFTERNOON";
  if (hour < 22) return "GOOD EVENING";
  return "SYSTEM NIGHT WATCH";
}

function buildBriefing(profile, activeSeconds, history, trends, recoveryDirective) {
  const weakest = weakestAttribute(profile);
  const mustCount = pendingMustCount(profile);
  const greeting = greetingForHour(new Date().getHours());
  const activeDays = history
    .slice(-7)
    .filter((day) => day.activeSeconds >= 5 * 60 || day.eventCount > 0).length;

  const lines = [];

  if (mustCount > 0) {
    lines.push(`${mustCount} MUST QUEST${mustCount === 1 ? "" : "S"} REMAIN ACTIVE.`);
  } else {
    lines.push("NO ACCEPTED MUST QUEST IS CURRENTLY OPEN.");
  }

  if (weakest) {
    lines.push(`${weakest.name} IS CURRENTLY YOUR LOWEST ATTRIBUTE.`);
  }

  if (trends.declining) {
    lines.push(`${trends.declining.name} HAS DECLINED ${Math.abs(trends.declining.delta)} POINT${Math.abs(trends.declining.delta) === 1 ? "" : "S"} IN THE STORED TREND WINDOW.`);
  } else if (trends.improving) {
    lines.push(`${trends.improving.name} IS YOUR STRONGEST RECENT IMPROVEMENT SIGNAL.`);
  }

  if (recoveryDirective) {
    lines.push(`${recoveryDirective.reason}. RECOVERY DIRECTIVE AVAILABLE.`);
  }

  return {
    greeting,
    player: String(profile?.name || "PLAYER").toUpperCase(),
    activeSeconds,
    activeDays,
    mustCount,
    weakest: weakest?.name || null,
    lines,
    summary: `${greeting}, ${String(profile?.name || "PLAYER").toUpperCase()}. ${lines.join(" ")}`,
  };
}

export function formatAwarenessDuration(seconds) {
  const total = Math.max(0, Math.floor(safeNumber(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M`;
  }

  if (minutes > 0) {
    return `${String(minutes).padStart(2, "0")}M ${String(secs).padStart(2, "0")}S`;
  }

  return `${String(secs).padStart(2, "0")}S`;
}

export function useSystemAwareness(profile, currentTab = "dashboard") {
  const identity = profile ? profileKey(profile) : "NO-PROFILE";
  const [store, setStore] = useState(() => loadStore(profile));
  const [activeNow, setActiveNow] = useState(false);
  const storeRef = useRef(store);
  const profileRef = useRef(profile);
  const tabRef = useRef(currentTab);
  const lastActivityRef = useRef(Date.now());
  const lastInteractionCreditRef = useRef(0);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    tabRef.current = currentTab;
  }, [currentTab]);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    const next = loadStore(profile);
    storeRef.current = next;
    setStore(next);
    lastActivityRef.current = Date.now();
    lastTickRef.current = Date.now();
  }, [identity]);

  // Record a compact profile snapshot whenever meaningful progression changes.
  useEffect(() => {
    if (!profile) return;

    const key = localDayKey();
    const nowIso = new Date().toISOString();
    const snapshot = profileSnapshot(profile);

    setStore((previous) => {
      const day = normalizeDay(previous.days?.[key]);
      const next = {
        ...previous,
        lastObservedAt: nowIso,
        days: {
          ...previous.days,
          [key]: {
            ...day,
            firstSeen: day.firstSeen || nowIso,
            lastSeen: nowIso,
            snapshot,
          },
        },
      };

      storeRef.current = next;
      return next;
    });
  }, [
    identity,
    profile?.level,
    profile?.xp,
    profile?.streak,
    profile?.momentum,
    profile?.questLog?.length,
    profile?.workoutLog?.length,
    profile?.bossQuests?.length,
    JSON.stringify(profile?.attributes || {}),
  ]);

  useEffect(() => {
    if (!profile || typeof window === "undefined") {
      return undefined;
    }

    function markActivity() {
      const now = Date.now();
      lastActivityRef.current = now;

      if (now - lastInteractionCreditRef.current < 1800) {
        return;
      }

      lastInteractionCreditRef.current = now;
      const key = localDayKey();

      setStore((previous) => {
        const day = normalizeDay(previous.days?.[key]);
        const next = {
          ...previous,
          lastObservedAt: new Date(now).toISOString(),
          days: {
            ...previous.days,
            [key]: {
              ...day,
              interactions: day.interactions + 1,
              firstSeen: day.firstSeen || new Date(now).toISOString(),
              lastSeen: new Date(now).toISOString(),
            },
          },
        };

        storeRef.current = next;
        return next;
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        lastActivityRef.current = Date.now();
        lastTickRef.current = Date.now();
        markActivity();
      } else {
        setActiveNow(false);
      }
    }

    const passive = { passive: true };
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"];

    for (const eventName of events) {
      window.addEventListener(eventName, markActivity, passive);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    markActivity();

    const tick = window.setInterval(() => {
      const now = Date.now();
      const previousTick = lastTickRef.current;
      lastTickRef.current = now;

      const visible = document.visibilityState === "visible";
      const recentlyActive = now - lastActivityRef.current < IDLE_AFTER_MS;
      const shouldCount = visible && recentlyActive;
      setActiveNow(shouldCount);

      if (!shouldCount) {
        return;
      }

      const deltaSeconds = Math.max(
        0,
        Math.min(10, Math.round((now - previousTick) / 1000))
      );

      if (!deltaSeconds) {
        return;
      }

      const key = localDayKey();
      const nowIso = new Date(now).toISOString();
      const tab = String(tabRef.current || "dashboard");

      setStore((previous) => {
        const day = normalizeDay(previous.days?.[key]);
        const next = {
          ...previous,
          lastObservedAt: nowIso,
          days: {
            ...previous.days,
            [key]: {
              ...day,
              activeSeconds: day.activeSeconds + deltaSeconds,
              firstSeen: day.firstSeen || nowIso,
              lastSeen: nowIso,
              tabs: {
                ...day.tabs,
                [tab]: safeNumber(day.tabs?.[tab]) + deltaSeconds,
              },
            },
          },
        };

        storeRef.current = next;
        return next;
      });
    }, TICK_MS);

    const persist = window.setInterval(() => {
      persistStore(profileRef.current, storeRef.current);
    }, PERSIST_MS);

    function flush() {
      persistStore(profileRef.current, storeRef.current);
    }

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(persist);

      for (const eventName of events) {
        window.removeEventListener(eventName, markActivity, passive);
      }

      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [identity]);

  const history = useMemo(() => buildHistory(store, profile), [store, profile]);
  const trends = useMemo(() => buildTrends(store, profile), [store, profile]);
  const today = normalizeDay(store?.days?.[localDayKey()]);
  const recoveryDirective = useMemo(
    () => buildRecoveryDirective(profile, history),
    [profile, history]
  );
  const ascension = useMemo(
    () => buildAscensionReadiness(profile, history),
    [profile, history]
  );
  const briefing = useMemo(
    () =>
      buildBriefing(
        profile,
        today.activeSeconds,
        history,
        trends,
        recoveryDirective
      ),
    [profile, today.activeSeconds, history, trends, recoveryDirective]
  );

  const context = useMemo(
    () => ({
      activeNow,
      activeTodaySeconds: today.activeSeconds,
      activeToday: formatAwarenessDuration(today.activeSeconds),
      sevenDayActiveDays: briefing.activeDays,
      pendingMustQuests: briefing.mustCount,
      weakestAttribute: briefing.weakest,
      trendStatus: trends.status,
      improving: trends.improving,
      declining: trends.declining,
      recoveryDirective,
      ascensionReadinessSignals: `${ascension.detected}/${ascension.total}`,
      briefing: briefing.summary,
    }),
    [activeNow, today.activeSeconds, briefing, trends, recoveryDirective, ascension]
  );

  return {
    activeNow,
    activeTodaySeconds: today.activeSeconds,
    activeTodayLabel: formatAwarenessDuration(today.activeSeconds),
    history,
    trends,
    recoveryDirective,
    ascension,
    briefing,
    context,
  };
}
