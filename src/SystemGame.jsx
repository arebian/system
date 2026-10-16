import React from "react";
import { todayKey, PATHS, scheduleDailyQuest, uid, hashString, SHIFT_PRESETS, formatClockLabel, normalizeProfile, normalizeSleepSchedule, addMinutesToClock } from "./systemProfileCore.js";
import { xpRequired, getRank } from "./systemProgressionCore.js";
import { useEffect, useRef, useMemo, useState, useLayoutEffect, useCallback } from "react";
import { getCloudUser, syncProfileToCloud } from "./systemProfileApi.js";
import { supabase } from "./supabaseClient.js";
import { formatAwarenessDuration, useSystemAwareness } from "./systemAwareness.js";
import { getFullAnalytics, generateTrainingPath } from "./systemAI.js";
import { SectionLabel, PageHero, SystemField, SystemModalPortal } from "./systemUI.jsx";
import { hasRaidEntryKey } from "./systemBossCore.js";
import AchievementCelebration from "./AchievementCelebration.jsx";
import { CLASS_TRACKS, createClassSoundtrack, soundtrackVolume } from "./systemMusicCore.js";
import { effectiveAttributes } from "./systemEquipmentCore.js";
import { achievementEvents, appendAchievements } from "./systemAchievementCore.js";
import WeeklyBoss from "./WeeklyBoss.jsx";
import { assignBossOnBackend, bootstrapAuthoritativeProfile, hydrateStructuredProfile, setBossObjectiveOnBackend, resolveBossOnBackend, evaluateAdaptiveQuest, acceptMustQuestOnBackend, updateRoutineOnBackend, routineCheckinOnBackend, completeQuestByTitleOnBackend, applyExpiredQuestPenaltiesOnBackend, uploadProofFile, loadAttributeCredits, allocateAttributeCreditOnBackend, startGpsSessionOnBackend, finishGpsWorkoutOnBackend, finishGpsSessionOnBackend, loadTrainingCatalog, uploadProofImage, submitProofRecordOnBackend, submitSkillAttemptOnBackend, saveLearningRecord, countLearningRecordsForSkill, evaluateSkillOnBackend, addPerformanceLogOnBackend, addWealthLogOnBackend, updateGoalProgressOnBackend, claimGoalOnBackend, createGoalOnBackend, addCustomInventoryOnBackend, claimRewardOnBackend, setInventoryStateOnBackend, refreshProgressionUnlocksOnBackend, equipTitleOnBackend, loadDailyCommandBrief, saveCloudPreferences, startTimedWorkoutOnBackend, completeTimedWorkoutOnBackend, completeWorkoutOnBackend } from "./systemCloud.js";
import { buildQuestActionKey, getQuestProofType, mustStateMatchesQuest, getServerClockOffsetMs, isMustStateReady, QUEST_PROOF_LABELS } from "./systemQuestCore.js";
import { createPortal } from "react-dom";
import { calculateClassAlignment, getClassAttributeBlueprint, sortAttributesForClass, normalizeAttributeCredit, getAttributeTier } from "./systemAttributesCore.js";
import { getWorkoutVerificationMode, WORKOUT_VERIFICATION_MODES, buildTimedWorkoutPlan, getTimedWorkoutCountdown, getTimedWorkoutPhase } from "./systemWorkoutTimer.js";
import { isClassCompatible } from "./systemClassSpecialCore.js";
import { normalizeFuelState, getFuelProtocol, getFuelMealPlan, summarizeFuelDay, recentFuelConsistency, FUEL_GOALS } from "./systemFuel.js";
import { LoginScreen } from "./LoginScreen.jsx";
import SectionBoundary from "./SectionBoundary.jsx";
import { reportSystemError } from "./systemErrorReporter.js";
import "./styles/stability.css";
const MageArchive = React.lazy(() => import("./MageArchive.jsx").then(m => ({ default: React.memo(m.MageArchive || m.default) })));
const SystemIntelligenceFloat = React.lazy(() => import("./SystemIntelligenceFloat.jsx").then(m => ({ default: m.SystemIntelligenceFloat || m.default })));
const ClassSpecial = React.lazy(() => import("./ClassSpecial.jsx").then(m => ({ default: React.memo(m.ClassSpecial || m.default) })));
const TrainingView = React.memo(Training);
const ClassTrainingView = React.memo(ClassTraining);
function useStableHandler(handler) {
  const current = useRef(handler);
  useLayoutEffect(() => { current.current = handler; });
  return useCallback((...args) => current.current(...args), []);
}

export const ATTRIBUTES = [
  "STRENGTH",
  "SPEED",
  "ENDURANCE",
  "INTELLIGENCE",
  "FOCUS",
  "DISCIPLINE",
  "WEALTH",
  "CHARISMA",
  "CREATIVITY",
  "RECOVERY",
];

export function haversineMeters(a, b) {
  if (!a || !b) return 0;

  const R = 6371000;
  const toRad = (value) =>
    value * Math.PI / 180;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);

  const h =
    s1 * s1 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      s2 * s2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(1 - h)
    );

  return R * c;
}

export function formatMovementTime(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(seconds || 0)
    );

  const h =
    Math.floor(total / 3600);

  const m =
    Math.floor(
      (total % 3600) / 60
    );

  const s =
    total % 60;

  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0")
  );
}

export function formatPace(distanceKm, seconds) {
  if (
    !distanceKm ||
    distanceKm < 0.05 ||
    !seconds
  ) {
    return "--";
  }

  const secondsPerKm =
    seconds / distanceKm;

  const min =
    Math.floor(secondsPerKm / 60);

  const sec =
    Math.floor(secondsPerKm % 60);

  return (
    min +
    ":" +
    String(sec).padStart(2, "0") +
    " /KM"
  );
}

export const WORKOUTS = [
  {
    id: "pushup",
    name: "NORMAL PUSH-UP",
    category: "STRENGTH",
    unlock: 1,
    amount: "3 × 10",
    xp: 20,
    description:
      "Controlled bodyweight pushing.",
  },
  {
    id: "squat",
    name: "BODYWEIGHT SQUAT",
    category: "LEGS",
    unlock: 1,
    amount: "3 × 15",
    xp: 20,
    description:
      "Foundational lower-body strength.",
  },
  {
    id: "plank",
    name: "PLANK",
    category: "CORE",
    unlock: 1,
    amount: "3 × 30 SEC",
    xp: 20,
    description:
      "Core stability and bracing.",
  },
  {
    id: "run2",
    name: "2 KM RUN",
    category: "ENDURANCE",
    unlock: 1,
    amount: "2 KM",
    xp: 40,
    description:
      "Foundational endurance mission.",
  },
  {
    id: "diamond",
    name: "DIAMOND PUSH-UP",
    category: "STRENGTH",
    unlock: 8,
    amount: "3 × 8",
    xp: 35,
    description:
      "Advanced push-up progression.",
  },
  {
    id: "lunges",
    name: "WALKING LUNGES",
    category: "LEGS",
    unlock: 8,
    amount: "3 × 12",
    xp: 35,
    description:
      "Unilateral leg strength.",
  },
  {
    id: "sprint",
    name: "SPRINT INTERVALS",
    category: "SPEED",
    unlock: 10,
    amount: "6 × 20 SEC",
    xp: 55,
    description:
      "Short controlled speed efforts.",
  },
  {
    id: "burpees",
    name: "BURPEES",
    category: "CONDITIONING",
    unlock: 12,
    amount: "3 × 8",
    xp: 45,
    description:
      "Full-body conditioning.",
  },
  {
    id: "pullup",
    name: "PULL-UP",
    category: "STRENGTH",
    unlock: 15,
    amount: "3 × 5",
    xp: 55,
    description:
      "Upper-body pulling strength.",
  },
  {
    id: "split",
    name: "BULGARIAN SPLIT SQUAT",
    category: "LEGS",
    unlock: 20,
    amount: "3 × 10",
    xp: 65,
    description:
      "Advanced unilateral leg strength.",
  },
  {
    id: "pike",
    name: "PIKE PUSH-UP",
    category: "STRENGTH",
    unlock: 25,
    amount: "3 × 8",
    xp: 70,
    description:
      "Vertical pressing progression.",
  },
];

export const SKILLS = {
  ASSASSIN: [
    ["EXPLOSIVE PUSH-UP", "POWER", 5, "NORMAL PUSH-UP", 50],
    ["ARCHER PUSH-UP", "CONTROL", 10, "DIAMOND PUSH-UP", 75],
    ["SHRIMP SQUAT", "BALANCE", 15, "SINGLE LEG CONTROL", 90],
    ["WALL HANDSTAND", "SKILL", 18, "SHOULDER CONTROL", 100],
    ["FREESTANDING HANDSTAND", "MASTER", 25, "WALL HANDSTAND", 160],
    ["ONE-ARM PUSH-UP", "MASTER", 35, "ARCHER PUSH-UP", 220],
    ["HANDSTAND PUSH-UP", "MASTER", 40, "HANDSTAND CONTROL", 250],
    ["90 DEGREE PUSH-UP", "LEGENDARY", 55, "ADVANCED PRESSING", 400],
    ["ONE-ARM HANDSTAND", "LEGENDARY", 70, "HANDSTAND MASTERY", 650],
  ],

  TANK: [
    ["DECLINE PUSH-UP", "STRENGTH", 5, "NORMAL PUSH-UP", 45],
    ["DIP PROGRESSION", "STRENGTH", 10, "PRESSING BASE", 70],
    ["BULGARIAN SPLIT SQUAT", "STRENGTH", 15, "SPLIT SQUAT", 80],
    ["CHEST-TO-BAR PULL-UP", "POWER", 22, "PULL-UP", 120],
    ["PISTOL SQUAT", "MASTER", 30, "SINGLE LEG CONTROL", 180],
    ["HANDSTAND PUSH-UP", "MASTER", 40, "PIKE PUSH-UP", 250],
    ["FRONT LEVER", "LEGENDARY", 55, "ADVANCED PULLING", 400],
    ["PLANCHE PROGRESSION", "LEGENDARY", 65, "ADVANCED PRESSING", 500],
  ],

  MAGE: [
    ["20 MIN DEEP WORK", "FOCUS", 1, "ONE TASK", 30],
    ["ACTIVE RECALL", "INTELLIGENCE", 5, "FOCUSED STUDY", 45],
    ["MEMORY DRILL", "INTELLIGENCE", 8, "ACTIVE RECALL", 55],
    ["60 MIN DEEP WORK", "MASTER", 12, "20 MIN DEEP WORK", 90],
    ["MENTAL ARITHMETIC", "COGNITION", 18, "FOCUS CONTROL", 110],
    ["KNOWLEDGE SYNTHESIS", "MASTER", 25, "ACTIVE RECALL", 160],
    ["2 HOUR KNOWLEDGE RAID", "LEGENDARY", 40, "DEEP WORK MASTERY", 300],
    ["TEACH WHAT YOU LEARNED", "LEGENDARY", 50, "KNOWLEDGE SYNTHESIS", 380],
  ],

  RANGER: [
    ["5 KM RUN", "ENDURANCE", 5, "2 KM RUN", 70],
    ["HILL INTERVALS", "POWER", 10, "SPRINT BASE", 90],
    ["MOBILITY FLOW", "MOBILITY", 12, "CONSISTENT MOVEMENT", 60],
    ["10 KM RUN", "MASTER", 25, "5 KM RUN", 170],
    ["TRAIL CHALLENGE", "ENDURANCE", 30, "DISTANCE BASE", 190],
    ["LONG DISTANCE MISSION", "MASTER", 40, "10 KM RUN", 260],
    ["ENDURANCE GAUNTLET", "LEGENDARY", 55, "DISTANCE MASTERY", 420],
  ],

  COMMANDER: [
    ["COMMANDER CIRCUIT", "BALANCED", 5, "BASIC TRAINING", 70],
    ["IRON DISCIPLINE", "DISCIPLINE", 10, "QUEST CONSISTENCY", 90],
    ["TACTICAL ENDURANCE", "BALANCED", 18, "RUN + STRENGTH", 130],
    ["FIRST ORDER", "DISCIPLINE", 22, "TASK EXECUTION", 120],
    ["MASTER OF ROUTINE", "MASTER", 30, "CONSISTENCY", 210],
    ["COMMANDER TRIAL", "LEGENDARY", 50, "MULTI-ATTRIBUTE MASTERY", 500],
    ["SOVEREIGN PROTOCOL", "LEGENDARY", 70, "COMMANDER TRIAL", 700],
  ],
};

export const CLASS_QUESTS = {
  ASSASSIN: [
    {
      name: "SILENT EXECUTION",
      task:
        "Finish one meaningful task with your phone out of reach.",
      message:
        "Speed means nothing without control.",
      xp: 30,
    },
    {
      name: "PRECISION WINDOW",
      task:
        "Spend 25 uninterrupted minutes on one objective.",
      message:
        "Today the target is precision.",
      xp: 35,
    },
    {
      name: "SHADOW MOVEMENT",
      task:
        "Complete 15 minutes of balance, mobility or controlled footwork.",
      message:
        "Move quietly. Move deliberately.",
      xp: 30,
    },
    {
      name: "SINGLE-THREAD STRIKE",
      task:
        "Complete 25 uninterrupted minutes on one meaningful objective with your phone out of reach. Record the concrete result.",
      message:
        "Precision begins by removing competing targets.",
      xp: 35,
      category: "FOCUS",
      proofType: "RESULT",
    },
    {
      name: "CLEAN FOOTWORK",
      task:
        "Complete 15 minutes of controlled footwork, balance or coordination practice. Stop before form becomes sloppy.",
      message:
        "Speed without control is only noise.",
      xp: 35,
      category: "PHYSICAL",
      proofType: "PERFORMANCE",
    },
    {
      name: "PRECISION RESET",
      task:
        "Complete 10 minutes of controlled ankle, hip and shoulder mobility, then identify one movement that feels cleaner.",
      message:
        "A sharp system restores its range before demanding speed.",
      xp: 30,
      category: "RECOVERY",
      proofType: "PERFORMANCE",
    },
    {
      name: "DECISIVE CUT",
      task:
        "Remove one avoidable distraction from your next work block and complete the first meaningful action it was delaying.",
      message:
        "The cleanest strike is the one made after hesitation is removed.",
      xp: 35,
      category: "DISCIPLINE",
      proofType: "RESULT",
    },
  ],

  TANK: [
    {
      name: "HOLD THE LINE",
      task:
        "Complete 3 controlled sets of an appropriate strength movement.",
      message:
        "Strength without control is wasted force.",
      xp: 35,
    },
    {
      name: "FORTRESS",
      task:
        "Complete three controlled core-strength sets.",
      message:
        "Build the structure that carries everything else.",
      xp: 30,
    },
    {
      name: "IRON PATIENCE",
      task:
        "Train using slow controlled repetitions.",
      message:
        "Power also requires patience.",
      xp: 35,
    },
    {
      name: "LOAD BEARING",
      task:
        "Complete 3 controlled strength sets at an appropriate load. Keep two good reps in reserve and record the sets.",
      message:
        "Durability is built through repeatable force, not reckless force.",
      xp: 40,
      category: "PHYSICAL",
      proofType: "PERFORMANCE",
    },
    {
      name: "FRAME REPAIR",
      task:
        "Spend 12 minutes restoring hips, shoulders and trunk with gentle mobility. Leave the session feeling better, not exhausted.",
      message:
        "A strong frame is maintained before it is tested.",
      xp: 30,
      category: "RECOVERY",
      proofType: "PERFORMANCE",
    },
    {
      name: "HOLD THE STANDARD",
      task:
        "Finish one responsibility you would normally postpone before entertainment or passive scrolling.",
      message:
        "A Tank does not lower the standard when no one is watching.",
      xp: 35,
      category: "DISCIPLINE",
      proofType: "RESULT",
    },
    {
      name: "SLOW FORCE",
      task:
        "Perform one familiar strength movement with a slow controlled lowering phase for 3 sets. Stop if technique breaks.",
      message:
        "Control under load is the foundation of real force.",
      xp: 35,
      category: "PHYSICAL",
      proofType: "PERFORMANCE",
    },
  ],

  MAGE: [
    {
      name: "COGNITIVE STRIKE",
      task:
        "Learn one difficult concept for 25 minutes and record 3 things you understood.",
      message:
        "Do not merely consume information. Capture it.",
      xp: 35,
    },
    {
      name: "MEMORY FORGE",
      task:
        "Learn 5 things and recall them later without checking.",
      message:
        "Memory converts information into power.",
      xp: 40,
    },
    {
      name: "DEEP WORK PROTOCOL",
      task:
        "Work on one meaningful task for 40 minutes with your phone away.",
      message:
        "One task. One mind.",
      xp: 45,
    },
    {
      name: "TEACH BACK",
      task:
        "Study one idea for 20 minutes, then explain it in your own words without reading from the source. Record three takeaways.",
      message:
        "Knowledge becomes power when it can survive outside the page.",
      xp: 40,
      category: "LEARNING",
      proofType: "LEARNING",
    },
    {
      name: "RESEARCH DISTILLATION",
      task:
        "Research one question for 30 minutes and reduce it into a concise answer with three useful facts or actions.",
      message:
        "Information is not intelligence until it is distilled.",
      xp: 45,
      category: "LEARNING",
      proofType: "LEARNING",
    },
    {
      name: "FOCUS SANCTUARY",
      task:
        "Protect a 25-minute distraction-free block for your most valuable work. State the concrete output when it ends.",
      message:
        "The mind needs defended territory before it can go deep.",
      xp: 35,
      category: "FOCUS",
      proofType: "RESULT",
    },
    {
      name: "KNOWLEDGE BRIDGE",
      task:
        "Apply something you learned this week to a real problem, task or decision, then record the result.",
      message:
        "The strongest knowledge crosses into real life.",
      xp: 40,
      category: "LEARNING",
      proofType: "RESULT",
    },
  ],

  RANGER: [
    {
      name: "KEEP MOVING",
      task:
        "Complete 25 minutes of walking, jogging or mobility.",
      message:
        "Distance is built one deliberate step at a time.",
      xp: 35,
    },
    {
      name: "OPEN TERRITORY",
      task:
        "Spend at least 20 minutes moving outdoors.",
      message:
        "Expand the map.",
      xp: 30,
    },
    {
      name: "STEADY PACE",
      task:
        "Complete continuous moderate movement without unnecessary stops.",
      message:
        "You do not need to be fast. Keep going.",
      xp: 40,
    },
    {
      name: "TERRAIN SCAN",
      task:
        "Move outdoors for 25 minutes at a comfortable, sustainable pace. Notice your breathing and keep it controlled.",
      message:
        "The Ranger reads the terrain without forcing the pace.",
      xp: 35,
      category: "PHYSICAL",
      proofType: "PERFORMANCE",
    },
    {
      name: "LONG HORIZON",
      task:
        "Complete 30 minutes of continuous walking, jogging or cycling at a pace you can maintain without a hard finish.",
      message:
        "Distance is built by respecting the horizon.",
      xp: 40,
      category: "PHYSICAL",
      proofType: "PERFORMANCE",
    },
    {
      name: "ROUTE RECOVERY",
      task:
        "Take a 15-minute easy walk, then complete five minutes of calf, hip and ankle mobility.",
      message:
        "A long path requires maintenance between the hard miles.",
      xp: 30,
      category: "RECOVERY",
      proofType: "PERFORMANCE",
    },
    {
      name: "ADAPTIVE PACE",
      task:
        "Complete 20 minutes of steady movement. Adjust the pace once if needed, but do not stop early without a real reason.",
      message:
        "Adaptability keeps the Ranger moving when conditions change.",
      xp: 35,
      category: "PHYSICAL",
      proofType: "PERFORMANCE",
    },
  ],

  COMMANDER: [
    {
      name: "FIRST ORDER",
      task:
        "Finish one task you have been avoiding before recreation.",
      message:
        "A commander does not negotiate with an order already given.",
      xp: 35,
    },
    {
      name: "CLEAR THE FIELD",
      task:
        "Remove one source of disorder from your environment.",
      message:
        "Order improves execution.",
      xp: 30,
    },
    {
      name: "TACTICAL HOUR",
      task:
        "Spend one uninterrupted hour on your highest-value responsibility.",
      message:
        "Protect the objective.",
      xp: 50,
    },
    {
      name: "OPERATIONAL MAP",
      task:
        "Write the three outcomes that would make today successful, then complete the first concrete step toward the most important one.",
      message:
        "Command begins by defining what success looks like.",
      xp: 35,
      category: "FOCUS",
      proofType: "RESULT",
    },
    {
      name: "CLEAR SIGNAL",
      task:
        "Make one delayed decision and communicate it clearly in a sentence or short message. Record the outcome.",
      message:
        "Clarity is a form of leadership.",
      xp: 35,
      category: "FOCUS",
      proofType: "RESULT",
    },
    {
      name: "DELEGATION DRILL",
      task:
        "Turn one task into a clear three-step handoff or plan: owner, outcome and deadline. Use it or save it for the next opportunity.",
      message:
        "A Commander makes the next move obvious.",
      xp: 35,
      category: "LEARNING",
      proofType: "RESULT",
    },
    {
      name: "AFTER-ACTION REVIEW",
      task:
        "Review one completed task. Record what worked, what failed and the one adjustment you will make next time.",
      message:
        "Review turns activity into command experience.",
      xp: 40,
      category: "LEARNING",
      proofType: "RESULT",
    },
  ],
};

export const MUST_DISCIPLINE = [
  {
    name: "NO ZERO DAY",
    task:
      "Complete one meaningful productive action before the day ends.",
    message:
      "Today is not allowed to disappear without evidence.",
    xp: 60,
    penalty: 25,
    category: "DISCIPLINE",
  },

  {
    name: "CLOSE THE LOOP",
    task:
      "Finish one responsibility you already know should be completed today.",
    message:
      "The System has detected unfinished business.",
    xp: 70,
    penalty: 30,
    category: "DISCIPLINE",
  },

  {
    name: "ORDER BEFORE REST",
    task:
      "Complete your highest-priority responsibility before unnecessary entertainment.",
    message:
      "Earn the rest that comes afterward.",
    xp: 65,
    penalty: 25,
    category: "DISCIPLINE",
  },
];

export const MUST_PHYSICAL = {
  ASSASSIN: [
    {
      name: "FOOTWORK PROTOCOL",
      task:
        "Complete 3 rounds: 60 seconds light footwork, 10 bodyweight squats, 8 controlled push-ups or incline push-ups. Rest 45 seconds between rounds. Finish with a 5-minute brisk walk.",
      message:
        "Speed begins with controlled movement.",
      xp: 65,
      penalty: 25,
      category: "SPEED",
    },

    {
      name: "QUICK BODY",
      task:
        "Complete 20 alternating reverse lunges, 20 mountain climbers per side, 30 seconds plank, then 10 minutes of brisk walking. Move with control, not panic.",
      message:
        "Precision before speed.",
      xp: 65,
      penalty: 25,
      category: "SPEED",
    },

    {
      name: "MOBILITY STRIKE",
      task:
        "Complete 2 rounds: 10 slow squats, 10 scapular push-ups, 30 seconds hip-flexor stretch per side, 30 seconds calf stretch per side, then 5 minutes easy movement.",
      message:
        "A restricted body cannot move cleanly.",
      xp: 60,
      penalty: 25,
      category: "RECOVERY",
    },
  ],

  TANK: [
    {
      name: "IRON FOUNDATION",
      task:
        "Complete 3 rounds: 10 controlled push-ups or incline push-ups, 15 bodyweight squats, 30-second plank. Rest 60 seconds between rounds.",
      message:
        "Build the frame before loading the frame.",
      xp: 65,
      penalty: 25,
      category: "STRENGTH",
    },

    {
      name: "STRUCTURAL CHECK",
      task:
        "Complete 3 sets of 12 squats, 3 sets of 8 push-ups or incline push-ups, and 3 sets of a 20-second side plank per side. Rest as needed.",
      message:
        "Durability is maintained, not assumed.",
      xp: 70,
      penalty: 25,
      category: "STRENGTH",
    },

    {
      name: "RECOVERY ARMOR",
      task:
        "Walk for 15 minutes, then complete 5 minutes of gentle shoulder, hip and ankle mobility. No max-effort work required.",
      message:
        "Recovery is part of strength.",
      xp: 60,
      penalty: 25,
      category: "RECOVERY",
    },
  ],

  MAGE: [
    {
      name: "BODY / MIND RESET",
      task:
        "Walk briskly for 15 minutes, then complete 2 rounds of 10 bodyweight squats, a 20-second plank and 10 shoulder circles each direction.",
      message:
        "A clear mind still requires a functioning body.",
      xp: 60,
      penalty: 25,
      category: "RECOVERY",
    },

    {
      name: "COGNITIVE MOBILITY",
      task:
        "Complete 10 minutes of walking plus 5 minutes of mobility: 30 seconds hip-flexor stretch per side, 30 seconds calf stretch per side, 10 thoracic rotations per side and 10 slow squats.",
      message:
        "Restore circulation. Return sharper.",
      xp: 60,
      penalty: 25,
      category: "RECOVERY",
    },

    {
      name: "SCHOLAR'S CIRCUIT",
      task:
        "Complete 2 rounds: 8 controlled push-ups or incline push-ups, 12 squats, 20-second plank and 60 seconds easy marching. Rest 45 seconds between rounds.",
      message:
        "Intelligence does not excuse physical neglect.",
      xp: 65,
      penalty: 25,
      category: "ENDURANCE",
    },
  ],

  RANGER: [
    {
      name: "BASE DISTANCE",
      task:
        "Complete 20 minutes of continuous walking or easy jogging. You must remain able to speak in short sentences throughout.",
      message:
        "The first weapon of endurance is pacing.",
      xp: 65,
      penalty: 25,
      category: "ENDURANCE",
    },

    {
      name: "PACE CONTROL",
      task:
        "Complete 5 minutes easy walking, 10 minutes brisk walking or easy jogging, then 5 minutes easy walking. Do not turn the middle block into a sprint.",
      message:
        "Control the pace. Own the distance.",
      xp: 65,
      penalty: 25,
      category: "ENDURANCE",
    },

    {
      name: "TRAIL LEGS",
      task:
        "Complete 3 rounds: 12 bodyweight squats, 10 reverse lunges per side and 20 calf raises. Rest 60 seconds between rounds, then walk for 5 minutes.",
      message:
        "Prepare the legs for distance.",
      xp: 70,
      penalty: 25,
      category: "ENDURANCE",
    },
  ],

  COMMANDER: [
    {
      name: "COMMAND BODY",
      task:
        "Complete 3 rounds: 10 push-ups or incline push-ups, 12 squats and a 25-second plank. Rest 60 seconds between rounds.",
      message:
        "You cannot command what you consistently neglect.",
      xp: 65,
      penalty: 25,
      category: "DISCIPLINE",
    },

    {
      name: "FIELD READINESS",
      task:
        "Complete a 15-minute brisk walk, then 2 rounds of 10 squats and 8 controlled push-ups or incline push-ups.",
      message:
        "Readiness is a daily standard.",
      xp: 65,
      penalty: 25,
      category: "ENDURANCE",
    },

    {
      name: "MAINTENANCE ORDER",
      task:
        "Complete 10 minutes of easy walking and 5 minutes of shoulder, hip and ankle mobility. This is a maintenance order, not a max-effort session.",
      message:
        "Preserve the asset.",
      xp: 60,
      penalty: 25,
      category: "RECOVERY",
    },
  ],
};

export const MUST_FOCUS = [
  {
    name: "FOCUS BLOCK",
    task:
      "Complete one uninterrupted 30-minute focused work block.",
    message:
      "Thirty minutes. One objective. Execute.",
    xp: 65,
    penalty: 25,
    category: "FOCUS",
  },

  {
    name: "IMPORTANT FIRST",
    task:
      "Spend at least 25 minutes on the most important unfinished responsibility.",
    message:
      "Do not allow minor tasks to protect the major one.",
    xp: 70,
    penalty: 30,
    category: "FOCUS",
  },

  {
    name: "MENTAL LOCK",
    task:
      "Choose one task and work without unnecessary switching for 30 minutes.",
    message:
      "Attention is a weapon. Stop dropping it.",
    xp: 65,
    penalty: 25,
    category: "FOCUS",
  },
];

export function inferAdaptiveQuestCategory(quest, fallback = "DISCIPLINE") {
  const explicit = String(quest?.category || "").toUpperCase();
  if (explicit) return explicit;

  const name = String(quest?.name || "").toUpperCase();
  if (name.includes("MEMORY") || name.includes("COGNITIVE") || name.includes("KNOWLEDGE")) return "INTELLIGENCE";
  if (name.includes("FOCUS") || name.includes("DEEP") || name.includes("PRECISION") || name.includes("TACTICAL")) return "FOCUS";
  if (name.includes("MOVEMENT") || name.includes("SHADOW")) return "SPEED";
  if (name.includes("WALK") || name.includes("PACE") || name.includes("MOVING") || name.includes("DISTANCE")) return "ENDURANCE";
  if (name.includes("BODY") || name.includes("FORTRESS") || name.includes("IRON")) return "STRENGTH";
  return fallback;
}

export function buildAdaptiveQuestCatalog(profile) {
  const date = todayKey();
  const path = PATHS[profile?.path] ? profile.path : "COMMANDER";
  const daily = scheduleDailyQuest(profile);

  const classPool = (CLASS_QUESTS[path] || []).map((quest, index) => ({
    ...quest,
    id: `CLASS-${path}-${index}`,
    type: "CLASS",
    category: inferAdaptiveQuestCategory(quest, PATHS[path].bonus),
    difficulty: Number(quest.xp || 0) >= 45 ? "NORMAL" : "EASY",
    classBonus: [path],
    minLevel: 1,
  }));

  const todayMusts = [
    { id: "MUST-DISCIPLINE", type: "MUST", ...pick(MUST_DISCIPLINE, date + path + "must1") },
    { id: "MUST-PHYSICAL", type: "MUST", ...pick(MUST_PHYSICAL[path] || MUST_PHYSICAL.COMMANDER, date + path + "must2"), classBonus: [path] },
    { id: "MUST-FOCUS", type: "MUST", ...pick(MUST_FOCUS, date + path + "must3") },
  ].map((quest) => ({
    ...quest,
    category: inferAdaptiveQuestCategory(quest, "DISCIPLINE"),
    difficulty: Number(quest.xp || 0) >= 70 ? "HARD" : "NORMAL",
    minLevel: 1,
  }));

  return [
    { ...daily, id: "DAILY-WAKE", type: "DAILY", category: "DISCIPLINE", difficulty: "EASY", minLevel: 1 },
    ...todayMusts,
    ...classPool,
  ];
}

export const RARE_EVENT_SCAN = {
  chance:
    0.15,
  cooldownHours:
    4,
  maxScansPerDay:
    3,
};

export const EVENT_QUESTS = [
  {
    name: "THE 15 MINUTE WINDOW",
    task:
      "Choose one small unfinished task and finish it completely.",
    seconds: 15 * 60,
    xp: 120,
  },

  {
    name: "ZERO DISTRACTION",
    task:
      "Work on one meaningful task without checking another app or site.",
    seconds: 20 * 60,
    xp: 150,
  },

  {
    name: "RAPID RESET",
    task:
      "Clean and organize your immediate environment.",
    seconds: 10 * 60,
    xp: 100,
  },

  {
    name: "QUICK MARCH",
    task:
      "Complete an appropriate brisk movement session.",
    seconds: 15 * 60,
    xp: 120,
  },
];

export const SYSTEM_LOOT = [
  {
    id: "runner-edge",
    name: "RUNNER'S EDGE",
    rarity: "RARE",
    type: "GEAR",
    level: 5,
    power: 18,
    bonus: "+5 SPEED",
    icon: "◈",
  },
  {
    id: "iron-key",
    name: "IRON KEY",
    rarity: "EPIC",
    type: "KEY",
    level: 10,
    power: 35,
    bonus: "+8 STRENGTH",
    icon: "◆",
  },
  {
    id: "focus-crystal",
    name: "FOCUS CRYSTAL",
    rarity: "LEGENDARY",
    type: "ARTIFACT",
    level: 20,
    power: 60,
    bonus: "+10 FOCUS",
    icon: "✦",
  },
  {
    id: "vanguard-emblem",
    name: "VANGUARD EMBLEM",
    rarity: "EPIC",
    type: "EMBLEM",
    level: 30,
    power: 85,
    bonus: "+10 DISCIPLINE",
    icon: "⚜",
  },
  {
    id: "ascendant-core",
    name: "ASCENDANT CORE",
    rarity: "MYTHIC",
    type: "CORE",
    level: 50,
    power: 140,
    bonus: "+15 ALL ROUND",
    icon: "⬢",
  },
];

export const RARITY_COLORS = {
  RARE: "#3b82f6",
  EPIC: "#a855f7",
  LEGENDARY: "#f59e0b",
  MYTHIC: "#ef4444",
};

export const EVOLUTIONS = {
  ASSASSIN: {
    title: "VOID REAPER",
    icon: "♠",
    identity:
      "The shadow no longer follows you. It answers to you.",
  },
  TANK: {
    title: "IRON COLOSSUS",
    icon: "⬢",
    identity:
      "Endurance has become authority.",
  },
  MAGE: {
    title: "ARCANE SOVEREIGN",
    icon: "✧",
    identity:
      "Knowledge is no longer collected. It is commanded.",
  },
  RANGER: {
    title: "WILDBOUND HUNTER",
    icon: "⌖",
    identity:
      "Distance, terrain and fatigue have become familiar territory.",
  },
  COMMANDER: {
    title: "SOVEREIGN COMMANDER",
    icon: "♛",
    identity:
      "The System now recognizes command as your natural state.",
  },
};

export const BOSS_XP = {
  C: 250,
  B: 450,
  A: 700,
  S: 1200,
};

export const BOSS_HP = {
  E: 100,
  D: 160,
  C: 240,
  B: 340,
  A: 480,
  S: 650,
};

export function bossDamageFromTraining(workout) {
  const xp =
    Math.max(
      0,
      Number(workout?.xp) || 0
    );

  const base =
    Math.max(
      8,
      Math.min(
        34,
        Math.round(
          8 + xp / 8
        )
      )
    );

  return base;
}

export const BOSS_RARITY = {
  C: "RARE",
  B: "EPIC",
  A: "LEGENDARY",
  S: "MYTHIC",
};

export const SYSTEM_BOSS_LIBRARY = {
  ASSASSIN: [
    {
      name: "SHADOW ASCENSION",
      category: "SPEED",
      objectives: [
        "Complete 3 speed or explosive training sessions.",
        "Finish one difficult responsibility before recreation on 3 separate days.",
        "Complete one 30-minute uninterrupted focus block after physical training.",
      ],
    },
    {
      name: "SILENT EXECUTION PROTOCOL",
      category: "DISCIPLINE",
      objectives: [
        "Complete 5 priority tasks without postponing them to the next day.",
        "Complete 2 high-intensity movement sessions.",
        "Maintain your planned routine for 4 consecutive days.",
      ],
    },
    {
      name: "CRIMSON HUNT",
      category: "SPEED",
      objectives: [
        "Complete one sprint or fast-footwork session.",
        "Complete one endurance session of at least 25 minutes.",
        "Complete one difficult task immediately when the System assigns it.",
      ],
    },
  ],

  TANK: [
    {
      name: "IRON FORTRESS",
      category: "STRENGTH",
      objectives: [
        "Complete 3 strength-focused training sessions.",
        "Complete one lower-body endurance session.",
        "Finish 4 planned responsibilities before ending the day.",
      ],
    },
    {
      name: "COLOSSUS TRIAL",
      category: "STRENGTH",
      objectives: [
        "Complete 100 total controlled push-up repetitions across the raid.",
        "Complete 150 total squat repetitions across the raid.",
        "Complete one 30-minute continuous walk or equivalent endurance session.",
      ],
    },
    {
      name: "HOLD THE LINE",
      category: "DISCIPLINE",
      objectives: [
        "Complete your planned routine for 5 consecutive days.",
        "Complete 2 difficult strength sessions.",
        "Finish one responsibility you have delayed for at least a week.",
      ],
    },
  ],

  MAGE: [
    {
      name: "ARCANE SIEGE",
      category: "INTELLIGENCE",
      objectives: [
        "Complete 3 focused study sessions of at least 45 minutes each.",
        "Produce one written synthesis of what you learned.",
        "Teach or explain one studied concept clearly in your own words.",
      ],
    },
    {
      name: "TOWER OF KNOWLEDGE",
      category: "FOCUS",
      objectives: [
        "Complete 4 deep-work sessions without unnecessary task switching.",
        "Create one structured set of notes from a serious learning source.",
        "Apply one learned idea to a real task, project, or decision.",
      ],
    },
    {
      name: "MIND SOVEREIGN TRIAL",
      category: "INTELLIGENCE",
      objectives: [
        "Study one subject for a total of at least 3 hours across the raid.",
        "Complete one active-recall session without looking at your notes first.",
        "Create a final summary containing the key principles and an application plan.",
      ],
    },
  ],

  RANGER: [
    {
      name: "HORIZON RAID",
      category: "ENDURANCE",
      objectives: [
        "Complete a GPS-verified 2 KM movement session.",
        "Complete a second movement session longer than the first.",
        "Accumulate at least 5 KM of total GPS-verified movement during the raid.",
      ],
    },
    {
      name: "WILDBOUND TRIAL",
      category: "ENDURANCE",
      objectives: [
        "Complete 3 outdoor movement sessions.",
        "Complete one continuous session of at least 30 minutes.",
        "Complete one mobility or recovery session after training.",
      ],
    },
    {
      name: "DISTANCE BREAKER",
      category: "ENDURANCE",
      objectives: [
        "Complete one GPS-verified 3 KM session.",
        "Complete one separate 20-minute continuous movement session.",
        "Finish the raid with no skipped planned movement day.",
      ],
    },
  ],

  COMMANDER: [
    {
      name: "SOVEREIGN ORDER",
      category: "DISCIPLINE",
      objectives: [
        "Complete 5 high-priority responsibilities before recreation.",
        "Maintain your planned routine for 5 consecutive days.",
        "Complete one task that has remained unfinished for at least one week.",
      ],
    },
    {
      name: "WAR ROOM PROTOCOL",
      category: "FOCUS",
      objectives: [
        "Complete 3 uninterrupted tactical work blocks of at least 60 minutes.",
        "Organize one area of work or life that is currently causing friction.",
        "Finish one major responsibility from start to final result.",
      ],
    },
    {
      name: "COMMANDER'S GAUNTLET",
      category: "DISCIPLINE",
      objectives: [
        "Complete one physical training session.",
        "Complete one deep-focus work session.",
        "Complete one responsibility you would normally postpone.",
        "Maintain your planned wake or sleep routine for 3 consecutive days.",
      ],
    },
  ],
};

export function systemBossRank(level) {
  const value =
    Number(level || 1);

  if (value >= 70) {
    return "S";
  }

  if (value >= 45) {
    return "A";
  }

  if (value >= 25) {
    return "B";
  }

  return "C";
}

export function systemBossDeadline(rank) {
  const days = {
    C: 5,
    B: 7,
    A: 10,
    S: 14,
  }[rank] || 7;

  const deadline =
    new Date();

  deadline.setDate(
    deadline.getDate() +
    days
  );

  return deadline
    .toISOString()
    .slice(0, 10);
}

export const REWARD_CATALOG = {
  ENDURANCE: [
    "Recovery meal",
    "Hydration upgrade",
    "New running socks",
    "Mobility or recovery session",
    "Useful running accessory",
  ],
  STRENGTH: [
    "Training accessory",
    "Resistance band",
    "Grip or wrist accessory",
    "High-protein meal",
    "New training clothing",
  ],
  SPEED: [
    "Light training gear",
    "Footwork accessory",
    "Sports socks",
    "Recovery snack",
    "New performance accessory",
  ],
  INTELLIGENCE: [
    "Premium notebook",
    "Learning resource",
    "Desk upgrade",
    "Course credit",
    "Useful study accessory",
  ],
  FOCUS: [
    "Noise-control accessory",
    "Desk organization upgrade",
    "Premium notebook",
    "Focused-work café session",
    "Useful productivity accessory",
  ],
  DISCIPLINE: [
    "Planned favorite meal",
    "Small everyday upgrade",
    "Guilt-free entertainment block",
    "Useful clothing item",
    "Personal care upgrade",
  ],
  WEALTH: [
    "Small planned celebration",
    "Useful purchase already in budget",
    "Savings milestone token",
    "Quality everyday upgrade",
    "Low-cost experience",
  ],
  CHARISMA: [
    "Grooming upgrade",
    "New outfit piece",
    "Social experience",
    "Fragrance or care item",
    "Professional accessory",
  ],
  CREATIVITY: [
    "Design resource",
    "Creative tool",
    "Sketchbook",
    "Print or art material",
    "Creative experience",
  ],
  RECOVERY: [
    "Recovery meal",
    "Massage or recovery session",
    "Sleep accessory",
    "Mobility tool",
    "Relaxing low-stress experience",
  ],
  OTHER: [
    "Favorite meal",
    "Useful accessory",
    "Small experience",
    "Personal upgrade",
    "Milestone token",
  ],
};

export const PERFORMANCE_METRICS = [
  ["BODY WEIGHT", "kg"],
  ["RUN DISTANCE", "km"],
  ["RUN TIME", "min"],
  ["PUSH-UPS", "reps"],
  ["PULL-UPS", "reps"],
  ["HANDSTAND", "sec"],
  ["PLANK", "sec"],
  ["SLEEP", "hours"],
  ["WATER", "L"],
  ["CUSTOM", ""],
];

export const WEALTH_TYPES = [
  "SAVINGS",
  "INCOME",
  "DEBT CLEARED",
  "INVESTMENT",
  "CHAMA",
  "OTHER",
];

export const GOAL_CATEGORIES = [
  "STRENGTH",
  "SPEED",
  "ENDURANCE",
  "INTELLIGENCE",
  "FOCUS",
  "DISCIPLINE",
  "WEALTH",
  "CHARISMA",
  "CREATIVITY",
  "RECOVERY",
  "OTHER",
];

export const SYSTEM_SINGLE_FLIGHTS =
  new Map();

export function runSystemSingleFlight(
  key,
  task
) {
  const existing =
    SYSTEM_SINGLE_FLIGHTS.get(
      key
    );

  if (existing) {
    return existing;
  }

  let flight;

  flight =
    Promise.resolve()
      .then(task)
      .finally(() => {
        if (
          SYSTEM_SINGLE_FLIGHTS.get(
            key
          ) === flight
        ) {
          SYSTEM_SINGLE_FLIGHTS.delete(
            key
          );
        }
      });

  SYSTEM_SINGLE_FLIGHTS.set(
    key,
    flight
  );

  return flight;
}

export function evolutionFor(profile) {
  return (
    EVOLUTIONS[profile.path] ||
    EVOLUTIONS.COMMANDER
  );
}

export function suggestReward(
  category,
  seed = String(Date.now())
) {
  const list =
    REWARD_CATALOG[category] ||
    REWARD_CATALOG.OTHER;

  return pick(
    list,
    category + "-" + seed
  );
}

export function addHistory(
  profile,
  type,
  title,
  detail = ""
) {
  return {
    ...profile,
    history: [
      {
        id: uid("H"),
        type,
        title,
        detail,
        date:
          new Date().toISOString(),
      },
      ...(profile.history || []),
    ],
  };
}

export function addReward(
  profile,
  {
    name,
    category = "OTHER",
    source = "SYSTEM",
    status = "UNCLAIMED",
  } = {}
) {
  return {
    ...profile,
    rewards: [
      {
        id: uid("R"),
        name:
          name ||
          suggestReward(category),
        category,
        source,
        status,
        date:
          new Date().toISOString(),
      },
      ...(profile.rewards || []),
    ],
  };
}

export async function imageData(file) {
  if (
    !file ||
    !file.type?.startsWith(
      "image/"
    )
  ) {
    return "";
  }

  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const img =
          new Image();

        img.onload = () => {
          const max = 720;

          const scale =
            Math.min(
              1,
              max /
                Math.max(
                  img.width,
                  img.height
                )
            );

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            Math.max(
              1,
              Math.round(
                img.width *
                  scale
              )
            );

          canvas.height =
            Math.max(
              1,
              Math.round(
                img.height *
                  scale
              )
            );

          const ctx =
            canvas.getContext(
              "2d"
            );

          ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.66
            )
          );
        };

        img.onerror =
          reject;

        img.src =
          reader.result;
      };

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}

export function pick(items, seed) {
  return items[
    hashString(seed) %
      items.length
  ];
}

export function addXP(
  profile,
  amount
) {
  let xp =
    Math.max(
      0,
      profile.xp + amount
    );

  let level =
    profile.level;

  while (
    xp >=
    xpRequired(level)
  ) {
    xp -=
      xpRequired(level);

    level += 1;
  }

  if (
    level >
    profile.level
  ) {
    playSFX(
      "levelup",
      soundtrackVolume(localStorage.getItem("systemSfxVolume"), 0.7)
    );
  }

  return {
    ...profile,
    xp,
    level,
  };
}

export function formatTimer(seconds) {
  const safe =
    Math.max(0, seconds);

  const min =
    Math.floor(safe / 60);

  const sec =
    safe % 60;

  return (
    String(min).padStart(
      2,
      "0"
    ) +
    ":" +
    String(sec).padStart(
      2,
      "0"
    )
  );
}

export const CLASS_MUSIC = {
  ASSASSIN: {
    title:
      "Algorithm Runner",
    artist:
      "JoelFazhari",
    src:
      "/music/assassin.mp3",
  },

  TANK: {
    title:
      "Tank Battle",
    artist:
      "mmutube84",
    src:
      "/music/tank.mp3",
  },

  MAGE: {
    title:
      "Mysterious Mystical Ambient",
    artist:
      "DELOSound",
    src:
      "/music/mage.mp3",
  },

  RANGER: {
    title:
      "Adventure Documentary",
    artist:
      "leberch",
    src:
      "/music/ranger.mp3",
  },

  COMMANDER: {
    title:
      "Military — War Military",
    artist:
      "YevhenAstafiev",
    src:
      "/music/commander.mp3",
  },
};

export const SFX_FILES = {
  click:
    "/sfx/click.wav",
  tab:
    "/sfx/click.wav",
  success:
    "/sfx/success.wav",
  must:
    "/sfx/impact.wav",
  event:
    "/sfx/impact.wav",
  decline:
    "/sfx/impact.wav",
  danger:
    "/sfx/impact.wav",
  levelup:
    "/sfx/levelup.wav",
};

export let systemAudioContext = null;

export function getSystemAudioContext() {
  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!systemAudioContext) {
    systemAudioContext =
      new AudioContextClass();
  }

  if (
    systemAudioContext.state ===
    "suspended"
  ) {
    systemAudioContext
      .resume()
      .catch(() => {});
  }

  return systemAudioContext;
}

export function cinematicPulse(
  frequency,
  duration,
  volume,
  detune = 0
) {
  const ctx =
    getSystemAudioContext();

  if (!ctx) return;

  const osc =
    ctx.createOscillator();

  const gain =
    ctx.createGain();

  const filter =
    ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.value =
    frequency;
  osc.detune.value =
    detune;

  filter.type =
    "lowpass";
  filter.frequency.value =
    Math.max(
      180,
      frequency * 4
    );

  const now =
    ctx.currentTime;

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    Math.max(
      0.0001,
      volume
    ),
    now + 0.018
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(
    ctx.destination
  );

  osc.start(now);
  osc.stop(
    now +
      duration +
      0.03
  );
}

export function cinematicNoise(
  duration,
  volume,
  cutoff
) {
  const ctx =
    getSystemAudioContext();

  if (!ctx) return;

  const frameCount =
    Math.floor(
      ctx.sampleRate *
        duration
    );

  const buffer =
    ctx.createBuffer(
      1,
      frameCount,
      ctx.sampleRate
    );

  const data =
    buffer.getChannelData(
      0
    );

  for (
    let i = 0;
    i < frameCount;
    i += 1
  ) {
    const fade =
      1 -
      i /
        frameCount;

    data[i] =
      (Math.random() * 2 -
        1) *
      fade;
  }

  const source =
    ctx.createBufferSource();

  const filter =
    ctx.createBiquadFilter();

  const gain =
    ctx.createGain();

  source.buffer =
    buffer;

  filter.type =
    "lowpass";
  filter.frequency.value =
    cutoff;

  const now =
    ctx.currentTime;

  gain.gain.setValueAtTime(
    volume,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(
    ctx.destination
  );

  source.start(now);
}

export function proceduralSFX(
  type,
  volume = 0.7
) {
  const safe =
    Math.max(
      0,
      Math.min(
        1,
        Number(volume) || 0
      )
    );

  if (type === "click") {
    cinematicPulse(
      460,
      0.055,
      0.035 * safe
    );
    return;
  }

  if (type === "tab") {
    cinematicPulse(
      520,
      0.07,
      0.03 * safe
    );
    cinematicPulse(
      690,
      0.08,
      0.02 * safe,
      6
    );
    return;
  }

  if (
    type === "success"
  ) {
    cinematicPulse(
      520,
      0.22,
      0.055 * safe
    );
    setTimeout(
      () =>
        cinematicPulse(
          780,
          0.24,
          0.045 * safe
        ),
      70
    );
    return;
  }

  if (
    type === "must" ||
    type === "event" ||
    type === "danger"
  ) {
    cinematicNoise(
      0.28,
      0.035 * safe,
      420
    );

    cinematicPulse(
      type === "danger"
        ? 46
        : 58,
      type === "danger"
        ? 0.7
        : 0.45,
      0.11 * safe
    );
    return;
  }

  if (
    type === "levelup"
  ) {
    cinematicPulse(
      260,
      0.35,
      0.055 * safe
    );
    setTimeout(
      () =>
        cinematicPulse(
          520,
          0.38,
          0.05 * safe
        ),
      85
    );
    setTimeout(
      () =>
        cinematicPulse(
          1040,
          0.42,
          0.04 * safe
        ),
      165
    );
    return;
  }

  cinematicPulse(
    420,
    0.06,
    0.03 * safe
  );
}

export function playSFX(
  type,
  volume = 0.7
) {
  if (
    localStorage.getItem(
      "systemSfx"
    ) === "off"
  ) {
    return;
  }

  const src =
    SFX_FILES[type] ||
    SFX_FILES.click;

  const audio =
    new Audio(src);

  audio.volume =
    Math.max(
      0,
      Math.min(
        1,
        Number(volume) || 0
      )
    );

  let fallbackUsed =
    false;

  function fallback() {
    if (fallbackUsed) {
      return;
    }

    fallbackUsed =
      true;

    proceduralSFX(
      type,
      volume
    );
  }

  audio.addEventListener(
    "error",
    fallback,
    { once: true }
  );

  audio
    .play()
    .catch(fallback);
}

export function ButtonSFX({
  enabled,
  volume,
}) {
  useEffect(() => {
    function handle(event) {
      if (!enabled) return;

      const button =
        event.target.closest(
          "button"
        );

      if (
        !button ||
        button.disabled
      ) {
        return;
      }

      playSFX(
        button.dataset.sfx ||
          "click",
        volume
      );
    }

    document.addEventListener(
      "pointerdown",
      handle
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handle
      );
    };
  }, [
    enabled,
    volume,
  ]);

  return null;
}

export const CLASS_BACKGROUND_MUSIC = CLASS_TRACKS;

export function MusicEngine({ enabled, volume, path, onStatus }) {
  const controller = useRef(null);
  const statusHandler = useRef(onStatus);
  const config = useRef({ enabled, volume, path });
  config.current = { enabled, volume, path };
  statusHandler.current = onStatus;
  useEffect(() => {
    const soundtrack = createClassSoundtrack({ createAudio: src => new Audio(src), onStatus: status => statusHandler.current?.(status) });
    controller.current = soundtrack;
    soundtrack.setVisible(document.visibilityState !== "hidden");
    soundtrack.configure(config.current);
    const intent = event => soundtrack.setEnabled(event?.detail?.enabled === true);
    const visibility = () => soundtrack.setVisible(document.visibilityState !== "hidden");
    window.addEventListener("system-music-intent", intent);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("system-music-intent", intent);
      document.removeEventListener("visibilitychange", visibility);
      controller.current = null;
      soundtrack.dispose();
    };
  }, []);
  useEffect(() => { controller.current?.configure({ enabled, volume, path }); }, [enabled, volume, path]);
  return null;
}

export async function deleteCloudProfile() {
  const user =
    await getCloudUser();

  if (!user) {
    return;
  }

  const tables = [
    "progression_events",
    "attributes",
    "profiles",
  ];

  for (
    const table
    of tables
  ) {
    const key =
      table ===
      "profiles"
        ? "id"
        : "user_id";

    const {
      error,
    } =
      await supabase
        .from(
          table
        )
        .delete()
        .eq(
          key,
          user.id
        );

    if (error) {
      throw error;
    }
  }
}

export async function systemSignOut() {
  localStorage.removeItem("systemProfile");
  const { error } = await supabase.auth.signOut();
  if (error) console.error("SYSTEM SIGN OUT FAILED:", error.message);
}

export function TopBar({
  profile,
  theme,
  setTheme,
  openOptions,
}) {
  const path =
    PATHS[
      profile.path
    ];

  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-symbol">
          S
        </div>

        <div>
          <strong>
            SYSTEM
          </strong>

          <small>
            REAL LIFE // RPG • 2.10.0
          </small>
        </div>
      </div>

      <div className="system-online">
        ● SYSTEM ONLINE
      </div>

      <div className="top-actions">
        <button
          data-sfx="click"
          type="button"
          className="theme-ghost-control"
          aria-label="Toggle interface theme"
          onClick={() =>
            setTheme(
              theme ===
                "dark"
                ? "light"
                : "dark"
            )
          }
        >
          {theme ===
          "dark"
            ? "☀"
            : "☾"}
        </button>

        <button
          data-sfx="click"
          type="button"
          className="player-crest-button"
          aria-label="Open player profile"
          onClick={(event) => {
            event.stopPropagation();
            openOptions();
          }}
        >
          <span className="player-crest-symbol">
            {path.icon}
          </span>

          <span className="player-crest-copy">
            <strong>
              {profile.name}
            </strong>

            <small>
              {path.name} • LV {profile.level} • PROFILE
            </small>
          </span>
        </button>
      </div>
    </header>
  );
}

export function Navigation({
  tab,
  setTab,
  profile,
}) {
  const tabs = [
    [
      "dashboard",
      "◈",
      "DASHBOARD",
    ],
    [
      "attributes",
      "◇",
      "ATTRIBUTES",
    ],
    [
      "quests",
      "⚔",
      "QUESTS",
    ],
    [
      "training",
      "✦",
      "TRAINING",
    ],
    [
      "class-training",
      "✧",
      "CLASS SPECIAL",
    ],
    [
      "fuel",
      "◒",
      "FUEL SYSTEM",
    ],
    ...(
      profile?.path ===
      "MAGE"
        ? [
            [
              "archive",
              "▤",
              "GRAND ARCHIVE",
            ],
          ]
        : []
    ),
    [
      "progress",
      "▣",
      "PROGRESS",
    ],
    [
      "inventory",
      "◆",
      "INVENTORY",
    ],
    [
      "journey",
      "◎",
      "JOURNEY",
    ],
    [
      "trophies",
      "♜",
      "TROPHY ROOM",
    ],
    [
      "system",
      "⌁",
      "SYSTEM",
    ],
  ];

  return (
    <nav className="navigation">
      {tabs.map(
        ([
          id,
          icon,
          title,
        ]) => (
          <button
            data-sfx="tab"
            type="button"
            key={id}
            className={
              tab === id
                ? "active"
                : ""
            }
            onClick={() =>
              setTab(id)
            }
          >
            <span>
              {icon}
            </span>

            {title}
          </button>
        )
      )}
    </nav>
  );
}

export function DailySystemBriefing({
  profile,
  awareness,
  dailyCommand,
  dailyCommandStatus,
  refreshDailyCommand,
  setTab,
}) {
  if (!awareness) return null;

  const briefing = awareness.briefing;
  const commandReady =
    dailyCommand?.status === "READY";
  const fuel = normalizeFuelState(profile.fuel);
  const fuelToday = summarizeFuelDay(fuel.logs[todayKey()], fuel.calorieTarget, fuel.proteinTarget);
  const recovery = awareness.recoveryDirective;
  const mustDirective =
    commandReady
      ? dailyCommand.must_directive ||
        null
      : null;
  const classDirective =
    commandReady
      ? dailyCommand.class_directive ||
        null
      : null;
  const unspentCredits = Math.max(
    0,
    Number(
      dailyCommand?.progress
        ?.unspent_credits
    ) || 0
  );

  const mustReward =
    mustDirective?.status ===
    "ACTIVE"
      ? "+" +
        Number(
          mustDirective.xp ||
            0
        ) +
        " XP" +
        (
          Number(
            mustDirective.penalty ||
              0
          ) > 0
            ? " • -" +
              Number(
                mustDirective.penalty
              ) +
              " XP IF FAILED"
            : ""
        )
      : "ACCEPT WHEN READY";

  const classReward =
    classDirective?.status ===
    "COMPLETE"
      ? "DIRECTIVE COMPLETE"
      : "+" +
        Number(
          classDirective?.xp ||
            0
        ) +
        " XP";

  return (
    <section className="system-awareness-briefing daily-command-briefing card3d">
      <div className="system-awareness-briefing-head">
        <div>
          <small>
            {commandReady
              ? "DAILY COMMAND // BACKEND SYNCHRONIZED"
              : "DAILY SYSTEM BRIEFING // AWARENESS ONLINE"}
          </small>
          <h2>
            {briefing.greeting}, {briefing.player}
          </h2>
        </div>
        <span className={awareness.activeNow ? "is-active" : "is-idle"}>
          {awareness.activeNow ? "● COUNTING ACTIVE TIME" : "Ⅱ ACTIVITY PAUSED"}
        </span>
      </div>

      {commandReady ? (
        <div className="daily-command-grid">
          <article className="daily-command-slot must">
            <small>01 // MUST DIRECTIVE</small>
            <strong>{mustDirective?.title || "NO MUST DIRECTIVE ACTIVE"}</strong>
            <p>{mustDirective?.objective || "Open the Quest Board when you are ready to accept a 24-hour directive."}</p>
            <div>
              <span>{mustDirective?.status === "ACTIVE" ? "ACTIVE • 24-HOUR CONTRACT" : "STANDBY"}</span>
              <b>{mustReward}</b>
            </div>
          </article>

          <article className="daily-command-slot class">
            <small>02 // CLASS ACTION</small>
            <strong>{classDirective?.title || "CLASS DIRECTIVE UNAVAILABLE"}</strong>
            <p>{classDirective?.objective || "The class catalogue is synchronizing. Retry without resetting progression."}</p>
            <div>
              <span>{classDirective?.rotation_mode === "UNUSED_7_DAY_ROTATION" ? "FRESH 7-DAY ROTATION" : "CLASS-ALIGNED"}</span>
              <b>{classReward}</b>
            </div>
          </article>

          <article className="daily-command-slot progress">
            <small>03 // FUEL & RECOVERY</small>
            <strong>{recovery ? recovery.target : fuel.goal + " • LOG YOUR NEXT MEAL"}</strong>
            <p>
              {recovery ? recovery.task : fuel.calorieTarget > 0
                ? `${fuelToday.calories} of ${fuel.calorieTarget} kcal logged. ${fuelToday.protein}g of ${fuel.proteinTarget || "—"}g protein. Use your ${profile.path.toLowerCase()} meal plan for the next meal.`
                : "Set your calorie and protein targets in Fuel, then log what you actually eat."}
            </p>
            <div>
              <span>LEVEL {dailyCommand?.progress?.level ?? profile.level} • {dailyCommand?.progress?.streak ?? profile.streak} DAY STREAK</span>
              <b>{fuel.goal} • PERSONAL LOG</b>
            </div>
            <button type="button" className="system-awareness-open" onClick={() => setTab("fuel")}>OPEN FUEL PLAN</button>
          </article>
        </div>
      ) : (
        <div className="system-awareness-briefing-body">
          <div className="system-awareness-active-time">
            <small>ACTIVE TODAY</small>
            <strong>{awareness.activeTodayLabel}</strong>
            <span>{briefing.activeDays} / 7 ACTIVE DAYS</span>
          </div>

          <div className="system-awareness-briefing-lines">
            {briefing.lines.slice(0, 3).map((line, index) => (
              <p key={`${line}-${index}`}><span>0{index + 1}</span>{line}</p>
            ))}
          </div>
        </div>
      )}

      {dailyCommandStatus === "LOADING" && (
        <div className="daily-command-sync-note">
          SYNCHRONIZING LIVE COMMAND — LOCAL AWARENESS REMAINS AVAILABLE.
        </div>
      )}

      {dailyCommandStatus === "ERROR" && (
        <div className="daily-command-sync-note is-error">
          LIVE COMMAND COULD NOT BE READ. NO PROGRESSION WAS CHANGED.
        </div>
      )}

      {awareness.recoveryDirective && !commandReady && (
        <div className="system-awareness-recovery-mini">
          <div>
            <small>RECOVERY DIRECTIVE DETECTED</small>
            <strong>{awareness.recoveryDirective.target}</strong>
          </div>
          <p>{awareness.recoveryDirective.task}</p>
        </div>
      )}

      <div className="daily-command-actions">
        <button data-sfx="tab" type="button" className="system-awareness-open" onClick={() => setTab("quests")}>
          OPEN QUEST BOARD
        </button>
        <button data-sfx="tab" type="button" className="system-awareness-open" onClick={() => setTab("attributes")}>
          {unspentCredits > 0 ? `ALLOCATE ${unspentCredits} CREDIT${unspentCredits === 1 ? "" : "S"}` : "OPEN ATTRIBUTES"}
        </button>
        {dailyCommandStatus === "ERROR" && (
          <button data-sfx="tab" type="button" className="system-awareness-open" onClick={refreshDailyCommand}>
            RETRY LIVE COMMAND
          </button>
        )}
      </div>
    </section>
  );
}

export function SystemAwarenessPanel({ awareness }) {
  if (!awareness) return null;
  const trends = awareness.trends;

  return (
    <section className="system-awareness-console card3d">
      <div className="system-awareness-console-head">
        <div>
          <small>SYSTEM AWARENESS 2.4 // MEMORY LAYER</small>
          <h2>THE SYSTEM IS REMEMBERING YOUR PATTERN</h2>
          <p>Active time, activity history and progression snapshots are stored locally on this device. Hidden tabs and idle periods do not count as active time.</p>
        </div>
        <div className="system-awareness-live-core">
          <span className={awareness.activeNow ? "online" : "paused"}>{awareness.activeNow ? "● LIVE" : "Ⅱ PAUSED"}</span>
          <strong>{awareness.activeTodayLabel}</strong>
          <small>ACTIVE TODAY</small>
        </div>
      </div>

      <div className="system-awareness-grid">
        <article className="system-awareness-memory-card">
          <small>14-DAY ACTIVITY MEMORY</small>
          <div className="system-awareness-heatmap">
            {awareness.history.map((day) => (
              <div key={day.key} className={`level-${day.level}`} title={`${day.key} • ${formatAwarenessDuration(day.activeSeconds)} • ${day.eventCount} recorded events`}>
                <i /><span>{day.key.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="system-awareness-legend"><span>LOW</span><i className="level-1"/><i className="level-2"/><i className="level-3"/><i className="level-4"/><span>HIGH</span></div>
        </article>

        <article className="system-awareness-memory-card">
          <small>TREND MEMORY</small>
          {trends.status === "ACTIVE" ? (
            <div className="system-awareness-trends">
              <div><span>IMPROVING</span><strong>{trends.improving?.name || "STABLE"}</strong><b>{trends.improving ? `+${trends.improving.delta}` : "0"}</b></div>
              <div><span>DECLINING</span><strong>{trends.declining?.name || "NONE DETECTED"}</strong><b>{trends.declining ? trends.declining.delta : "0"}</b></div>
              <p>WINDOW // {trends.window}</p>
            </div>
          ) : (
            <div className="system-awareness-collecting"><strong>COLLECTING TREND MEMORY</strong><p>Keep using THE SYSTEM across multiple days. Attribute snapshots will begin showing real direction instead of only the current state.</p></div>
          )}
        </article>
      </div>

      <div className="system-awareness-grid lower">
        <article className="system-awareness-memory-card recovery">
          <small>FAILURE RECOVERY PROTOCOL</small>
          {awareness.recoveryDirective ? (
            <>
              <div className="system-awareness-recovery-badge">{awareness.recoveryDirective.reason}</div>
              <h3>{awareness.recoveryDirective.title}</h3>
              <strong>TARGET // {awareness.recoveryDirective.target}</strong>
              <p>{awareness.recoveryDirective.task}</p>
              <small className="system-awareness-advisory-note">ADVISORY ONLY — THIS DOES NOT AWARD XP OR BYPASS QUEST PROOF.</small>
            </>
          ) : (
            <div className="system-awareness-collecting"><strong>NO RECOVERY DIRECTIVE REQUIRED</strong><p>Momentum and recent activity are inside normal parameters.</p></div>
          )}
        </article>

        <article className="system-awareness-memory-card ascension">
          <small>ASCENSION TELEMETRY</small>
          <div className="system-awareness-ascension-score"><strong>{awareness.ascension.detected}</strong><span>/ {awareness.ascension.total} SIGNALS DETECTED</span></div>
          <div className="system-awareness-ascension-signals">
            {awareness.ascension.signals.map((signal) => <i key={signal.id} className={signal.detected ? "detected" : "locked"}>{signal.detected ? "◆" : "◇"}</i>)}
          </div>
          <p>{awareness.ascension.note}</p>
        </article>
      </div>
    </section>
  );
}

export function AdaptiveIntelligenceSnapshot({ profile, setTab }) {
  const questCatalog = useMemo(
    () => buildAdaptiveQuestCatalog(profile),
    [profile.path, profile.sleepSchedule?.wake, profile.sleepSchedule?.verificationMinutes, profile.level]
  );

  const analytics = useMemo(
    () => getFullAnalytics(profile, { questCatalog, xpRequired, limit: 3, focus: "BALANCED" }),
    [profile, questCatalog]
  );

  const analysis = analytics.profile;
  const topQuest = analytics.recommendations.quests[0];
  const difficulty = analytics.recommendations.difficulty;
  const forecast = analytics.analytics.levelPrediction;
  const alert = analytics.analytics.alerts[0];

  return (
    <section className="adaptive-snapshot card3d">
      <div className="adaptive-snapshot-head">
        <div>
          <small>ADAPTIVE INTELLIGENCE // LIVE ANALYSIS</small>
          <h2>SYSTEM ANALYSIS</h2>
        </div>
        <span className="adaptive-live-chip">● PROFILE ACTIVE</span>
      </div>

      <div className="adaptive-snapshot-grid">
        <article>
          <small>CURRENT STRENGTH</small>
          <strong>{analysis.strengths[0] || "COLLECTING DATA"}</strong>
          <p>{analysis.strengthDetails[0]?.value ?? "--"} ATTRIBUTE POWER</p>
        </article>
        <article>
          <small>CURRENT WEAKNESS</small>
          <strong className="adaptive-warning-text">{analysis.weaknesses[0] || "COLLECTING DATA"}</strong>
          <p>TARGET FOR BALANCED PROGRESSION</p>
        </article>
        <article>
          <small>7-DAY CONSISTENCY</small>
          <strong>{analysis.recentPerformance.consistency}%</strong>
          <p>{analysis.recentPerformance.activeDays} ACTIVE DAYS DETECTED</p>
        </article>
        <article>
          <small>OPTIMAL DIFFICULTY</small>
          <strong>{difficulty.recommendedDifficulty}</strong>
          <p>CONFIDENCE {Math.round(difficulty.confidence * 100)}%</p>
        </article>
      </div>

      {topQuest && (
        <div className="adaptive-primary-directive">
          <div className="adaptive-match-score">
            <strong>{topQuest.matchScore}%</strong>
            <small>MATCH</small>
          </div>
          <div>
            <small>RECOMMENDED DIRECTIVE</small>
            <h3>{topQuest.name}</h3>
            <p>{topQuest.reason}</p>
          </div>
          <div className="adaptive-directive-meta">
            <span>TARGET {topQuest.targetAttribute || topQuest.category}</span>
            <span>{topQuest.difficultyFit || "MATCHED"} FIT</span>
            <span>+{Number(topQuest.xp || 0)} XP</span>
          </div>
        </div>
      )}

      <div className="adaptive-snapshot-foot">
        <div>
          <small>SYSTEM NOTICE</small>
          <strong>{alert?.message || "NO CRITICAL ALERTS. CONTINUE CURRENT DIRECTIVE."}</strong>
        </div>
        <div>
          <small>NEXT LEVEL FORECAST</small>
          <strong>{forecast?.predictions?.realistic?.daysToLevel ? `${forecast.predictions.realistic.daysToLevel} ACTIVE DAYS` : "COLLECTING DATA"}</strong>
        </div>
        <button data-sfx="tab" type="button" onClick={() => setTab("system")}>OPEN FULL ANALYSIS</button>
      </div>
    </section>
  );
}

export function Dashboard({
  profile,
  setTab,
  openRoutine,
  awareness,
  dailyCommand,
  dailyCommandStatus,
  refreshDailyCommand,
}) {
  const path =
    PATHS[
      profile.path
    ];

  const total =
    Object.values(
      effectiveAttributes(profile)
    ).reduce(
      (sum, value) =>
        sum +
        Number(value),
      0
    );

  const required =
    xpRequired(
      profile.level
    );

  const percent =
    Math.min(
      profile.xp /
        required *
        100,
      100
    );

  const ascended =
    profile.level >= 101;

  const evolution =
    evolutionFor(profile);

  const activeBoss =
    profile.bossQuests.find(
      (boss) =>
        boss.status ===
        "ACTIVE"
    ) || null;

  const activeBossMaxHp =
    activeBoss
      ? Number(
          activeBoss.maxHp
        ) ||
        BOSS_HP[
          activeBoss.rank
        ] ||
        100
      : 0;

  const activeBossHp =
    activeBoss
      ? Number.isFinite(
          Number(
            activeBoss.hp
          )
        )
        ? Math.max(
            0,
            Number(
              activeBoss.hp
            )
          )
        : activeBossMaxHp
      : 0;

  const activeBossPercent =
    activeBoss
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              activeBossHp /
                activeBossMaxHp *
                100
            )
          )
        )
      : 0;

  const activeQuestCount =
    Object.values(
      profile.mustState || {}
    ).filter(
      (state) =>
        state?.accepted &&
        !state?.completed &&
        !state?.failed
    ).length;

  const directive =
    ascended
      ? "SUSTAIN ASCENDED FORM"
      : profile.path ===
        "MAGE"
        ? "BUILD INTELLIGENCE"
        : profile.path ===
          "TANK"
          ? "BUILD RESILIENCE"
          : profile.path ===
            "ASSASSIN"
            ? "BUILD PRECISION"
            : profile.path ===
              "RANGER"
              ? "BUILD CONTROL"
              : "BUILD COMMAND";

  return (
    <div className="page">
      <section className="hero card3d">
        <div className="hero-grid" />

        <div className="hero-main">
          <div>
            <span className="eyebrow">
              {ascended
                ? "ASCENDED PLAYER"
                : "PLAYER DESIGNATION"}
            </span>

            <h1>
              {profile.name}
            </h1>

            <div className="hero-class">
              <span>
                {ascended
                  ? evolution.icon
                  : path.icon}
              </span>

              {ascended
                ? profile.evolution.title ||
                  evolution.title
                : path.name}

              <i />

              {getRank(
                profile.level
              )}
            </div>

            <p>
              "{ascended
                ? evolution.identity
                : path.identity}"
            </p>
          </div>

          <div
            className="level-ring"
            style={{
              "--level-progress":
                percent +
                "%",
            }}
          >
            <div className="level-ring-core">
              <strong>
                {profile.level}
              </strong>

              <small>
                {ascended
                  ? "ASCENDED"
                  : "LEVEL"}
              </small>
            </div>
          </div>
        </div>

        <div className="current-directive">
          <small>
            CURRENT DIRECTIVE
          </small>

          <strong>
            {directive}
          </strong>
        </div>

        <div className="xp-section">
          <div>
            <span>
              EXPERIENCE
            </span>

            <strong>
              {profile.xp} /{" "}
              {required}
            </strong>
          </div>

          <div className="xp-track">
            <div
              style={{
                width:
                  percent +
                  "%",
              }}
            />
          </div>
        </div>
      </section>

      <div className="system-status-strip">
        <div>
          <span>
            {path.icon}
          </span>

          <strong>
            {path.name}
          </strong>

          <small>
            {getRank(
              profile.level
            )}
          </small>
        </div>

        <i />

        <div>
          <span>
            ⚔
          </span>

          <strong>
            BOSS
          </strong>

          <small>
            {activeBoss
              ? activeBossPercent +
                "% HP"
              : "NO ACTIVE RAID"}
          </small>
        </div>

        <i />

        <div>
          <span>
            ◉
          </span>

          <strong>
            {activeQuestCount}
          </strong>

          <small>
            QUESTS ACTIVE
          </small>
        </div>

        <i />

        <div>
          <span>
            🔥
          </span>

          <strong>
            {profile.streak}
          </strong>

          <small>
            STREAK
          </small>
        </div>

        <i />

        <div>
          <span>◷</span>
          <strong className="awareness-strip-time">{awareness?.activeTodayLabel || "00S"}</strong>
          <small>ACTIVE TODAY</small>
        </div>
      </div>

      <DailySystemBriefing
        profile={profile}
        awareness={awareness}
        dailyCommand={dailyCommand}
        dailyCommandStatus={dailyCommandStatus}
        refreshDailyCommand={refreshDailyCommand}
        setTab={setTab}
      />

      <AdaptiveIntelligenceSnapshot
        profile={profile}
        setTab={setTab}
      />

      <div className="stat-grid">
        <Stat
          label="TOTAL POWER"
          value={total}
          sub={`BASE ${Object.values(profile.attributes).reduce((sum, value) => sum + Number(value), 0)} + GEAR ${Object.values(profile.equipment?.bonuses || {}).reduce((sum, value) => sum + Number(value), 0)}`}
        />

        <Stat
          label="STREAK"
          value={
            profile.streak
          }
          sub="ACTIVE DAYS"
        />

        <Stat
          label="MOMENTUM"
          value={
            profile.momentum
          }
          sub="QUEST FLOW"
        />

        <Stat
          label="MISSIONS"
          value={
            profile.questLog
              .length
          }
          sub="COMPLETED"
        />
      </div>

      <section className="today-routine-card card3d">
        <div className="today-routine-head">
          <div>
            <small>
              PLAYER SCHEDULE
            </small>

            <h2>
              TODAY'S ROUTINE
            </h2>
          </div>

          <span>
            {
              SHIFT_PRESETS[
                profile.sleepSchedule.mode
              ]?.label ||
              "CUSTOM"
            }
          </span>
        </div>

        <div className="today-routine-grid">
          <div>
            <small>
              SLEEP
            </small>

            <strong>
              {formatClockLabel(
                profile.sleepSchedule.sleep
              )}
            </strong>
          </div>

          <div>
            <small>
              WAKE
            </small>

            <strong>
              {formatClockLabel(
                profile.sleepSchedule.wake
              )}
            </strong>
          </div>

          <div>
            <small>
              SLEEP BLOCK
            </small>

            <strong>
              {profile.sleepSchedule.mode ===
              "CUSTOM"
                ? "8 HOURS"
                : "PLANNED"}
            </strong>
          </div>

          <div>
            <small>
              PROOF
            </small>

            <strong>
              {
                profile.sleepSchedule
                  .verificationMinutes
              } MIN WINDOW
            </strong>
          </div>
        </div>

        <div className="today-routine-foot">
          <p>
            NO-SNOOZE will judge this committed wake time.
          </p>

          <button
            data-sfx="click"
            type="button"
            onClick={
              openRoutine
            }
          >
            EDIT ROUTINE
          </button>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <small>
            MISSION NETWORK
          </small>

          <h2>
            QUEST CONTROL
          </h2>
        </div>

        <button
          data-sfx="tab"
          type="button"
          onClick={() =>
            setTab(
              "quests"
            )
          }
        >
          ENTER →
        </button>
      </div>

      <div className="overview-grid">
        <Overview
          title="DAILY"
          value="01"
          text="Daily discipline"
        />

        <Overview
          title="CLASS"
          value={
            path.icon
          }
          text={
            path.name +
            " development"
          }
        />

        <Overview
          title="MUST"
          value="03"
          text="3 system mandates"
        />

        <Overview
          title="BOSS"
          value={
            profile.bossQuests.filter(
              (boss) =>
                boss.status === "ACTIVE"
            ).length
          }
          text="Active raids"
        />
      </div>

      {ascended && (
        <div className="ascension-banner card3d">
          <span>
            {profile.evolution.emblem ||
              evolution.icon}
          </span>

          <div>
            <small>
              LEVEL 101 EVOLUTION
            </small>

            <h2>
              {profile.evolution.title ||
                evolution.title}
            </h2>

            <p>
              {evolution.identity}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}) {
  const icon =
    {
      "TOTAL POWER":
        "◆",
      STREAK:
        "🔥",
      MOMENTUM:
        "↗",
      MISSIONS:
        "◎",
    }[
      label
    ] || "•";

  return (
    <div className="stat card3d">
      <div className="stat-head">
        <small>
          {label}
        </small>

        <i>
          {icon}
        </i>
      </div>

      <strong>
        {value}
      </strong>

      <span>
        {sub}
      </span>
    </div>
  );
}

export function Overview({
  title,
  value,
  text,
}) {
  return (
    <div className="overview card3d">
      <span>
        {title}
      </span>

      <strong>
        {value}
      </strong>

      <p>
        {text}
      </p>
    </div>
  );
}

export function ConsequencePanel({
  profile,
  saveProfile,
}) {
  if (
    !profile.pendingConsequences.length
  ) {
    return null;
  }

  function resolve(id) {
    const item =
      profile.pendingConsequences.find(
        (entry) =>
          entry.id === id
      );

    let updated = {
      ...profile,
      pendingConsequences:
        profile.pendingConsequences.filter(
          (entry) =>
            entry.id !== id
        ),
    };

    updated =
      addHistory(
        updated,
        "CONSEQUENCE RESOLVED",
        item?.quest ||
          "MUST QUEST",
        item?.consequence || ""
      );

    saveProfile(updated);
  }

  return (
    <>
      <SectionLabel
        number="!"
        title="PENDING CONSEQUENCES"
        danger
      />

      <div className="consequence-list">
        {profile.pendingConsequences.map(
          (item) => (
            <div
              className="consequence-card card3d"
              key={item.id}
            >
              <span>
                FAILED MUST QUEST
              </span>

              <h3>
                {item.quest}
              </h3>

              <p>
                {item.consequence ||
                  "No custom consequence was set."}
              </p>

              <button
                type="button"
                onClick={() =>
                  resolve(item.id)
                }
              >
                MARK RESOLVED
              </button>
            </div>
          )
        )}
      </div>
    </>
  );
}

export function BossGate({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
}) {
  const [open, setOpen] =
    useState(false);

  const [bossError, setBossError] =
    useState("");

  const [bossNotice, setBossNotice] =
    useState("");

  const activeBoss =
    profile.bossQuests.find(
      (boss) =>
        boss.status ===
        "ACTIVE"
    ) || null;

  const raidEntryKeyDetected =
    hasRaidEntryKey(profile);

  const path =
    String(
      profile.path ||
      "COMMANDER"
    ).toUpperCase();

  const rank =
    systemBossRank(
      profile.level
    );

  const pool =
    SYSTEM_BOSS_LIBRARY[path] ||
    SYSTEM_BOSS_LIBRARY.COMMANDER;

  const preview =
    pick(
      pool,
      path +
        "-" +
        todayKey() +
        "-" +
        profile.level +
        "-" +
        profile.bossQuests.length
    );

  if (!activeBoss || activeBoss.metadata?.kind === "WEEKLY_PREPARATION") {
    return <WeeklyBoss profile={profile} applyAuthoritativeProfile={applyAuthoritativeProfile} />;
  }

  async function createSystemBoss() {
    setBossError("");
    setBossNotice("");

    if (activeBoss) {
      setBossError(
        "AN ACTIVE BOSS QUEST ALREADY EXISTS. DEFEAT IT BEFORE REQUESTING ANOTHER RAID."
      );
      return;
    }

    try {
      const result =
        await assignBossOnBackend();

      if (
        result?.data?.assigned ===
        false
      ) {
        const reason = String(
          result?.data?.reason ||
          "BOSS_NOT_AVAILABLE"
        );
        setBossError(
          reason === "RAID_KEY_REQUIRED"
            ? "BOSS GATE LOCKED • EARN THE RAID ENTRY KEY AT LEVEL 5 WITH A 3-DAY DAILY STREAK."
            : "BOSS CANNOT BE ASSIGNED • " + reason.replaceAll("_", " ")
        );
        return;
      }

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      const updated =
        normalizeProfile(
          hydrated
        );

      applyAuthoritativeProfile(
        updated
      );

      const assignedName =
        result?.data?.boss?.title ||
        updated.bossQuests?.find(
          (boss) =>
            boss.status ===
            "ACTIVE"
        )?.name ||
        "BOSS";

      setBossNotice(
        assignedName +
        " HAS ENTERED THE SYSTEM."
      );

      playSFX(
        "event",
        Number(
          localStorage.getItem(
            "systemSfxVolume"
          )
        ) || 0.7
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE BOSS ASSIGNMENT FAILED:",
        error
      );

      setBossError(
        "THE SYSTEM COULD NOT ASSIGN A BOSS QUEST."
      );
    }
  }

  async function toggleObjective(
    bossId,
    objectiveId
  ) {
    const boss =
      profile.bossQuests.find(
        (item) =>
          item.id ===
          bossId
      );

    const objective =
      boss?.objectives?.find(
        (item) =>
          item.id ===
          objectiveId
      );

    if (
      !boss ||
      !objective
    ) {
      return;
    }

    const match =
      String(
        objectiveId
      ).match(
        /^OBJ-(\d+)$/
      );

    if (!match) {
      setBossError(
        "THIS OBJECTIVE IS NOT LINKED TO THE AUTHORITATIVE BOSS."
      );
      return;
    }

    try {
      await setBossObjectiveOnBackend({
        objectiveId:
          Number(
            match[1]
          ),
        complete:
          !objective.done,
      });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      applyAuthoritativeProfile(
        normalizeProfile(
          hydrated
        )
      );
    } catch (error) {
      console.error(
        "BOSS OBJECTIVE UPDATE FAILED:",
        error
      );

      setBossError(
        "THE SYSTEM REJECTED THE OBJECTIVE UPDATE."
      );
    }
  }

  async function claimBoss(
    boss
  ) {
    if (
      boss.status ===
        "COMPLETE"
    ) {
      return;
    }

    try {
      const result =
        await resolveBossOnBackend();

      if (
        result?.data?.resolved ===
        false
      ) {
        const reason =
          String(
            result?.data?.reason ||
            "BOSS_NOT_READY"
          )
            .replaceAll(
              "_",
              " "
            );

        setBossError(
          "BOSS CANNOT BE CLAIMED • " +
          reason
        );
        return;
      }

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      updated = {
        ...updated,
        completed: [
          "BOSS — " +
            boss.name,
          ...(
            updated.completed ||
            []
          ).filter(
            (entry) =>
              entry !==
              "BOSS — " +
                boss.name
          ),
        ],
        questLog: [
          {
            name:
              boss.name,
            type:
              "boss",
            systemAssigned:
              true,
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...(
            updated.questLog ||
            []
          ),
        ],
      };

      updated =
        addHistory(
          updated,
          "BOSS DEFEATED",
          boss.name,
          "BACKEND VERIFIED • +" +
            Number(
              boss.xp ||
              0
            ) +
            " XP" +
            (
              result?.data?.reward_name
                ? " • " +
                  result.data.reward_name
                : ""
            )
        );

      applyAuthoritativeProfile(
        updated
      );

      setBossNotice(
        boss.name +
        " HAS BEEN DEFEATED."
      );

      playSFX(
        "success",
        Number(
          localStorage.getItem(
            "systemSfxVolume"
          )
        ) || 0.7
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE BOSS RESOLUTION FAILED:",
        error
      );

      setBossError(
        "THE SYSTEM COULD NOT RESOLVE THIS BOSS."
      );
    }
  }

  return (
    <div className="boss-gate">
      <div className="boss-header card3d">
        <div>
          <small>
            SYSTEM RAID AUTHORITY
          </small>

          <h2>
            BOSS GATE
          </h2>

          <p>
            Boss Quests are assigned by THE SYSTEM. The player cannot create or customize a Boss mission, and the gate only opens with a Raid Entry Key.
          </p>
        </div>

        <button
          data-sfx="event"
          type="button"
          className="system-action system-action-boss"
          onClick={() => {
            setBossError("");
            setBossNotice("");
            setOpen(!open);
          }}
        >
          {open
            ? "CLOSE GATE"
            : activeBoss
              ? "VIEW RAID"
              : raidEntryKeyDetected
                ? "REQUEST BOSS"
                : "RAID KEY REQUIRED"}
        </button>
      </div>

      {open && (
        <div className="system-form boss-assignment-panel card3d">
          <div className="boss-system-scan">
            <small>
              [ SYSTEM ANALYSIS ]
            </small>

            <h3>
              {activeBoss
                ? "ACTIVE RAID DETECTED"
                : "BOSS CANDIDATE SELECTED"}
            </h3>

            <p>
              {activeBoss
                ? "Defeat the current Boss before THE SYSTEM assigns another."
                : "The System has selected a raid using your class, level and current progression."}
            </p>
          </div>

          {!activeBoss && (
            <>
              <div className="boss-key-status">
                <small>RAID ENTRY KEY</small>
                <strong>
                  {raidEntryKeyDetected
                    ? "KEY DETECTED • BOSS GATE READY"
                    : "LOCKED • LEVEL 5 + 3-DAY DAILY STREAK REQUIRED"}
                </strong>
              </div>
              <div className="boss-assignment-grid">
                <div>
                  <span>
                    CLASS
                  </span>
                  <strong>
                    {path}
                  </strong>
                </div>

                <div>
                  <span>
                    THREAT RANK
                  </span>
                  <strong>
                    {rank}
                  </strong>
                </div>

                <div>
                  <span>
                    REWARD
                  </span>
                  <strong>
                    +{BOSS_XP[rank]} XP
                  </strong>
                </div>

                <div>
                  <span>
                    TROPHY
                  </span>
                  <strong>
                    {BOSS_RARITY[rank]}
                  </strong>
                </div>
              </div>

              <div className="boss-preview">
                <small>
                  INCOMING BOSS
                </small>

                <h3>
                  {preview.name}
                </h3>

                <span>
                  {preview.category} AFFINITY • DEADLINE {systemBossDeadline(rank)}
                </span>

                <div className="boss-preview-objectives">
                  {preview.objectives.map(
                    (
                      objective,
                      index
                    ) => (
                      <p
                        key={
                          objective
                        }
                      >
                        <b>
                          0{index + 1}
                        </b>
                        {objective}
                      </p>
                    )
                  )}
                </div>
              </div>

              <button
                data-sfx="must"
                type="button"
                className="system-primary system-action system-action-boss"
                onClick={
                  createSystemBoss
                }
              >
                ACCEPT SYSTEM BOSS QUEST
              </button>
            </>
          )}

          {activeBoss && (
            <div className="boss-active-notice">
              <span>
                ACTIVE BOSS
              </span>

              <strong>
                {activeBoss.name}
              </strong>

              <small>
                {activeBoss.rank}-RANK • DEADLINE {activeBoss.deadline || "OPEN"}
              </small>
            </div>
          )}

          {bossError && (
            <div className="boss-form-error">
              ⚠ {bossError}
            </div>
          )}

          {bossNotice && (
            <div className="boss-form-success">
              ◈ SYSTEM ASSIGNMENT CONFIRMED — {bossNotice}
            </div>
          )}
        </div>
      )}

      <div className="boss-list">
        {profile.bossQuests.map(
          (boss) => {
            const done =
              boss.objectives.filter(
                (objective) =>
                  objective.done
              ).length;

            const maxHp =
              Number(
                boss.maxHp
              ) ||
              BOSS_HP[
                boss.rank
              ] ||
              100;

            const hp =
              Number.isFinite(
                Number(
                  boss.hp
                )
              )
                ? Math.max(
                    0,
                    Number(
                      boss.hp
                    )
                  )
                : maxHp;

            const hpPercent =
              Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    hp /
                      maxHp *
                      100
                  )
                )
              );

            const expired =
              boss.deadline &&
              new Date(
                boss.deadline +
                  "T23:59:59"
              ) <
                new Date() &&
              boss.status !==
                "COMPLETE";

            return (
              <div
                className={
                  "boss-card card3d rank-" +
                  boss.rank
                }
                key={
                  boss.id
                }
              >
                <div className="boss-title">
                  <div>
                    <span>
                      {boss.rank}-RANK SYSTEM BOSS
                    </span>

                    <h3>
                      {boss.name}
                    </h3>
                  </div>

                  <b>
                    {boss.status ===
                    "COMPLETE"
                      ? "DEFEATED"
                      : expired
                        ? "DEADLINE PASSED"
                        : done +
                          "/" +
                          boss.objectives.length}
                  </b>
                </div>

                <div className="boss-hp-block">
                  <div className="boss-hp-copy">
                    <span>
                      BOSS HP
                    </span>

                    <strong>
                      {hp}/{maxHp}
                    </strong>
                  </div>

                  <div className="boss-hp-track">
                    <i
                      style={{
                        width:
                          hpPercent +
                          "%",
                      }}
                    />
                  </div>

                  <small>
                    TRAINING DEALS DAMAGE AUTOMATICALLY
                  </small>
                </div>

                {boss.deadline && (
                  <small>
                    DEADLINE: {boss.deadline}
                  </small>
                )}

                <div className="boss-objectives">
                  {boss.objectives.map(
                    (
                      objective
                    ) => (
                      <button
                        type="button"
                        key={
                          objective.id
                        }
                        className={
                          objective.done
                            ? "done"
                            : ""
                        }
                        disabled={
                          boss.status ===
                          "COMPLETE"
                        }
                        onClick={() =>
                          toggleObjective(
                            boss.id,
                            objective.id
                          )
                        }
                      >
                        <i>
                          {objective.done
                            ? "✓"
                            : "○"}
                        </i>

                        {objective.text}
                      </button>
                    )
                  )}
                </div>

                {boss.status !==
                  "COMPLETE" &&
                  boss.objectives.every(
                    (
                      objective
                    ) =>
                      objective.done
                  ) && (
                    <button
                      data-sfx="levelup"
                      type="button"
                      className="boss-claim system-action system-action-boss"
                      onClick={() =>
                        claimBoss(
                          boss
                        )
                      }
                    >
                      CLAIM BOSS VICTORY +{boss.xp} XP
                    </button>
                  )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export function dailyCommandClassQuest(command) {
  const directive =
    command?.class_directive;

  if (
    !directive ||
    directive.status === "NONE" ||
    !directive.title
  ) {
    return null;
  }

  return {
    id:
      directive.code ||
      directive.title,
    code:
      directive.code ||
      directive.title,
    name: directive.title,
    task:
      directive.objective ||
      "Complete the live class directive.",
    message:
      directive.message ||
      "Class-aligned directive selected by the live rotation.",
    xp: Math.max(
      0,
      Number(
        directive.xp
      ) || 0
    ),
    category:
      directive.category ||
      "CLASS",
    proofType:
      directive.proof_type ||
      "HONOR",
  };
}

export function QuestPage({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
  openEvent,
  setTab,
  dailyCommand,
}) {
  const date =
    todayKey();

  const [
    wakeClock,
    setWakeClock,
  ] = useState(Date.now());

  useEffect(() => {
    const timer =
      window.setInterval(
        () => setWakeClock(Date.now()),
        1000
      );

    return () =>
      window.clearInterval(timer);
  }, []);

  const [
    pendingProof,
    setPendingProof,
  ] = useState(null);

  const [
    eventScanNotice,
    setEventScanNotice,
  ] = useState(null);

  const [
    questNotice,
    setQuestNotice,
  ] = useState(null);

  const [
    attributeCreditReady,
    setAttributeCreditReady,
  ] = useState(null);

  const [
    mustSync,
    setMustSync,
  ] = useState({});

  // Must Quest acceptance can finish while another Quest action is in
  // progress. Keep the newest profile snapshot so an asynchronous acceptance
  // never writes an older copy of the UI state back over a verified result.
  const latestProfileRef =
    useRef(profile);

  useEffect(() => {
    latestProfileRef.current =
      profile;
  }, [
    profile,
  ]);

  function commitMustState(
    mustState
  ) {
    const current =
      latestProfileRef.current ||
      profile;

    const next = {
      ...current,
      mustState,
    };

    latestProfileRef.current = next;
    applyAuthoritativeProfile(
      next
    );
  }

  // A quest action can remain in flight for a moment while the backend
  // confirms proof and returns the authoritative profile. Keep the UI from
  // opening a second proof flow or sending a duplicate completion request
  // during that window.
  const questActionLocksRef = useRef(new Set());

  function questActionKey(quest, context) {
    return buildQuestActionKey({
      assignedFor: date,
      context,
      quest,
    });
  }

  function releaseQuestAction(key) {
    if (key) {
      questActionLocksRef.current.delete(key);
    }
  }

  function registerAttributeCredit(completion) {
    const credit =
      completion?.data?.attribute_credit ||
      null;

    const available = Math.max(
      0,
      Number(
        credit?.credits_available ??
          (
            Number(credit?.credits_awarded) ||
            0
          ) -
            (
              Number(credit?.credits_spent) ||
              0
          )
      ) || 0
    );

    if (
      credit?.status === "READY" &&
      available > 0
    ) {
      setAttributeCreditReady({
        available,
        sourceTitle:
          credit.source_title ||
          "VERIFIED QUEST",
      });
    }
  }

  async function requestQuestProof({
    quest,
    context,
    onVerified,
  }) {
    const actionKey = questActionKey(
      quest,
      context
    );

    if (
      questActionLocksRef.current.has(
        actionKey
      )
    ) {
      return;
    }

    questActionLocksRef.current.add(
      actionKey
    );

    const proofType =
      getQuestProofType(
        quest,
        context
      );

    setPendingProof({
      quest,
      context,
      proofType,
      onVerified,
      actionKey,
    });
  }

  const [
    adaptiveQuest,
    setAdaptiveQuest,
  ] = useState(null);

  const [
    adaptiveStatus,
    setAdaptiveStatus,
  ] = useState("LOADING");

  const [
    adaptiveError,
    setAdaptiveError,
  ] = useState("");

  const [
    adaptiveRetryNonce,
    setAdaptiveRetryNonce,
  ] = useState(0);

  useEffect(() => {
    let active = true;

    setAdaptiveStatus("LOADING");
    setAdaptiveError("");

    const adaptiveSignature = [
      date,
      profile.path,
      profile.level,
      profile.workoutLog.length,
      profile.wealthLogs.length,
      profile.masteryLogs.length,
      profile.questLog.length,
      profile.momentum,
      profile.attributes?.FOCUS,
      profile.attributes?.RECOVERY,
      adaptiveRetryNonce,
    ].join(":");

    runSystemSingleFlight(
      "adaptive-evaluation:" +
        adaptiveSignature,
      () =>
        evaluateAdaptiveQuest(
          profile
        )
    )
      .then((quest) => {
        if (active) {
          setAdaptiveQuest(
            quest
          );
          setAdaptiveStatus(
            quest?.status ||
              "UNAVAILABLE"
          );
          setAdaptiveError(
            quest?.status ===
            "ERROR"
              ? quest.code ||
                "ADAPTIVE_CATALOG_UNAVAILABLE"
              : ""
          );
        }
      })
      .catch((error) => {
        console.error(
          "ADAPTIVE QUEST EVALUATION FAILED:",
          error
        );

        if (active) {
          setAdaptiveQuest(null);
          setAdaptiveStatus("ERROR");
          setAdaptiveError(
            error?.code ||
              error?.message ||
              "ADAPTIVE_CATALOG_UNAVAILABLE"
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    date,
    profile.path,
    profile.workoutLog.length,
    profile.wealthLogs.length,
    profile.masteryLogs.length,
    profile.questLog.length,
    profile.momentum,
    profile.level,
    profile.attributes?.FOCUS,
    profile.attributes?.RECOVERY,
    adaptiveRetryNonce,
  ]);

  const classQuest =
    dailyCommandClassQuest(
      dailyCommand
    ) ||
    pick(
      CLASS_QUESTS[
        profile.path
      ],
      date +
        profile.path +
        "class"
    );

  const mustQuests = [
    {
      id: "discipline",
      type:
        "DISCIPLINE",
      ...pick(
        MUST_DISCIPLINE,
        date +
          profile.path +
          "must1"
      ),
    },
    {
      id: "physical",
      type:
        "PHYSICAL",
      ...pick(
        MUST_PHYSICAL[
          profile.path
        ] ||
          MUST_PHYSICAL.COMMANDER,
        date +
          profile.path +
          "must2"
      ),
    },
    {
      id: "focus",
      type:
        "FOCUS",
      ...pick(
        MUST_FOCUS,
        date +
          profile.path +
          "must3"
      ),
    },
  ];

  useEffect(() => {
    let active = true;

    async function ensureMustQuests() {
      const now =
        new Date();

      const mergedMustState = {
        ...(
          latestProfileRef.current
            ?.mustState ||
          profile.mustState
        ),
      };

      let changed =
        false;

      for (
        const quest of
        mustQuests
      ) {
        if (!active) {
          return;
        }

        const key =
          date +
          "-" +
          quest.id;

        const existing =
          mergedMustState[
            key
          ];

        const stateMatchesQuest =
          mustStateMatchesQuest(
            existing,
            quest,
            date
          );

        const terminal =
          Boolean(
            stateMatchesQuest &&
            (
              existing?.completed ||
              existing?.failed ||
              existing?.penaltyApplied
            )
          );

        if (terminal) {
          setMustSync(
            (current) => ({
              ...current,
              [key]:
                "TERMINAL",
            })
          );
          continue;
        }

        setMustSync(
          (current) => ({
            ...current,
            [key]:
              "SYNCING",
          })
        );

        try {
          const result =
            await runSystemSingleFlight(
              "must-accept:" +
                key +
                ":" +
                quest.name,
              () =>
                acceptMustQuestOnBackend({
                  title:
                    quest.name,
                  durationSeconds:
                    24 *
                    60 *
                    60,
                  legacyKey:
                    key,
                  assignedFor:
                    date,
                })
            );

          if (!active) {
            return;
          }

          const serverQuest =
            result?.data
              ?.quest;

          if (
            !serverQuest?.expires_at
          ) {
            throw new Error(
              "DIRECTIVE_TIMER_NOT_RETURNED"
            );
          }

          if (
            serverQuest.status ===
            "FAILED"
          ) {
            throw new Error(
              "DIRECTIVE_ALREADY_FAILED"
            );
          }

          const acceptedAt =
            serverQuest
              ?.accepted_at ||
            result?.data
              ?.server_now ||
            now.toISOString();

          const expiresAt =
            serverQuest
              .expires_at;

          mergedMustState[
            key
          ] = {
            ...(
              existing ||
              {}
            ),
            accepted:
              true,
            mandatory:
              true,
            completed:
              serverQuest.status ===
              "COMPLETED",
            failed:
              serverQuest.status ===
              "FAILED",
            penaltyApplied:
              serverQuest.status ===
              "FAILED",
            penalty:
              Number(
                serverQuest.xp_penalty ??
                quest.penalty ??
                0
              ),
            name:
              quest.name,
            date,
            consequence:
              existing?.consequence ||
              "",
            generatedAt:
              acceptedAt,
            acceptedAt,
            expiresAt,
            serverOffsetMs:
              getServerClockOffsetMs(
                result?.data?.server_now
              ),
            backendQuestId:
              serverQuest.id ||
              null,
            authoritative:
              true,
            syncStatus:
              "READY",
          };

          setMustSync(
            (current) => ({
              ...current,
              [key]:
                "READY",
            })
          );

          changed =
            true;
        } catch (error) {
          console.warn(
            "MUST QUEST SERVER ACCEPTANCE DEFERRED:",
            quest.name,
            error
          );

          setMustSync(
            (current) => ({
              ...current,
              [key]:
                "ERROR",
            })
          );
        }
      }

      if (
        active &&
        changed
      ) {
        commitMustState(
          mergedMustState
        );
      }
    }

    void ensureMustQuests();

    return () => {
      active =
        false;
    };
  }, [
    date,
    profile.path,
  ]);

  async function retryMustSync(
    quest
  ) {
    const key =
      date +
      "-" +
      quest.id;

    setMustSync(
      (current) => ({
        ...current,
        [key]:
          "SYNCING",
      })
    );

    setQuestNotice(
      null
    );

    try {
      const result =
        await runSystemSingleFlight(
          "must-accept:" +
            key +
            ":" +
            quest.name,
          () =>
            acceptMustQuestOnBackend({
              title:
                quest.name,
              durationSeconds:
                24 *
                60 *
                60,
              legacyKey:
                key,
              assignedFor:
                date,
            })
        );

      const serverQuest =
        result?.data
          ?.quest;

      if (
        !serverQuest?.expires_at
      ) {
        throw new Error(
          "DIRECTIVE_TIMER_NOT_RETURNED"
        );
      }

      const existing =
        (
          latestProfileRef.current
            ?.mustState ||
          profile.mustState
        )[
          key
        ] ||
        {};

      const nextState = {
        ...existing,
        accepted:
          true,
        mandatory:
          true,
        completed:
          serverQuest.status ===
          "COMPLETED",
        failed:
          serverQuest.status ===
          "FAILED",
        penaltyApplied:
          serverQuest.status ===
          "FAILED",
        penalty:
          Number(
            serverQuest.xp_penalty ??
            quest.penalty ??
            0
          ),
        name:
          quest.name,
        date,
        generatedAt:
          serverQuest.accepted_at ||
          serverQuest.created_at ||
          new Date()
            .toISOString(),
        acceptedAt:
          serverQuest.accepted_at ||
          null,
        expiresAt:
          serverQuest.expires_at,
        serverOffsetMs:
          getServerClockOffsetMs(
            result?.data?.server_now
          ),
        backendQuestId:
          serverQuest.id ||
          null,
        authoritative:
          true,
        syncStatus:
          "READY",
      };

      commitMustState({
        ...(
          latestProfileRef.current
            ?.mustState ||
          profile.mustState
        ),
        [key]: nextState,
      });

      setMustSync(
        (current) => ({
          ...current,
          [key]:
            "READY",
        })
      );

      setQuestNotice({
        type:
          "SUCCESS",
        text:
          quest.name +
          " • DIRECTIVE SYNCHRONIZED",
      });
    } catch (error) {
      console.error(
        "MUST QUEST RETRY FAILED:",
        error
      );

      setMustSync(
        (current) => ({
          ...current,
          [key]:
            "ERROR",
        })
      );

      setQuestNotice({
        type:
          "ERROR",
        text:
          "COULD NOT SYNCHRONIZE " +
          quest.name +
          " • " +
          (
            error?.message ||
            "BACKEND UNAVAILABLE"
          ),
      });
    }
  }


  const dailyQuest =
    scheduleDailyQuest(
      profile,
      new Date(wakeClock)
    );

  const wakeWindow =
    dailyQuest.wakeWindow;

  const wakeNow =
    new Date(wakeClock);

  const wakeStatus =
    wakeNow < wakeWindow.start
      ? "UPCOMING"
      : wakeNow <= wakeWindow.end
        ? "VERIFY NOW"
        : "MISSED";

  const wakeProofKey =
    todayKey(
      wakeWindow.start
    );

  const wakeVerified =
    Boolean(
      profile.wakeProofs[
        wakeProofKey
      ]
    );

  const dailyDone =
    wakeVerified ||
    profile.dailyCompleted[
      date + "-daily"
    ];

  const classDone =
    profile.dailyCompleted[
      date + "-class"
    ] ||
    dailyCommand?.class_directive
      ?.status === "COMPLETE";

  const classGpsTarget =
    movementTargetForQuest(
      classQuest
    );

  function startClassGpsMission() {
    if (
      !classGpsTarget ||
      classDone
    ) {
      return;
    }

    saveProfile({
      ...profile,
      activeGpsMission: {
        id:
          "gps-class-" +
          date +
          "-" +
          Date.now(),
        source:
          "CLASS_QUEST",
        sourceId:
          "class-" +
          date,
        completionKey:
          date +
          "-class",
        name:
          classQuest.name,
        attribute:
          PATHS[
            profile.path
          ].bonus,
        xp:
          Number(
            classQuest.xp ||
            0
          ),
        targetKind:
          classGpsTarget.kind,
        targetDistanceKm:
          classGpsTarget.distanceKm ||
          null,
        targetDurationSeconds:
          classGpsTarget.durationSeconds ||
          null,
        targetLabel:
          classGpsTarget.label,
        createdAt:
          new Date().toISOString(),
      },
    });

    setTab(
      "training"
    );
  }

  const rawEventScanState =
    profile.eventScanState ||
    {};

  const eventScanState =
    rawEventScanState.date ===
    date
      ? rawEventScanState
      : {
          date,
          scans: 0,
          lastScanAt: "",
          eventFound: false,
        };

  const eventScanCooldownMs =
    RARE_EVENT_SCAN.cooldownHours *
    60 *
    60 *
    1000;

  const eventScanRemaining =
    eventScanState.lastScanAt
      ? Math.max(
          0,
          eventScanCooldownMs -
            (
              wakeClock -
              new Date(
                eventScanState.lastScanAt
              ).getTime()
            )
        )
      : 0;

  const eventScanLocked =
    Boolean(
      eventScanState.eventFound
    ) ||
    eventScanState.scans >=
      RARE_EVENT_SCAN.maxScansPerDay ||
    eventScanRemaining > 0;

  function scanRareEvent() {
    const result =
      openEvent();

    if (!result) {
      return;
    }

    if (
      result.status ===
      "FOUND"
    ) {
      setEventScanNotice({
        type: "FOUND",
        text:
          "RARE EVENT DETECTED — SYSTEM INTERRUPTION INCOMING.",
      });
      return;
    }

    if (
      result.status ===
      "EMPTY"
    ) {
      setEventScanNotice({
        type: "EMPTY",
        text:
          "NO ANOMALY DETECTED • " +
          result.remainingScans +
          " SCAN" +
          (
            result.remainingScans ===
            1
              ? ""
              : "S"
          ) +
          " REMAINING TODAY",
      });
      return;
    }

    if (
      result.status ===
      "COOLDOWN"
    ) {
      setEventScanNotice({
        type: "LOCKED",
        text:
          "SCANNER RECALIBRATING.",
      });
      return;
    }

    setEventScanNotice({
      type: "LOCKED",
      text:
        result.message ||
        "SCANNER UNAVAILABLE.",
    });
  }

  async function verifyWake() {
    if (wakeVerified) {
      return;
    }

    const now =
      new Date();

    if (
      now < wakeWindow.start ||
      now > wakeWindow.end
    ) {
      return;
    }

    try {
      await updateRoutineOnBackend({
        shiftMode:
          profile.sleepSchedule.mode,
        sleepTime:
          profile.sleepSchedule.sleep,
        wakeTime:
          profile.sleepSchedule.wake,
        timezone:
          profile.sleepSchedule.timezone ||
          Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone ||
          "UTC",
        verificationMinutes:
          profile.sleepSchedule.verificationMinutes,
      });

      const checkin =
        await routineCheckinOnBackend({
          type:
            "WAKE",
          occurredAt:
            now.toISOString(),
          metadata: {
            target_wake:
              profile.sleepSchedule.wake,
          },
        });

      const checkinStatus =
        checkin?.data?.status;

      if (
        checkinStatus !==
        "ON_TIME"
      ) {
        setQuestNotice({
          type:
            "ERROR",
          text:
            "SYSTEM WAKE VERIFICATION FAILED • " +
            (
              checkinStatus ||
              "OUTSIDE WINDOW"
            ),
        });
        return;
      }

      const completion =
        await completeQuestByTitleOnBackend({
        title:
          dailyQuest.name,
        context:
          "DAILY_WAKE",
        proof: {
          type:
            "TIME",
          verifiedAt:
            now.toISOString(),
        },
        legacyKey:
          date +
          "-daily",
        assignedFor:
          date,
        });

      registerAttributeCredit(
        completion
      );

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      let updated =
        normalizeProfile(
          cloud
        );

      updated = {
        ...updated,
        dailyCompleted: {
          ...updated.dailyCompleted,
          [date + "-daily"]:
            true,
        },
        wakeProofs: {
          ...updated.wakeProofs,
          [wakeProofKey]: {
            verifiedAt:
              now.toISOString(),
            targetWake:
              profile.sleepSchedule.wake,
            sleepTime:
              profile.sleepSchedule.sleep,
            mode:
              profile.sleepSchedule.mode,
            windowMinutes:
              profile.sleepSchedule.verificationMinutes,
            proofType:
              "TIME",
          },
        },
        completed: [
          dailyQuest.name,
          ...updated.completed.filter(
            (name) =>
              name !==
              dailyQuest.name
          ),
        ],
        questLog: [
          {
            name:
              dailyQuest.name,
            type:
              "daily",
            proofType:
              "TIME",
            targetWake:
              profile.sleepSchedule.wake,
            verifiedAt:
              now.toISOString(),
            date:
              now.toISOString(),
            authoritative:
              true,
          },
          ...updated.questLog,
        ],
      };

      updated =
        addHistory(
          updated,
          "WAKE PROOF VERIFIED",
          dailyQuest.name,
          "BACKEND VERIFIED • +" +
            dailyQuest.xp +
            " XP"
        );

      applyAuthoritativeProfile(
        updated
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE WAKE QUEST FAILED:",
        error
      );

      setQuestNotice({
        type:
          "ERROR",
        text:
          "WAKE QUEST VERIFICATION FAILED • " +
          (
            error?.message ||
            "BACKEND REJECTED THE ACTION"
          ),
      });
    }
  }

  async function completeNormal(
    key,
    quest,
    attribute,
    proof = null
  ) {
    const legacyKey =
      date +
      "-" +
      key;

    if (
      profile.dailyCompleted[
        legacyKey
      ]
    ) {
      return;
    }

    try {
      const completion =
        await completeQuestByTitleOnBackend({
        title:
          quest.name,
        context:
          key === "class"
            ? "CLASS"
            : "DAILY",
        proof,
        legacyKey,
        assignedFor:
          date,
        });

      registerAttributeCredit(
        completion
      );

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      let updated =
        normalizeProfile(
          cloud
        );

      updated = {
        ...updated,
        dailyCompleted: {
          ...updated.dailyCompleted,
          [legacyKey]:
            true,
        },
        questProofs: {
          ...updated.questProofs,
          [legacyKey]:
            proof
              ? {
                  ...proof,
                  questName:
                    quest.name,
                  context:
                    key,
                }
              : null,
        },
        completed: [
          quest.name,
          ...updated.completed.filter(
            (name) =>
              name !==
              quest.name
          ),
        ],
        questLog: [
          {
            name:
              quest.name,
            type:
              key,
            proofType:
              proof?.type ||
              "HONOR",
            proof:
              proof ||
              null,
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...updated.questLog,
        ],
      };

      updated =
        addHistory(
          updated,
          key === "class"
            ? "CLASS QUEST"
            : "DAILY QUEST",
          quest.name,
          "BACKEND VERIFIED • +" +
            quest.xp +
            " XP"
        );

      applyAuthoritativeProfile(
        updated
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE QUEST COMPLETION FAILED:",
        error
      );

      const failure =
        new Error(
          error?.message ||
          "SYSTEM BACKEND REJECTED THIS QUEST."
        );

      setQuestNotice({
        type:
          "ERROR",
        text:
          failure.message,
      });

      throw failure;
    }
  }


  async function completeMust(
    quest,
    proof = null
  ) {
    const key =
      date +
      "-" +
      quest.id;

    let state =
      (
        latestProfileRef.current
          ?.mustState ||
        profile.mustState
      )[
        key
      ];

    const stateMatchesQuest =
      mustStateMatchesQuest(
        state,
        quest,
        date
      );

    if (!stateMatchesQuest) {
      state =
        null;
    }

    try {
      if (
        !isMustStateReady(
          state
        )
      ) {
        const accepted =
          await runSystemSingleFlight(
            "must-accept:" +
              key +
              ":" +
              quest.name,
            () =>
              acceptMustQuestOnBackend({
                title:
                  quest.name,
                durationSeconds:
                  24 *
                  60 *
                  60,
                legacyKey:
                  key,
                assignedFor:
                  date,
              })
          );

        const serverQuest =
          accepted?.data
            ?.quest;

        if (
          !serverQuest?.expires_at
        ) {
          throw new Error(
            "DIRECTIVE_TIMER_NOT_RETURNED"
          );
        }

        const acceptedAt =
          serverQuest
            ?.accepted_at ||
          accepted?.data
            ?.server_now ||
          new Date()
            .toISOString();

        const expiresAt =
          serverQuest
            .expires_at;

        state = {
          accepted:
            true,
          mandatory:
            true,
          completed:
            false,
          failed:
            false,
          penaltyApplied:
            false,
          penalty:
            quest.penalty,
          name:
            quest.name,
          date,
          consequence:
            "",
          generatedAt:
            acceptedAt,
          acceptedAt,
          expiresAt,
          serverOffsetMs:
            getServerClockOffsetMs(
              accepted?.data?.server_now
            ),
          backendQuestId:
            serverQuest.id ||
            null,
          authoritative:
            true,
        };

        commitMustState({
          ...(
            latestProfileRef.current
              ?.mustState ||
            profile.mustState
          ),
          [key]: state,
        });
      }

      if (
        state?.completed ||
        state?.failed ||
        state?.penaltyApplied
      ) {
        return;
      }

      const completion =
        await runSystemSingleFlight(
        "must-complete:" +
          key +
          ":" +
          quest.name,
        () =>
          completeQuestByTitleOnBackend({
            title:
              quest.name,
            context:
              "MUST",
            proof,
            legacyKey:
              key,
            assignedFor:
              date,
          })
        );

      registerAttributeCredit(
        completion
      );

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      let updated =
        normalizeProfile(
          cloud
        );

      updated = {
        ...updated,
        mustState: {
          ...updated.mustState,
          [key]: {
            ...state,
            completed:
              true,
            failed: false,
            penaltyApplied: false,
            proofType:
              proof?.type ||
              "HONOR",
            proofVerifiedAt:
              proof?.verifiedAt ||
              new Date()
                .toISOString(),
            authoritative:
              true,
          },
        },
        questProofs: {
          ...updated.questProofs,
          [key]:
            proof
              ? {
                  ...proof,
                  questName:
                    quest.name,
                  context:
                    "must",
                }
              : null,
        },
        completed: [
          "MUST — " +
            quest.name,
          ...updated.completed.filter(
            (name) =>
              name !==
              "MUST — " +
                quest.name
          ),
        ],
        questLog: [
          {
            name:
              quest.name,
            type:
              "must",
            proofType:
              proof?.type ||
              "HONOR",
            proof:
              proof ||
              null,
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...updated.questLog,
        ],
      };

      updated =
        addHistory(
          updated,
          "MUST QUEST",
          quest.name,
          "BACKEND VERIFIED • +" +
            quest.xp +
            " XP"
        );

      applyAuthoritativeProfile(
        updated
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE MUST QUEST FAILED:",
        error
      );

      const failure =
        new Error(
          error?.message ||
          "SYSTEM BACKEND REJECTED THIS MUST QUEST."
        );

      setQuestNotice({
        type:
          "ERROR",
        text:
          quest.name +
          " • " +
          failure.message,
      });

      throw failure;
    }
  }


  async function completeAdaptive(
    proof = null
  ) {
    if (!adaptiveQuest) {
      return;
    }

    const key =
      date +
      "-adaptive-" +
      adaptiveQuest.code;

    if (
      profile.dailyCompleted[
        key
      ]
    ) {
      return;
    }

    try {
      const completion =
        await completeQuestByTitleOnBackend({
        title:
          adaptiveQuest.name,
        context:
          "ADAPTIVE",
        proof,
        legacyKey:
          key,
        assignedFor:
          date,
        });

      registerAttributeCredit(
        completion
      );

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      updated = {
        ...updated,
        dailyCompleted: {
          ...updated.dailyCompleted,
          [key]:
            true,
        },
        questProofs: {
          ...(
            updated.questProofs ||
            {}
          ),
          [key]: proof
            ? {
                ...proof,
                questName:
                  adaptiveQuest.name,
                context:
                  "adaptive",
              }
            : null,
        },
        completed: [
          adaptiveQuest.name,
          ...(
            updated.completed ||
            []
          ).filter(
            (name) =>
              name !==
              adaptiveQuest.name
          ),
        ],
        questLog: [
          {
            name:
              adaptiveQuest.name,
            type:
              "adaptive",
            category:
              adaptiveQuest.category,
            proofType:
              proof?.type ||
              "HONOR",
            proofVerifiedAt:
              proof?.verifiedAt ||
              new Date()
                .toISOString(),
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...(
            updated.questLog ||
            []
          ),
        ],
      };

      updated =
        addHistory(
          updated,
          "ADAPTIVE DIRECTIVE",
          adaptiveQuest.name,
          "BACKEND VERIFIED"
        );

      applyAuthoritativeProfile(
        updated
      );
    } catch (error) {
      console.error(
        "ADAPTIVE QUEST BACKEND REJECTED:",
        error
      );

      setQuestNotice({
        type:
          "ERROR",
        text:
          "ADAPTIVE QUEST VERIFICATION FAILED • " +
          (
            error?.message ||
            "BACKEND REJECTED THE ACTION"
          ),
      });
    }
  }


  async function failMust(quest) {
    const key = date + "-" + quest.id;
    const state = profile.mustState[key];

    const stateMatchesQuest =
      mustStateMatchesQuest(
        state,
        quest,
        date
      );

    if (
      !stateMatchesQuest ||
      !state?.accepted ||
      state.completed ||
      state.penaltyApplied
    ) {
      return;
    }

    try {
      const penaltyResult = await runSystemSingleFlight(
        "must-failure:" +
          key +
          ":" +
          quest.name,
        () =>
          applyExpiredQuestPenaltiesOnBackend()
      );

      const penaltyData = penaltyResult?.data || {};
      const failedCount = Number(
        penaltyData.failed_quests
      ) || 0;
      const failedQuestIds = Array.isArray(
        penaltyData.failed_quest_ids
      )
        ? penaltyData.failed_quest_ids.map((value) => String(value))
        : [];

      if (
        failedCount <= 0 ||
        (
          failedQuestIds.length > 0 &&
          state.backendQuestId &&
          !failedQuestIds.includes(String(state.backendQuestId))
        )
      ) {
        throw new Error("MUST_PENALTY_NOT_CONFIRMED");
      }

      const cloud = await bootstrapAuthoritativeProfile();
      if (!cloud) throw new Error("AUTHORITATIVE_REFRESH_FAILED");

      const authoritativeState =
        normalizeProfile(cloud).mustState?.[key];

      // If completion won a race with expiry, keep the authoritative
      // completed state instead of overwriting it with a local failure.
      if (authoritativeState?.completed) {
        applyAuthoritativeProfile(
          normalizeProfile(cloud)
        );
        return;
      }

      let updated = normalizeProfile(cloud);
      updated = {
        ...updated,
        mustState: {
          ...updated.mustState,
          [key]: {
            ...state,
            failed: true,
            failedAt: new Date().toISOString(),
            penaltyApplied: true,
            authoritative: true,
          },
        },
      };

      updated = addHistory(
        updated,
        "MUST QUEST FAILURE",
        state.name || quest.name,
        "SERVER VERIFIED • -" + Number(state.penalty || quest.penalty || 0) + " XP"
      );

      applyAuthoritativeProfile(updated);
    } catch (error) {
      console.warn("MUST PENALTY SERVER RECONCILIATION DEFERRED:", error);
    }
  }

  useEffect(() => {
    let active = true;

    async function reconcileMustPenalties() {
      try {
        const minuteBucket =
          Math.floor(
            Date.now() /
              60000
          );

        const result =
          await runSystemSingleFlight(
            "must-penalty-reconcile:" +
              date +
              ":" +
              minuteBucket,
            () =>
              applyExpiredQuestPenaltiesOnBackend()
          );

        const failedCount = Number(result?.data?.failed_quests) || 0;
        if (!active || failedCount <= 0) return;

        const cloud = await bootstrapAuthoritativeProfile();
        if (!active || !cloud) return;

        applyAuthoritativeProfile(normalizeProfile(cloud));
      } catch (error) {
        console.warn("MUST PENALTY RECONCILIATION DEFERRED:", error);
      }
    }

    reconcileMustPenalties();
    const timer = setInterval(reconcileMustPenalties, 60 * 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [date]);



  return (
    <div className="page">
      <PageHero
        eyebrow="SYSTEM MISSION NETWORK"
        title="QUESTS"
        text="Daily orders, class development, three system mandates, Boss raids and rare urgent encounters."
      />

      {questNotice && (
        <div
          className={
            "quest-system-notice " +
            String(
              questNotice.type ||
              "INFO"
            ).toLowerCase()
          }
        >
          <span>
            {questNotice.type ===
            "ERROR"
              ? "⚠"
              : questNotice.type ===
                  "SUCCESS"
                ? "✓"
                : "◇"}
          </span>

          <strong>
            {questNotice.text}
          </strong>

          <button
            type="button"
            onClick={() =>
              setQuestNotice(
                null
              )
            }
          >
            ×
          </button>
        </div>
      )}

      {attributeCreditReady && (
        <div className="quest-credit-ready card3d">
          <div>
            <small>ATTRIBUTE CREDIT EARNED</small>
            <strong>
              +{attributeCreditReady.available} CREDIT{attributeCreditReady.available === 1 ? "" : "S"} • {attributeCreditReady.sourceTitle}
            </strong>
            <p>Choose an eligible attribute from the secure allocation console.</p>
          </div>

          <div>
            <button
              type="button"
              className="system-action"
              onClick={() => {
                setAttributeCreditReady(null);
                setTab("attributes");
              }}
            >
              ALLOCATE NOW
            </button>

            <button
              type="button"
              aria-label="Dismiss attribute credit notice"
              onClick={() =>
                setAttributeCreditReady(null)
              }
            >
              ×
            </button>
          </div>
        </div>
      )}

      <ConsequencePanel
        profile={profile}
        saveProfile={saveProfile}
      />

      <SectionLabel
        number="01"
        title="DAILY"
      />

      <article className="quest-card card3d wake-proof-card">
        <div className="quest-side">
          DAILY
        </div>

        <div className="quest-body">
          <div className="quest-top">
            <div>
              <span>
                DISCIPLINE • TIME PROOF
              </span>

              <h3>
                {dailyQuest.name}
              </h3>
            </div>

            <strong>
              +{dailyQuest.xp} XP
            </strong>
          </div>

          <p>
            {dailyQuest.task}
          </p>

          <blockquote>
            {dailyQuest.message}
          </blockquote>

          <div className="wake-schedule-strip">
            <div>
              <small>SHIFT</small>
              <strong>
                {
                  SHIFT_PRESETS[
                    profile.sleepSchedule.mode
                  ]?.label || "CUSTOM"
                }
              </strong>
            </div>

            <div>
              <small>PLANNED SLEEP</small>
              <strong>
                {formatClockLabel(
                  profile.sleepSchedule.sleep
                )}
              </strong>
            </div>

            <div>
              <small>TARGET WAKE</small>
              <strong>
                {formatClockLabel(
                  profile.sleepSchedule.wake
                )}
              </strong>
            </div>

            <div>
              <small>PROOF WINDOW</small>
              <strong>
                {
                  profile.sleepSchedule.verificationMinutes
                } MIN
              </strong>
            </div>
          </div>

          {wakeVerified ? (
            <button
              type="button"
              disabled
              className="wake-verified"
            >
              ✓ AWAKENING VERIFIED
            </button>
          ) : wakeStatus ===
            "VERIFY NOW" ? (
            <button
              data-sfx="success"
              type="button"
              className="wake-verify-button"
              onClick={verifyWake}
            >
              I'M UP — VERIFY AWAKENING
            </button>
          ) : (
            <div className="wake-window-state">
              <span>
                {wakeStatus === "UPCOMING"
                  ? "VERIFICATION OPENS"
                  : "WINDOW MISSED"}
              </span>

              <strong>
                {wakeStatus === "UPCOMING"
                  ? wakeWindow.start.toLocaleString(
                      [],
                      {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )
                  : "THE NEXT COMMITTED WAKE WINDOW WILL BECOME ACTIVE"}
              </strong>
            </div>
          )}

          <small className="wake-proof-note">
            The System judges the wake time you committed to — not a universal 6:00 AM rule.
          </small>
        </div>
      </article>

      <SectionLabel
        number="02"
        title="CLASS"
      />

      <QuestCard
        quest={classQuest}
        tag={profile.path}
        completed={classDone}
        proofType={
          getQuestProofType(
            classQuest,
            profile.path
          )
        }
        gpsTarget={
          classGpsTarget
        }
        onStartGps={
          startClassGpsMission
        }
        onComplete={() =>
          requestQuestProof({
            quest:
              classQuest,
            context:
              profile.path,
            onVerified:
              (proof) =>
                completeNormal(
                  "class",
                  classQuest,
                  PATHS[
                    profile.path
                  ].bonus,
                  proof
                ),
          })
        }
        accent
      />

      <SectionLabel
        number="03"
        title="MUST QUESTS"
        danger
      />

      <div className="must-grid">
        {mustQuests.map(
          (quest) => {
            const key =
              date +
              "-" +
              quest.id;

            const state =
              profile.mustState[key];

            return (
              <MustCard
                key={quest.id}
                quest={quest}
                state={state}
                syncStatus={
                  mustSync[
                    key
                  ] ||
                  (
                    state?.accepted &&
                    state?.expiresAt
                      ? "READY"
                      : "SYNCING"
                  )
                }
                retrySync={() =>
                  retryMustSync(
                    quest
                  )
                }
                proofType={
                  getQuestProofType(
                    quest,
                    quest.type
                  )
                }
                complete={() =>
                  requestQuestProof({
                    quest,
                    context:
                      quest.type,
                    onVerified:
                      (proof) =>
                        completeMust(
                          quest,
                          proof
                        ),
                  })
                }
                fail={() =>
                  failMust(
                    quest
                  )
                }
              />
            );
          }
        )}
      </div>

      <SectionLabel
        number="A"
        title="ADAPTIVE DIRECTIVE"
      />

      <article
        className={
          "quest-card card3d adaptive-card " +
          (
            adaptiveStatus ===
            "READY"
              ? ""
              : "adaptive-status-card"
          )
        }
      >
        <div className="quest-side">
          ANALYSIS
        </div>

        {adaptiveStatus ===
        "READY" &&
        adaptiveQuest ? (
          <div className="quest-body">
            <div className="quest-top">
              <div>
                <span>
                  {adaptiveQuest.category}
                  {" • "}
                  PRIORITY {adaptiveQuest.priority}
                </span>

                <h3>
                  {adaptiveQuest.name}
                </h3>
              </div>

              <strong>
                +{adaptiveQuest.xp} XP
              </strong>
            </div>

            <blockquote>
              "{adaptiveQuest.reason}"
            </blockquote>

            <div className="objective">
              <span>
                SYSTEM OBJECTIVE
              </span>

              <p>
                {adaptiveQuest.task}
              </p>
            </div>

            <button
              data-sfx="success"
              type="button"
              disabled={
                Boolean(
                  profile.dailyCompleted[
                    date +
                    "-adaptive-" +
                    adaptiveQuest.code
                  ]
                )
              }
              onClick={() =>
                requestQuestProof({
                  quest:
                    adaptiveQuest,
                  context:
                    "ADAPTIVE",
                  onVerified:
                    (proof) =>
                      completeAdaptive(
                        proof
                      ),
                })
              }
            >
              {profile.dailyCompleted[
                date +
                "-adaptive-" +
                adaptiveQuest.code
              ]
                ? "DIRECTIVE COMPLETE"
                : "SUBMIT PROOF"}
            </button>
          </div>
        ) : (
          <div className="quest-body adaptive-status-body">
            <div className="quest-top">
              <div>
                <span>
                  LIVE ANALYSIS
                </span>

                <h3>
                  {adaptiveStatus ===
                  "LOADING"
                    ? "CALIBRATING YOUR NEXT DIRECTIVE"
                    : adaptiveStatus ===
                        "AUTH_REQUIRED"
                      ? "SIGN IN TO CALIBRATE"
                      : adaptiveStatus ===
                          "UNAVAILABLE"
                        ? "NO COMPATIBLE DIRECTIVE"
                        : "ADAPTIVE LINK NEEDS RETRY"}
                </h3>
              </div>
            </div>

            <p>
              {adaptiveStatus ===
              "LOADING"
                ? "THE SYSTEM is comparing your recent movement, wealth, learning, focus and recovery signals."
                : adaptiveStatus ===
                    "AUTH_REQUIRED"
                  ? "Adaptive directives are assigned from your signed-in progression profile."
                  : adaptiveStatus ===
                      "UNAVAILABLE"
                    ? adaptiveQuest?.reason ||
                      "The active catalog has no safe Standard directive for this profile yet."
                    : "The directive catalog could not be reached. Retry without resetting any local progress."}
            </p>

            {adaptiveStatus !==
            "LOADING" &&
            adaptiveStatus !==
              "AUTH_REQUIRED" && (
              <>
                {adaptiveError && (
                  <small className="adaptive-status-code">
                    {String(
                      adaptiveError
                    )
                      .replace(
                        /_/g,
                        " "
                      )
                      .toUpperCase()}
                  </small>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setAdaptiveRetryNonce(
                      (previous) =>
                        previous +
                        1
                    )
                  }
                >
                  RETRY DIRECTIVE
                </button>
              </>
            )}
          </div>
        )}
      </article>

      <SectionLabel
        number="04"
        title="BOSS QUESTS"
      />

      <BossGate
        profile={profile}
        saveProfile={saveProfile}
        applyAuthoritativeProfile={
          applyAuthoritativeProfile
        }
      />

      <SectionLabel
        number="05"
        title="MOMENTUM"
      />

      <div className="momentum card3d">
        <div>
          <span>
            CURRENT MOMENTUM
          </span>

          <strong>
            {profile.momentum}
          </strong>
        </div>

        <p>
          Completing objectives builds
          momentum. It represents your
          current execution rhythm.
        </p>
      </div>

      <SectionLabel
        number="06"
        title="SYSTEM EVENT"
      />

      <div className="rare-scan-zone">
        <button
          data-sfx="event"
          type="button"
          className="event-scan card3d"
          disabled={
            eventScanLocked
          }
          onClick={
            scanRareEvent
          }
        >
          <div>
            <span>
              RARE ENCOUNTER NETWORK
            </span>

            <strong>
              {eventScanState.eventFound
                ? "EVENT DETECTED"
                : eventScanState.scans >=
                    RARE_EVENT_SCAN.maxScansPerDay
                  ? "DAILY SCANS EXHAUSTED"
                  : eventScanRemaining > 0
                    ? "SCANNER RECALIBRATING"
                    : "SCAN FOR EVENT"}
            </strong>

            <small>
              15% DETECTION CHANCE •{" "}
              {
                Math.max(
                  0,
                  RARE_EVENT_SCAN.maxScansPerDay -
                    Number(
                      eventScanState.scans ||
                      0
                    )
                )
              }{" "}
              SCANS REMAINING
            </small>
          </div>

          <b>
            {eventScanRemaining > 0
              ? formatMustTime(
                  eventScanRemaining
                )
              : eventScanLocked
                ? "LOCKED"
                : "SCAN →"}
          </b>
        </button>

        {eventScanNotice && (
          <div
            className={
              "rare-scan-result " +
              eventScanNotice.type.toLowerCase()
            }
          >
            <span>
              {eventScanNotice.type ===
              "FOUND"
                ? "⚠"
                : eventScanNotice.type ===
                    "EMPTY"
                  ? "◇"
                  : "⌛"}
            </span>

            <strong>
              {
                eventScanNotice.text
              }
            </strong>
          </div>
        )}

        <p className="rare-scan-rule">
          Rare events are not guaranteed. The scanner can be used up to 3 times per day with a 4-hour recalibration between scans. Finding an event locks further scans for that day.
        </p>
      </div>

      {pendingProof && (
        <QuestProofModal
          assignedFor={date}
          quest={
            pendingProof.quest
          }
          proofType={
            pendingProof.proofType
          }
          close={() => {
            releaseQuestAction(
              pendingProof.actionKey
            );
            setPendingProof(
              null
            );
          }}
          verified={async (
            proof
          ) => {
            const currentProof =
              pendingProof;

            try {
              await currentProof.onVerified(
                proof
              );

              setPendingProof(
                null
              );

              setQuestNotice({
                type:
                  "SUCCESS",
                text:
                  currentProof.quest.name + " • " + (proof.reviewMessage || "PROOF VERIFIED"),
              });
            } finally {
              releaseQuestAction(
                currentProof.actionKey
              );
            }
          }}
        />
      )}
    </div>
  );
}

export function QuestCard({
  quest,
  tag,
  completed,
  onComplete,
  accent,
  proofType = "HONOR",
  gpsTarget = null,
  onStartGps = null,
}) {
  return (
    <article
      className={
        accent
          ? "quest-card card3d accent-card"
          : "quest-card card3d"
      }
    >
      <div className="quest-side">
        SYSTEM
      </div>

      <div className="quest-body">
        <div className="quest-top">
          <div>
            <span>
              {tag}
            </span>

            <h3>
              {quest.name}
            </h3>
          </div>

          <strong>
            +{quest.xp} XP
          </strong>
        </div>

        <blockquote>
          "{quest.message}"
        </blockquote>

        <div className="quest-proof-chip">
          <span>
            PROOF
          </span>

          <strong>
            {
              QUEST_PROOF_LABELS[
                proofType
              ] ||
              proofType
            }
          </strong>
        </div>

        <div className="objective">
          <span>
            OBJECTIVE
          </span>

          <p>
            {quest.task}
          </p>
        </div>

        {gpsTarget &&
        !completed ? (
          <div className="quest-gps-actions">
            <div className="gps-eligible-badge">
              <span>
                GPS PROOF AVAILABLE
              </span>

              <strong>
                {gpsTarget.label} TARGET
              </strong>
            </div>

            <button
              data-sfx="success"
              type="button"
              onClick={
                onStartGps
              }
            >
              START GPS MISSION
            </button>

            <button
              type="button"
              className="manual-proof-fallback"
              onClick={
                onComplete
              }
            >
              USE MANUAL PROOF
            </button>
          </div>
        ) : (
          <button
            data-sfx="success"
            type="button"
            disabled={
              completed
            }
            onClick={
              onComplete
            }
          >
            {completed
              ? "OBJECTIVE COMPLETE"
              : "MARK COMPLETE"}
          </button>
        )}
      </div>
    </article>
  );
}

export function QuestProofModal({
  quest,
  proofType,
  close,
  verified,
}) {
  const submitLock = useRef(false);
  const uploadedProof = useRef(null);
  const [
    note,
    setNote,
  ] = useState("");

  const [
    detail,
    setDetail,
  ] = useState("");

  const [
    takeaways,
    setTakeaways,
  ] = useState("");

  const [
    file,
    setFile,
  ] = useState(null);

  const [
    filePreviewUrl,
    setFilePreviewUrl,
  ] = useState("");

  const [
    honorConfirmed,
    setHonorConfirmed,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [
    file,
  ]);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollY =
      window.scrollY ||
      html.scrollTop ||
      body.scrollTop ||
      0;
    const scrollX =
      window.scrollX ||
      html.scrollLeft ||
      body.scrollLeft ||
      0;
    const scrollbarWidth =
      window.innerWidth - html.clientWidth;
    const previous = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
      htmlScrollBehavior: html.style.scrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    html.style.overflow = "hidden";

    return () => {
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.width = previous.bodyWidth;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
      html.style.overflow = previous.htmlOverflow;
      html.style.scrollBehavior = "auto";
      window.scrollTo(scrollX, scrollY);
      html.style.scrollBehavior = previous.htmlScrollBehavior;
    };
  }, []);

  function requestClose() {
    if (busy) {
      return;
    }

    close();
  }

  const description = {
    PERFORMANCE:
      "Record what you physically completed. The System wants the actual result — reps, rounds, duration, distance or equivalent evidence.",
    LEARNING:
      "Explain what you learned and record at least three takeaways. Completion without recall is not mastery.",
    RESULT:
      "State the concrete result you produced. The System is verifying outcome, not intention.",
    PHOTO:
      "Upload one photo showing the completed result. Add a short note so the proof remains understandable later.",
    VIDEO:
      "Record a short private video of yourself completing the drill. Review it, then add a specific reflection before submitting.",
    HONOR:
      "Confirm that you completed the objective exactly as written. The System records your confirmation before awarding progression.",
  }[
    proofType
  ];


  const resultNoteExample = {
    PERFORMANCE:
      "Example: Completed 3 rounds — 10 push-ups, 15 squats and 30-sec plank each round. Final round completed without assistance.",
    RESULT:
      "Example: Finished the assigned task, organized the full workspace and cleared the remaining items. Final result is complete and ready for use.",
    LEARNING:
      "Example: Studied the topic for 45 minutes, completed the lesson and can explain the main concept without notes.",
    PHOTO:
      "Example: This image shows the completed result after the task was finished.",
    VIDEO:
      "Example: I introduced myself clearly, explained my idea for 45 seconds and kept eye contact more consistently than my first attempt.",
    HONOR:
      "Example: I completed the objective as written and can stand behind this confirmation.",
  }[
    proofType
  ];

  function isVagueResult(
    value
  ) {
    const normalized =
      String(
        value ||
        ""
      )
        .trim()
        .toLowerCase()
        .replace(
          /[.!?,]/g,
          ""
        );

    const vague =
      new Set([
        "done",
        "finished",
        "complete",
        "completed",
        "yes",
        "did it",
        "done it",
        "task done",
        "all done",
      ]);

    return (
      !normalized ||
      vague.has(
        normalized
      ) ||
      normalized.length <
        12
    );
  }

  async function submit() {
    if (submitLock.current) return;
    setError("");

    if (
      proofType ===
        "PERFORMANCE" &&
      isVagueResult(
        detail
      )
    ) {
      setError(
        "RESULT NOTE IS TOO VAGUE. STATE WHAT YOU COMPLETED AND INCLUDE A MEASURABLE RESULT SUCH AS REPS, ROUNDS, TIME OR DISTANCE."
      );
      return;
    }

    if (
      proofType ===
        "LEARNING" &&
      (
        detail.trim().length <
          20 ||
        takeaways
          .split("\n")
          .filter(
            (item) =>
              item.trim()
          ).length < 3
      )
    ) {
      setError(
        "EXPLAIN WHAT YOU LEARNED AND ENTER AT LEAST 3 TAKEAWAYS — ONE PER LINE."
      );
      return;
    }

    if (
      proofType ===
        "RESULT" &&
      isVagueResult(
        detail
      )
    ) {
      setError(
        "INSUFFICIENT RESULT DETAIL. STATE WHAT YOU COMPLETED, THE OUTCOME PRODUCED, AND WHAT THE EVIDENCE DEMONSTRATES."
      );
      return;
    }

    if (
      proofType ===
        "PHOTO" &&
      !file
    ) {
      setError(
        "SELECT A PHOTO BEFORE SUBMITTING PROOF."
      );
      return;
    }

    if (
      proofType ===
        "VIDEO" &&
      !file
    ) {
      setError(
        "RECORD OR SELECT A SHORT VIDEO BEFORE SUBMITTING PROOF."
      );
      return;
    }

    if (
      proofType ===
        "VIDEO" &&
      detail.trim().length <
        20
    ) {
      setError(
        "ADD A SHORT REFLECTION: WHAT YOU DID WELL AND ONE THING YOU WILL IMPROVE."
      );
      return;
    }

    if (
      proofType ===
        "HONOR" &&
      !honorConfirmed
    ) {
      setError(
        "CONFIRM THAT THE OBJECTIVE IS COMPLETE BEFORE SUBMITTING."
      );
      return;
    }

    if (
      proofType ===
        "PHOTO" &&
      note.trim().length <
        12
    ) {
      setError(
        "EXPLAIN WHAT THE PHOTO PROVES BEFORE SUBMITTING."
      );
      return;
    }

    submitLock.current = true;
    setBusy(true);

    try {
      let uploadedFile = null;

      if (
        (
          proofType ===
            "PHOTO" ||
          proofType ===
            "VIDEO"
        ) &&
        file
      ) {
        uploadedFile = uploadedProof.current?.file === file ? uploadedProof.current.uploaded : await uploadProofFile(file);
        uploadedProof.current = { file, uploaded: uploadedFile };
      }

      const proof = {
        honorConfirmed,
        type:
          proofType,
        verifiedAt:
          new Date().toISOString(),
        detail:
          detail.trim(),
        note:
          note.trim(),
        takeaways:
          proofType ===
          "LEARNING"
            ? takeaways
                .split("\n")
                .map(
                  (item) =>
                    item.trim()
                )
                .filter(Boolean)
            : [],
        imagePath:
          uploadedFile?.path ||
          "",
        imageUrl:
          uploadedFile?.url ||
          "",
        mediaType:
          file?.type ||
          "",
        fileName:
          file?.name ||
          "",
      };

      await verified(
        proof
      );
    } catch (submitError) {
      const rawMessage =
        String(
          submitError?.message ||
          "THE SYSTEM COULD NOT VERIFY THIS PROOF."
        );

      setError(
        rawMessage
          .replace(
            /_/g,
            " "
          )
          .toUpperCase()
      );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  const modal = (
    <div
      className="proof-overlay"
      onClick={
        requestClose
      }
    >
      <div
        className="proof-modal card3d"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="proof-modal-head">
          <div>
            <small>
              SYSTEM VERIFICATION
            </small>

            <h2>
              {
                QUEST_PROOF_LABELS[
                  proofType
                ]
              }
            </h2>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={
              requestClose
            }
          >
            ×
          </button>
        </div>

        <div className="proof-quest-name">
          <span>
            QUEST
          </span>

          <strong>
            {quest.name}
          </strong>
        </div>

        <p className="proof-description">
          {description}
        </p>


        <div className="result-note-guide">
          <small>
            {proofType === "HONOR"
              ? "HONOR CONFIRMATION"
              : "RESULT NOTE"}
          </small>

          <strong>
            {proofType === "HONOR"
              ? "CONFIRM THE OBJECTIVE WAS COMPLETED"
              : "RECORD THE RESULT — NOT JUST “DONE”"}
          </strong>

          <p>
            {proofType === "HONOR"
              ? "This confirmation is the proof for this quest. Submit only when the objective is complete."
              : "State what you completed, include a measurable result where possible, and explain what your evidence proves."}
          </p>

          <em>
            {resultNoteExample}
          </em>
        </div>

        {proofType ===
          "PERFORMANCE" && (
          <SystemField label="RESULT NOTE — PERFORMANCE">
            <textarea
              value={
                detail
              }
              onChange={(e) =>
                setDetail(
                  e.target.value
                )
              }
              placeholder="State exactly what you completed. Include reps, rounds, duration, distance or another measurable result."
            />
          </SystemField>
        )}

        {proofType ===
          "RESULT" && (
          <SystemField label="RESULT NOTE — OUTCOME">
            <textarea
              value={
                detail
              }
              onChange={(e) =>
                setDetail(
                  e.target.value
                )
              }
              placeholder="Describe the completed outcome and what changed because the task was finished."
            />
          </SystemField>
        )}

        {proofType ===
          "LEARNING" && (
          <>
            <SystemField label="WHAT DID YOU LEARN?">
              <textarea
                value={
                  detail
                }
                onChange={(e) =>
                  setDetail(
                    e.target.value
                  )
                }
                placeholder="Explain the concept in your own words."
              />
            </SystemField>

            <SystemField label="3 KEY TAKEAWAYS • ONE PER LINE">
              <textarea
                value={
                  takeaways
                }
                onChange={(e) =>
                  setTakeaways(
                    e.target.value
                  )
                }
                placeholder={"1. ...\n2. ...\n3. ..."}
              />
            </SystemField>
          </>
        )}

        {proofType ===
          "PHOTO" && (
          <>
            <SystemField label="PROOF IMAGE">
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFile(
                    e.target
                      .files?.[0] ||
                    null
                  )
                }
              />
            </SystemField>

            <SystemField label="RESULT NOTE — WHAT DOES THIS PROVE?">
              <textarea
                value={
                  note
                }
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                placeholder="Explain exactly what is visible and why it proves completion."
              />
            </SystemField>
          </>
        )}

        {proofType ===
          "VIDEO" && (
          <>
            <SystemField label="PRIVATE VIDEO PROOF • 30–60 SECONDS RECOMMENDED • 35 MB MAX">
              <input
                type="file"
                accept="video/*"
                capture="user"
                onChange={(e) =>
                  setFile(
                    e.target
                      .files?.[0] ||
                    null
                  )
                }
              />
            </SystemField>

            {filePreviewUrl && (
              <video
                className="proof-video-preview"
                controls
                playsInline
                src={filePreviewUrl}
              />
            )}

            <SystemField label="REVIEW REFLECTION">
              <textarea
                value={detail}
                onChange={(e) =>
                  setDetail(
                    e.target.value
                  )
                }
                placeholder="What did you do well? What felt uncomfortable? What will you improve on the next recording?"
              />
            </SystemField>
          </>
        )}

        {proofType ===
          "HONOR" && (
          <label className="proof-honor-confirmation">
            <input
              type="checkbox"
              checked={honorConfirmed}
              onChange={(event) =>
                setHonorConfirmed(
                  event.target.checked
                )
              }
            />
            <span>
              I confirm that I completed this objective exactly as written.
            </span>
          </label>
        )}

        {error && (
          <div className="proof-error">
            ⚠ {error}
          </div>
        )}

        <div className="proof-actions">
          <button
            type="button"
            disabled={busy}
            onClick={
              requestClose
            }
          >
            CANCEL
          </button>

          <button
            data-sfx="success"
            type="button"
            disabled={
              busy
            }
            onClick={
              submit
            }
          >
            {busy
              ? "VERIFYING..."
              : "SUBMIT PROOF"}
          </button>
        </div>
      </div>
    </div>
  );

  // A .page retains a transform after its entrance animation. Rendering the
  // proof window there makes "fixed" positioning page-relative instead of
  // viewport-relative, so this portal keeps the popup centered on screen.
  const portalRoot =
    typeof document ===
    "undefined"
      ? null
      : document.getElementById(
          "system-modal-root"
        );

  return portalRoot
    ? createPortal(
        modal,
        portalRoot
      )
    : modal;
}

export function formatMustTime(
  milliseconds
) {
  const total =
    Math.max(
      0,
      Math.floor(
        milliseconds /
          1000
      )
    );

  const hours =
    Math.floor(
      total / 3600
    );

  const minutes =
    Math.floor(
      (total % 3600) /
        60
    );

  const seconds =
    total % 60;

  return (
    String(hours).padStart(
      2,
      "0"
    ) +
    ":" +
    String(minutes).padStart(
      2,
      "0"
    ) +
    ":" +
    String(seconds).padStart(
      2,
      "0"
    )
  );
}

export function MustCard({
  quest,
  state,
  complete,
  fail,
  retrySync,
  syncStatus = "SYNCING",
  proofType = "HONOR",
}) {
  const [now, setNow] =
    useState(
      Date.now()
    );

  const failureTriggeredRef =
    useRef(false);

  const completed =
    Boolean(
      state?.completed
    );

  const failed =
    Boolean(
      state?.failed ||
      state?.penaltyApplied
    );

  const expiresAt =
    state?.expiresAt
      ? new Date(
          state.expiresAt
        ).getTime()
      : null;

  const serverOffsetMs =
    Number.isFinite(
      Number(
        state?.serverOffsetMs
      )
    )
      ? Number(
          state.serverOffsetMs
        )
      : 0;

  const ready =
    isMustStateReady(
      state
    );

  const remaining =
    ready
      ? expiresAt -
        (
          now +
          serverOffsetMs
        )
      : null;

  useEffect(() => {
    if (
      completed ||
      failed ||
      !ready
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    completed,
    failed,
    ready,
    expiresAt,
    serverOffsetMs,
  ]);

  useEffect(() => {
    failureTriggeredRef.current =
      false;
  }, [
    expiresAt,
  ]);

  useEffect(() => {
    if (
      !completed &&
      !failed &&
      ready &&
      remaining <= 0 &&
      !failureTriggeredRef.current
    ) {
      failureTriggeredRef.current =
        true;

      Promise.resolve(
        fail()
      ).catch(() => {
        failureTriggeredRef.current =
          false;
      });
    }
  }, [
    completed,
    failed,
    ready,
    remaining,
    fail,
  ]);

  const syncFailed =
    syncStatus ===
    "ERROR";

  const syncing =
    !ready &&
    !completed &&
    !failed &&
    !syncFailed;

  return (
    <article
      className={
        failed
          ? "must-card card3d must-failed"
          : syncFailed
            ? "must-card card3d mandatory-must must-sync-error"
            : "must-card card3d mandatory-must"
      }
    >
      <div className="must-type">
        {quest.type}
        {" • MANDATORY"}
      </div>

      <h3>
        {quest.name}
      </h3>

      <blockquote>
        "{quest.message}"
      </blockquote>

      <div className="quest-proof-chip must-proof-chip">
        <span>
          REQUIRED PROOF
        </span>

        <strong>
          {
            QUEST_PROOF_LABELS[
              proofType
            ] ||
            proofType
          }
        </strong>
      </div>

      <div className="objective">
        <span>
          SYSTEM OBJECTIVE
        </span>

        <p>
          {quest.task}
        </p>
      </div>

      <div className="must-stats">
        <div>
          <small>
            REWARD
          </small>

          <strong>
            +{quest.xp}
          </strong>
        </div>

        <div>
          <small>
            FAILURE
          </small>

          <strong>
            -{quest.penalty}
          </strong>
        </div>
      </div>

      {!completed &&
        !failed && (
          <>
            <div
              className={
                "must-countdown mandatory-countdown " +
                (
                  ready
                    ? "is-ready"
                    : syncFailed
                      ? "is-error"
                      : "is-syncing"
                )
              }
            >
              <small>
                {ready
                  ? "TIME REMAINING"
                  : syncFailed
                    ? "DIRECTIVE LINK"
                    : "DIRECTIVE STATUS"}
              </small>

              <strong>
                {ready
                  ? formatMustTime(
                      remaining
                    )
                  : syncFailed
                    ? "SYNC FAILED"
                    : "SYNCING..."}
              </strong>

              <span>
                {ready
                  ? "SYSTEM DIRECTIVE • COMPULSORY"
                  : syncFailed
                    ? "SERVER TIMER NOT CONFIRMED"
                    : "CONFIRMING AUTHORITATIVE TIMER"}
              </span>
            </div>

            {ready ? (
              <div className="system-warning-strip">
                FAILURE WILL BE RECORDED AUTOMATICALLY WHEN THE TIMER REACHES ZERO.
              </div>
            ) : (
              <div className="system-warning-strip sync-warning">
                COMPLETION IS LOCKED UNTIL THE SYSTEM CONFIRMS THIS DIRECTIVE.
              </div>
            )}

            {syncFailed ? (
              <button
                type="button"
                className="must-retry-button"
                onClick={retrySync}
              >
                RETRY DIRECTIVE SYNC
              </button>
            ) : (
              <button
                data-sfx="success"
                type="button"
                disabled={
                  syncing ||
                  !ready ||
                  Boolean(
                    state?.completed ||
                    state?.failed ||
                    state?.penaltyApplied
                  )
                }
                onClick={complete}
              >
                {syncing
                  ? "SYNCHRONIZING..."
                  : "SUBMIT COMPLETION"}
              </button>
            )}
          </>
        )}

      {completed && (
        <button
          type="button"
          disabled
        >
          DIRECTIVE COMPLETE
        </button>
      )}

      {failed && (
        <button
          type="button"
          disabled
          className="failed-button"
        >
          FAILED — PENALTY APPLIED
        </button>
      )}
    </article>
  );
}

export function EventModal({
  event,
  setEvent,
  profile,
  saveProfile,
  applyAuthoritativeProfile,
}) {
  const [remaining, setRemaining] =
    useState(
      event?.quest
        ?.seconds || 0
    );

  useEffect(() => {
    if (
      event?.stage !==
      "active"
    ) {
      return;
    }

    const timer =
      setInterval(() => {
        setRemaining(
          (previous) => {
            if (
              previous <= 1
            ) {
              clearInterval(
                timer
              );

              setEvent({
                ...event,
                stage:
                  "failed",
              });

              return 0;
            }

            return (
              previous - 1
            );
          }
        );
      }, 1000);

    return () =>
      clearInterval(
        timer
      );
  }, [
    event?.stage,
  ]);

  if (!event) return null;

  const quest =
    event.quest;

  function accept() {
    setRemaining(
      quest.seconds
    );

    setEvent({
      ...event,
      stage:
        "active",
    });
  }

  async function complete() {
    try {
      await completeQuestByTitleOnBackend({
        title:
          quest.name,
        context:
          "RARE_EVENT",
        legacyKey:
          "event-" +
          todayKey() +
          "-" +
          quest.name,
      });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      updated = {
        ...updated,
        completed: [
          "EVENT — " +
            quest.name,
          ...(
            updated.completed ||
            []
          ).filter(
            (item) =>
              item !==
              "EVENT — " +
                quest.name
          ),
        ],
        questLog: [
          {
            name:
              quest.name,
            type:
              "event",
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...(
            updated.questLog ||
            []
          ),
        ],
      };

      applyAuthoritativeProfile(
        updated
      );

      setEvent({
        ...event,
        stage:
          "complete",
      });
    } catch (error) {
      console.error(
        "RARE EVENT BACKEND REJECTED:",
        error
      );

      alert(
        "THE SYSTEM COULD NOT VERIFY THIS EVENT. NO XP WAS AWARDED."
      );
    }
  }


  if (
    event.stage ===
    "alert"
  ) {
    return (
      <div className="event-overlay">
        <div className="urgent-modal">
          <div className="urgent-icon">
            !
          </div>

          <span>
            SYSTEM INTERRUPTION
          </span>

          <h2>
            URGENT QUEST
          </h2>

          <p>
            An unexpected event has
            appeared.
          </p>

          <button
            data-sfx="event"
            type="button"
            onClick={() =>
              setEvent({
                ...event,
                stage:
                  "preview",
              })
            }
          >
            OKAY — ENTER
          </button>
        </div>
      </div>
    );
  }

  if (
    event.stage ===
    "preview"
  ) {
    return (
      <div className="event-overlay">
        <div className="urgent-modal">
          <span>
            URGENT QUEST
          </span>

          <h2>
            {quest.name}
          </h2>

          <div className="event-data">
            <div>
              <small>
                TIME
              </small>

              <strong>
                {Math.floor(
                  quest.seconds /
                    60
                )}{" "}
                MIN
              </strong>
            </div>

            <div>
              <small>
                REWARD
              </small>

              <strong>
                +{quest.xp} XP
              </strong>
            </div>
          </div>

          <div className="objective">
            <span>
              SYSTEM OBJECTIVE
            </span>

            <p>
              {quest.task}
            </p>
          </div>

          <p className="event-note">
            Declining has no penalty.
            Event failure never removes
            XP.
          </p>

          <div className="event-buttons">
            <button
              data-sfx="event"
              type="button"
              className="yes"
              onClick={
                accept
              }
            >
              YES — ACCEPT
            </button>

            <button
              data-sfx="decline"
              type="button"
              className="no"
              onClick={() =>
                setEvent(
                  null
                )
              }
            >
              NO — DECLINE
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    event.stage ===
    "active"
  ) {
    return (
      <div className="event-overlay">
        <div className="urgent-modal">
          <span>
            EVENT ACTIVE
          </span>

          <h2>
            {quest.name}
          </h2>

          <div className="countdown">
            {formatTimer(
              remaining
            )}
          </div>

          <div className="objective">
            <span>
              OBJECTIVE
            </span>

            <p>
              {quest.task}
            </p>
          </div>

          <button
            data-sfx="success"
            type="button"
            className="event-complete"
            onClick={
              complete
            }
          >
            COMPLETE EVENT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-overlay">
      <div className="urgent-modal">
        <span>
          SYSTEM RESULT
        </span>

        <h2>
          {event.stage ===
          "complete"
            ? "EVENT COMPLETE"
            : "TIME EXPIRED"}
        </h2>

        <p>
          {event.stage ===
          "complete"
            ? "+" +
              quest.xp +
              " XP AWARDED"
            : "No XP has been removed."}
        </p>

        <button
          data-sfx={
            event.stage ===
            "complete"
              ? "success"
              : "decline"
          }
          type="button"
          onClick={() =>
            setEvent(null)
          }
        >
          RETURN
        </button>
      </div>
    </div>
  );
}

export function Attributes({
  profile,
  applyAuthoritativeProfile,
}) {
  const [credits, setCredits] =
    useState([]);

  const [creditStatus, setCreditStatus] =
    useState("LOADING");

  const [creditError, setCreditError] =
    useState("");

  const [creditNotice, setCreditNotice] =
    useState("");

  const [allocatingKey, setAllocatingKey] =
    useState("");

  const path = profile?.path || "COMMANDER";

  const alignment = useMemo(
    () =>
      calculateClassAlignment(
        path,
        profile?.attributes
      ),
    [
      path,
      profile?.attributes,
    ]
  );

  const blueprint = useMemo(
    () =>
      getClassAttributeBlueprint(
        path
      ),
    [path]
  );

  const orderedAttributes = useMemo(
    () =>
      sortAttributesForClass(
        profile?.attributes,
        path
      ),
    [
      path,
      profile?.attributes,
    ]
  );

  const pendingCredits = useMemo(
    () =>
      credits.filter(
        (credit) =>
          credit.available > 0
      ),
    [credits]
  );

  const availableCreditTotal =
    pendingCredits.reduce(
      (sum, credit) =>
        sum + credit.available,
      0
    );

  async function refreshCredits({
    silent = false,
  } = {}) {
    if (!silent) {
      setCreditStatus("LOADING");
    }

    setCreditError("");

    try {
      const rows =
        await loadAttributeCredits();

      setCredits(
        rows.map(
          normalizeAttributeCredit
        )
      );

      setCreditStatus("READY");
    } catch (error) {
      console.warn(
        "ATTRIBUTE CREDIT LEDGER DEFERRED:",
        error
      );

      setCreditStatus("DEGRADED");
      setCreditError(
        error?.message ||
          "ATTRIBUTE_CREDIT_LEDGER_UNAVAILABLE"
      );
    }
  }

  useEffect(() => {
    let active = true;

    async function loadCredits() {
      try {
        const rows =
          await loadAttributeCredits();

        if (!active) {
          return;
        }

        setCredits(
          rows.map(
            normalizeAttributeCredit
          )
        );
        setCreditStatus("READY");
        setCreditError("");
      } catch (error) {
        if (!active) {
          return;
        }

        setCreditStatus("DEGRADED");
        setCreditError(
          error?.message ||
            "ATTRIBUTE_CREDIT_LEDGER_UNAVAILABLE"
        );
      }
    }

    setCreditStatus("LOADING");
    void loadCredits();

    return () => {
      active = false;
    };
  }, [
    profile?.fingerprint,
  ]);

  async function allocateCredit(
    credit,
    attribute
  ) {
    const actionKey =
      credit.id + ":" + attribute;

    if (allocatingKey) {
      return;
    }

    setAllocatingKey(actionKey);
    setCreditError("");
    setCreditNotice("");

    try {
      await allocateAttributeCreditOnBackend({
        creditId: credit.id,
        attribute,
        amount: 1,
      });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      applyAuthoritativeProfile?.(
        normalizeProfile(hydrated)
      );

      await refreshCredits({
        silent: true,
      });

      setCreditNotice(
        "+1 " +
          attribute +
          " ALLOCATED • BACKEND CONFIRMED"
      );
    } catch (error) {
      console.error(
        "ATTRIBUTE CREDIT ALLOCATION FAILED:",
        error
      );

      setCreditError(
        error?.message ||
          "ATTRIBUTE_CREDIT_ALLOCATION_FAILED"
      );
    } finally {
      setAllocatingKey("");
    }
  }

  return (
    <div className="page">
      <PageHero
        eyebrow="CHARACTER DEVELOPMENT"
        title="ATTRIBUTES"
        text="Class identity sets your starting path. Verified actions earn controlled credits you choose where to place."
      />

      <div className="cloud-backed-strip card3d">
        <span>● CLOUD BACKED</span>
        <small>
          CLASS BASELINE + ATTRIBUTE CREDITS ARE VERIFIED BY YOUR SUPABASE ACCOUNT
        </small>
      </div>

      <section className="attribute-command-deck card3d">
        <div className="attribute-command-primary">
          <small>CLASS ALIGNMENT</small>
          <strong>{alignment.score}%</strong>
          <p>
            {path} core: {blueprint.core.join(" • ")}
          </p>
        </div>

        <div className="attribute-command-stat">
          <small>CORE AVERAGE</small>
          <strong>{alignment.coreAverage}</strong>
          <span>SUPPORT {alignment.supportAverage}</span>
        </div>

        <div className="attribute-command-stat">
          <small>UNSPENT CREDITS</small>
          <strong>{availableCreditTotal}</strong>
          <span>
            {creditStatus === "LOADING"
              ? "SYNCING"
              : creditStatus === "DEGRADED"
                ? "RETRY REQUIRED"
                : "BACKEND LEDGER"}
          </span>
        </div>

        <button
          type="button"
          className="system-action attribute-credit-sync"
          onClick={() =>
            refreshCredits()
          }
          disabled={
            creditStatus === "LOADING" ||
            Boolean(allocatingKey)
          }
        >
          {creditStatus === "LOADING"
            ? "SYNCING"
            : "SYNC CREDITS"}
        </button>
      </section>

      <section className="attribute-credit-console">
        <SectionLabel
          number="01"
          title="ATTRIBUTE CREDIT CONSOLE"
        />

        <div className="attribute-credit-console-intro">
          <p>
            Spend only on the attributes earned by the verified quest. The browser cannot create, alter or duplicate credits.
          </p>

          {creditNotice && (
            <strong className="attribute-credit-feedback success">
              {creditNotice}
            </strong>
          )}

          {creditError && (
            <strong className="attribute-credit-feedback error">
              {String(creditError)
                .replace(/_/g, " ")
                .toUpperCase()}
            </strong>
          )}
        </div>

        {creditStatus === "LOADING" && (
          <div className="attribute-credit-empty card3d">
            <strong>SYNCING ATTRIBUTE CREDITS</strong>
            <p>Your earned credits are being read from the secure progression ledger.</p>
          </div>
        )}

        {creditStatus !== "LOADING" &&
          pendingCredits.length === 0 && (
          <div className="attribute-credit-empty card3d">
            <strong>NO UNSPENT ATTRIBUTE CREDITS</strong>
            <p>Complete a verified quest to earn a class-guided credit allocation.</p>
          </div>
        )}

        <div className="attribute-credit-list">
          {pendingCredits.map(
            (credit) => (
              <article
                key={credit.id}
                className="attribute-credit-card card3d"
              >
                <div className="attribute-credit-card-head">
                  <div>
                    <small>VERIFIED QUEST CREDIT</small>
                    <h3>{credit.sourceTitle}</h3>
                    <p>{credit.sourceCategory} DIRECTIVE</p>
                  </div>

                  <strong>
                    {credit.available} AVAILABLE
                  </strong>
                </div>

                <div className="attribute-credit-actions">
                  {credit.eligibleAttributes.map(
                    (attribute) => {
                      const tier =
                        getAttributeTier(
                          path,
                          attribute
                        );
                      const actionKey =
                        credit.id + ":" + attribute;

                      return (
                        <button
                          key={attribute}
                          type="button"
                          className={
                            "attribute-credit-option is-" +
                            tier.toLowerCase()
                          }
                          disabled={
                            Boolean(allocatingKey)
                          }
                          onClick={() =>
                            allocateCredit(
                              credit,
                              attribute
                            )
                          }
                        >
                          <span>{tier}</span>
                          <strong>
                            {allocatingKey ===
                            actionKey
                              ? "ALLOCATING"
                              : "+1 " + attribute}
                          </strong>
                        </button>
                      );
                    }
                  )}
                </div>
              </article>
            )
          )}
        </div>
      </section>

      <div className="attribute-grid">
        {orderedAttributes.map(
          ([
            name,
            value,
          ]) => {
            const tier =
              getAttributeTier(path, name);

            return (
            <div
              key={
                name
              }
              className={
                "attribute-card card3d attribute-tier-" +
                tier.toLowerCase()
              }
            >
              <div>
                <div className="attribute-card-label">
                  <span>
                    {name}
                  </span>
                  <small>{tier}</small>
                </div>

                <strong>
                  {effectiveAttributes(profile)[name]}
                </strong>
                {Number(profile.equipment?.bonuses?.[name]) > 0 && <small className="equipment-attribute-detail">{value} BASE + {profile.equipment.bonuses[name]} GEAR</small>}
              </div>

              <div className="attribute-track">
                <div
                  style={{
                    width:
                      Math.min(
                        effectiveAttributes(profile)[name],
                        100
                      ) +
                      "%",
                  }}
                />
              </div>
            </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export const SKILL_RANKS = [
  "E",
  "D",
  "C",
  "B",
  "A",
  "S",
];

export const RANK_REQUIREMENTS = {
  E: 0,
  D: 3,
  C: 3,
  B: 3,
  A: 2,
  S: 2,
};

export const CLASS_CURRICULUM = {
  ASSASSIN: {
    title:
      "PRECISION / SPEED / EXECUTION",
    statement:
      "Reaction, footwork, movement control, fast execution and disciplined action.",
  },

  TANK: {
    title:
      "STRENGTH / DURABILITY / RECOVERY",
    statement:
      "Strength, load tolerance, grip, stability, recovery and long-cycle resilience.",
  },

  MAGE: {
    title:
      "KNOWLEDGE / FOCUS / RESEARCH",
    statement:
      "Study, memory, deep work, research, synthesis, teaching and applied intelligence.",
  },

  RANGER: {
    title:
      "ENDURANCE / EXPLORATION / ADAPTATION",
    statement:
      "Pacing, distance, breathing, terrain, navigation and sustained performance.",
  },

  COMMANDER: {
    title:
      "LEADERSHIP / SYSTEMS / WEALTH",
    statement:
      "Planning, communication, delegation, money visibility, projects and operational command.",
  },
};

export function movementTargetForWorkout(workout) {
  if (
    getWorkoutVerificationMode(workout) !==
    WORKOUT_VERIFICATION_MODES.GPS
  ) {
    return null;
  }

  const text =
    (
      String(workout?.name || "") +
      " " +
      String(workout?.description || "")
    ).toUpperCase();

  const distanceMatch =
    text.match(
      /(\d+(?:\.\d+)?)\s*KM\b/
    );

  if (distanceMatch) {
    const value =
      Number(distanceMatch[1]);

    return {
      kind: "DISTANCE",
      distanceKm: value,
      label:
        value +
        " KM",
    };
  }

  if (
    /\b(?:RUN|WALK|JOG|HIKE|TRAIL|SPRINT|CYCLE|CYCLING|BIKE|SWIM)\b/.test(
      text
    ) &&
    Number(workout?.estimated_minutes) > 0
  ) {
    const minutes =
      Number(
        workout.estimated_minutes
      );

    return {
      kind: "DURATION",
      durationSeconds:
        minutes * 60,
      label:
        minutes +
        " MIN",
    };
  }

  return null;
}

export function movementTargetForQuest(quest) {
  const name =
    String(
      quest?.name || ""
    ).toUpperCase();

  const task =
    String(
      quest?.task || ""
    ).toUpperCase();

  const distanceMatch =
    (
      name +
      " " +
      task
    ).match(
      /(\d+(?:\.\d+)?)\s*KM\b/
    );

  if (distanceMatch) {
    const value =
      Number(
        distanceMatch[1]
      );

    return {
      kind: "DISTANCE",
      distanceKm:
        value,
      label:
        value +
        " KM",
    };
  }

  const minuteMatch =
    task.match(
      /(\d+)\s*MINUTE/
    );

  if (
    minuteMatch &&
    /WALK|RUN|JOG|MOVING|MOVEMENT|OUTDOOR/.test(
      name +
      " " +
      task
    )
  ) {
    const minutes =
      Number(
        minuteMatch[1]
      );

    return {
      kind: "DURATION",
      durationSeconds:
        minutes * 60,
      label:
        minutes +
        " MIN",
    };
  }

  return null;
}

export function gpsMissionProgress(
  mission,
  distanceKm,
  durationSeconds
) {
  if (!mission) {
    return {
      reached: false,
      percent: 0,
      currentLabel: "",
      targetLabel: "",
    };
  }

  if (
    mission.targetKind ===
    "DISTANCE"
  ) {
    const target =
      Number(
        mission.targetDistanceKm ||
        0
      );

    return {
      reached:
        target > 0 &&
        distanceKm >= target,
      percent:
        target > 0
          ? Math.min(
              100,
              distanceKm /
                target *
                100
            )
          : 0,
      currentLabel:
        distanceKm.toFixed(
          2
        ) +
        " KM",
      targetLabel:
        target.toFixed(
          target % 1
            ? 1
            : 0
        ) +
        " KM",
    };
  }

  const target =
    Number(
      mission.targetDurationSeconds ||
      0
    );

  return {
    reached:
      target > 0 &&
      durationSeconds >=
        target,
    percent:
      target > 0
        ? Math.min(
            100,
            durationSeconds /
              target *
              100
          )
        : 0,
    currentLabel:
      formatMovementTime(
        durationSeconds
      ),
    targetLabel:
      formatMovementTime(
        target
      ),
  };
}

export function WorkoutTimerModal({
  timer,
  onClose,
  onComplete,
}) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const session =
    timer?.session ||
    timer?.timer_session ||
    timer ||
    {};

  const workout =
    timer?.workout ||
    session?.workout ||
    {};

  const startedAt =
    session?.started_at ||
    session?.startedAt ||
    timer?.started_at ||
    "";

  const targetSeconds =
    Number(
      session?.target_seconds ||
      session?.targetSeconds ||
      timer?.target_seconds ||
      Number(workout?.estimated_minutes || 0) * 60
    ) || 0;

  const plan = useMemo(
    () => buildTimedWorkoutPlan(workout?.steps || []),
    [workout?.steps]
  );

  const countdown = getTimedWorkoutCountdown({
    startedAt,
    targetSeconds,
    serverOffsetMs: Number(timer?.serverOffsetMs || 0),
    nowMs: now,
  });

  const phase = getTimedWorkoutPhase(
    plan,
    countdown.elapsedSeconds
  );

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const previousBodyOverflow =
      document.body.style.overflow;
    const previousRootOverflow =
      document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  async function claim() {
    if (!countdown.complete || busy) return;

    setBusy(true);
    setError("");

    try {
      await onComplete({
        timerSessionId:
          session?.id ||
          session?.session_id ||
          timer?.id,
        workout,
      });
    } catch (completionError) {
      const message = String(completionError?.message || "");

      setError(
        message.includes("TIMER_NOT_COMPLETE") ||
        message.includes("TIMER_SESSION_NOT_READY")
          ? "THE SERVER TIMER HAS NOT REACHED ZERO YET. KEEP THE SESSION OPEN."
          : message.includes("TIMER_EXPIRED")
            ? "THIS TIMER SESSION EXPIRED. START A FRESH TRAINING SESSION."
            : "THE TRAINING CLAIM COULD NOT BE VERIFIED. NO REWARD WAS APPLIED."
      );
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <div
      className="workout-timer-overlay"
      role="presentation"
    >
      <section
        className="workout-timer-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Focused training countdown"
      >
        <header className="workout-timer-header">
          <div>
            <small>SERVER-VERIFIED FOCUS SESSION</small>
            <h2>{workout?.name || "TIMED TRAINING"}</h2>
            <p>{workout?.description || "Complete the protocol with controlled form."}</p>
          </div>

          <button
            type="button"
            className="workout-timer-close"
            disabled={busy}
            onClick={onClose}
            aria-label="Close timer"
          >
            ×
          </button>
        </header>

        <div className="workout-timer-clock" aria-live="polite">
          <small>SESSION COUNTDOWN</small>
          <strong>{formatMovementTime(countdown.remainingSeconds)}</strong>
          <span>{countdown.complete ? "READY TO VERIFY" : "SERVER CLOCK ACTIVE"}</span>
        </div>

        <div className="workout-timer-protocol">
          {phase ? (
            <>
              <small>{phase.type === "REST" ? "RECOVER" : "CURRENT SET"}</small>
              <strong>{phase.type === "REST" ? "REST" : phase.exercise}</strong>
              <p>
                {phase.type === "REST"
                  ? `Prepare for ${phase.exercise} — set ${phase.set + 1} of ${phase.sets}.`
                  : `Set ${phase.set} of ${phase.sets}. Hold controlled form.`}
              </p>
              <b>{formatTimer(phase.remainingSeconds)}</b>
            </>
          ) : plan.length ? (
            <>
              <small>PROTOCOL COMPLETE</small>
              <strong>CONTROLLED RECOVERY</strong>
              <p>Use the remaining session time for breathing, form review, and recovery.</p>
              <b>STAY PRESENT</b>
            </>
          ) : (
            <>
              <small>FOCUS PROTOCOL</small>
              <strong>TRAIN WITH INTENTION</strong>
              <p>Keep the session active until the server countdown reaches zero.</p>
            </>
          )}
        </div>

        {error && <div className="workout-timer-error">{error}</div>}

        <div className="workout-timer-actions">
          <button
            type="button"
            className="workout-timer-secondary"
            disabled={busy}
            onClick={onClose}
          >
            CLOSE • TIMER CONTINUES
          </button>

          <button
            data-sfx="success"
            type="button"
            className="system-action"
            disabled={!countdown.complete || busy}
            onClick={claim}
          >
            {busy
              ? "VERIFYING..."
              : countdown.complete
                ? "VERIFY & CLAIM TRAINING"
                : "CLAIM UNLOCKS AT ZERO"}
          </button>
        </div>
      </section>
    </div>
  );

  return <SystemModalPortal>{modal}</SystemModalPortal>;
}

export function WorkoutTimerInlineStatus({
  timer,
  onOpen,
}) {
  const [now, setNow] =
    useState(Date.now());

  const session =
    timer?.session ||
    timer?.timer_session ||
    timer ||
    {};

  const workout =
    timer?.workout ||
    session?.workout ||
    {};

  const startedAt =
    session?.started_at ||
    session?.startedAt ||
    timer?.started_at ||
    "";

  const targetSeconds =
    Number(
      session?.target_seconds ||
      session?.targetSeconds ||
      timer?.target_seconds ||
      Number(workout?.estimated_minutes || 0) * 60
    ) || 0;

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => window.clearInterval(interval);
  }, []);

  if (!startedAt || !targetSeconds) {
    return null;
  }

  const countdown = getTimedWorkoutCountdown({
    startedAt,
    targetSeconds,
    serverOffsetMs: Number(timer?.serverOffsetMs || 0),
    nowMs: now,
  });

  return (
    <button
      type="button"
      className="workout-timer-inline"
      onClick={onOpen}
      aria-label="Open active workout timer"
    >
      <span>LIVE COUNTDOWN • TAP TO OPEN</span>
      <strong>
        {formatMovementTime(
          countdown.remainingSeconds
        )}
      </strong>
      <small>
        {countdown.complete
          ? "READY TO VERIFY"
          : "SERVER CLOCK ACTIVE"}
      </small>
    </button>
  );
}

export function MovementTracker({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
}) {
  const [status, setStatus] =
    useState("IDLE");

  const [watchId, setWatchId] =
    useState(null);

  const [points, setPoints] =
    useState([]);

  const [
    distanceMeters,
    setDistanceMeters,
  ] = useState(0);

  const [startedAt, setStartedAt] =
    useState(null);

  const [now, setNow] =
    useState(Date.now());

  const [accuracy, setAccuracy] =
    useState(null);

  const [error, setError] =
    useState("");

  const [lastSaved, setLastSaved] =
    useState(null);

  const [
    backendGpsSessionId,
    setBackendGpsSessionId,
  ] = useState(null);

  const wakeLockRef =
    useRef(null);

  const trackingRef =
    useRef(false);

  const lastVisibilityRef =
    useRef(
      document.visibilityState
    );

  const lastGoodPointRef =
    useRef(null);

  async function requestTrackingWakeLock() {
    try {
      if (
        "wakeLock" in navigator &&
        document.visibilityState ===
          "visible"
      ) {
        wakeLockRef.current =
          await navigator.wakeLock.request(
            "screen"
          );

        wakeLockRef.current?.addEventListener(
          "release",
          () => {
            wakeLockRef.current =
              null;
          }
        );
      }
    } catch (error) {
      console.warn(
        "GPS WAKE LOCK UNAVAILABLE:",
        error
      );
    }
  }

  async function releaseTrackingWakeLock() {
    try {
      await wakeLockRef.current?.release?.();
    } catch {
      // Ignore browsers that already released it.
    }

    wakeLockRef.current =
      null;
  }

  const active =
    status === "TRACKING";

  const durationSeconds =
    startedAt
      ? Math.max(
          0,
          Math.floor(
            (now - startedAt) / 1000
          )
        )
      : 0;

  const distanceKm =
    distanceMeters / 1000;

  const pace =
    formatPace(
      distanceKm,
      durationSeconds
    );

  const mission =
    profile.activeGpsMission ||
    null;

  const missionProgress =
    gpsMissionProgress(
      mission,
      distanceKm,
      durationSeconds
    );

  const today = todayKey();

  const sessions =
    profile.gpsSessions || [];

  const todayDistanceKm =
    sessions
      .filter(
        (session) =>
          session.dateKey === today
      )
      .reduce(
        (sum, session) =>
          sum +
          Number(
            session.distanceKm || 0
          ),
        0
      );

  const totalDistanceKm =
    sessions.reduce(
      (sum, session) =>
        sum +
        Number(
          session.distanceKm || 0
        ),
      0
    );

  useEffect(() => {
    if (!active) return;

    const timer =
      window.setInterval(
        () => setNow(Date.now()),
        1000
      );

    return () =>
      window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    return () => {
      if (
        watchId != null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          watchId
        );
      }
    };
  }, [watchId]);

  async function startTracking() {
    setError("");
    setLastSaved(null);

    if (!navigator.geolocation) {
      setError(
        "GPS IS NOT AVAILABLE IN THIS BROWSER."
      );
      return;
    }

    setPoints([]);
    setDistanceMeters(0);
    setAccuracy(null);

    setStatus("REQUESTING");

    try {
      const targetDistanceKm =
        mission?.targetKind ===
          "DISTANCE"
          ? Number(
              mission.targetDistanceKm ||
              0
            )
          : null;

      const targetDurationSeconds =
        mission?.targetKind ===
          "DURATION"
          ? Number(
              mission.targetDurationSeconds ||
              0
            )
          : (
              mission
                ? null
                : 10
            );

      const backend =
        await startGpsSessionOnBackend({
          activityType:
            mission?.source ===
              "WORKOUT"
              ? "WORKOUT"
              : mission?.source ===
                  "QUEST"
                ? "QUEST"
                : "MOVEMENT",
          targetDistanceKm:
            targetDistanceKm > 0
              ? targetDistanceKm
              : null,
          targetDurationSeconds:
            targetDurationSeconds > 0
              ? targetDurationSeconds
              : null,
          metadata: {
            mission_source:
              mission?.source ||
              null,
            mission_source_id:
              mission?.sourceId ||
              null,
            mission_name:
              mission?.name ||
              null,
          },
        });

      const session =
        backend?.data;

      if (!session?.id) {
        throw new Error(
          "GPS_BACKEND_SESSION_NOT_CREATED"
        );
      }

      setBackendGpsSessionId(
        session.id
      );

      const start =
        Date.now();

      setStartedAt(start);
      setNow(start);

      const id =
        navigator.geolocation.watchPosition(
          (position) => {
            const nextPoint = {
              lat:
                position.coords.latitude,
              lon:
                position.coords.longitude,
              accuracy:
                position.coords.accuracy,
              timestamp:
                position.timestamp ||
                Date.now(),
            };

            setAccuracy(
              position.coords.accuracy
            );

            if (
              Number(
                nextPoint.accuracy ||
                999
              ) > 90
            ) {
              return;
            }

            lastGoodPointRef.current =
              nextPoint;

            setPoints((current) => {
              const previous =
                current[
                  current.length - 1
                ];

              if (previous) {
                const jump =
                  haversineMeters(
                    previous,
                    nextPoint
                  );

                const tolerance =
                  Math.max(
                    100,
                    Math.max(
                      Number(
                        previous.accuracy ||
                        50
                      ),
                      Number(
                        nextPoint.accuracy ||
                        50
                      )
                    ) * 2.5
                  );

                if (
                  jump <= tolerance
                ) {
                  setDistanceMeters(
                    (value) =>
                      value +
                      jump
                  );
                }
              }

              return [
                ...current,
                nextPoint,
              ];
            });

            setStatus(
              "TRACKING"
            );
          },
          (geoError) => {
            setStatus("ERROR");

            const message =
              geoError.code === 1
                ? "LOCATION PERMISSION WAS DENIED."
                : geoError.code === 2
                  ? "GPS POSITION IS CURRENTLY UNAVAILABLE."
                  : geoError.code === 3
                    ? "GPS REQUEST TIMED OUT."
                    : "GPS TRACKING FAILED.";

            setError(message);
          },
          {
            enableHighAccuracy:
              true,
            maximumAge:
              2000,
            timeout:
              15000,
          }
        );

      setWatchId(id);
      trackingRef.current = true;
      void requestTrackingWakeLock();
    } catch (backendError) {
      console.error(
        "GPS BACKEND START FAILED:",
        backendError
      );

      setStatus("ERROR");
      setBackendGpsSessionId(
        null
      );
      setError(
        "SYSTEM COULD NOT START AN AUTHORITATIVE GPS SESSION."
      );
    }
  }

  function stopWatch() {
    if (
      watchId != null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchId
      );
    }

    setWatchId(null);
  
    trackingRef.current =
      false;

    void releaseTrackingWakeLock();
  }

  function discardTracking() {
    stopWatch();

    setStatus("IDLE");
    setStartedAt(null);
    setPoints([]);
    setDistanceMeters(0);
    setAccuracy(null);
    setBackendGpsSessionId(null);
    setError("");
  }

  async function endTracking() {
    stopWatch();
    setStatus("IDLE");

    const endedAt =
      Date.now();

    const finalDuration =
      startedAt
        ? Math.max(
            0,
            Math.floor(
              (
                endedAt -
                startedAt
              ) / 1000
            )
          )
        : 0;

    const finalDistanceKm =
      Number(
        (
          distanceMeters /
          1000
        ).toFixed(3)
      );

    if (
      finalDuration < 10 ||
      points.length < 2
    ) {
      setError(
        "SESSION TOO SHORT TO SAVE AS GPS PROOF."
      );
      return;
    }

    if (!backendGpsSessionId) {
      setError(
        "NO AUTHORITATIVE GPS SESSION EXISTS. NOTHING WAS REWARDED."
      );
      return;
    }

    const route =
      points.map(
        (point) => ({
          lat:
            Number(
              point.lat.toFixed(6)
            ),
          lon:
            Number(
              point.lon.toFixed(6)
            ),
          accuracy:
            Math.round(
              Number(
                point.accuracy ||
                0
              )
            ),
          timestamp:
            point.timestamp,
        })
      );

    try {
      let result;

      if (
        mission?.source ===
        "WORKOUT"
      ) {
        result =
          await finishGpsWorkoutOnBackend({
            sessionId:
              backendGpsSessionId,
            workoutId:
              mission.sourceId,
            distanceKm:
              finalDistanceKm,
            durationSeconds:
              finalDuration,
            route,
            metadata: {
              mission_name:
                mission.name,
            },
          });
      } else {
        result =
          await finishGpsSessionOnBackend({
            sessionId:
              backendGpsSessionId,
            distanceKm:
              finalDistanceKm,
            durationSeconds:
              finalDuration,
            route,
            metadata: {
              mission_source:
                mission?.source ||
                null,
              mission_name:
                mission?.name ||
                null,
            },
          });

        if (
          result?.data?.verified &&
          mission?.source ===
            "QUEST"
        ) {
          await completeQuestByTitleOnBackend({
            title:
              mission.name,
            context:
              "GPS",
            proof: {
              type:
                "GPS",
              verifiedAt:
                new Date(
                  endedAt
                ).toISOString(),
            },
            legacyKey:
              mission.id ||
              null,
          });
        }
      }

      const backendResult =
        result?.data ||
        {};

      const verified =
        Boolean(
          backendResult.verified
        );

      const backendSession =
        backendResult.session ||
        {};

      const session = {
        id:
          backendSession.id ||
          backendGpsSessionId,
        type:
          backendSession.activity_type ||
          "MOVEMENT",
        proofType:
          "GPS",
        proofId:
          backendResult.proof_id ||
          null,
        verified,
        dateKey:
          todayKey(),
        startedAt:
          backendSession.started_at ||
          new Date(
            startedAt
          ).toISOString(),
        endedAt:
          backendSession.ended_at ||
          new Date(
            endedAt
          ).toISOString(),
        durationSeconds:
          Number(
            backendSession.duration_seconds ??
            finalDuration
          ),
        distanceKm:
          Number(
            backendSession.distance_km ??
            finalDistanceKm
          ),
        averagePace:
          formatPace(
            finalDistanceKm,
            finalDuration
          ),
        bossDamage:
          Number(
            backendResult.boss_damage ||
            0
          ),
        authoritative:
          true,
      };

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      updated = {
        ...updated,
        gpsSessions: [
          session,
          ...(
            profile.gpsSessions ||
            []
          ).filter(
            (item) =>
              item.id !==
              session.id
          ),
        ],
        totalDistance:
          Number(
            (
              Number(
                profile.totalDistance ||
                0
              ) +
              session.distanceKm
            ).toFixed(3)
          ),
        activeGpsMission:
          verified
            ? null
            : mission,
      };

      updated =
        addHistory(
          updated,
          verified
            ? "GPS VERIFIED"
            : "GPS ENDED EARLY",
          mission?.name ||
            "MOVEMENT SESSION",
          session.distanceKm.toFixed(
            2
          ) +
            " KM • " +
            formatMovementTime(
              session.durationSeconds
            ) +
            (
              session.bossDamage >
              0
                ? " • " +
                  session.bossDamage +
                  " BOSS DAMAGE"
                : ""
            )
        );

      applyAuthoritativeProfile(
        updated
      );

      setLastSaved({
        ...session,
        missionCompleted:
          verified &&
          Boolean(
            mission
          ),
        missionSource: mission?.source,
        missionName:
          mission?.name ||
          "",
      });

      setBackendGpsSessionId(
        null
      );

      if (
        mission &&
        !verified
      ) {
        setError(
          "GPS SESSION SAVED, BUT THE SERVER DID NOT VERIFY THE MISSION TARGET. NO MISSION REWARD WAS APPLIED."
        );
      }
    } catch (backendError) {
      console.error(
        "AUTHORITATIVE GPS FINISH FAILED:",
        backendError
      );

      setError(
        "SYSTEM BACKEND COULD NOT VERIFY THIS GPS SESSION. NO LOCAL REWARD WAS APPLIED."
      );
    }
  }

  function cancelGpsMission() {
    if (
      active ||
      status ===
        "REQUESTING"
    ) {
      setError(
        "END OR DISCARD THE ACTIVE GPS SESSION BEFORE CANCELLING THE MISSION."
      );
      return;
    }

    saveProfile({
      ...profile,
      activeGpsMission:
        null,
    });

    setError("");
    setLastSaved(null);
  }

  useEffect(() => {
    function recoverTracking() {
      const visible =
        document.visibilityState ===
          "visible";

      if (
        visible &&
        trackingRef.current
      ) {
        void requestTrackingWakeLock();

        if (
          watchId == null &&
          navigator.geolocation
        ) {
          const id =
            navigator.geolocation.watchPosition(
              (position) => {
                const point = {
                  lat:
                    position.coords.latitude,
                  lon:
                    position.coords.longitude,
                  accuracy:
                    position.coords.accuracy,
                  timestamp:
                    position.timestamp ||
                    Date.now(),
                };

                setAccuracy(
                  position.coords.accuracy
                );

                if (
                  Number(
                    point.accuracy ||
                      999
                  ) > 90
                ) {
                  return;
                }

                setPoints(
                  (current) => {
                    const previous =
                      current[
                        current.length -
                          1
                      ];

                    if (previous) {
                      const jump =
                        haversineMeters(
                          previous,
                          point
                        );

                      const elapsedMs =
                        Math.max(
                          1,
                          Number(
                            point.timestamp
                          ) -
                            Number(
                              previous.timestamp ||
                                point.timestamp
                            )
                        );

                      const speedMps =
                        jump /
                        (
                          elapsedMs /
                          1000
                        );

                      const tolerance =
                        Math.max(
                          100,
                          Math.max(
                            Number(
                              previous.accuracy ||
                                50
                            ),
                            Number(
                              point.accuracy ||
                                50
                            )
                          ) *
                            2.5
                        );

                      if (
                        jump <=
                          tolerance &&
                        speedMps <=
                          12
                      ) {
                        setDistanceMeters(
                          (value) =>
                            value +
                            jump
                        );
                      }
                    }

                    return [
                      ...current,
                      point,
                    ];
                  }
                );

                setStatus(
                  "TRACKING"
                );
              },
              (geoError) => {
                console.warn(
                  "GPS RECOVERY WATCH ERROR:",
                  geoError
                );
              },
              {
                enableHighAccuracy:
                  true,
                maximumAge:
                  1000,
                timeout:
                  15000,
              }
            );

          setWatchId(
            id
          );
        }
      }

      lastVisibilityRef.current =
        document.visibilityState;
    }

    function handleVisibility() {
      if (
        document.visibilityState ===
          "visible"
      ) {
        recoverTracking();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "pageshow",
      recoverTracking
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "pageshow",
        recoverTracking
      );
    };
  }, [
    watchId,
  ]);


  return (
    <section className="movement-tracker">
      <div className="movement-hero card3d">
        <div>
          <small>
            TRAINING • GPS
          </small>

          <h2>
            MOVEMENT TRACKING
          </h2>

          <p>
            Record walking and running with live device GPS. Location is used only while a session is active.
          </p>
        </div>

        <div
          className={
            "gps-status " +
            status.toLowerCase()
          }
        >
          <span>●</span>

          <strong>
            {status === "TRACKING"
              ? "GPS LOCKED"
              : status === "REQUESTING"
                ? "ACQUIRING GPS"
                : status === "ERROR"
                  ? "GPS ERROR"
                  : "GPS STANDBY"}
          </strong>
        </div>
      </div>

      {mission && (
        <div className="gps-mission-panel card3d">
          <div className="gps-mission-head">
            <div>
              <small>
                ACTIVE GPS MISSION •{" "}
                {mission.source ===
                "WORKOUT"
                  ? "WORKOUT"
                  : "QUEST"}
              </small>

              <h3>
                {mission.name}
              </h3>
            </div>

            <strong>
              {missionProgress.reached
                ? "TARGET REACHED"
                : mission.targetLabel}
            </strong>
          </div>

          <div className="gps-mission-progress">
            <div>
              <span>
                CURRENT
              </span>

              <b>
                {
                  missionProgress.currentLabel
                }
              </b>
            </div>

            <div className="gps-target-track">
              <i
                style={{
                  width:
                    missionProgress.percent +
                    "%",
                }}
              />
            </div>

            <div>
              <span>
                TARGET
              </span>

              <b>
                {
                  missionProgress.targetLabel
                }
              </b>
            </div>
          </div>

          <p>
            {missionProgress.reached
              ? "Requirement satisfied. End and save the session to verify the mission and claim progression."
              : "Reach the target with GPS active. Ending early saves the session but will not complete the mission."}
          </p>

          {!active &&
            status !==
              "REQUESTING" && (
            <button
              type="button"
              className="gps-cancel-mission"
              onClick={
                cancelGpsMission
              }
            >
              CANCEL GPS MISSION
            </button>
          )}
        </div>
      )}

      <div className="movement-summary-grid">
        <div className="card3d">
          <small>TODAY</small>
          <strong>
            {todayDistanceKm.toFixed(2)} KM
          </strong>
        </div>

        <div className="card3d">
          <small>TOTAL</small>
          <strong>
            {totalDistanceKm.toFixed(2)} KM
          </strong>
        </div>

        <div className="card3d">
          <small>SESSIONS</small>
          <strong>
            {sessions.length}
          </strong>
        </div>
      </div>

      <div className="movement-live card3d">
        <div className="movement-live-top">
          <div>
            <small>
              ACTIVE SESSION
            </small>

            <h3>
              WALK / RUN
            </h3>
          </div>

          <span>
            {active
              ? "● RECORDING"
              : "○ READY"}
          </span>
        </div>

        <div className="movement-metrics">
          <div>
            <small>DISTANCE</small>
            <strong>
              {distanceKm.toFixed(2)} KM
            </strong>
          </div>

          <div>
            <small>DURATION</small>
            <strong>
              {formatMovementTime(
                durationSeconds
              )}
            </strong>
          </div>

          <div>
            <small>AVG PACE</small>
            <strong>{pace}</strong>
          </div>

          <div>
            <small>GPS ACCURACY</small>
            <strong>
              {accuracy
                ? "±" +
                  Math.round(accuracy) +
                  " M"
                : "--"}
            </strong>
          </div>

          <div>
            <small>ROUTE POINTS</small>
            <strong>
              {points.length}
            </strong>
          </div>
        </div>

        {error && (
          <div className="movement-error">
            ⚠ {error}
          </div>
        )}

        {lastSaved && (
          <div className="movement-success">
            {lastSaved.missionCompleted
              ? "✓ MISSION VERIFIED"
              : "✓ GPS PROOF SAVED"}{" "}
            •{" "}
            {Number(
              lastSaved.distanceKm
            ).toFixed(2)} KM
            {lastSaved.missionSource === "CLASS_SPECIAL" && <p>Return to CLASS SPECIAL and refresh the route status to claim your practice.</p>}
          </div>
        )}

        <div className="movement-actions">
          {!active &&
            status !== "REQUESTING" && (
            <button
              type="button"
              className="mission-start-button"
              onClick={startTracking}
            >
              <span>
                {mission
                  ? "START MISSION"
                  : "START TRACKING"}
              </span>

              <i aria-hidden="true">
                ↗
              </i>
            </button>
          )}

          {status === "REQUESTING" && (
            <button
              type="button"
              className="mission-start-button is-loading"
              disabled
            >
              <span>
                ACQUIRING GPS
              </span>

              <i aria-hidden="true">
                •
              </i>
            </button>
          )}

          {active && (
            <div className="gps-session-action-stack">
              <button
                type="button"
                className="gps-end-session-button"
                onClick={endTracking}
              >
                <span className="gps-action-icon">
                  ✓
                </span>

                <span className="gps-action-copy">
                  <strong>
                    END & SAVE
                  </strong>

                  <small>
                    VERIFY SESSION
                  </small>
                </span>

                <i aria-hidden="true">
                  ↗
                </i>
              </button>

              <button
                type="button"
                className="gps-discard-session-button"
                onClick={discardTracking}
              >
                <span>
                  DISCARD SESSION
                </span>

                <small>
                  NO REWARD
                </small>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="movement-history card3d">
        <small>
          GPS PROOF ARCHIVE
        </small>

        <h3>
          RECENT SESSIONS
        </h3>

        {sessions.length === 0 ? (
          <div className="movement-empty">
            NO GPS SESSIONS RECORDED YET.
          </div>
        ) : (
          <div className="movement-session-list">
            {sessions
              .slice(0, 10)
              .map(
                (session) => (
                  <div
                    className="movement-session-row"
                    key={session.id}
                  >
                    <div>
                      <strong>
                        {Number(
                          session.distanceKm || 0
                        ).toFixed(2)} KM
                      </strong>

                      <small>
                        {new Date(
                          session.startedAt
                        ).toLocaleString()}
                      </small>
                    </div>

                    <span>
                      {formatMovementTime(
                        session.durationSeconds
                      )}
                    </span>

                    <span>
                      {session.averagePace || "--"}
                    </span>

                    <b>
                      ✓ GPS
                    </b>
                  </div>
                )
              )}
          </div>
        )}
      </div>
    </section>
  );
}

export function normalizeClassAffinity(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (item) =>
          String(item)
            .trim()
            .toUpperCase()
      )
      .filter(Boolean);
  }

  if (
    value == null
  ) {
    return [];
  }

  const text =
    String(value)
      .trim();

  if (!text) {
    return [];
  }

  // Supports:
  // ["MAGE","ASSASSIN"]
  // {MAGE,ASSASSIN}
  // MAGE,ASSASSIN
  try {
    const parsed =
      JSON.parse(text);

    if (
      Array.isArray(parsed)
    ) {
      return parsed
        .map(
          (item) =>
            String(item)
              .trim()
              .toUpperCase()
        )
        .filter(Boolean);
    }
  } catch {
    // fall through
  }

  return text
    .replace(
      /^[{\[]|[}\]]$/g,
      ""
    )
    .replace(
      /"/g,
      ""
    )
    .split(",")
    .map(
      (item) =>
        item
          .trim()
          .toUpperCase()
    )
    .filter(Boolean);
}

export function Training({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
  completeWorkout,
  startTimedWorkout,
  completeTimedWorkout,
}) {
  const activeClass =
    String(
      profile.path ||
      ""
    )
      .trim()
      .toUpperCase();
  const [mode, setMode] =
    useState(
      profile.activeGpsMission
        ? "TRACKING"
        : "SKILLS"
    );

  useEffect(() => {
    if (profile.activeGpsMission?.id) setMode("TRACKING");
  }, [profile.activeGpsMission?.id]);

  const [catalog, setCatalog] =
    useState({
      loading: true,
      workouts: [],
      skills: [],
      prerequisites: [],
      requirements: [],
    });

  const [
    catalogError,
    setCatalogError,
  ] = useState("");

  const [
    catalogReloadToken,
    setCatalogReloadToken,
  ] = useState(0);

  const [
    learningSkill,
    setLearningSkill,
  ] = useState(null);

  const [
    learningForm,
    setLearningForm,
  ] = useState({
    sourceTitle: "",
    sourceType: "BOOK",
    durationMinutes: "",
    summary: "",
    takeaway1: "",
    takeaway2: "",
    takeaway3: "",
    application: "",
  });

  const [
    learningSaving,
    setLearningSaving,
  ] = useState(false);

  const [
    learningError,
    setLearningError,
  ] = useState("");

  const [
    masterySkill,
    setMasterySkill,
  ] = useState(null);

  const [
    masteryValue,
    setMasteryValue,
  ] = useState("");

  const [
    masteryEvidence,
    setMasteryEvidence,
  ] = useState("");

  const [
    masteryProofFile,
    setMasteryProofFile,
  ] = useState(null);

  const [
    unlockNotice,
    setUnlockNotice,
  ] = useState(null);

  const [
    focusedSkillId,
    setFocusedSkillId,
  ] = useState(null);

  const [activeTimer, setActiveTimer] =
    useState(null);

  const [timerModalOpen, setTimerModalOpen] =
    useState(false);

  const [resumableTimerId, setResumableTimerId] =
    useState(null);

  const [timerStartingId, setTimerStartingId] =
    useState(null);

  const [timerError, setTimerError] =
    useState("");

  useEffect(() => {
    let active = true;

    setCatalog(
      (current) => ({
        ...current,
        loading: true,
      })
    );

    if (
      catalogReloadToken >
      0
    ) {
      setCatalogError("");
    }

    loadTrainingCatalog()
      .then((data) => {
        if (active) {
          setCatalog({
            loading: false,
            workouts:
              data.workouts || [],
            skills:
              data.skills || [],
            prerequisites:
              data.prerequisites || [],
            requirements:
              data.requirements || [],
          });

          setCatalogError(
            data.warning || ""
          );
        }
      })
      .catch((error) => {
        console.error(
          "SYSTEM TRAINING CATALOG LOAD FAILED:",
          error
        );

        if (active) {
          setCatalog((current) => ({
            ...current,
            loading: false,
          }));

          setCatalogError(
            error?.message ||
            "TRAINING CATALOG FAILED TO LOAD."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    catalogReloadToken,
  ]);

  const masteredNames =
    useMemo(
      () =>
        new Set(
          Object.entries(
            profile.masteredSkills ||
            {}
          )
            .filter(
              ([, mastered]) =>
                Boolean(mastered)
            )
            .map(([name]) =>
              String(name).toUpperCase()
            )
        ),
      [profile.masteredSkills]
    );

  const skillById =
    useMemo(
      () =>
        new Map(
          catalog.skills.map(
            (skill) => [
              skill.id,
              skill,
            ]
          )
        ),
      [catalog.skills]
    );

  const completedWorkoutNames =
    useMemo(
      () =>
        new Set(
          (
            profile.workoutLog ||
            []
          ).map((entry) =>
            String(
              entry?.name || ""
            ).toUpperCase()
          )
        ),
      [profile.workoutLog]
    );

  const workoutsUnlockedBySkill = (
    skill
  ) =>
    catalog.requirements
      .filter(
        (requirement) =>
          requirement.skill_id ===
          skill.id
      )
      .map((requirement) =>
        visibleWorkouts.find(
          (workout) =>
            workout.id ===
            requirement.workout_id
        )
      )
      .filter(Boolean);

  const requiredSkillsForWorkout = (
    workout
  ) =>
    catalog.requirements
      .filter(
        (requirement) =>
          requirement.workout_id ===
          workout.id
      )
      .map((requirement) =>
        skillById.get(
          requirement.skill_id
        )
      )
      .filter(Boolean);

  function trainingCompletedAfterSkill(
    skill
  ) {
    const linked =
      workoutsUnlockedBySkill(
        skill
      );

    if (
      linked.length === 0
    ) {
      return true;
    }

    return linked.some(
      (workout) =>
        completedWorkoutNames.has(
          String(
            workout.name
          ).toUpperCase()
        )
    );
  }

  const classCoreSkills =
    useMemo(
      () =>
        catalog.skills.filter(
          (skill) => {
            const affinity =
              normalizeClassAffinity(
                skill.class_affinity
              );

            if (
              !affinity.includes(
                activeClass
              )
            ) {
              return false;
            }

            if (
              skill.skill_scope ===
              "UNIVERSAL"
            ) {
              return false;
            }

            // Mage is a knowledge-first class.
            // Do not bury its mental tree under legacy
            // handstand / L-sit / calisthenics entries.
            if (
              activeClass ===
              "MAGE"
            ) {
              const mentalGroups =
                new Set([
                  "MIND",
                  "KNOWLEDGE",
                  "MEMORY",
                  "FOCUS",
                  "RESEARCH",
                  "SYNTHESIS",
                  "TEACHING",
                  "MASTERY",
                  "COGNITION",
                  "LEARNING",
                ]);

              const group =
                String(
                  skill.progression_group ||
                  ""
                ).toUpperCase();

              return (
                skill.proof_type ===
                  "LEARNING" ||
                skill.proof_type ===
                  "PROJECT" ||
                skill.proof_type ===
                  "MIXED" ||
                mentalGroups.has(
                  group
                )
              );
            }

            return true;
          }
        ),
      [
        catalog.skills,
        activeClass,
      ]
    );

  const universalSkills =
    useMemo(
      () =>
        catalog.skills.filter(
          (skill) =>
            skill.skill_scope ===
            "UNIVERSAL"
        ),
      [catalog.skills]
    );

  const classAffinitySkills =
    useMemo(
      () =>
        catalog.skills.filter(
          (skill) =>
            normalizeClassAffinity(
              skill.class_affinity
            ).includes(
              activeClass
            )
        ),
      [
        catalog.skills,
        activeClass,
      ]
    );

  const visibleSkills =
    classCoreSkills.length >
    0
      ? classCoreSkills
      : classAffinitySkills;

  const visibleSkillIds =
    useMemo(
      () =>
        new Set(
          visibleSkills.map(
            (skill) =>
              skill.id
          )
        ),
      [visibleSkills]
    );

  const visibleWorkouts =
    useMemo(
      () =>
        catalog.workouts.filter(
          (workout) => {
            if (!isClassCompatible(workout.class_affinity, activeClass)) return false;
            const linkedRequirements =
              catalog.requirements.filter(
                (requirement) =>
                  requirement.workout_id ===
                  workout.id
              );

            // Foundation training is allowed when the
            // workout has no skill prerequisite at all.
            if (
              linkedRequirements.length ===
              0
            ) {
              return true;
            }

            // Every required skill must exist in the
            // player's CURRENT visible class Skill Tree.
            // This prevents impossible locks.
            return linkedRequirements.every(
              (requirement) =>
                visibleSkillIds.has(
                  requirement.skill_id
                )
            );
          }
        ),
      [
        catalog.workouts,
        catalog.requirements,
        visibleSkillIds,
        activeClass,
      ]
    );

  const skillsByRank =
    useMemo(() => {
      const grouped = {};

      SKILL_RANKS.forEach(
        (rank) => {
          grouped[rank] = [];
        }
      );

      visibleSkills.forEach(
        (skill) => {
          const rank =
            SKILL_RANKS.includes(
              skill.skill_rank
            )
              ? skill.skill_rank
              : "E";

          grouped[rank].push(
            skill
          );
        }
      );

      return grouped;
    }, [visibleSkills]);

  function masteredInRank(
    rank
  ) {
    return (
      skillsByRank[rank] ||
      []
    ).filter((skill) =>
      masteredNames.has(
        String(
          skill.name
        ).toUpperCase()
      )
    ).length;
  }

  function rankUnlocked(
    rank
  ) {
    const index =
      SKILL_RANKS.indexOf(
        rank
      );

    if (index <= 0) {
      return true;
    }

    const previousRank =
      SKILL_RANKS[
        index - 1
      ];

    const previousSkills =
      skillsByRank[
        previousRank
      ] || [];

    if (
      previousSkills.length ===
      0
    ) {
      return true;
    }

    const needed =
      Math.min(
        RANK_REQUIREMENTS[
          rank
        ] || 1,
        previousSkills.length
      );

    return (
      masteredInRank(
        previousRank
      ) >= needed
    );
  }

  function rankRequirementText(
    rank
  ) {
    const index =
      SKILL_RANKS.indexOf(
        rank
      );

    if (index <= 0) {
      return "FOUNDATION RANK";
    }

    const previous =
      SKILL_RANKS[
        index - 1
      ];

    const total =
      (
        skillsByRank[
          previous
        ] || []
      ).length;

    const required =
      Math.min(
        RANK_REQUIREMENTS[
          rank
        ] || 1,
        total
      );

    return (
      masteredInRank(
        previous
      ) +
      "/" +
      required +
      " " +
      previous +
      "-RANK MASTERY REQUIRED"
    );
  }

  const prerequisiteSkills = (
    skill
  ) =>
    catalog.prerequisites
      .filter(
        (item) =>
          item.skill_id ===
          skill.id
      )
      .map((item) =>
        skillById.get(
          item.prerequisite_skill_id
        )
      )
      .filter(Boolean);

  const skillStatus = (skill) => {
    if (
      masteredNames.has(
        String(
          skill.name
        ).toUpperCase()
      )
    ) {
      return "MASTERED";
    }

    if (
      !rankUnlocked(
        skill.skill_rank ||
          "E"
      )
    ) {
      return "RANK LOCKED";
    }

    const requirements =
      prerequisiteSkills(
        skill
      );

    const unmet =
      requirements.some(
        (prerequisite) =>
          !masteredNames.has(
            String(
              prerequisite.name
            ).toUpperCase()
          )
      );

    if (unmet) {
      return "PREREQUISITE LOCKED";
    }

    const incompleteTraining =
      requirements.some(
        (prerequisite) =>
          !trainingCompletedAfterSkill(
            prerequisite
          )
      );

    if (
      incompleteTraining
    ) {
      return "TRAINING LOCKED";
    }

    if (
      profile.level <
      Number(
        skill.unlock_level ||
          1
      )
    ) {
      return "LEVEL LOCKED";
    }

    return "AVAILABLE";
  };

  const workoutLocked = (
    workout
  ) => {
    const requirements =
      catalog.requirements.filter(
        (item) =>
          item.workout_id ===
          workout.id
      );

    return requirements.some(
      (item) => {
        const skill =
          skillById.get(
            item.skill_id
          );

        return (
          skill &&
          !masteredNames.has(
            String(
              skill.name
            ).toUpperCase()
          )
        );
      }
    );
  };

  const normalizeWorkoutCategory = (
    workout
  ) => {
    const raw =
      String(
        workout.category ||
          ""
      ).toUpperCase();

    if (
      raw.includes("RUN") ||
      raw.includes(
        "ENDURANCE"
      ) ||
      raw.includes(
        "CONDITION"
      )
    ) {
      return "ENDURANCE";
    }

    if (
      raw.includes("LEG")
    ) {
      return "LEGS";
    }

    if (
      raw.includes("SPEED")
    ) {
      return "SPEED";
    }

    return "STRENGTH";
  };

  function focusSkill(
    skillId
  ) {
    setFocusedSkillId(
      skillId
    );

    window.setTimeout(
      () => {
        const node =
          document.getElementById(
            "skill-node-" +
            skillId
          );

        if (node) {
          node.scrollIntoView({
            behavior:
              "smooth",
            block:
              "center",
          });
        }
      },
      60
    );

    window.setTimeout(
      () => {
        setFocusedSkillId(
          (current) =>
            current ===
            skillId
              ? null
              : current
        );
      },
      2200
    );
  }

  function openMasteryTest(
    skill
  ) {
    setMasterySkill(skill);
    setMasteryValue("");
    setMasteryEvidence("");
    setMasteryProofFile(null);
  }

  async function submitMasteryTest() {
    if (!masterySkill) {
      return;
    }

    const value =
      masteryValue === ""
        ? null
        : Number(
            masteryValue
          );

    if (
      masteryValue !== "" &&
      !Number.isFinite(value)
    ) {
      setMasteryEvidence(
        "SYSTEM: ENTER A VALID RESULT VALUE."
      );
      return;
    }

    try {
      let proofRecordId =
        null;

      if (
        masteryProofFile
      ) {
        const uploaded =
          await uploadProofImage(
            masteryProofFile
          );

        const proofResponse =
          await submitProofRecordOnBackend({
            title:
              masterySkill.name +
              " MASTERY PROOF",
            proofType:
              "IMAGE",
            storagePath:
              uploaded.path,
            mimeType:
              masteryProofFile.type ||
              null,
            fileSize:
              masteryProofFile.size ||
              null,
            relatedEventType:
              "SKILL",
            relatedEventId:
              masterySkill.id,
            note:
              String(
                masteryEvidence ||
                ""
              ).trim(),
            metadata: {
              skill_name:
                masterySkill.name,
            },
          });

        proofRecordId =
          proofResponse?.data?.proof_id ||
          null;
      }

      const result =
        await submitSkillAttemptOnBackend({
          skillId:
            masterySkill.id,
          value,
          proofRecordId,
          unit:
            masterySkill.mastery_unit ||
            null,
          metadata: {
            note:
              String(
                masteryEvidence ||
                ""
              ).trim(),
            displayed_skill:
              masterySkill.name,
          },
        });

      const evaluation =
        result?.data?.evaluation ||
        result?.data ||
        {};

      if (
        !evaluation.mastered
      ) {
        const reason =
          String(
            evaluation.reason ||
            "VERIFIED_PROOF_REQUIRED"
          )
            .replaceAll(
              "_",
              " "
            );

        setMasteryEvidence(
          (
            String(
              masteryEvidence ||
              ""
            ).trim() +
            (
              masteryEvidence
                ? "\n\n"
                : ""
            ) +
            "SYSTEM: " +
            reason +
            (
              masteryProofFile
                ? ". Proof uploaded and registered as PENDING review."
                : ". This attempt is recorded, but mastery has not been awarded."
            )
          ).trim()
        );

        return;
      }

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      updated = {
        ...updated,
        masteryLogs: [
          {
            id:
              result?.data?.attempt_id ||
              uid("SKILL"),
            skill:
              masterySkill.name,
            value:
              evaluation.value ??
              value ??
              1,
            unit:
              evaluation.unit ||
              masterySkill.mastery_unit ||
              "proof",
            status:
              "MASTERED",
            note:
              String(
                masteryEvidence ||
                ""
              ).trim(),
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...(
            updated.masteryLogs ||
            []
          ),
        ],
      };

      updated =
        addHistory(
          updated,
          "SKILL MASTERED",
          masterySkill.name,
          "BACKEND VERIFIED • +" +
            Number(
              masterySkill.xp_reward ||
              0
            ) +
            " XP" +
            (
              evaluation.attribute
                ? " • +" +
                  Number(
                    evaluation.attribute_delta ||
                    0
                  ) +
                  " " +
                  evaluation.attribute
                : ""
            )
        );

      const newWorkouts =
        workoutsUnlockedBySkill(
          masterySkill
        );

      const nextSkills =
        catalog.prerequisites
          .filter(
            (item) =>
              item.prerequisite_skill_id ===
              masterySkill.id
          )
          .map(
            (item) =>
              skillById.get(
                item.skill_id
              )
          )
          .filter(Boolean);

      setUnlockNotice({
        skill:
          masterySkill.name,
        workouts:
          newWorkouts.map(
            (item) =>
              item.name
          ),
        nextSkills:
          nextSkills.map(
            (item) =>
              item.name
          ),
      });

      applyAuthoritativeProfile(
        updated
      );

      setMasterySkill(
        null
      );
      setMasteryValue(
        ""
      );
      setMasteryEvidence(
        ""
      );
      setMasteryProofFile(
        null
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE SKILL MASTERY FAILED:",
        error
      );

      const message =
        String(
          error?.message ||
          ""
        );

      if (
        message.includes(
          "SKILL_LOCKED_OR_UNAVAILABLE"
        )
      ) {
        setMasteryEvidence(
          "SYSTEM: THIS SKILL IS STILL LOCKED BY ITS BACKEND PREREQUISITES."
        );
        return;
      }

      setMasteryEvidence(
        "SYSTEM: MASTERY VERIFICATION FAILED. NO XP OR ATTRIBUTE REWARD WAS APPLIED."
      );
    }
  }


  function openLearningRecord(
    skill
  ) {
    setLearningSkill(skill);

    setLearningForm({
      sourceTitle: "",
      sourceType: "BOOK",
      durationMinutes: "",
      summary: "",
      takeaway1: "",
      takeaway2: "",
      takeaway3: "",
      application: "",
    });

    setLearningError("");
  }

  async function submitLearningRecord() {
    if (
      !learningSkill
    ) {
      return;
    }

    const minutes =
      Number(
        learningForm.durationMinutes
      );

    const takeaways = [
      learningForm.takeaway1,
      learningForm.takeaway2,
      learningForm.takeaway3,
    ]
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

    const requirements =
      learningSkill.mastery_requirements ||
      {};

    const minimumMinutes =
      Number(
        requirements.min_minutes_each ||
          requirements.min_minutes ||
          1
      );

    if (
      !learningForm.sourceTitle.trim()
    ) {
      setLearningError(
        "ENTER THE EXACT TITLE OR TOPIC YOU STUDIED."
      );
      return;
    }

    if (
      !minutes ||
      minutes <
        minimumMinutes
    ) {
      setLearningError(
        "THIS RECORD REQUIRES AT LEAST " +
          minimumMinutes +
          " MINUTES."
      );
      return;
    }

    if (
      learningForm.summary.trim()
        .length < 20
    ) {
      setLearningError(
        "EXPLAIN WHAT YOU LEARNED IN YOUR OWN WORDS."
      );
      return;
    }

    const requiredTakeaways =
      Number(
        requirements.requires_takeaways ||
          3
      );

    if (
      takeaways.length <
      Math.min(
        3,
        requiredTakeaways
      )
    ) {
      setLearningError(
        "ADD AT LEAST " +
          Math.min(
            3,
            requiredTakeaways
          ) +
          " KEY TAKEAWAYS."
      );
      return;
    }

    if (
      requirements.requires_application &&
      !learningForm.application.trim()
    ) {
      setLearningError(
        "EXPLAIN HOW YOU WILL APPLY WHAT YOU LEARNED."
      );
      return;
    }

    setLearningSaving(true);
    setLearningError("");

    try {
      await saveLearningRecord({
        skillId:
          learningSkill.id,
        skillName:
          learningSkill.name,
        className:
          activeClass,
        title:
          learningSkill.name,
        sourceTitle:
          learningForm.sourceTitle.trim(),
        sourceType:
          learningForm.sourceType,
        durationMinutes:
          minutes,
        learningSummary:
          learningForm.summary.trim(),
        keyTakeaways:
          takeaways,
        applicationPlan:
          learningForm.application.trim(),
      });

      const recordCount =
        await countLearningRecordsForSkill(
          learningSkill.id
        );

      const evaluationResponse =
        await evaluateSkillOnBackend(
          learningSkill.id
        );

      const evaluation =
        evaluationResponse?.data ||
        {};

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      updated = {
        ...updated,
        masteryLogs: [
          {
            id:
              uid("MAGE"),
            skill:
              learningSkill.name,
            value:
              evaluation.value ??
              recordCount,
            unit:
              evaluation.unit ||
              "learning records",
            status:
              evaluation.mastered
                ? "MASTERED"
                : "PRACTICING",
            authoritative:
              true,
            date:
              new Date()
                .toISOString(),
          },
          ...(
            updated.masteryLogs ||
            []
          ),
        ],
      };

      if (
        evaluation.mastered
      ) {
        updated =
          addHistory(
            updated,
            "MAGE SKILL MASTERED",
            learningSkill.name,
            "BACKEND VERIFIED • +" +
              Number(
                learningSkill.xp_reward ||
                0
              ) +
              " XP" +
              (
                evaluation.attribute
                  ? " • +" +
                    Number(
                      evaluation.attribute_delta ||
                      0
                    ) +
                    " " +
                    evaluation.attribute
                  : ""
              )
          );
      } else {
        updated =
          addHistory(
            updated,
            "LEARNING RECORD",
            learningForm.sourceTitle.trim(),
            learningSkill.name +
              " • " +
              minutes +
              " MIN • SERVER PROGRESS " +
              String(
                evaluation.value ??
                recordCount
              )
          );
      }

      applyAuthoritativeProfile(
        updated
      );
      setLearningSkill(null);
    } catch (error) {
      console.error(
        "LEARNING RECORD SAVE FAILED:",
        error
      );

      setLearningError(
        error?.message ||
          "LEARNING RECORD COULD NOT BE SAVED."
      );
    } finally {
      setLearningSaving(false);
    }
  }

  function startWorkoutGpsMission(
    workout,
    target
  ) {
    saveProfile({
      ...profile,
      activeGpsMission: {
        id:
          "gps-workout-" +
          workout.id +
          "-" +
          Date.now(),
        source:
          "WORKOUT",
        sourceId:
          workout.id,
        name:
          workout.name,
        category:
          normalizeWorkoutCategory(
            workout
          ),
        xp:
          Number(
            workout.xp_reward ||
            0
          ),
        targetKind:
          target.kind,
        targetDistanceKm:
          target.distanceKm ||
          null,
        targetDurationSeconds:
          target.durationSeconds ||
          null,
        targetLabel:
          target.label,
        createdAt:
          new Date().toISOString(),
      },
    });

    setMode(
      "TRACKING"
    );
  }

  async function beginTimedWorkout(workout) {
    if (timerStartingId) return;

    setTimerStartingId(workout.id);
    setTimerError("");

    try {
      const response = await startTimedWorkout(workout);
      const payload = response?.data || response || {};
      const session =
        payload.session ||
        payload.timer_session ||
        payload;

      if (!session?.id) {
        throw new Error("TIMER_SESSION_NOT_CREATED");
      }

      const serverNow =
        payload.server_now ||
        session.server_now ||
        null;

      const serverNowMs = Date.parse(serverNow || "");

      setActiveTimer({
        session,
        workout: {
          ...workout,
          ...(payload.workout || {}),
          steps:
            payload.workout?.steps ||
            workout.steps ||
            [],
        },
        serverOffsetMs: Number.isFinite(serverNowMs)
          ? serverNowMs - Date.now()
          : 0,
      });
      setTimerModalOpen(true);
      setResumableTimerId(workout.id);
    } catch (startError) {
      console.error("TIMED WORKOUT START FAILED:", startError);
      const message = String(startError?.message || "");

      setTimerError(
        message.includes("WORKOUT_NOT_TIMER_VERIFIED")
          ? "THIS WORKOUT USES A DIFFERENT VERIFICATION METHOD."
          : "THE FOCUS TIMER COULD NOT START. CHECK YOUR CONNECTION AND RETRY."
      );
    } finally {
      setTimerStartingId(null);
    }
  }

  async function finishTimedWorkout(payload) {
    await completeTimedWorkout(payload);
    setActiveTimer(null);
    setTimerModalOpen(false);
    setResumableTimerId(null);
    setTimerError("");
  }

  const curriculum =
    CLASS_CURRICULUM[
      activeClass
    ];

  return (
    <div className="page">
      <PageHero
        eyebrow={
          activeClass +
          " DEVELOPMENT"
        }
        title="SKILL DEVELOPMENT"
        text={
          "Skill Tree = destination. Training = the route. Mastery = proof. " +
          (curriculum?.statement ||
            "Build real-world mastery through ranked progression.")
        }
      />

      <div className="class-curriculum-banner card3d">
        <div>
          <span>
            {PATHS[
              activeClass
            ]?.icon}{" "}
            {activeClass} CURRICULUM
          </span>

          <h3>
            {curriculum?.title}
          </h3>
        </div>

        <strong>
          RANKED MASTERY
        </strong>
      </div>

      <div className="cloud-backed-strip card3d">
        <span>
          ● LIVE SUPABASE CATALOG
        </span>

        <small>
          {catalog.loading
            ? "SYNCHRONIZING TRAINING DATA..."
            : `${visibleSkills.length} ${activeClass} SKILLS • ${visibleWorkouts.length} WORKOUTS`}
        </small>
      </div>

      {catalogError && (
        <div className="training-catalog-warning">
          <strong>
            ⚠ TRAINING DATA TEMPORARILY DEGRADED
          </strong>

          <span>
            {catalogError}
          </span>

          <button
            type="button"
            onClick={() =>
              setCatalogReloadToken(
                (value) =>
                  value + 1
              )
            }
          >
            RETRY
          </button>
        </div>
      )}

      <div className="training-switch">
        <button
          data-sfx="tab"
          type="button"
          className={
            mode ===
            "SKILLS"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode("SKILLS")
          }
        >
          SKILL TREE
        </button>
        <button
          data-sfx="tab"
          type="button"
          className={
            mode ===
            "WORKOUTS"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode("WORKOUTS")
          }
        >
          WORKOUTS
        </button>
      
        <button
          type="button"
          className={
            mode === "TRACKING"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode("TRACKING")
          }
        >
          TRACKING
        </button>
      </div>

      {mode ===
        "TRACKING" && (
        <MovementTracker
          profile={profile}
          saveProfile={saveProfile}
          applyAuthoritativeProfile={
            applyAuthoritativeProfile
          }
        />
      )}

      {mode ===
        "WORKOUTS" && (
        <div>
          {!catalog.loading && (
            <div className="training-path-rule card3d">
              <small>
                SKILL TREE → WORKOUTS
              </small>

              <strong>
                YOUR TRAINING QUEUE NOW FOLLOWS YOUR VISIBLE SKILL TREE
              </strong>

              <p>
                If a workout requires a skill, that skill must exist in your current class tree. No hidden prerequisite can block progression.
              </p>
            </div>
          )}

          {catalog.loading && (
            <div className="workout card3d">
              <div>
                <span>
                  SYSTEM
                </span>
                <h3>
                  LOADING WORKOUT NETWORK...
                </h3>
              </div>
            </div>
          )}

          {!catalog.loading &&
            visibleWorkouts.length ===
              0 && (
            <div className="workout card3d training-empty-workouts">
              <div>
                <span>
                  TRAINING NETWORK
                </span>

                <h3>
                  NO VALID WORKOUTS LINKED YET
                </h3>

                <p>
                  Your current Skill Tree has no compatible workout links. This is a catalog-linking issue, not a locked skill.
                </p>
              </div>
            </div>
          )}

          {!catalog.loading &&
            visibleWorkouts.map(
              (workout) => {
                const locked =
                  workoutLocked(
                    workout
                  );

                return (
                  <div
                    key={
                      workout.id
                    }
                    className={
                      locked
                        ? "workout card3d locked"
                        : "workout card3d"
                    }
                  >
                    <div>
                      <span>
                        {
                          workout.category
                        } • {
                          workout.difficulty
                        }
                      </span>

                      <h3>
                        {
                          workout.name
                        }
                      </h3>

                      <p>
                        {
                          workout.description
                        }
                      </p>

                      <div className="target">
                        {workout.estimated_minutes
                          ? `${workout.estimated_minutes} MIN`
                          : "SYSTEM ROUTINE"}
                        {" • "}
                        +{
                          workout.xp_reward ||
                          0
                        } XP
                      </div>

                      {Array.isArray(
                        workout.steps
                      ) &&
                        workout.steps.length >
                          0 && (
                        <div className="cloud-workout-steps">
                          {workout.steps.map(
                            (
                              step,
                              index
                            ) => (
                              <div
                                key={
                                  step.id ||
                                  index
                                }
                                className="cloud-workout-step"
                              >
                                <b>
                                  {index +
                                    1}
                                  .
                                </b>
                                <span>
                                  {
                                    step.exercise_name
                                  }
                                  {step.sets
                                    ? ` • ${step.sets} SETS`
                                    : ""}
                                  {step.reps
                                    ? ` • ${step.reps}`
                                    : ""}
                                  {step.duration_seconds
                                    ? ` • ${step.duration_seconds}s`
                                    : ""}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {(() => {
                        const requiredSkills =
                          requiredSkillsForWorkout(
                            workout
                          );

                        return (
                          <div className="workout-unlock-path">
                            <small>
                              {requiredSkills.length
                                ? "UNLOCKED BY SKILL TREE"
                                : "FOUNDATION TRAINING"}
                            </small>

                            {requiredSkills.map(
                              (requiredSkill) => {
                                const mastered =
                                  masteredNames.has(
                                    String(
                                      requiredSkill.name
                                    ).toUpperCase()
                                  );

                                return (
                                  <span
                                    key={
                                      requiredSkill.id
                                    }
                                  >
                                    {mastered
                                      ? "✓"
                                      : "🔒"}{" "}
                                    {
                                      requiredSkill.name
                                    }{" "}
                                    —{" "}
                                    {mastered
                                      ? "MASTERED"
                                      : "MASTER THIS SKILL"}
                                  </span>
                                );
                              }
                            )}
                          </div>
                        );
                      })()}

                      {locked ? (
                        <small className="cloud-lock-note">
                          RETURN TO THE SKILL TREE AND MASTER THE REQUIREMENTS ABOVE.
                        </small>
                      ) : (() => {
                        const verificationMode =
                          getWorkoutVerificationMode(
                            workout
                          );

                        const gpsTarget =
                          movementTargetForWorkout(
                            workout
                          );

                        if (verificationMode === WORKOUT_VERIFICATION_MODES.GPS && gpsTarget) {
                          return (
                            <div className="gps-workout-actions">
                              <div className="gps-eligible-badge">
                                <span>
                                  GPS VERIFIED
                                </span>

                                <strong>
                                  {
                                    gpsTarget.label
                                  } TARGET
                                </strong>
                              </div>

                              <button
                                data-sfx="success"
                                type="button"
                                className="system-action"
                                onClick={() =>
                                  startWorkoutGpsMission(
                                    workout,
                                    gpsTarget
                                  )
                                }
                              >
                                START GPS MISSION
                              </button>
                            </div>
                          );
                        }

                        if (verificationMode === WORKOUT_VERIFICATION_MODES.TIMER) {
                          const isStarting =
                            timerStartingId === workout.id;

                          const activeTimerWorkoutId =
                            activeTimer?.workout?.id ??
                            activeTimer?.session?.workout_id ??
                            activeTimer?.session?.workoutId ??
                            null;

                          const hasActiveTimer =
                            activeTimerWorkoutId !== null &&
                            String(activeTimerWorkoutId) ===
                            String(workout.id);

                          return (
                            <div className="timer-workout-actions">
                              <div className="timer-eligible-badge">
                                <span>TIMER VERIFIED</span>
                                <strong>{workout.estimated_minutes || 0} MIN COUNTDOWN</strong>
                              </div>

                              <small>
                                Guided sets and rests. The server, not the browser, controls when this training can be claimed.
                              </small>

                              <button
                                data-sfx="success"
                                type="button"
                                className="system-action"
                                disabled={isStarting}
                                onClick={() => {
                                  if (hasActiveTimer) {
                                    setTimerModalOpen(true);
                                    return;
                                  }

                                  void beginTimedWorkout(workout);
                                }}
                              >
                                {isStarting
                                  ? "STARTING TIMER..."
                                  : hasActiveTimer
                                    ? "OPEN ACTIVE TIMER"
                                    : resumableTimerId === workout.id
                                    ? "RESUME COUNTDOWN"
                                    : "START FOCUS TIMER"}
                              </button>

                              {hasActiveTimer && (
                                <WorkoutTimerInlineStatus
                                  timer={activeTimer}
                                  onOpen={() =>
                                    setTimerModalOpen(true)
                                  }
                                />
                              )}

                              {timerError && (
                                <small className="timer-workout-error">
                                  {timerError}
                                </small>
                              )}
                            </div>
                          );
                        }

                        return (
                          <button
                            data-sfx="success"
                            type="button"
                            className="system-action"
                            onClick={() =>
                              completeWorkout(
                                {
                                  id:
                                    "cloud-" +
                                    workout.id,
                                  name:
                                    workout.name,
                                  category:
                                    normalizeWorkoutCategory(
                                      workout
                                    ),
                                  xp:
                                    Number(
                                      workout.xp_reward ||
                                        0
                                    ),
                                }
                              )
                            }
                          >
                            COMPLETE TRAINING
                          </button>
                        );
                      })()}
                    </div>

                    <strong>
                      {locked
                        ? "LOCKED"
                        : workout.difficulty}
                    </strong>
                  </div>
                );
              }
            )}
        </div>
      )}

      {mode ===
        "SKILLS" && (
        <div className="ranked-skill-tree">
          <div className="class-tree-identity card3d">
            <div className="class-tree-icon">
              {PATHS[
                activeClass
              ]?.icon}
            </div>

            <div>
              <small>
                {activeClass} • PRIMARY CURRICULUM
              </small>

              <h2>
                {activeClass ===
                "MAGE"
                  ? "THE ARCANE MIND"
                  : curriculum?.title}
              </h2>

              <p>
                {activeClass ===
                "MAGE"
                  ? "Knowledge, memory, focus, research, synthesis, teaching and applied intelligence. Physical skills are no longer mixed into the Mage core tree."
                  : curriculum?.statement}
              </p>
            </div>

            <strong>
              {visibleSkills.length} CLASS SKILLS
            </strong>
          </div>

          {activeClass ===
            "MAGE" && (
            <div className="mage-path-map card3d">
              <span>
                MAGE PROGRESSION PATH
              </span>

              <div>
                <b>E</b>
                <em>
                  STUDY FOUNDATION
                </em>
                <i>→</i>
                <b>D</b>
                <em>
                  MEMORY + DEEP WORK
                </em>
                <i>→</i>
                <b>C</b>
                <em>
                  ANALYSIS
                </em>
                <i>→</i>
                <b>B</b>
                <em>
                  SYNTHESIS
                </em>
                <i>→</i>
                <b>A</b>
                <em>
                  TEACH + RESEARCH
                </em>
                <i>→</i>
                <b>S</b>
                <em>
                  SUBJECT MASTERY
                </em>
              </div>
            </div>
          )}
          {!catalog.loading && (
            <div className="available-now-section">
              <div className="available-now-head">
                <div>
                  <small>
                    SYSTEM • CURRENT ACCESS
                  </small>
                  <h3>
                    AVAILABLE NOW
                  </h3>
                </div>

                <strong>
                  {
                    visibleSkills.filter(
                      (skill) =>
                        skillStatus(
                          skill
                        ) ===
                        "AVAILABLE"
                    ).length
                  } READY
                </strong>
              </div>

              <div className="available-now-grid">
                {visibleSkills
                  .filter(
                    (skill) =>
                      skillStatus(
                        skill
                      ) ===
                      "AVAILABLE"
                  )
                  .slice(0, 6)
                  .map(
                    (skill) => (
                      <button
                        type="button"
                        key={
                          "available-" +
                          skill.id
                        }
                        className="available-now-card card3d"
                        onClick={() =>
                          focusSkill(
                            skill.id
                          )
                        }
                      >
                        <span>
                          {
                            skill.skill_rank
                          }-RANK •{" "}
                          {
                            skill.progression_group
                          }
                        </span>

                        <h4>
                          {
                            skill.name
                          }
                        </h4>

                        <p>
                          {
                            skill.mastery_notes ||
                            "READY TO BEGIN"
                          }
                        </p>

                        <em>
                          LOCATE IN SKILL TREE ↓
                        </em>
                      </button>
                    )
                  )}
              </div>
            </div>
          )}

          {!catalog.loading &&
            visibleSkills.length ===
              0 && (
            <div className="skill card3d training-zero-diagnostic">
              <small>
                SYSTEM DIAGNOSTIC
              </small>

              <h3>
                NO CLASS SKILLS VISIBLE
              </h3>

              <p>
                Active class:{" "}
                <strong>
                  {activeClass ||
                    "UNKNOWN"}
                </strong>
                {" • "}
                Catalog skills received:{" "}
                <strong>
                  {
                    catalog.skills
                      .length
                  }
                </strong>
              </p>

              <span>
                If catalog skills are above zero, this is a class-filter issue. If catalog skills are zero, the cloud catalog did not load.
              </span>
            </div>
          )}

          {catalog.loading && (
            <div className="skill card3d">
              <span>
                SYSTEM
              </span>
              <h3>
                LOADING CLASS TREE...
              </h3>
            </div>
          )}

          {!catalog.loading &&
            SKILL_RANKS.map(
              (rank) => {
                const rankSkills =
                  skillsByRank[
                    rank
                  ] || [];

                if (
                  rankSkills.length ===
                  0
                ) {
                  return null;
                }

                const unlocked =
                  rankUnlocked(
                    rank
                  );

                return (
                  <section
                    className={
                      unlocked
                        ? "skill-rank-section"
                        : "skill-rank-section rank-locked"
                    }
                    key={rank}
                  >
                    <div className="skill-rank-header card3d">
                      <div className="rank-emblem">
                        {rank}
                      </div>

                      <div>
                        <small>
                          {activeClass} SKILL RANK
                        </small>

                        <h2>
                          {rank}-RANK
                        </h2>

                        <p>
                          {rankRequirementText(
                            rank
                          )}
                        </p>
                      </div>

                      <strong>
                        {unlocked
                          ? `${masteredInRank(
                              rank
                            )}/${rankSkills.length} MASTERED`
                          : "LOCKED"}
                      </strong>
                    </div>

                    <div className="rank-skill-grid">
                      {rankSkills.map(
                        (skill) => {
                          const status =
                            skillStatus(
                              skill
                            );

                          const locked =
                            status !==
                              "AVAILABLE" &&
                            status !==
                              "MASTERED";

                          const requirements =
                            prerequisiteSkills(
                              skill
                            );

                          const unmet =
                            requirements.filter(
                              (
                                requirement
                              ) =>
                                !masteredNames.has(
                                  String(
                                    requirement.name
                                  ).toUpperCase()
                                )
                            );

                          const isMageLearning =
                            activeClass ===
                              "MAGE" &&
                            skill.proof_type ===
                              "LEARNING";

                          return (
                            <div
                              id={
                                "skill-node-" +
                                skill.id
                              }
                              key={
                                skill.id
                              }
                              className={
                                (
                                  locked
                                    ? "skill card3d ranked-skill locked"
                                    : status ===
                                        "MASTERED"
                                      ? "skill card3d ranked-skill mastered"
                                      : "skill card3d ranked-skill"
                                ) +
                                (
                                  focusedSkillId ===
                                  skill.id
                                    ? " skill-located"
                                    : ""
                                )
                              }
                            >
                              <div className="ranked-skill-top">
                                <span>
                                  {
                                    skill.progression_group ||
                                    skill.category
                                  }
                                  {" • "}
                                  {
                                    skill.proof_type
                                  }
                                </span>

                                <b>
                                  {rank}
                                </b>
                              </div>

                              <h3>
                                {
                                  skill.name
                                }
                              </h3>

                              <p>
                                {
                                  skill.description
                                }
                              </p>

                              {unmet.length >
                                0 && (
                                <div className="skill-requirement-box">
                                  <small>
                                    REQUIRED BEFORE UNLOCK
                                  </small>

                                  {unmet.map(
                                    (
                                      requirement
                                    ) => (
                                      <span
                                        key={
                                          requirement.id
                                        }
                                      >
                                        🔒{" "}
                                        {
                                          requirement.name
                                        }{" "}
                                        — MASTERED
                                      </span>
                                    )
                                  )}
                                </div>
                              )}

                              {status ===
                                "RANK LOCKED" && (
                                <div className="skill-requirement-box">
                                  <small>
                                    RANK GATE
                                  </small>

                                  <span>
                                    {rankRequirementText(
                                      rank
                                    )}
                                  </span>
                                </div>
                              )}

                              {status ===
                                "LEVEL LOCKED" && (
                                <div className="skill-requirement-box">
                                  <small>
                                    PLAYER LEVEL
                                  </small>

                                  <span>
                                    REQUIRES LEVEL{" "}
                                    {
                                      skill.unlock_level
                                    }
                                  </span>
                                </div>
                              )}

                              <div className="target">
                                {skill.mastery_notes ||
                                  (skill.mastery_target !=
                                  null
                                    ? `MASTERY: ${skill.mastery_target} ${skill.mastery_unit || ""}`
                                    : "PROOF REQUIRED")}
                              </div>

                              {(() => {
                                const unlockedWorkouts =
                                  workoutsUnlockedBySkill(
                                    skill
                                  );

                                return (
                                  <div className="skill-unlocks-box">
                                    <small>
                                      MASTER THIS SKILL TO UNLOCK
                                    </small>

                                    {unlockedWorkouts.length >
                                    0 ? (
                                      unlockedWorkouts.map(
                                        (workout) => (
                                          <span
                                            key={
                                              workout.id
                                            }
                                          >
                                            →{" "}
                                            {
                                              workout.name
                                            }
                                          </span>
                                        )
                                      )
                                    ) : (
                                      <span>
                                        → NEXT SKILL GATE
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}

                              {status ===
                                "TRAINING LOCKED" && (
                                <div className="skill-requirement-box">
                                  <small>
                                    COMPLETE TRAINING FIRST
                                  </small>

                                  {requirements.map(
                                    (
                                      prerequisite
                                    ) => {
                                      const linked =
                                        workoutsUnlockedBySkill(
                                          prerequisite
                                        );

                                      return linked.map(
                                        (
                                          workout
                                        ) => (
                                          <span
                                            key={
                                              workout.id
                                            }
                                          >
                                            🔒 COMPLETE{" "}
                                            {
                                              workout.name
                                            }
                                          </span>
                                        )
                                      );
                                    }
                                  )}
                                </div>
                              )}

                              {isMageLearning &&
                                status !==
                                  "MASTERED" &&
                                !locked && (
                                <button
                                  type="button"
                                  data-sfx="success"
                                  className="system-action"
                                  onClick={() =>
                                    openLearningRecord(
                                      skill
                                    )
                                  }
                                >
                                  LOG LEARNING PROOF
                                </button>
                              )}

                              {!isMageLearning &&
                                status ===
                                  "AVAILABLE" && (
                                <button
                                  type="button"
                                  data-sfx="success"
                                  className="system-action"
                                  onClick={() =>
                                    openMasteryTest(
                                      skill
                                    )
                                  }
                                >
                                  TAKE MASTERY TEST
                                </button>
                              )}

                              <strong>
                                {status}
                              </strong>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </section>
                );
              }
            )}
        </div>
      )}

      {masterySkill && (
        <div className="learning-overlay">
          <div className="learning-record-modal card3d">
            <div className="learning-modal-head">
              <div>
                <small>
                  SYSTEM • MASTERY GATE
                </small>

                <h2>
                  {
                    masterySkill.name
                  }
                </h2>
              </div>

              <button
                type="button"
                className="learning-close"
                onClick={() =>
                  setMasterySkill(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <p className="learning-rule">
              UNLOCKING A SKILL DOES NOT MEAN YOU HAVE MASTERED IT. COMPLETE THE REQUIREMENT BELOW. MASTERY UNLOCKS ITS TRAINING AND OPENS THE NEXT SKILL GATE.
            </p>

            <div className="mastery-requirement-display">
              <small>
                MASTERY REQUIREMENT
              </small>

              <strong>
                {masterySkill.mastery_notes ||
                  (masterySkill.mastery_target !=
                  null
                    ? `${masterySkill.mastery_target} ${masterySkill.mastery_unit || ""}`
                    : "RESULT / PROOF REQUIRED")}
              </strong>
            </div>

            {masterySkill.mastery_target !=
              null && (
              <SystemField
                label={`YOUR RESULT — ${masterySkill.mastery_unit || "VALUE"}`}
              >
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    masteryValue
                  }
                  onChange={(e) =>
                    setMasteryValue(
                      e.target.value
                    )
                  }
                  placeholder={
                    String(
                      masterySkill.mastery_target
                    )
                  }
                />
              </SystemField>
            )}

            <SystemField label="PHYSICAL PROOF — IMAGE">
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setMasteryProofFile(
                    event.target.files?.[0] ||
                    null
                  )
                }
              />

              <small className="muted-system-copy">
                {masteryProofFile
                  ? masteryProofFile.name +
                    " • WILL BE REGISTERED AS PENDING PROOF"
                  : "OPTIONAL FOR GPS / LEARNING SKILLS. PHYSICAL MASTERY REQUIRES VERIFIED PROOF."}
              </small>
            </SystemField>

            <SystemField label="RESULT NOTE — MASTERY EVIDENCE">
              <div className="result-note-inline-help">
                State the exact test result. Include reps, time, distance, load or the measurable standard you reached. Avoid notes such as “done” or “completed.”
              </div>

              <textarea
                rows="4"
                value={
                  masteryEvidence
                }
                onChange={(e) =>
                  setMasteryEvidence(
                    e.target.value
                  )
                }
                placeholder="Example: Completed 5 strict pull-ups continuously • full hang to chin above bar • no kipping • video attached."
              />
            </SystemField>

            <button
              type="button"
              className="system-primary system-action"
              onClick={
                submitMasteryTest
              }
            >
              VERIFY MASTERY
            </button>
          </div>
        </div>
      )}

      {unlockNotice && (
        <div className="learning-overlay">
          <div className="unlock-event-modal card3d">
            <small>
              [ SYSTEM NOTIFICATION ]
            </small>

            <h2>
              SKILL MASTERED
            </h2>

            <h3>
              {
                unlockNotice.skill
              }
            </h3>

            {unlockNotice.workouts.length >
              0 && (
              <div className="unlock-event-section">
                <span>
                  NEW TRAINING UNLOCKED
                </span>

                {unlockNotice.workouts.map(
                  (name) => (
                    <b key={name}>
                      → {name}
                    </b>
                  )
                )}
              </div>
            )}

            {unlockNotice.nextSkills.length >
              0 && (
              <div className="unlock-event-section">
                <span>
                  NEXT SKILL PATH
                </span>

                {unlockNotice.nextSkills.map(
                  (name) => (
                    <b key={name}>
                      → {name}
                    </b>
                  )
                )}
              </div>
            )}

            <button
              type="button"
              className="system-primary system-action"
              onClick={() =>
                setUnlockNotice(
                  null
                )
              }
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {learningSkill && (
        <div className="learning-overlay">
          <div className="learning-record-modal card3d">
            <div className="learning-modal-head">
              <div>
                <small>
                  MAGE • PROOF OF LEARNING
                </small>

                <h2>
                  {learningSkill.name}
                </h2>
              </div>

              <button
                type="button"
                className="learning-close"
                onClick={() =>
                  setLearningSkill(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <p className="learning-rule">
              TIME SPENT DOES NOT EQUAL MASTERY. THE SYSTEM REQUIRES WHAT YOU STUDIED, WHAT YOU UNDERSTOOD AND HOW YOU WILL USE IT.
            </p>

            <SystemField label="WHAT DID YOU STUDY? — EXACT BOOK / COURSE / TOPIC TITLE">
              <input
                value={
                  learningForm.sourceTitle
                }
                onChange={(e) =>
                  setLearningForm({
                    ...learningForm,
                    sourceTitle:
                      e.target.value,
                  })
                }
                placeholder="e.g. Deep Work — Cal Newport, Chapter 2"
              />
            </SystemField>

            <div className="learning-two-col">
              <SystemField label="SOURCE TYPE">
                <select
                  value={
                    learningForm.sourceType
                  }
                  onChange={(e) =>
                    setLearningForm({
                      ...learningForm,
                      sourceType:
                        e.target.value,
                    })
                  }
                >
                  <option>
                    BOOK
                  </option>
                  <option>
                    COURSE
                  </option>
                  <option>
                    ARTICLE
                  </option>
                  <option>
                    VIDEO
                  </option>
                  <option>
                    TOPIC
                  </option>
                  <option>
                    CLASS
                  </option>
                  <option>
                    OTHER
                  </option>
                </select>
              </SystemField>

              <SystemField label="TIME STUDIED — MINUTES">
                <input
                  type="number"
                  min="1"
                  value={
                    learningForm.durationMinutes
                  }
                  onChange={(e) =>
                    setLearningForm({
                      ...learningForm,
                      durationMinutes:
                        e.target.value,
                    })
                  }
                  placeholder="120"
                />
              </SystemField>
            </div>

            <SystemField label="EXPLAIN WHAT YOU LEARNED IN YOUR OWN WORDS">
              <textarea
                rows="5"
                value={
                  learningForm.summary
                }
                onChange={(e) =>
                  setLearningForm({
                    ...learningForm,
                    summary:
                      e.target.value,
                  })
                }
                placeholder="Do not copy the source. Explain what actually changed in your understanding."
              />
            </SystemField>

            <div className="learning-takeaways">
              <SystemField label="KEY TAKEAWAY 01">
                <input
                  value={
                    learningForm.takeaway1
                  }
                  onChange={(e) =>
                    setLearningForm({
                      ...learningForm,
                      takeaway1:
                        e.target.value,
                    })
                  }
                />
              </SystemField>

              <SystemField label="KEY TAKEAWAY 02">
                <input
                  value={
                    learningForm.takeaway2
                  }
                  onChange={(e) =>
                    setLearningForm({
                      ...learningForm,
                      takeaway2:
                        e.target.value,
                    })
                  }
                />
              </SystemField>

              <SystemField label="KEY TAKEAWAY 03">
                <input
                  value={
                    learningForm.takeaway3
                  }
                  onChange={(e) =>
                    setLearningForm({
                      ...learningForm,
                      takeaway3:
                        e.target.value,
                    })
                  }
                />
              </SystemField>
            </div>

            <SystemField label="HOW WILL YOU APPLY THIS?">
              <textarea
                rows="3"
                value={
                  learningForm.application
                }
                onChange={(e) =>
                  setLearningForm({
                    ...learningForm,
                    application:
                      e.target.value,
                  })
                }
                placeholder="Describe one real action, experiment or project."
              />
            </SystemField>

            {learningError && (
              <div className="learning-error">
                {learningError}
              </div>
            )}

            <button
              type="button"
              className="system-primary system-action"
              disabled={
                learningSaving
              }
              onClick={
                submitLearningRecord
              }
            >
              {learningSaving
                ? "VERIFYING LEARNING RECORD..."
                : "SAVE LEARNING RECORD"}
            </button>
          </div>
        </div>
      )}

      {activeTimer &&
        timerModalOpen && (
        <WorkoutTimerModal
          timer={activeTimer}
          onClose={() =>
            setTimerModalOpen(false)
          }
          onComplete={finishTimedWorkout}
        />
      )}
    </div>
  );
}

export function SystemLogList({
  items,
  render,
}) {
  if (!items.length) {
    return (
      <div className="empty card3d">
        NO RECORDS YET
      </div>
    );
  }

  return (
    <div className="system-log-list">
      {items.map((item) => (
        <div
          className="system-log-row card3d"
          key={item.id}
        >
          {render(item)}
        </div>
      ))}
    </div>
  );
}

export function PerformancePanel({
  profile,
  saveProfile,
}) {
  const [metric, setMetric] =
    useState(
      PERFORMANCE_METRICS[0][0]
    );

  const [custom, setCustom] =
    useState("");

  const [value, setValue] =
    useState("");

  const [unit, setUnit] =
    useState(
      PERFORMANCE_METRICS[0][1]
    );

  const [note, setNote] =
    useState("");

  function chooseMetric(event) {
    const next =
      event.target.value;

    setMetric(next);

    const definition =
      PERFORMANCE_METRICS.find(
        (item) =>
          item[0] === next
      );

    setUnit(
      definition?.[1] || ""
    );
  }

  async function addLog() {
    if (!value) {
      return;
    }

    const title =
      metric ===
        "CUSTOM"
        ? custom.trim() ||
          "CUSTOM"
        : metric;

    try {
      const row =
        await addPerformanceLogOnBackend({
          metric:
            title,
          value:
            Number(value),
          unit,
          note:
            note.trim() ||
            null,
        });

      const log = {
        id:
          "PERF-" +
          row.id,
        metric:
          row.metric,
        value:
          Number(
            row.value
          ),
        unit:
          row.unit ||
          "",
        note:
          row.note ||
          "",
        date:
          row.recorded_at,
      };

      saveProfile({
        ...profile,
        performanceLogs: [
          log,
          ...profile.performanceLogs,
        ],
      });

      setValue("");
      setNote("");
    } catch (error) {
      console.error(
        "PERFORMANCE LOG BACKEND FAILED:",
        error
      );
    }
  }


  return (
    <div>
      <div className="system-form card3d">
        <h3>
          BODY & PERFORMANCE LOG
        </h3>

        <div className="system-form-grid">
          <SystemField label="METRIC">
            <select
              value={metric}
              onChange={chooseMetric}
            >
              {PERFORMANCE_METRICS.map(
                ([item]) => (
                  <option key={item}>
                    {item}
                  </option>
                )
              )}
            </select>
          </SystemField>

          {metric ===
            "CUSTOM" && (
            <SystemField label="CUSTOM METRIC">
              <input
                value={custom}
                onChange={(event) =>
                  setCustom(
                    event.target.value
                  )
                }
                placeholder="METRIC NAME"
              />
            </SystemField>
          )}

          <SystemField label="VALUE">
            <input
              type="number"
              step="any"
              value={value}
              onChange={(event) =>
                setValue(
                  event.target.value
                )
              }
              placeholder="0"
            />
          </SystemField>

          <SystemField label="UNIT">
            <input
              value={unit}
              onChange={(event) =>
                setUnit(
                  event.target.value
                )
              }
              placeholder="reps / sec / km"
            />
          </SystemField>
        </div>

        <SystemField label="NOTE">
          <input
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            placeholder="Optional context"
          />
        </SystemField>

        <button
          type="button"
          className="system-primary system-action"
          onClick={addLog}
        >
          LOG PERFORMANCE
        </button>
      </div>

      <SystemLogList
        items={
          profile.performanceLogs.slice(
            0,
            12
          )
        }
        render={(item) => (
          <>
            <strong>
              {item.metric}
            </strong>

            <span>
              {item.value} {item.unit}
            </span>

            <small>
              {new Date(
                item.date
              ).toLocaleDateString()}
              {item.note
                ? " • " +
                  item.note
                : ""}
            </small>
          </>
        )}
      />
    </div>
  );
}

export function WealthPanel({
  profile,
  saveProfile,
}) {
  const [type, setType] =
    useState("SAVINGS");

  const [amount, setAmount] =
    useState("");

  const [note, setNote] =
    useState("");

  const total =
    profile.wealthLogs.reduce(
      (sum, item) =>
        sum +
        Number(
          item.amount || 0
        ),
      0
    );

  async function addWealth() {
    const number =
      Number(
        amount
      );

    if (
      !number ||
      number < 0
    ) {
      return;
    }

    try {
      const row =
        await addWealthLogOnBackend({
          type,
          amount:
            number,
          note:
            note.trim() ||
            null,
        });

      const log = {
        id:
          "W-" +
          row.id,
        type:
          row.type,
        amount:
          Number(
            row.amount
          ),
        note:
          row.note ||
          "",
        day:
          row.recorded_on,
        date:
          row.created_at ||
          new Date()
            .toISOString(),
      };

      const cloud =
        await bootstrapAuthoritativeProfile();

      let updated =
        cloud
          ? normalizeProfile(
              await hydrateStructuredProfile(
                cloud
              )
            )
          : {
              ...profile,
              wealthLogs: [
                log,
                ...profile.wealthLogs,
              ],
            };

      saveProfile(
        updated
      );

      setAmount("");
      setNote("");
    } catch (error) {
      console.error(
        "WEALTH LOG BACKEND FAILED:",
        error
      );
    }
  }


  return (
    <div>
      <div className="wealth-summary card3d">
        <small>
          RECORDED FINANCIAL MOVEMENT
        </small>

        <strong>
          KSh {total.toLocaleString()}
        </strong>

        <p>
          The first genuine wealth action logged each day adds +1 WEALTH.
        </p>
      </div>

      <div className="system-form card3d">
        <h3>
          WEALTH PROGRESS
        </h3>

        <div className="system-form-grid">
          <SystemField label="TYPE">
            <select
              value={type}
              onChange={(event) =>
                setType(
                  event.target.value
                )
              }
            >
              {WEALTH_TYPES.map(
                (item) => (
                  <option key={item}>
                    {item}
                  </option>
                )
              )}
            </select>
          </SystemField>

          <SystemField label="AMOUNT (KSh)">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(event) =>
                setAmount(
                  event.target.value
                )
              }
              placeholder="0"
            />
          </SystemField>
        </div>

        <SystemField label="NOTE">
          <input
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            placeholder="Optional"
          />
        </SystemField>

        <button
          type="button"
          className="system-primary system-action"
          onClick={addWealth}
        >
          LOG WEALTH ACTION
        </button>
      </div>

      <SystemLogList
        items={
          profile.wealthLogs.slice(
            0,
            12
          )
        }
        render={(item) => (
          <>
            <strong>
              {item.type}
            </strong>

            <span>
              KSh {Number(
                item.amount
              ).toLocaleString()}
            </span>

            <small>
              {new Date(
                item.date
              ).toLocaleDateString()}
              {item.note
                ? " • " +
                  item.note
                : ""}
            </small>
          </>
        )}
      />
    </div>
  );
}

export function MasteryPanel({
  profile,
  saveProfile,
}) {
  const skills =
    SKILLS[profile.path];

  const [skill, setSkill] =
    useState(
      skills[0]?.[0] || ""
    );

  const [value, setValue] =
    useState("");

  const [unit, setUnit] =
    useState("reps");

  const [status, setStatus] =
    useState("PRACTICING");

  useEffect(() => {
    if (
      !skills.some(
        (item) =>
          item[0] === skill
      )
    ) {
      setSkill(
        skills[0]?.[0] || ""
      );
    }
  }, [profile.path]);

  function addMastery() {
    if (
      !skill ||
      !value
    ) {
      return;
    }

    if (
      status ===
      "MASTERED"
    ) {
      alert(
        "MASTERY MUST BE VERIFIED THROUGH TRAINING → SKILL TREE. This legacy progress log cannot grant XP, attributes or mastery."
      );
      return;
    }

    const updated =
      addHistory(
        {
          ...profile,
          masteryLogs: [
            {
              id:
                uid("M"),
              skill,
              value:
                Number(
                  value
                ),
              unit,
              status:
                "PRACTICING",
              date:
                new Date()
                  .toISOString(),
            },
            ...profile.masteryLogs,
          ],
        },
        "SKILL PROGRESS",
        skill,
        value +
          " " +
          unit +
          " • PRACTICING"
      );

    saveProfile(
      updated
    );

    setValue("");
  }


  return (
    <div>
      <div className="system-form card3d">
        <h3>
          SKILL MASTERY
        </h3>

        <div className="system-form-grid">
          <SystemField label="CLASS SKILL">
            <select
              value={skill}
              onChange={(event) =>
                setSkill(
                  event.target.value
                )
              }
            >
              {skills.map(
                (item) => (
                  <option key={item[0]}>
                    {item[0]}
                  </option>
                )
              )}
            </select>
          </SystemField>

          <SystemField label="PROGRESS">
            <input
              type="number"
              step="any"
              value={value}
              onChange={(event) =>
                setValue(
                  event.target.value
                )
              }
              placeholder="0"
            />
          </SystemField>

          <SystemField label="UNIT">
            <input
              value={unit}
              onChange={(event) =>
                setUnit(
                  event.target.value
                )
              }
              placeholder="sec / reps / km"
            />
          </SystemField>

          <SystemField label="STATUS">
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value
                )
              }
            >
              <option>
                PRACTICING
              </option>

              <option>
                MASTERED
              </option>
            </select>
          </SystemField>
        </div>

        <button
          data-sfx={
            status === "MASTERED"
              ? "levelup"
              : "success"
          }
          type="button"
          className="system-primary system-action"
          onClick={addMastery}
        >
          RECORD SKILL PROGRESS
        </button>
      </div>

      <SystemLogList
        items={
          profile.masteryLogs.slice(
            0,
            12
          )
        }
        render={(item) => (
          <>
            <strong>
              {item.skill}
            </strong>

            <span>
              {item.value} {item.unit} • {item.status}
            </span>

            <small>
              {new Date(
                item.date
              ).toLocaleDateString()}
            </small>
          </>
        )}
      />
    </div>
  );
}

export function GoalCard({
  goal,
  profile,
  saveProfile,
}) {
  const [value, setValue] =
    useState(
      String(goal.current || 0)
    );

  async function updateGoal() {
    const number =
      Math.max(
        0,
        Number(
          value
        ) || 0
      );

    try {
      await updateGoalProgressOnBackend({
        goalId:
          goal.id,
        current:
          number,
      });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      saveProfile(
        normalizeProfile(
          await hydrateStructuredProfile(
            cloud
          )
        )
      );
    } catch (error) {
      console.error(
        "GOAL UPDATE BACKEND FAILED:",
        error
      );
    }
  }

  async function claimGoal() {
    if (
      goal.status ===
        "COMPLETE" ||
      Number(
        goal.current
      ) <
        Number(
          goal.target
        )
    ) {
      return;
    }

    try {
      await claimGoalOnBackend(
        goal.id
      );

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      saveProfile(
        normalizeProfile(
          await hydrateStructuredProfile(
            cloud
          )
        )
      );
    } catch (error) {
      console.error(
        "GOAL CLAIM BACKEND FAILED:",
        error
      );

      alert(
        "THE SYSTEM COULD NOT VERIFY THIS GOAL."
      );
    }
  }


  const percent =
    Math.min(
      100,
      ((Number(
        goal.current
      ) || 0) /
        Math.max(
          1,
          Number(
            goal.target
          ) || 1
        )) *
        100
    );

  return (
    <div className="goal-card card3d">
      <div className="goal-top">
        <div>
          <span>
            {goal.category}
          </span>

          <h3>
            {goal.title}
          </h3>
        </div>

        <b>
          {goal.status}
        </b>
      </div>

      <div className="goal-progress">
        <i
          style={{
            width:
              percent + "%",
          }}
        />
      </div>

      <div className="goal-numbers">
        <strong>
          {goal.current} / {goal.target} {goal.unit}
        </strong>

        {goal.deadline && (
          <small>
            {goal.deadline}
          </small>
        )}
      </div>

      {goal.status !==
        "COMPLETE" && (
        <div className="goal-update">
          <input
            type="number"
            step="any"
            value={value}
            onChange={(event) =>
              setValue(
                event.target.value
              )
            }
          />

          <button
            type="button"
            onClick={updateGoal}
          >
            UPDATE
          </button>
        </div>
      )}

      {goal.status !==
        "COMPLETE" &&
        Number(goal.current) >=
          Number(goal.target) && (
          <button
            data-sfx="levelup"
            type="button"
            className="system-primary system-action"
            onClick={claimGoal}
          >
            CLAIM MAJOR GOAL
          </button>
        )}
    </div>
  );
}

export function GoalsPanel({
  profile,
  saveProfile,
}) {
  const [title, setTitle] =
    useState("");

  const [category, setCategory] =
    useState("ENDURANCE");

  const [target, setTarget] =
    useState("");

  const [unit, setUnit] =
    useState("");

  const [deadline, setDeadline] =
    useState("");

  async function addGoal() {
    if (
      !title.trim() ||
      !Number(
        target
      )
    ) {
      return;
    }

    try {
      await createGoalOnBackend({
        title:
          title
            .trim()
            .toUpperCase(),
        category,
        target:
          Number(
            target
          ),
        unit:
          unit.trim() ||
          null,
        deadline:
          deadline ||
          null,
      });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      saveProfile(
        normalizeProfile(
          await hydrateStructuredProfile(
            cloud
          )
        )
      );

      setTitle("");
      setTarget("");
      setDeadline("");
    } catch (error) {
      console.error(
        "GOAL CREATE BACKEND FAILED:",
        error
      );
    }
  }


  return (
    <div>
      <div className="system-form card3d">
        <h3>
          MAJOR GOAL
        </h3>

        <p className="muted-system-copy">
          Long-term character objectives only. Normal custom daily quests are intentionally not included.
        </p>

        <div className="system-form-grid">
          <SystemField label="GOAL">
            <input
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="E.G. RUN 10 KM"
            />
          </SystemField>

          <SystemField label="CATEGORY">
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
            >
              {GOAL_CATEGORIES.map(
                (item) => (
                  <option key={item}>
                    {item}
                  </option>
                )
              )}
            </select>
          </SystemField>

          <SystemField label="TARGET">
            <input
              type="number"
              step="any"
              value={target}
              onChange={(event) =>
                setTarget(
                  event.target.value
                )
              }
              placeholder="100"
            />
          </SystemField>

          <SystemField label="UNIT">
            <input
              value={unit}
              onChange={(event) =>
                setUnit(
                  event.target.value
                )
              }
              placeholder="km / KSh / reps"
            />
          </SystemField>

          <SystemField label="DEADLINE">
            <input
              type="date"
              value={deadline}
              onChange={(event) =>
                setDeadline(
                  event.target.value
                )
              }
            />
          </SystemField>
        </div>

        <button
          type="button"
          className="system-primary system-action"
          onClick={addGoal}
        >
          LOCK MAJOR GOAL
        </button>
      </div>

      <div className="goal-grid">
        {profile.goals.map(
          (goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              profile={profile}
              saveProfile={saveProfile}
            />
          )
        )}
      </div>
    </div>
  );
}

export function ProgressPage({
  profile,
  saveProfile,
}) {
  const [mode, setMode] =
    useState("PERFORMANCE");

  return (
    <div className="page">
      <PageHero
        eyebrow="REAL-WORLD CHARACTER DATA"
        title="PROGRESS"
        text="Track body performance, wealth, actual skill mastery and major goals."
      />

      <div className="progress-switch">
        {[
          "PERFORMANCE",
          "WEALTH",
          "MASTERY",
          "GOALS",
        ].map((item) => (
          <button
            type="button"
            key={item}
            className={
              mode === item
                ? "active"
                : ""
            }
            onClick={() =>
              setMode(item)
            }
          >
            {item}
          </button>
        ))}
      </div>

      {mode ===
        "PERFORMANCE" && (
        <PerformancePanel
          profile={profile}
          saveProfile={saveProfile}
        />
      )}

      {mode ===
        "WEALTH" && (
        <WealthPanel
          profile={profile}
          saveProfile={saveProfile}
        />
      )}

      {mode ===
        "MASTERY" && (
        <MasteryPanel
          profile={profile}
          saveProfile={saveProfile}
        />
      )}

      {mode ===
        "GOALS" && (
        <GoalsPanel
          profile={profile}
          saveProfile={saveProfile}
        />
      )}
    </div>
  );
}

export function Inventory({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
}) {
  const [mode, setMode] =
    useState("SYSTEM");

  const [selected, setSelected] =
    useState(null);

  const [name, setName] =
    useState("");

  const [type, setType] =
    useState("GEAR");

  const [rarity, setRarity] =
    useState("RARE");

  const [bonus, setBonus] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [image, setImage] =
    useState("");

  const [rewardCategory, setRewardCategory] =
    useState("ENDURANCE");

  const [rewardSource, setRewardSource] =
    useState("");

  const [rewardName, setRewardName] =
    useState("");

  const systemItems = (profile.equipment?.items || []).map(item => ({ ...item, id: "GEAR-" + item.id }));
  const [equipmentPending, setEquipmentPending] = useState(false);
  const [equipmentError, setEquipmentError] = useState("");
  const equipmentLock = useRef(false);

  useEffect(() => {
    setSelected(current => current && String(current.id).startsWith("GEAR-")
      ? systemItems.find(item => item.id === current.id) || profile.customInventory?.find(item => item.id === current.id) || null
      : current);
  }, [profile.equipment, profile.customInventory]);

  async function addPhoto(event) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      setImage(
        await imageData(file)
      );
    } catch {}
  }

  async function addGear() {
    if (
      !name.trim()
    ) {
      return;
    }

    try {
      await addCustomInventoryOnBackend({
        name:
          name
            .trim()
            .toUpperCase(),
        rarity,
        type,
        bonus:
          bonus.trim() ||
          null,
        notes:
          notes.trim() ||
          null,
        imagePath:
          null,
      });

      await refreshInventoryAuthority();

      setName("");
      setBonus("");
      setNotes("");
      setImage("");
    } catch (error) {
      console.error(
        "CUSTOM GEAR BACKEND FAILED:",
        error
      );

      alert(
        "THE SYSTEM COULD NOT ADD THIS GEAR."
      );
    }
  }


  function suggest() {
    setRewardName(
      suggestReward(
        rewardCategory,
        rewardSource +
          Date.now()
      )
    );
  }

  function addManualReward() {
    alert(
      "REWARD VAULT IS SYSTEM-AUTHORITATIVE. Rewards are earned from verified quests, Bosses, goals and progression events."
    );
  }


  async function refreshInventoryAuthority() {
    const cloud =
      await bootstrapAuthoritativeProfile();

    if (!cloud) {
      throw new Error(
        "AUTHORITATIVE_REFRESH_FAILED"
      );
    }

    const hydrated =
      await hydrateStructuredProfile(
        cloud
      );

    applyAuthoritativeProfile(
      normalizeProfile(
        hydrated
      )
    );
  }

  async function claimReward(id) {
    try {
      await claimRewardOnBackend(
        id
      );

      await refreshInventoryAuthority();
    } catch (error) {
      console.error(
        "AUTHORITATIVE REWARD CLAIM FAILED:",
        error
      );

      alert(
        "THE SYSTEM COULD NOT CLAIM THIS REWARD."
      );
    }
  }

  async function toggleEquipped(item) {
    if (equipmentLock.current) return;
    equipmentLock.current = true; setEquipmentPending(true); setEquipmentError("");
    try {
      await setInventoryStateOnBackend({
        inventoryId:
          item.id,
        equipped:
          !item.equipped,
      });

      await refreshInventoryAuthority();
    } catch (error) {
      console.error(
        "AUTHORITATIVE EQUIP FAILED:",
        error
      );

      setEquipmentError("The equipment change could not be confirmed. Refresh your inventory and retry.");
    } finally { equipmentLock.current = false; setEquipmentPending(false); }
  }

  async function toggleShowcase(item) {
    try {
      await setInventoryStateOnBackend({
        inventoryId:
          item.id,
        showcase:
          !item.showcase,
      });

      await refreshInventoryAuthority();
    } catch (error) {
      console.error(
        "AUTHORITATIVE SHOWCASE FAILED:",
        error
      );

      alert(
        "THE SYSTEM COULD NOT CHANGE THIS ITEM'S SHOWCASE STATE."
      );
    }
  }


  return (
    <div className="page">
      <PageHero
        eyebrow="ACQUIRED ASSETS"
        title="INVENTORY"
        text="System loot, real gear and matched rewards live in one vault."
      />

      <section className="equipment-loadout card3d" aria-label="Active equipment bonuses">
        <strong>ACTIVE EQUIPMENT</strong>
        <p>{Object.entries(profile.equipment?.bonuses || {}).filter(([, value]) => Number(value) > 0).map(([name, value]) => `+${value} ${name}`).join(" · ") || "Equip an unlocked System item to activate its bonus."}</p>
        <small>Gear bonuses apply while equipped. Earned attributes remain yours. Personal gear descriptions do not create stat bonuses.</small>
        {equipmentError && <p role="alert">{equipmentError}</p>}
        <button type="button" disabled={equipmentPending} onClick={async () => {
          setEquipmentPending(true); setEquipmentError("");
          try { await refreshInventoryAuthority(); } catch { setEquipmentError("Inventory sync failed. Please retry."); } finally { setEquipmentPending(false); }
        }}>SYNC INVENTORY</button>
      </section>

      <div className="progress-switch inventory-switch">
        {[
          ["SYSTEM", "SYSTEM LOOT"],
          ["GEAR", "MY GEAR"],
          ["REWARDS", "REWARD VAULT"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={
              mode === id
                ? "active"
                : ""
            }
            onClick={() =>
              setMode(id)
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "SYSTEM" && (
        !systemItems.length ? (
          <div className="empty card3d">
            ◆ REACH LEVEL 5 TO UNLOCK YOUR FIRST SYSTEM ITEM
          </div>
        ) : (
          <div className="loot-grid">
            {systemItems.map(
              (item) => (
                <button
                  type="button"
                  className="loot-card card3d"
                  key={item.id}
                  onClick={() =>
                    setSelected(item)
                  }
                >
                  <div
                    className="loot-icon"
                    style={{
                      color:
                        RARITY_COLORS[
                          item.rarity
                        ],
                      borderColor:
                        RARITY_COLORS[
                          item.rarity
                        ],
                    }}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <span
                      style={{
                        color:
                          RARITY_COLORS[
                            item.rarity
                          ],
                      }}
                    >
                      {item.rarity}
                    </span>

                    <strong>
                      {item.name}
                    </strong>

                    <small>
                      POWER {item.power} • LVL {item.level}
                    </small>
                  </div>
                </button>
              )
            )}
          </div>
        )
      )}

      {mode === "GEAR" && (
        <>
          <div className="system-form card3d">
            <h3>
              ADD REAL GEAR
            </h3>

            <div className="system-form-grid">
              <SystemField label="ITEM NAME">
                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="E.G. RUNNING SHOES"
                />
              </SystemField>

              <SystemField label="TYPE">
                <input
                  value={type}
                  onChange={(event) =>
                    setType(
                      event.target.value
                    )
                  }
                  placeholder="GEAR"
                />
              </SystemField>

              <SystemField label="RARITY">
                <select
                  value={rarity}
                  onChange={(event) =>
                    setRarity(
                      event.target.value
                    )
                  }
                >
                  {Object.keys(
                    RARITY_COLORS
                  ).map((item) => (
                    <option key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </SystemField>

              <SystemField label="BONUS / MEANING">
                <input
                  value={bonus}
                  onChange={(event) =>
                    setBonus(
                      event.target.value
                    )
                  }
                  placeholder="+ ENDURANCE / PERSONAL BEST"
                />
              </SystemField>
            </div>

            <SystemField label="NOTES">
              <input
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                placeholder="How you earned it"
              />
            </SystemField>

            <SystemField label="OPTIONAL IMAGE">
              <input
                type="file"
                accept="image/*"
                onChange={addPhoto}
              />
            </SystemField>

            {image && (
              <img
                className="proof-preview"
                src={image}
                alt="Gear preview"
              />
            )}

            <button
              type="button"
              className="system-primary system-action"
              onClick={addGear}
            >
              ADD TO INVENTORY
            </button>
          </div>

          {!profile.customInventory.length ? (
            <div className="empty card3d">
              NO REAL GEAR ADDED YET
            </div>
          ) : (
            <div className="loot-grid">
              {profile.customInventory.map(
                (item) => (
                  <button
                    type="button"
                    className="loot-card card3d"
                    key={item.id}
                    onClick={() =>
                      setSelected(item)
                    }
                  >
                    {item.image ? (
                      <img
                        className="loot-photo"
                        src={item.image}
                        alt=""
                      />
                    ) : (
                      <div
                        className="loot-icon"
                        style={{
                          color:
                            RARITY_COLORS[
                              item.rarity
                            ],
                          borderColor:
                            RARITY_COLORS[
                              item.rarity
                            ],
                        }}
                      >
                        ◆
                      </div>
                    )}

                    <div>
                      <span
                        style={{
                          color:
                            RARITY_COLORS[
                              item.rarity
                            ],
                        }}
                      >
                        {item.rarity}
                      </span>

                      <strong>
                        {item.name}
                      </strong>

                      <small>
                        {item.type}
                        {item.bonus
                          ? " • " +
                            item.bonus
                          : ""}
                      </small>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {mode === "REWARDS" && (
        <>
          <div className="system-form card3d">
            <h3>
              MATCHED REWARD / GIFT
            </h3>

            <p className="muted-system-copy">
              Choose the achievement type and the System can suggest a reward that actually fits it.
            </p>

            <div className="system-form-grid">
              <SystemField label="ACHIEVEMENT TYPE">
                <select
                  value={rewardCategory}
                  onChange={(event) =>
                    setRewardCategory(
                      event.target.value
                    )
                  }
                >
                  {GOAL_CATEGORIES.map(
                    (item) => (
                      <option key={item}>
                        {item}
                      </option>
                    )
                  )}
                </select>
              </SystemField>

              <SystemField label="SOURCE">
                <input
                  value={rewardSource}
                  onChange={(event) =>
                    setRewardSource(
                      event.target.value
                    )
                  }
                  placeholder="E.G. 10 KM BOSS"
                />
              </SystemField>
            </div>

            <SystemField label="REWARD">
              <input
                value={rewardName}
                onChange={(event) =>
                  setRewardName(
                    event.target.value
                  )
                }
                placeholder="Reward or gift"
              />
            </SystemField>

            <div className="dual-actions">
              <button
                type="button"
                onClick={suggest}
              >
                SYSTEM SUGGESTION
              </button>

              <button
                type="button"
                className="system-primary system-action"
                onClick={addManualReward}
              >
                ADD REWARD
              </button>
            </div>
          </div>

          {!profile.rewards.length ? (
            <div className="empty card3d">
              NO REWARDS IN VAULT
            </div>
          ) : (
            <div className="reward-grid">
              {profile.rewards.map(
                (reward) => (
                  <div
                    className={
                      "reward-card card3d " +
                      (reward.status ===
                      "CLAIMED"
                        ? "claimed"
                        : "")
                    }
                    key={reward.id}
                  >
                    <span>
                      {reward.category}
                    </span>

                    <h3>
                      {reward.name}
                    </h3>

                    <p>
                      {reward.source}
                    </p>

                    <b>
                      {reward.status}
                    </b>

                    {reward.status !==
                      "CLAIMED" && (
                      <button
                        data-sfx="success"
                        type="button"
                        onClick={() =>
                          claimReward(
                            reward.id
                          )
                        }
                      >
                        CLAIM REWARD
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <div
          className="loot-modal-overlay"
          onClick={() =>
            setSelected(null)
          }
        >
          <div
            className="loot-modal card3d"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {selected.image ? (
              <img
                className="loot-modal-photo"
                src={selected.image}
                alt=""
              />
            ) : (
              <div
                className="loot-icon big"
                style={{
                  color:
                    RARITY_COLORS[
                      selected.rarity
                    ],
                  borderColor:
                    RARITY_COLORS[
                      selected.rarity
                    ],
                }}
              >
                {selected.icon || "◆"}
              </div>
            )}

            <h2>
              {selected.name}
            </h2>

            <b
              style={{
                color:
                  RARITY_COLORS[
                    selected.rarity
                  ],
              }}
            >
              {selected.rarity}
            </b>

            {[
              ["TYPE", selected.type],
              [
                "LEVEL",
                selected.level ||
                  "REAL",
              ],
              [
                "POWER",
                selected.power ?? "—",
              ],
              [
                "AFFINITY",
                selected.bonus || "—",
              ],
            ].map(([label, value]) => (
              <div
                className="loot-stat"
                key={label}
              >
                <span>
                  {label}
                </span>

                <strong>
                  {value}
                </strong>
              </div>
            ))}

            {selected.notes && (
              <p className="muted-system-copy">
                {selected.notes}
              </p>
            )}

            {String(selected.id || "").startsWith("GEAR-") && (
              <div className="inventory-authority-actions">
                <button
                  type="button"
                  disabled={equipmentPending}
                  onClick={() =>
                    toggleEquipped(
                      selected
                    )
                  }
                >
                  {equipmentPending ? "SYNCING" : selected.equipped
                    ? "UNEQUIP"
                    : "EQUIP"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleShowcase(
                      selected
                    )
                  }
                >
                  {selected.showcase
                    ? "REMOVE SHOWCASE"
                    : "SHOWCASE"}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setSelected(null)
              }
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Journey({
  profile,
  saveProfile,
  applyAuthoritativeProfile,
}) {
  const [title, setTitle] =
    useState("");

  const [type, setType] =
    useState("ACHIEVEMENT");

  const [note, setNote] =
    useState("");

  const [image, setImage] =
    useState("");

  const [
    proofFile,
    setProofFile,
  ] = useState(null);

  const [
    uploadingProof,
    setUploadingProof,
  ] = useState(false);

  useEffect(() => {
    refreshProgressionAuthority();
  }, []);

  async function addPhoto(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setProofFile(file);

    try {
      setImage(
        await imageData(file)
      );
    } catch {}
  }

  async function refreshProgressionAuthority() {
    try {
      await refreshProgressionUnlocksOnBackend();

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      applyAuthoritativeProfile(
        normalizeProfile(
          hydrated
        )
      );
    } catch (error) {
      console.error(
        "PROGRESSION REFRESH FAILED:",
        error
      );
    }
  }

  async function equipTitle(title) {
    try {
      await equipTitleOnBackend(
        title.id
      );

      await refreshProgressionAuthority();
    } catch (error) {
      console.error(
        "TITLE EQUIP FAILED:",
        error
      );

      alert(
        "THE SYSTEM COULD NOT EQUIP THIS TITLE."
      );
    }
  }

  async function archiveProof() {
    if (
      !title.trim() ||
      uploadingProof
    ) {
      return;
    }

    setUploadingProof(
      true
    );

    try {
      let storagePath =
        "";

      if (
        proofFile
      ) {
        const uploaded =
          await uploadProofImage(
            proofFile
          );

        storagePath =
          uploaded.path;
      }

      await submitProofRecordOnBackend({
        title:
          title
            .trim()
            .toUpperCase(),
        proofType:
          type ===
            "PHYSICAL"
            ? "IMAGE"
            : "OTHER",
        storagePath:
          storagePath ||
          null,
        mimeType:
          proofFile?.type ||
          null,
        fileSize:
          proofFile?.size ||
          null,
        relatedEventType:
          type,
        note:
          note.trim() ||
          null,
        metadata: {
          archived_from:
            "JOURNEY",
        },
      });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (cloud) {
        applyAuthoritativeProfile(
          normalizeProfile(
            await hydrateStructuredProfile(
              cloud
            )
          )
        );
      }

      setTitle("");
      setNote("");
      setImage("");
      setProofFile(
        null
      );
    } catch (error) {
      console.error(
        "PROOF ARCHIVE FAILED:",
        error
      );

      alert(
        "PROOF ARCHIVE FAILED. Check your connection and try again."
      );
    } finally {
      setUploadingProof(
        false
      );
    }
  }


  const legacy =
    profile.history.length
      ? []
      : profile.completed.map(
          (item, index) => ({
            id:
              "legacy-" + index,
            type: "REGISTERED",
            title: item,
            detail:
              "Action successfully registered.",
            date: "",
          })
        );

  const entries = [
    ...profile.history,
    ...legacy,
  ];

  return (
    <div className="page">
      <PageHero
        eyebrow="PLAYER HISTORY"
        title="JOURNEY"
        text="Major victories, gear, wealth, skill mastery, proof and progression are archived here."
      />

      <div className="system-form card3d">
        <h3>
          PROOF / ACHIEVEMENT RECORD
        </h3>

        <div className="system-form-grid">
          <SystemField label="TITLE">
            <input
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="E.G. FIRST 10 KM"
            />
          </SystemField>

          <SystemField label="TYPE">
            <select
              value={type}
              onChange={(event) =>
                setType(
                  event.target.value
                )
              }
            >
              <option>
                ACHIEVEMENT
              </option>
              <option>
                PHYSICAL
              </option>
              <option>
                SKILL
              </option>
              <option>
                WEALTH
              </option>
              <option>
                GEAR
              </option>
            </select>
          </SystemField>
        </div>

        <SystemField label="NOTE">
          <input
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            placeholder="Optional context"
          />
        </SystemField>

        <SystemField label="PHOTO PROOF">
          <input
            type="file"
            accept="image/*"
            onChange={addPhoto}
          />
        </SystemField>

        {image && (
          <img
            className="proof-preview"
            src={image}
            alt="Proof preview"
          />
        )}

        <button
          type="button"
          className="system-primary system-action"
          onClick={archiveProof}
          disabled={
            uploadingProof
          }
        >
          {uploadingProof
            ? "UPLOADING TO PROOF VAULT..."
            : "ARCHIVE PROOF"}
        </button>
      </div>

      {profile.proofs.length > 0 && (
        <>
          <SectionLabel
            number="P"
            title="PROOF VAULT"
          />

          <div className="proof-grid">
            {profile.proofs.map(
              (proof) => (
                <div
                  className="proof-card card3d"
                  key={proof.id}
                >
                  {proof.image && (
                    <img
                      src={proof.image}
                      alt=""
                    />
                  )}

                  <span>
                    {proof.type}
                  </span>

                  <h3>
                    {proof.title}
                  </h3>

                  <p>
                    {proof.note}
                  </p>

                  <small>
                    {new Date(
                      proof.date
                    ).toLocaleDateString()}
                  </small>
                </div>
              )
            )}
          </div>
        </>
      )}

      {profile.cloudAchievements.length > 0 && (
        <>
          <SectionLabel
            number="★"
            title="ACHIEVEMENTS"
          />

          <div className="achievement-grid">
            {profile.cloudAchievements.map(
              (achievement) => (
                <div
                  key={
                    achievement.id
                  }
                  className={
                    achievement.unlocked
                      ? "achievement-card card3d unlocked"
                      : "achievement-card card3d"
                  }
                >
                  <span>
                    {achievement.icon ||
                      "◆"}
                  </span>

                  <div>
                    <small>
                      {achievement.rarity}
                    </small>

                    <h3>
                      {achievement.name}
                    </h3>

                    <p>
                      {achievement.description}
                    </p>
                  </div>

                  <strong>
                    {achievement.unlocked
                      ? "UNLOCKED"
                      : `${Number(
                          achievement.progress ||
                            0
                        )}/${Number(
                          achievement.target ||
                            1
                        )}`}
                  </strong>
                </div>
              )
            )}
          </div>
        </>
      )}

      {Array.isArray(
        profile.cloudTitles
      ) &&
        profile.cloudTitles.length >
          0 && (
        <>
          <SectionLabel
            number="T"
            title="TITLES"
          />

          <div className="achievement-grid title-grid">
            {profile.cloudTitles.map(
              (title) => (
                <div
                  key={title.id}
                  className={
                    title.equipped
                      ? "achievement-card card3d unlocked"
                      : "achievement-card card3d"
                  }
                >
                  <span>
                    {title.icon ||
                      "◆"}
                  </span>

                  <div>
                    <small>
                      {title.rarity}
                      {" • "}
                      {title.category}
                    </small>

                    <h3>
                      {title.name}
                    </h3>

                    <p>
                      {title.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      title.equipped
                    }
                    onClick={() =>
                      equipTitle(
                        title
                      )
                    }
                  >
                    {title.equipped
                      ? "EQUIPPED"
                      : "EQUIP TITLE"}
                  </button>
                </div>
              )
            )}
          </div>
        </>
      )}

      <SectionLabel
        number="∞"
        title="SYSTEM HISTORY"
      />

      <div className="timeline">
        <div className="timeline-entry card3d">
          <span>
            00
          </span>

          <div>
            <small>
              ORIGIN
            </small>

            <strong>
              SYSTEM INITIALIZED
            </strong>

            <p>
              {profile.name} entered as {profile.path}.
            </p>
          </div>
        </div>

        {entries.map(
          (entry, index) => (
            <div
              className="timeline-entry card3d"
              key={
                entry.id ||
                entry.title +
                  index
              }
            >
              <span>
                {String(
                  index + 1
                ).padStart(
                  2,
                  "0"
                )}
              </span>

              <div>
                <small>
                  {entry.type}
                </small>

                <strong>
                  {entry.title}
                </strong>

                <p>
                  {entry.detail}
                </p>

                {entry.date && (
                  <em>
                    {new Date(
                      entry.date
                    ).toLocaleString()}
                  </em>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <div className="fingerprint-card card3d">
        <small>
          COMMITMENT FINGERPRINT
        </small>

        <strong>
          {profile.fingerprint}
        </strong>

        <p>
          Local identifier generated from your original System registration.
        </p>
      </div>
    </div>
  );
}


export function ClassTraining({ profile, saveProfile, applyAuthoritativeProfile, setTab }) {
  async function refreshProfile() {
    const cloud = await bootstrapAuthoritativeProfile();
    if (!cloud) throw new Error("AUTHORITATIVE_REFRESH_FAILED");
    applyAuthoritativeProfile(normalizeProfile(await hydrateStructuredProfile(cloud)));
  }
  return <ClassSpecial key={profile.path} profile={profile} saveProfile={saveProfile}
    refreshProfile={refreshProfile} setTab={setTab} PageHero={PageHero} SectionLabel={SectionLabel} />;
}

export function FuelSystem({
  profile,
  saveProfile,
}) {
  const fuel =
    normalizeFuelState(
      profile.fuel
    );

  const date = todayKey();

  const [mealName, setMealName] =
    useState("");

  const [mealCalories, setMealCalories] =
    useState("");

  const [mealProtein, setMealProtein] =
    useState("");

  const [mealSlot, setMealSlot] =
    useState("MEAL");

  const protocol =
    getFuelProtocol(
      profile.path,
      fuel.goal || "MAINTAIN"
    );

  const plannedMeals =
    getFuelMealPlan(
      profile.path,
      fuel.goal || "MAINTAIN"
    );

  const todayEntries =
    fuel.logs[date] ||
    [];

  const summary =
    summarizeFuelDay(
      todayEntries,
      fuel.calorieTarget,
      fuel.proteinTarget
    );

  const lastSevenDays =
    Array.from(
      { length: 7 },
      (_, index) => {
        const day = new Date();
        day.setDate(
          day.getDate() - index
        );
        return todayKey(day);
      }
    );

  const consistency =
    recentFuelConsistency(
      fuel.logs,
      lastSevenDays
    );

  function updateFuel(next) {
    saveProfile({
      ...profile,
      fuel: normalizeFuelState(next),
    });
  }

  function chooseGoal(goal) {
    updateFuel({
      ...fuel,
      goal,
    });
  }

  function setTarget(key, value) {
    const clean =
      value === ""
        ? 0
        : Math.max(
            0,
            Math.round(
              Number(value) || 0
            )
          );

    updateFuel({
      ...fuel,
      [key]: clean,
    });
  }

  function prepareSuggestedMeal(meal) {
    if (!meal) {
      return;
    }

    setMealSlot(meal.slot || "MEAL");
    setMealName(meal.title || "");
    setMealCalories("");
    setMealProtein("");

    window.requestAnimationFrame(() => {
      document
        .getElementById("system-fuel-log-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    });
  }

  function logMeal() {
    const calories =
      Math.max(
        0,
        Math.round(
          Number(mealCalories) ||
          0
        )
      );

    const protein =
      Math.max(
        0,
        Math.round(
          Number(mealProtein) ||
          0
        )
      );

    if (
      !mealName.trim() ||
      calories <= 0
    ) {
      return;
    }

    const entry = {
      id: uid("FUEL"),
      meal: mealName.trim(),
      calories,
      protein,
      slot: mealSlot,
      loggedAt: new Date()
        .toISOString(),
    };

    updateFuel({
      ...fuel,
      logs: {
        ...fuel.logs,
        [date]: [
          ...todayEntries,
          entry,
        ],
      },
    });

    setMealName("");
    setMealCalories("");
    setMealProtein("");
  }

  function removeMeal(id) {
    updateFuel({
      ...fuel,
      logs: {
        ...fuel.logs,
        [date]: todayEntries.filter(
          (entry) =>
            entry.id !== id
        ),
      },
    });
  }

  if (!fuel.goal) {
    return (
      <div className="page fuel-system-page">
        <PageHero
          eyebrow={profile.path + " FUEL PROTOCOL"}
          title="FUEL SYSTEM"
          text="Choose your current goal. THE SYSTEM already knows your class and will shape the meal rhythm and food guidance around it."
        />

        <section className="fuel-onboarding card3d">
          <small>SELECT CURRENT OBJECTIVE</small>
          <h2>HOW SHOULD THIS CLASS EAT RIGHT NOW?</h2>
          <p>
            Your class is {profile.path}. You do not need to select it again.
          </p>

          <div className="fuel-goal-grid">
            {FUEL_GOALS.map((goal) => (
              <button
                data-sfx="click"
                type="button"
                key={goal}
                onClick={() =>
                  chooseGoal(goal)
                }
              >
                <small>
                  {goal === "CUT"
                    ? "REDUCE FAT"
                    : goal === "BULK"
                      ? "BUILD MUSCLE"
                      : "STAY STEADY"}
                </small>
                <strong>{goal}</strong>
                <span>
                  {getFuelProtocol(
                    profile.path,
                    goal
                  ).mealRhythm}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page fuel-system-page">
      <PageHero
        eyebrow={profile.path + " // " + fuel.goal + " FUEL PROTOCOL"}
        title="FUEL SYSTEM"
        text={protocol.focus}
      />

      <section className="fuel-protocol-card card3d">
        <div>
          <small>CLASS MEAL RHYTHM</small>
          <strong>{protocol.mealRhythm}</strong>
          <p>{protocol.disclaimer}</p>
        </div>
        <div className="fuel-food-chips">
          {protocol.foods.map((food) => (
            <span key={food}>{food}</span>
          ))}
        </div>
      </section>

      <SectionLabel
        number="01"
        title={profile.path + " DAILY MEAL PLAN"}
      />

      <section className="fuel-meal-plan">
        <div className="fuel-meal-plan-intro card3d">
          <div>
            <small>CLASS-SPECIFIC RHYTHM</small>
            <strong>{protocol.mealRhythm}</strong>
          </div>
          <p>
            Build each entry from what you actually eat. The plan gives the
            {" "}
            {profile.path.toLowerCase()} structure; you still log the real
            calories and protein from your portions.
          </p>
        </div>

        <div className="fuel-meal-plan-grid">
          {plannedMeals.map((meal, index) => (
            <article
              key={meal.slot + "-" + meal.title}
              className="fuel-meal-plan-card card3d"
            >
              <small>
                {String(index + 1).padStart(2, "0")} // {meal.slot}
              </small>
              <strong>{meal.title}</strong>
              <p>{meal.guide}</p>
              <button
                type="button"
                onClick={() =>
                  prepareSuggestedMeal(meal)
                }
              >
                PREPARE LOG
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="fuel-targets card3d">
        <div>
          <small>GOAL</small>
          <strong>{fuel.goal}</strong>
          <button
            type="button"
            onClick={() =>
              chooseGoal("")
            }
          >
            CHANGE
          </button>
        </div>

        <SystemField label="DAILY CALORIE TARGET">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={
              fuel.calorieTarget ||
              ""
            }
            onChange={(event) =>
              setTarget(
                "calorieTarget",
                event.target.value
              )
            }
            placeholder="SET YOUR TARGET"
          />
        </SystemField>

        <SystemField label="DAILY PROTEIN TARGET (G)">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={
              fuel.proteinTarget ||
              ""
            }
            onChange={(event) =>
              setTarget(
                "proteinTarget",
                event.target.value
              )
            }
            placeholder="SET YOUR TARGET"
          />
        </SystemField>
      </section>

      <section className="fuel-summary-grid">
        <article className="card3d">
          <small>CALORIES LOGGED</small>
          <strong>{summary.calories}</strong>
          <span>
            {fuel.calorieTarget
              ? summary.calorieRemaining >= 0
                ? summary.calorieRemaining + " REMAINING"
                : Math.abs(summary.calorieRemaining) + " OVER TARGET"
              : "SET A TARGET"}
          </span>
          <div className="fuel-meter">
            <i
              style={{
                width:
                  summary.caloriePercent +
                  "%",
              }}
            />
          </div>
        </article>

        <article className="card3d">
          <small>PROTEIN LOGGED</small>
          <strong>{summary.protein}G</strong>
          <span>
            {fuel.proteinTarget
              ? summary.proteinRemaining >= 0
                ? summary.proteinRemaining + "G REMAINING"
                : "TARGET MET"
              : "SET A TARGET"}
          </span>
          <div className="fuel-meter protein">
            <i
              style={{
                width:
                  summary.proteinPercent +
                  "%",
              }}
            />
          </div>
        </article>

        <article className="card3d">
          <small>7-DAY CONSISTENCY</small>
          <strong>
            {consistency.loggedDays} / {consistency.totalDays}
          </strong>
          <span>LOGGED DAYS</span>
        </article>
      </section>

      <SectionLabel
        number="02"
        title="LOG A MEAL"
      />

      <section
        id="system-fuel-log-form"
        className="fuel-log-form card3d"
      >
        <select
          value={mealSlot}
          onChange={(event) =>
            setMealSlot(
              event.target.value
            )
          }
        >
          <option value="BREAKFAST">BREAKFAST</option>
          <option value="LUNCH">LUNCH</option>
          <option value="DINNER">DINNER</option>
          <option value="SNACK">SNACK</option>
          <option value="MEAL">MEAL</option>
        </select>

        <input
          value={mealName}
          onChange={(event) =>
            setMealName(
              event.target.value
            )
          }
          placeholder="MEAL NAME — E.G. EGGS + OATS"
        />

        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={mealCalories}
          onChange={(event) =>
            setMealCalories(
              event.target.value
            )
          }
          placeholder="CALORIES"
        />

        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={mealProtein}
          onChange={(event) =>
            setMealProtein(
              event.target.value
            )
          }
          placeholder="PROTEIN G"
        />

        <button
          data-sfx="success"
          type="button"
          onClick={logMeal}
        >
          LOG MEAL
        </button>
      </section>

      <SectionLabel
        number="03"
        title="TODAY'S FUEL LOG"
      />

      <section className="fuel-log-list">
        {todayEntries.length ? (
          todayEntries.map((entry) => (
            <article
              key={entry.id}
              className="fuel-log-entry card3d"
            >
              <span>{entry.slot}</span>
              <div>
                <strong>{entry.meal}</strong>
                <small>
                  {entry.calories} KCAL • {entry.protein}G PROTEIN
                </small>
              </div>
              <button
                type="button"
                aria-label={
                  "Remove " +
                  entry.meal
                }
                onClick={() =>
                  removeMeal(entry.id)
                }
              >
                ×
              </button>
            </article>
          ))
        ) : (
          <div className="fuel-log-empty card3d">
            <strong>NO MEALS LOGGED YET.</strong>
            <p>
              Start with the next meal you actually eat; consistency matters more than a perfect first day.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function TrophyRoom({
  profile,
}) {
  const completedQuests =
    Array.isArray(
      profile.questLog
    )
      ? profile.questLog.length
      : 0;

  const bossVictories =
    Array.isArray(
      profile.bossQuests
    )
      ? profile.bossQuests.filter(
          (boss) =>
            boss.status ===
            "COMPLETE"
        ).length
      : 0;

  const workouts =
    Number(
      profile.totalWorkouts ||
      0
    );

  const streak =
    Number(
      profile.streak ||
      0
    );

  const titles =
    Array.isArray(
      profile.cloudTitles
    )
      ? profile.cloudTitles
      : [];

  const backendAchievements =
    Array.isArray(
      profile.cloudAchievements
    )
      ? profile.cloudAchievements
      : [];

  const milestoneTrophies = [
    {
      id:
        "first-blood",
      icon:
        "◆",
      name:
        "FIRST BLOOD",
      rarity:
        "COMMON",
      description:
        "Complete your first registered quest.",
      current:
        completedQuests,
      target:
        1,
    },
    {
      id:
        "quest-hunter",
      icon:
        "⚔",
      name:
        "QUEST HUNTER",
      rarity:
        "RARE",
      description:
        "Complete 25 registered quests.",
      current:
        completedQuests,
      target:
        25,
    },
    {
      id:
        "iron-discipline",
      icon:
        "✦",
      name:
        "IRON DISCIPLINE",
      rarity:
        "EPIC",
      description:
        "Complete 20 training sessions.",
      current:
        workouts,
      target:
        20,
    },
    {
      id:
        "unbroken",
      icon:
        "∞",
      name:
        "THE UNBROKEN",
      rarity:
        "EPIC",
      description:
        "Reach a 14-day streak.",
      current:
        streak,
      target:
        14,
    },
    {
      id:
        "boss-hunter",
      icon:
        "♜",
      name:
        "BOSS HUNTER",
      rarity:
        "LEGENDARY",
      description:
        "Defeat your first Boss Quest.",
      current:
        bossVictories,
      target:
        1,
    },
    {
      id:
        "boss-slayer",
      icon:
        "♛",
      name:
        "BOSS SLAYER",
      rarity:
        "LEGENDARY",
      description:
        "Defeat 10 Boss Quests.",
      current:
        bossVictories,
      target:
        10,
    },
  ].map(
    (trophy) => ({
      ...trophy,
      unlocked:
        trophy.current >=
        trophy.target,
      progress:
        Math.min(
          100,
          Math.round(
            trophy.current /
              trophy.target *
              100
          )
        ),
    })
  );

  const unlockedCount =
    milestoneTrophies.filter(
      (trophy) =>
        trophy.unlocked
    ).length +
    backendAchievements.filter(
      (achievement) =>
        achievement.unlocked !==
          false
    ).length;

  return (
    <div className="page trophy-room-page">
      <PageHero
        eyebrow="PLAYER LEGACY"
        title="TROPHY ROOM"
        text="Achievements, trophies and titles earned through verified progression are displayed here."
      />

      <div className="trophy-room-summary card3d">
        <div>
          <small>
            UNLOCKED HONORS
          </small>

          <strong>
            {unlockedCount}
          </strong>
        </div>

        <div>
          <small>
            BOSS VICTORIES
          </small>

          <strong>
            {bossVictories}
          </strong>
        </div>

        <div>
          <small>
            CURRENT STREAK
          </small>

          <strong>
            {streak}
          </strong>
        </div>

        <div>
          <small>
            EQUIPPABLE TITLES
          </small>

          <strong>
            {titles.length}
          </strong>
        </div>
      </div>

      <SectionLabel
        number="01"
        title="TROPHIES"
      />

      <div className="trophy-grid">
        {milestoneTrophies.map(
          (trophy) => (
            <article
              key={
                trophy.id
              }
              className={
                "trophy-card card3d " +
                (
                  trophy.unlocked
                    ? "unlocked"
                    : "locked"
                ) +
                " rarity-" +
                trophy.rarity.toLowerCase()
              }
            >
              <div className="trophy-icon">
                {
                  trophy.icon
                }
              </div>

              <div className="trophy-copy">
                <small>
                  {
                    trophy.rarity
                  }
                  {" • "}
                  {trophy.unlocked
                    ? "UNLOCKED"
                    : "LOCKED"}
                </small>

                <h3>
                  {
                    trophy.name
                  }
                </h3>

                <p>
                  {
                    trophy.description
                  }
                </p>

                <div className="trophy-progress">
                  <div>
                    <span
                      style={{
                        width:
                          trophy.progress +
                          "%",
                      }}
                    />
                  </div>

                  <strong>
                    {
                      trophy.current
                    }
                    {" / "}
                    {
                      trophy.target
                    }
                  </strong>
                </div>
              </div>
            </article>
          )
        )}
      </div>

      {backendAchievements.length >
        0 && (
        <>
          <SectionLabel
            number="02"
            title="SYSTEM ACHIEVEMENTS"
          />

          <div className="achievement-grid">
            {backendAchievements.map(
              (
                achievement,
                index
              ) => (
                <article
                  key={
                    achievement.id ||
                    index
                  }
                  className={
                    "achievement-card card3d " +
                    (
                      achievement.unlocked ===
                        false
                        ? ""
                        : "unlocked"
                    )
                  }
                >
                  <span>
                    {achievement.icon ||
                      "◆"}
                  </span>

                  <div>
                    <small>
                      {achievement.rarity ||
                        "SYSTEM"}
                    </small>

                    <h3>
                      {achievement.name ||
                        achievement.title ||
                        "ACHIEVEMENT"}
                    </h3>

                    <p>
                      {achievement.description ||
                        "Verified System milestone."}
                    </p>
                  </div>
                </article>
              )
            )}
          </div>
        </>
      )}

      <SectionLabel
        number="03"
        title="TITLE COLLECTION"
      />

      <div className="trophy-title-grid">
        {titles.length >
        0 ? (
          titles.map(
            (title) => (
              <article
                key={
                  title.id
                }
                className={
                  title.equipped
                    ? "trophy-title-card card3d equipped"
                    : "trophy-title-card card3d"
                }
              >
                <span>
                  {title.icon ||
                    "◇"}
                </span>

                <div>
                  <small>
                    {title.rarity ||
                      "TITLE"}
                  </small>

                  <strong>
                    {
                      title.name
                    }
                  </strong>

                  <p>
                    {title.description}
                  </p>
                </div>

                {title.equipped && (
                  <em>
                    EQUIPPED
                  </em>
                )}
              </article>
            )
          )
        ) : (
          <div className="trophy-room-empty card3d">
            Titles earned through progression will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

export function AdaptiveIntelligenceConsole({ profile, setTab }) {
  const [trainingFocus, setTrainingFocus] = useState(
    () => localStorage.getItem("systemAdaptiveTrainingFocus") || "BALANCED"
  );

  const questCatalog = useMemo(
    () => buildAdaptiveQuestCatalog(profile),
    [profile.path, profile.sleepSchedule?.wake, profile.sleepSchedule?.verificationMinutes, profile.level]
  );

  const analytics = useMemo(
    () => getFullAnalytics(profile, { questCatalog, xpRequired, limit: 5, focus: trainingFocus }),
    [profile, questCatalog, trainingFocus]
  );

  const trainingPath = useMemo(
    () => generateTrainingPath(profile, trainingFocus, { questCatalog }),
    [profile, trainingFocus, questCatalog]
  );

  const analysis = analytics.profile;
  const difficulty = analytics.recommendations.difficulty;
  const classProtocol = analytics.recommendations.class;
  const forecast = analytics.analytics.levelPrediction;

  function selectFocus(focus) {
    setTrainingFocus(focus);
    localStorage.setItem("systemAdaptiveTrainingFocus", focus);
  }

  function actionForAlert(alert) {
    setTab(alert?.action === "OPEN_PROGRESS" ? "progress" : "quests");
  }

  return (
    <div className="adaptive-console">
      <section className="adaptive-command-header card3d">
        <div>
          <small>SYSTEM CORE // ADAPTIVE INTELLIGENCE 2.3</small>
          <h2>PLAYER ANALYSIS COMPLETE</h2>
          <p>The System evaluates verified progression patterns, class alignment, attributes, recent activity and quest history. Recommendations can never award XP or complete progression.</p>
        </div>
        <div className="adaptive-command-score">
          <strong>{analysis.recentPerformance.consistency}%</strong>
          <small>7-DAY ACTIVITY</small>
          <span>{analysis.recentPerformance.activeDays} / 7 ACTIVE DAYS</span>
        </div>
      </section>

      <div className="adaptive-console-grid">
        <section className="adaptive-analysis-card card3d">
          <div className="adaptive-section-title"><span>01</span><div><small>PLAYER PROFILE ANALYSIS</small><h3>STRENGTH / WEAKNESS MATRIX</h3></div></div>
          <div className="adaptive-attribute-matrix">
            <div>
              <small>STRONGEST</small>
              {analysis.strengthDetails.map((item, index) => (
                <p key={item.name}><span>0{index + 1}</span><strong>{item.name}</strong><b>{item.value}</b></p>
              ))}
            </div>
            <div>
              <small>NEEDS ATTENTION</small>
              {analysis.weaknessDetails.map((item, index) => (
                <p key={item.name}><span>0{index + 1}</span><strong>{item.name}</strong><b>{item.value}</b></p>
              ))}
            </div>
          </div>
          <div className="adaptive-metric-row">
            <span>COMPLETION<b>{analysis.completionRate}%</b></span>
            <span>ACTIVE DAYS<b>{analysis.recentPerformance.activeDays}</b></span>
            <span>XP / ACTIVE DAY<b>{analysis.averageXpPerDay || "--"}</b></span>
          </div>
        </section>

        <section className="adaptive-analysis-card card3d">
          <div className="adaptive-section-title"><span>02</span><div><small>ADAPTIVE DIFFICULTY</small><h3>PRESSURE CALIBRATION</h3></div></div>
          <div className="adaptive-difficulty-core"><strong>{difficulty.recommendedDifficulty}</strong><span>{Math.round(difficulty.confidence * 100)}% CONFIDENCE</span></div>
          <p>{difficulty.reason}</p>
          <div className="adaptive-next-tier"><small>NEXT PRESSURE TIER</small><strong>{difficulty.nextMilestone}</strong></div>
        </section>
      </div>

      <section className="adaptive-recommendations card3d">
        <div className="adaptive-section-title"><span>03</span><div><small>QUEST RECOMMENDATIONS</small><h3>DIRECTIVE MATCHING</h3></div></div>
        <div className="adaptive-recommendation-list">
          {analytics.recommendations.quests.map((quest, index) => (
            <article key={quest.id || quest.name} className={index === 0 ? "primary" : ""}>
              <div className="adaptive-rec-rank"><small>MATCH</small><strong>{quest.matchScore}%</strong></div>
              <div><small>{quest.type || "QUEST"} // {quest.category}</small><h4>{quest.name}</h4><p>{quest.reason}</p></div>
              <div className="adaptive-rec-reward"><span>{quest.difficulty} • {quest.difficultyFit || "MATCHED"} FIT</span><strong>+{Number(quest.xp || 0)} XP</strong><small>TARGET {quest.targetAttribute || quest.category}</small></div>
            </article>
          ))}
        </div>
        <button data-sfx="tab" type="button" className="adaptive-open-quests" onClick={() => setTab("quests")}>OPEN QUEST BOARD</button>
      </section>

      <section className="adaptive-training-path card3d">
        <div className="adaptive-section-title"><span>04</span><div><small>PERSONALIZED TRAINING PATH</small><h3>30-DAY DEVELOPMENT PROTOCOL</h3></div></div>
        <div className="adaptive-focus-switch">
          {["WEAKNESS", "BALANCED", "STRENGTH"].map((focus) => (
            <button data-sfx="click" type="button" key={focus} className={trainingFocus === focus ? "active" : ""} onClick={() => selectFocus(focus)}>{focus}</button>
          ))}
        </div>
        <div className="adaptive-training-grid">
          {trainingPath.trainingPlan.map((item) => (
            <article key={item.stat}><small>{item.priority} PRIORITY</small><strong>{item.stat}</strong><span>{item.recommendedFrequency}</span><p>{item.reason}</p></article>
          ))}
        </div>
        <div className="adaptive-milestones">
          {trainingPath.milestones.map((milestone) => (
            <div key={milestone.day}><b>DAY {milestone.day}</b><span>{milestone.goal}</span><small>{milestone.reward}</small></div>
          ))}
        </div>
      </section>

      <div className="adaptive-console-grid">
        <section className="adaptive-analysis-card card3d">
          <div className="adaptive-section-title"><span>05</span><div><small>PERFORMANCE PREDICTION</small><h3>NEXT LEVEL FORECAST</h3></div></div>
          {forecast?.predictions ? (
            <div className="adaptive-forecast-list">
              {Object.entries(forecast.predictions).map(([key, value]) => (
                <div key={key}><small>{key.toUpperCase()}</small><strong>{value.daysToLevel} DAYS</strong><span>{value.condition}</span></div>
              ))}
            </div>
          ) : (
            <div className="adaptive-empty-analysis"><strong>COLLECTING DATA</strong><p>Complete verified quests so the System can calculate a meaningful XP trajectory.</p></div>
          )}
        </section>

        <section className="adaptive-analysis-card card3d">
          <div className="adaptive-section-title"><span>06</span><div><small>CLASS-SPECIFIC ANALYSIS</small><h3>{classProtocol.class} PROTOCOL</h3></div></div>
          <div className="adaptive-class-protocol">
            <small>NATURAL ADVANTAGE</small>
            <strong>{classProtocol.strongStats.join(" + ")}</strong>
            <p>{classProtocol.trainingFocus}</p>
            <div>{classProtocol.uniqueAbilities.map((ability) => <span key={ability}>{ability}</span>)}</div>
          </div>
        </section>
      </div>

      <section className="adaptive-alerts card3d">
        <div className="adaptive-section-title"><span>07</span><div><small>SMART ALERTS</small><h3>SYSTEM NOTICES</h3></div></div>
        {analytics.analytics.alerts.length ? (
          <div className="adaptive-alert-list">
            {analytics.analytics.alerts.map((alert) => (
              <button data-sfx="click" type="button" key={alert.type} className={alert.severity.toLowerCase()} onClick={() => actionForAlert(alert)}>
                <span>{alert.severity}</span><strong>{alert.message}</strong><small>OPEN</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="adaptive-empty-analysis"><strong>NO PRIORITY ALERTS</strong><p>Current progression is inside normal System parameters.</p></div>
        )}
      </section>
    </div>
  );
}

export function SystemPage({ profile, setTab, awareness }) {
  const ascended = profile.level >= 101;
  const evolution = evolutionFor(profile);

  const terminalText = `SYSTEM ONLINE.\n\nPLAYER: ${profile.name}\nCLASS: ${profile.path}\n${ascended ? `EVOLUTION: ${profile.evolution.title || evolution.title}\n` : ""}LEVEL: ${profile.level}\nRANK: ${getRank(profile.level)}\nSTREAK: ${profile.streak}\nMOMENTUM: ${profile.momentum}\nWORKOUTS: ${profile.totalWorkouts}\nMISSIONS: ${profile.questLog.length}\nBOSS VICTORIES: ${profile.bossQuests.filter((item) => item.status === "COMPLETE").length}\nGOALS COMPLETE: ${profile.goals.filter((item) => item.status === "COMPLETE").length}\nGEAR: ${profile.customInventory.length}\nREWARDS: ${profile.rewards.length}\n\nDIRECTIVE: CONSISTENCY DETERMINES PROGRESSION.`;

  return (
    <div className="page">
      <PageHero eyebrow="SYSTEM AWARENESS" title="SYSTEM" text={ascended ? "Evolution protocol active. The System continues observing progression patterns." : "The System now analyzes, remembers and reacts to how the player actually develops."} />
      <SystemAwarenessPanel awareness={awareness} />
      <AdaptiveIntelligenceConsole profile={profile} setTab={setTab} />
      <div className="terminal card3d">{terminalText}</div>
    </div>
  );
}

export function Options({
  profile,
  saveProfile,
  theme,
  setTheme,
  musicEnabled,
  setMusicEnabled,
  musicPlaybackStatus,
  musicVolume,
  setMusicVolume,
  sfxEnabled,
  setSfxEnabled,
  sfxVolume,
  setSfxVolume,
  close,
}) {
  const [confirm, setConfirm] =
    useState(false);

  const [
    scheduleDraft,
    setScheduleDraft,
  ] = useState(
    normalizeSleepSchedule(
      profile.sleepSchedule
    )
  );

  const [
    scheduleSaved,
    setScheduleSaved,
  ] = useState(false);

  function toggleSoundtrack() {
    const nextEnabled = !musicEnabled;

    // MusicEngine listens only for this explicit player choice. Ordinary SFX
    // clicks never dispatch it and therefore cannot start the soundtrack.
    window.dispatchEvent(
      new CustomEvent(
        "system-music-intent",
        {
          detail: {
            enabled: nextEnabled,
          },
        }
      )
    );

    setMusicEnabled(
      nextEnabled
    );
  }

  function chooseShift(mode) {
    const preset =
      SHIFT_PRESETS[mode];

    if (!preset) {
      return;
    }

    setScheduleSaved(false);

    const nextSleep =
      mode ===
      "CUSTOM"
        ? scheduleDraft.sleep
        : preset.sleep;

    setScheduleDraft({
      ...scheduleDraft,
      mode,
      sleep:
        nextSleep,
      wake:
        mode ===
        "CUSTOM"
          ? addMinutesToClock(
              nextSleep,
              8 * 60
            )
          : preset.wake,
    });
  }

  function saveSchedule() {
    const clean =
      normalizeSleepSchedule({
        ...scheduleDraft,
        updatedAt:
          new Date().toISOString(),
      });

    saveProfile({
      ...profile,
      sleepSchedule: clean,
    });

    setScheduleDraft(clean);
    setScheduleSaved(true);

    window.setTimeout(
      () =>
        setScheduleSaved(false),
      1600
    );
  }

  async function removeAccount() {
    try {
      await deleteCloudProfile();
      localStorage.removeItem(
        "systemProfile"
      );
      window.location.reload();
    } catch (error) {
      alert(
        "SYSTEM COULD NOT DELETE THE CLOUD CHARACTER: " +
          (
            error?.message ||
            "UNKNOWN ERROR"
          )
      );
    }
  }

  const classData =
    PATHS[
      profile.path
    ];

  return (
    <div
      className="options-overlay"
      onClick={
        close
      }
    >
      <div
        className="options options-console"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="options-console-head">
          <div className="options-console-brand">
            <div className="options-system-mark">
              S
            </div>

            <div>
              <span>
                PLAYER SYSTEM
              </span>

              <h2>
                PROFILE & ROUTINE
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="options-close"
            onClick={
              close
            }
          >
            ×
          </button>
        </div>

        <div className="options-player-strip">
          <div className="options-player-class">
            <b>
              {
                classData?.icon
              }
            </b>

            <div>
              <small>
                ACTIVE CLASS
              </small>

              <strong>
                {
                  profile.path
                }
              </strong>
            </div>
          </div>

          <div>
            <small>
              PLAYER
            </small>
            <strong>
              {
                profile.name
              }
            </strong>
          </div>

          <div>
            <small>
              AGE
            </small>
            <strong>
              {
                profile.age
              }
            </strong>
          </div>

          <div>
            <small>
              GENDER
            </small>
            <strong>
              {
                profile.gender ===
                "UNSPECIFIED"
                  ? "—"
                  : profile.gender
              }
            </strong>
          </div>

          <div>
            <small>
              LEVEL
            </small>
            <strong>
              {
                profile.level
              }
            </strong>
          </div>

          <div>
            <small>
              INTERFACE
            </small>
            <strong>
              {
                theme.toUpperCase()
              }
            </strong>
          </div>
        </div>

        <div className="options-console-grid">
          <section className="options-module">
            <div className="options-module-title">
              <span>
                01
              </span>

              <div>
                <small>
                  VISUAL SYSTEM
                </small>
                <h3>
                  INTERFACE
                </h3>
              </div>
            </div>

            <div className="options-control-card">
              <div>
                <strong>
                  APPEARANCE
                </strong>

                <span>
                  Current mode:{" "}
                  {
                    theme.toUpperCase()
                  }
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setTheme(
                    theme ===
                      "dark"
                      ? "light"
                      : "dark"
                  )
                }
              >
                {theme ===
                "dark"
                  ? "SWITCH TO LIGHT"
                  : "SWITCH TO DARK"}
              </button>
            </div>

            <div className="options-control-card static">
              <div>
                <strong>
                  CLASS ATMOSPHERE
                </strong>

                <span>
                  {
                    classData?.icon
                  }{" "}
                  {
                    profile.path
                  } theme active
                </span>
              </div>

              <em>
                SYNCHRONIZED
              </em>
            </div>

            {profile.level >=
              101 && (
              <div className="options-control-card static">
                <div>
                  <strong>
                    EVOLUTION
                  </strong>

                  <span>
                    {
                      profile.evolution.title ||
                      evolutionFor(
                        profile
                      ).title
                    }
                  </span>
                </div>

                <em>
                  ASCENDED
                </em>
              </div>
            )}
          </section>

          <section className="options-module">
            <div className="options-module-title">
              <span>
                02
              </span>

              <div>
                <small>
                  AUDIO SYSTEM
                </small>
                <h3>
                  SOUND
                </h3>
              </div>
            </div>

            <div className="options-audio-block">
              <div className="options-audio-head">
                <div>
                  <strong>
                    CLASS SOUNDTRACK
                  </strong>

                  <span>
                    Automatic{" "}
                    {
                      profile.path
                    } soundtrack
                  </span>
                </div>

                <Toggle
                  active={
                    musicEnabled
                  }
                  onClick={
                    toggleSoundtrack
                  }
                />
              </div>

              <Volume
                label="MUSIC VOLUME"
                value={
                  musicVolume
                }
                setValue={
                  setMusicVolume
                }
              />
              <p role="status" className="soundtrack-status">{musicPlaybackStatus === "PLAYING" ? "SOUNDTRACK PLAYING" : musicPlaybackStatus === "STARTING" ? "STARTING SOUNDTRACK…" : musicPlaybackStatus === "BLOCKED" ? "Tap Play Soundtrack to enable audio in this browser." : musicPlaybackStatus === "ERROR" ? "The soundtrack could not load. Check your connection and retry." : "SOUNDTRACK PAUSED"}</p>
              {["BLOCKED", "ERROR"].includes(musicPlaybackStatus) && musicEnabled && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("system-music-intent", { detail: { enabled: true } }))}>PLAY SOUNDTRACK</button>}
            </div>

            <div className="options-audio-block">
              <div className="options-audio-head">
                <div>
                  <strong>
                    SYSTEM SFX
                  </strong>

                  <span>
                    Quests, alerts, mastery and interface feedback
                  </span>
                </div>

                <Toggle
                  active={
                    sfxEnabled
                  }
                  onClick={() =>
                    setSfxEnabled(
                      !sfxEnabled
                    )
                  }
                />
              </div>

              <Volume
                label="SFX VOLUME"
                value={
                  sfxVolume
                }
                setValue={
                  setSfxVolume
                }
              />
            </div>
          </section>
        </div>

        <section
          id="sleep-shift-settings"
          className="options-schedule-module"
        >
          <div className="options-module-title">
            <span>03</span>

            <div>
              <small>REAL-LIFE SCHEDULE</small>
              <h3>SLEEP / SHIFT</h3>
            </div>
          </div>

          <p className="schedule-philosophy">
            NO-SNOOZE follows your committed wake time. A late-shift player is not punished for sleeping after getting home late.
          </p>

          <div className="shift-preset-grid">
            {Object.entries(
              SHIFT_PRESETS
            ).map(
              ([
                key,
                preset,
              ]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    scheduleDraft.mode === key
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    chooseShift(key)
                  }
                >
                  <strong>
                    {preset.label}
                  </strong>

                  <span>
                    {formatClockLabel(
                      preset.sleep
                    )}{" "}
                    →{" "}
                    {formatClockLabel(
                      preset.wake
                    )}
                  </span>
                </button>
              )
            )}
          </div>

          <div className="schedule-time-grid">
            <SystemField label="PLANNED SLEEP">
              <input
                type="time"
                value={
                  scheduleDraft.sleep
                }
                onChange={(e) => {
                  setScheduleSaved(false);
                  const nextSleep =
                    e.target.value;

                  setScheduleDraft({
                    ...scheduleDraft,
                    mode: "CUSTOM",
                    sleep:
                      nextSleep,
                    wake:
                      addMinutesToClock(
                        nextSleep,
                        8 * 60
                      ),
                  });
                }}
              />
            </SystemField>

            <SystemField label="TARGET WAKE">
              <input
                type="time"
                value={
                  scheduleDraft.wake
                }
                readOnly={
                  scheduleDraft.mode ===
                  "CUSTOM"
                }
                onChange={(e) => {
                  if (
                    scheduleDraft.mode ===
                    "CUSTOM"
                  ) {
                    return;
                  }

                  setScheduleSaved(false);

                  setScheduleDraft({
                    ...scheduleDraft,
                    wake:
                      e.target.value,
                  });
                }}
              />

              {scheduleDraft.mode ===
                "CUSTOM" && (
                <small className="eight-hour-lock-note">
                  🔒 AUTO-LOCKED TO 8 HOURS AFTER SLEEP TIME
                </small>
              )}
            </SystemField>

            <SystemField label="WAKE PROOF WINDOW">
              <select
                value={
                  scheduleDraft.verificationMinutes
                }
                onChange={(e) => {
                  setScheduleSaved(false);
                  setScheduleDraft({
                    ...scheduleDraft,
                    verificationMinutes:
                      Number(e.target.value),
                  });
                }}
              >
                <option value={5}>5 MINUTES</option>
                <option value={10}>10 MINUTES</option>
                <option value={15}>15 MINUTES</option>
                <option value={20}>20 MINUTES</option>
                <option value={30}>30 MINUTES</option>
              </select>
            </SystemField>
          </div>

          <div className="schedule-preview">
            <div>
              <small>NEXT COMMITTED WAKE</small>
              <strong>
                {formatClockLabel(
                  scheduleDraft.wake
                )}
              </strong>
            </div>

            <span>
              {scheduleDraft.mode ===
              "CUSTOM"
                ? "8-HOUR SLEEP BLOCK • "
                : ""}
              Verify within{" "}
              {
                scheduleDraft.verificationMinutes
              }{" "}
              minutes.
            </span>

            <button
              data-sfx="success"
              type="button"
              onClick={saveSchedule}
            >
              {scheduleSaved
                ? "✓ SCHEDULE SAVED"
                : "SAVE SCHEDULE"}
            </button>
          </div>
        </section>

        <section className="options-account-module">
          <div className="options-module-title">
            <span>
              04
            </span>

            <div>
              <small>
                PLAYER ACCESS
              </small>
              <h3>
                ACCOUNT
              </h3>
            </div>
          </div>

          <div className="options-account-actions">
            <div>
              <strong>
                CLOUD SESSION
              </strong>

              <span>
                Sign out without deleting your character.
              </span>

              <button
                type="button"
                onClick={() => {
                  void systemSignOut();
                }}
              >
                SIGN OUT
              </button>
            </div>

            <div className="danger-zone">
              <strong>
                DELETE CHARACTER
              </strong>

              <span>
                Permanently erase this character's cloud progression.
              </span>

              {!confirm ? (
                <button
                  data-sfx="danger"
                  type="button"
                  onClick={() =>
                    setConfirm(
                      true
                    )
                  }
                >
                  INITIATE DELETE
                </button>
              ) : (
                <div className="confirm">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirm(
                        false
                      )
                    }
                  >
                    CANCEL
                  </button>

                  <button
                    data-sfx="danger"
                    type="button"
                    onClick={
                      removeAccount
                    }
                  >
                    CONFIRM DELETE
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="options-console-foot">
          <span>
            ● SYSTEM SETTINGS ONLINE
          </span>

          <small>
            Changes apply immediately.
          </small>
        </div>
      </div>
    </div>
  );
}

export function OptionGroup({
  title,
  children,
}) {
  return (
    <section className="option-group">
      <small>
        {title}
      </small>

      {children}
    </section>
  );
}

export function OptionRow({
  title,
  description,
  children,
}) {
  return (
    <div className="option-row">
      <div>
        <strong>
          {title}
        </strong>

        <span>
          {
            description
          }
        </span>
      </div>

      {children}
    </div>
  );
}

export function Toggle({
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "toggle system-audio-toggle active"
          : "toggle system-audio-toggle"
      }
      onClick={
        onClick
      }
      aria-pressed={
        active
      }
    >
      <span className="system-audio-toggle-track">
        <i />
      </span>

      <strong>
        {active
          ? "ON"
          : "OFF"}
      </strong>
    </button>
  );
}

export function Volume({
  label,
  value,
  setValue,
}) {
  const percent =
    Math.round(
      Number(
        value ||
        0
      ) *
        100
    );

  const quiet =
    percent ===
      0;

  const loud =
    percent >=
      65;

  return (
    <div className="volume system-volume-control">
      <div className="system-volume-head">
        <div className="system-volume-label">
          <span className="system-volume-icon">
            {quiet
              ? "×"
              : loud
                ? ")))"
                : "))"}
          </span>

          <span>
            {label}
          </span>
        </div>

        <strong>
          {String(
            percent
          ).padStart(
            2,
            "0"
          )}
          <small>
            %
          </small>
        </strong>
      </div>

      <div className="system-volume-track-wrap">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={
            value
          }
          style={{
            "--volume-fill":
              percent +
              "%",
          }}
          onChange={(e) =>
            setValue(
              Number(
                e.target
                  .value
              )
            )
          }
          aria-label={
            label
          }
        />

        <div className="system-volume-scale">
          <span>
            0
          </span>

          <span>
            50
          </span>

          <span>
            100
          </span>
        </div>
      </div>
    </div>
  );
}

export function EvolutionModal({
  profile,
  saveProfile,
}) {
  const evolution =
    evolutionFor(profile);

  const [title, setTitle] =
    useState(
      profile.evolution.title ||
        evolution.title
    );

  const [emblem, setEmblem] =
    useState(
      profile.evolution.emblem ||
        evolution.icon
    );

  if (
    profile.level < 101 ||
    profile.evolution.awakened
  ) {
    return null;
  }

  function awaken() {
    let updated = {
      ...profile,
      evolution: {
        awakened: true,
        title:
          title.trim().toUpperCase() ||
          evolution.title,
        emblem:
          emblem.trim() ||
          evolution.icon,
        awakenedAt:
          new Date().toISOString(),
      },
      customInventory: [
        {
          id: uid("GEAR"),
          name:
            "LEVEL 101 ASCENSION EMBLEM",
          rarity: "MYTHIC",
          type: "EMBLEM",
          bonus:
            title.trim().toUpperCase() ||
            evolution.title,
          notes:
            "Awarded by the Level 101 Evolution Protocol.",
          image: "",
          date:
            new Date().toISOString(),
        },
        ...profile.customInventory,
      ],
    };

    updated =
      addHistory(
        updated,
        "LEVEL 101 EVOLUTION",
        updated.evolution.title,
        evolution.identity
      );

    saveProfile(updated);

    playSFX(
      "levelup",
      soundtrackVolume(localStorage.getItem("systemSfxVolume"), 0.7)
    );
  }

  return (
    <div className="evolution-overlay">
      <div className="evolution-modal">
        <div className="evolution-sigil">
          {emblem ||
            evolution.icon}
        </div>

        <span>
          LEVEL 101 PROTOCOL
        </span>

        <h1>
          EVOLUTION AVAILABLE
        </h1>

        <p>
          {evolution.identity}
        </p>

        <SystemField label="EVOLVED TITLE">
          <input
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
          />
        </SystemField>

        <SystemField label="EMBLEM">
          <input
            value={emblem}
            onChange={(event) =>
              setEmblem(
                event.target.value
              )
            }
            maxLength="4"
          />
        </SystemField>

        <button
          data-sfx="levelup"
          type="button"
          onClick={awaken}
        >
          AWAKEN NEW FORM
        </button>
      </div>
    </div>
  );
}

export function SystemGame() {
  const authoritativeProfileRef = useRef(null);
  const seenCelebrationsRef = useRef(new Set());
  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [profile, setProfile] =
    useState(null);

  const [
    initializationStage,
    setInitializationStage,
  ] = useState("idle");

  const initializationAudioRef =
    useRef(null);

  const initializationTimerRef =
    useRef(null);

  const [theme, setTheme] =
    useState(
      localStorage.getItem(
        "systemTheme"
      ) || "dark"
    );

  const [tab, setTab] =
    useState(
      "dashboard"
    );

  const awareness =
    useSystemAwareness(
      profile,
      tab
    );

  const [dailyCommand, setDailyCommand] =
    useState(null);
  const [commandDay, setCommandDay] = useState(todayKey);
  useEffect(() => {
    const interval = window.setInterval(() => setCommandDay(todayKey()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const [
    dailyCommandStatus,
    setDailyCommandStatus,
  ] = useState("IDLE");

  const [
    dailyCommandRefreshNonce,
    setDailyCommandRefreshNonce,
  ] = useState(0);

  const dailyCommandMustSignature =
    JSON.stringify(
      profile?.mustState || {}
    );

  function refreshDailyCommand() {
    setDailyCommandRefreshNonce(
      (value) => value + 1
    );
  }

  useEffect(() => {
    if (!profile) {
      setDailyCommand(null);
      setDailyCommandStatus("IDLE");
      return undefined;
    }

    let active = true;
    setDailyCommandStatus("LOADING");
    setDailyCommand((current) => current?.assigned_for === commandDay && current?.progress?.class === profile.path ? current : null);

    void loadDailyCommandBrief({
      assignedFor: commandDay,
      classPath: profile.path,
    })
      .then((command) => {
        if (!active) {
          return;
        }

        setDailyCommand(
          command || null
        );
        setDailyCommandStatus(
          command?.status === "READY"
            ? "READY"
            : "ERROR"
        );
      })
      .catch((error) => {
        void reportSystemError(error, "NETWORK");
        console.warn(
          "DAILY COMMAND SYNC DEFERRED:",
          error
        );

        if (active) {
          setDailyCommandStatus("ERROR");
        }
      });

    return () => {
      active = false;
    };
  }, [
    profile?.fingerprint,
    profile?.path,
    profile?.level,
    profile?.streak,
    profile?.xp,
    JSON.stringify(profile?.attributes || {}),
    profile?.questLog?.length,
    dailyCommandMustSignature,
    dailyCommandRefreshNonce,
    commandDay,
  ]);

  const pageTopRef =
    useRef(null);

  useEffect(() => {
    function resetPageScroll() {
      try {
        document.documentElement.scrollTop =
          0;

        document.body.scrollTop =
          0;

        window.scrollTo(
          0,
          0
        );

        pageTopRef.current
          ?.scrollIntoView({
            behavior:
              "auto",
            block:
              "start",
          });
      } catch {
        // Scroll restoration must never block page navigation.
      }
    }

    resetPageScroll();

    const frame =
      window.requestAnimationFrame(
        resetPageScroll
      );

    const first =
      window.setTimeout(
        resetPageScroll,
        0
      );

    const safari =
      window.setTimeout(
        resetPageScroll,
        90
      );

    return () => {
      window.cancelAnimationFrame(
        frame
      );
      window.clearTimeout(
        first
      );
      window.clearTimeout(
        safari
      );
    };
  }, [
    tab,
  ]);

  useEffect(() => {
    if (
      profile?.path !==
        "MAGE" &&
      tab ===
        "archive"
    ) {
      setTab(
        "dashboard"
      );
    }
  }, [
    profile?.path,
    tab,
  ]);

  const [optionsOpen, setOptionsOpen] =
    useState(false);

  const [
    intelligenceOpen,
    setIntelligenceOpen,
  ] = useState(false);
  const [intelligenceVisited, setIntelligenceVisited] = useState(false);
  function openIntelligence() { setIntelligenceVisited(true); setIntelligenceOpen(true); }

  const [musicPlaybackStatus, setMusicPlaybackStatus] = useState("PAUSED");
  const [musicEnabled, setMusicEnabled] =
    useState(
      localStorage.getItem(
        "systemMusic"
      ) === "on"
    );

  const [musicVolume, setMusicVolume] =
    useState(
      soundtrackVolume(localStorage.getItem("systemMusicVolume"), 0.3)
    );

  const [musicMode, setMusicMode] =
    useState(
      localStorage.getItem(
        "systemMusicMode"
      ) || "AUTO"
    );

  const [sfxEnabled, setSfxEnabled] =
    useState(
      localStorage.getItem(
        "systemSfx"
      ) !== "off"
    );

  const [sfxVolume, setSfxVolume] =
    useState(
      soundtrackVolume(localStorage.getItem("systemSfxVolume"), 0.7)
    );

  const [event, setEvent] =
    useState(null);

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "systemProfile"
      );

    if (!saved) {
      return;
    }

    try {
      const loaded =
        normalizeProfile(
          JSON.parse(
            saved
          )
        );

      // XP and Must Quest penalties are authoritative on the server.
      // Never deduct XP from a stale browser cache during startup.
      authoritativeProfileRef.current = loaded;
      try { seenCelebrationsRef.current = new Set(JSON.parse(localStorage.getItem(`systemCelebrations:${loaded.fingerprint}`) || "[]")); } catch { seenCelebrationsRef.current = new Set(); }
      setProfile(
        loaded
      );
    } catch {
      localStorage.removeItem(
        "systemProfile"
      );
    }
  }, []);

  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = theme;
    const palette = PATHS[profile?.path || "COMMANDER"];
    document.body.style.backgroundColor = theme === "light" ? palette.lightBg : palette.darkBg;
    document.documentElement.dataset.systemTheme = theme;
    localStorage.setItem(
      "systemTheme",
      theme
    );
  }, [
    theme,
    profile?.path,
  ]);

  useEffect(() => {
    localStorage.setItem(
      "systemMusic",
      musicEnabled
        ? "on"
        : "off"
    );
  }, [
    musicEnabled,
  ]);

  useEffect(() => {
    localStorage.setItem(
      "systemMusicVolume",
      String(
        musicVolume
      )
    );
  }, [
    musicVolume,
  ]);

  useEffect(() => {
    localStorage.setItem(
      "systemMusicMode",
      musicMode
    );
  }, [
    musicMode,
  ]);

  useEffect(() => {
    localStorage.setItem(
      "systemSfx",
      sfxEnabled
        ? "on"
        : "off"
    );
  }, [
    sfxEnabled,
  ]);

  useEffect(() => {
    localStorage.setItem(
      "systemSfxVolume",
      String(
        sfxVolume
      )
    );
  }, [
    sfxVolume,
  ]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    void saveCloudPreferences({
      theme,
      music_enabled:
        musicEnabled,
      music_volume:
        musicVolume,
      music_mode:
        musicMode,
      sfx_enabled:
        sfxEnabled,
      sfx_volume:
        sfxVolume,
    }).catch((error) => {
      console.warn(
        "SYSTEM PREFERENCES SYNC DEFERRED:",
        error
      );
    });
  }, [
    profile?.fingerprint,
    theme,
    musicEnabled,
    musicVolume,
    musicMode,
    sfxEnabled,
    sfxVolume,
  ]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const key =
      "systemEvent-" +
      todayKey();

    if (
      localStorage.getItem(
        key
      )
    ) {
      return;
    }

    const chance =
      hashString(
        todayKey() +
          profile.fingerprint
      ) %
      100;

    if (
      chance < 16
    ) {
      const quest =
        pick(
          EVENT_QUESTS,
          todayKey() +
            profile.path
        );

      setEvent({
        quest,
        stage:
          "alert",
      });

      localStorage.setItem(
        key,
        "shown"
      );

      if (
        sfxEnabled
      ) {
        playSFX(
          "event",
          sfxVolume
        );
      }
    }
  }, [
    profile,
  ]);

  useEffect(() => {
    return () => {
      if (
        initializationTimerRef.current
      ) {
        window.clearTimeout(
          initializationTimerRef.current
        );
      }

      if (
        initializationAudioRef.current
      ) {
        try {
          initializationAudioRef.current
            .pause();
        } catch {
          // Ignore cleanup failures.
        }
      }
    };
  }, []);

  function beginSystemInitialization(
    newProfile
  ) {
    setTab(
      "dashboard"
    );

    setOptionsOpen(
      false
    );

    authoritativeProfileRef.current = newProfile;
    setProfile(
      newProfile
    );

    setInitializationStage(
      "active"
    );

    if (
      initializationTimerRef.current
    ) {
      window.clearTimeout(
        initializationTimerRef.current
      );
    }

    if (
      initializationAudioRef.current
    ) {
      try {
        initializationAudioRef.current
          .pause();
      } catch {
        // Ignore previous audio cleanup failure.
      }
    }

    const gender =
      String(
        newProfile?.gender ||
        ""
      ).toUpperCase();

    const audio =
      new Audio(
        gender ===
        "FEMALE"
          ? "/voices/system-female.mp3"
          : "/voices/system-male.mp3"
      );

    audio.preload =
      "auto";

    audio.volume =
      0.96;

    initializationAudioRef.current =
      audio;

    let finished =
      false;

    function finishIntro() {
      if (finished) {
        return;
      }

      finished =
        true;

      setInitializationStage(
        "fade"
      );

      initializationTimerRef.current =
        window.setTimeout(
          () => {
            setInitializationStage(
              "idle"
            );

            initializationAudioRef.current =
              null;
          },
          950
        );
    }

    audio.addEventListener(
      "ended",
      finishIntro,
      {
        once: true,
      }
    );

    audio.addEventListener(
      "error",
      finishIntro,
      {
        once: true,
      }
    );

    const playPromise =
      audio.play();

    if (
      playPromise &&
      typeof playPromise.catch ===
        "function"
    ) {
      playPromise.catch(
        () => {
          // Keep the cinematic timing even if
          // a browser blocks playback unexpectedly.
          initializationTimerRef.current =
            window.setTimeout(
              finishIntro,
              2600
            );
        }
      );
    }
  }

  function applyAuthoritativeProfile(
    updated,
    options = {}
  ) {
    const clean =
      normalizeProfile(
        updated
      );

    if (options.announce !== false && authoritativeProfileRef.current) {
      const events = achievementEvents(authoritativeProfileRef.current, clean);
      const previouslySeen = new Set(seenCelebrationsRef.current);
      setCelebrationQueue(queue => appendAchievements(queue, events, previouslySeen));
      for (const event of events) seenCelebrationsRef.current.add(event.id);
      try { localStorage.setItem(`systemCelebrations:${clean.fingerprint}`, JSON.stringify([...seenCelebrationsRef.current].slice(-150))); } catch { /* Presentation cache only. */ }
    }
    authoritativeProfileRef.current = clean;
    setProfile(
      clean
    );

    try {
      localStorage.setItem(
        "systemProfile",
        JSON.stringify(
          clean
        )
      );
    } catch {
      // Backend state is already committed. A local cache failure
      // must not cause the client to re-award or retry progression.
    }
  }


  useEffect(() => {
    function receiveCloudProfile(
      event
    ) {
      if (
        event?.detail
      ) {
        applyAuthoritativeProfile(
          event.detail,
          { announce: false }
        );
      }
    }

    window.addEventListener(
      "system-cloud-profile",
      receiveCloudProfile
    );

    return () =>
      window.removeEventListener(
        "system-cloud-profile",
        receiveCloudProfile
      );
  }, []);

  function saveProfile(
    updated
  ) {
    const clean =
      normalizeProfile(
        updated
      );

    const previous =
      profile
        ? normalizeProfile(
            profile
          )
        : null;

    setProfile(
      clean
    );

    try {
      localStorage.setItem(
        "systemProfile",
        JSON.stringify(
          clean
        )
      );

      const identityChanged =
        !previous ||
        previous.name !==
          clean.name ||
        Number(
          previous.age
        ) !==
          Number(
            clean.age
          ) ||
        previous.gender !==
          clean.gender;

      if (
        identityChanged
      ) {
        void syncProfileToCloud(
          clean
        );
      }
    } catch {
      alert(
        "SYSTEM STORAGE FULL. Remove some proof images or inventory images, then try again."
      );
    }
  }

  async function startTimedWorkout(
    workout
  ) {
    const workoutId = Number(workout?.id);

    if (!Number.isFinite(workoutId) || workoutId <= 0) {
      throw new Error("INVALID_WORKOUT_ID");
    }

    return startTimedWorkoutOnBackend({
      workoutId,
      metadata: {
        displayed_name: workout.name,
        displayed_category: workout.category,
      },
    });
  }

  async function completeTimedWorkout({
    timerSessionId,
    workout,
  }) {
    if (!profile) {
      throw new Error("PROFILE_REQUIRED");
    }

    const result =
      await completeTimedWorkoutOnBackend({
        timerSessionId,
        metadata: {
          displayed_name: workout?.name || "TIMED TRAINING",
          displayed_category: workout?.category || "TRAINING",
        },
      });

    const serverResult =
      result?.data ||
      result ||
      {};

    const cloud =
      await bootstrapAuthoritativeProfile();

    const hydrated = cloud
      ? await hydrateStructuredProfile(cloud)
      : profile;

    let updated = normalizeProfile(hydrated);

    const serverSession =
      serverResult.session ||
      serverResult.workout_session ||
      null;

    const timerSession =
      serverResult.timer_session ||
      null;

    const durationSeconds =
      Number(
        serverSession?.duration_seconds ||
        timerSession?.target_seconds ||
        workout?.estimated_minutes * 60 ||
        0
      ) || 0;

    const workoutName =
      workout?.name ||
      timerSession?.workout_name_snapshot ||
      "TIMED TRAINING";

    updated = {
      ...updated,
      activeTimedWorkout: null,
      totalWorkouts:
        Number(updated.totalWorkouts || 0) + 1,
      completed: [
        "TRAINING — " + workoutName,
        ...(updated.completed || []).filter(
          (entry) => entry !== "TRAINING — " + workoutName
        ),
      ],
      workoutLog: [
        {
          name: workoutName,
          workoutId: Number(workout?.id || 0) || null,
          sessionId: serverSession?.id || null,
          timerSessionId: timerSession?.id || timerSessionId,
          durationSeconds,
          authoritative: true,
          verification: "TIMER",
          date:
            serverSession?.completed_at ||
            timerSession?.completed_at ||
            new Date().toISOString(),
        },
        ...(updated.workoutLog || []),
      ],
    };

    updated = addHistory(
      updated,
      "TIMER VERIFIED TRAINING",
      workoutName,
      "SERVER COUNTDOWN • " +
        formatMovementTime(durationSeconds) +
        " • +" +
        Number(workout?.xp_reward || workout?.xp || 0) +
        " XP"
    );

    applyAuthoritativeProfile(updated);
    return serverResult;
  }

  async function completeWorkout(
    workout
  ) {
    if (!profile) {
      return;
    }

    const match =
      String(
        workout?.id ||
        ""
      ).match(
        /^cloud-(\d+)$/
      );

    if (!match) {
      alert(
        "SYSTEM TRAINING RECORD IS NOT BACKEND-LINKED. No progression was awarded."
      );
      return;
    }

    const workoutId =
      Number(
        match[1]
      );

    try {
      const result =
        await completeWorkoutOnBackend({
          workoutId,
          metadata: {
            displayed_name:
              workout.name,
            displayed_category:
              workout.category,
          },
        });

      const cloud =
        await bootstrapAuthoritativeProfile();

      if (!cloud) {
        throw new Error(
          "AUTHORITATIVE_REFRESH_FAILED"
        );
      }

      const hydrated =
        await hydrateStructuredProfile(
          cloud
        );

      let updated =
        normalizeProfile(
          hydrated
        );

      const serverResult =
        result?.data ||
        {};

      const serverSession =
        serverResult.session ||
        null;

      const bossDamage =
        Number(
          serverResult.boss_damage
        ) || 0;

      updated = {
        ...updated,

        totalWorkouts:
          Number(
            updated.totalWorkouts ||
            0
          ) + 1,

        completed: [
          "TRAINING — " +
            workout.name,
          ...(
            updated.completed ||
            []
          ).filter(
            (entry) =>
              entry !==
              "TRAINING — " +
                workout.name
          ),
        ],

        workoutLog: [
          {
            name:
              workout.name,
            workoutId,
            sessionId:
              serverSession?.id ||
              null,
            authoritative:
              true,
            bossDamage,
            date:
              serverSession?.completed_at ||
              new Date()
                .toISOString(),
          },
          ...(
            updated.workoutLog ||
            []
          ),
        ],
      };

      updated =
        addHistory(
          updated,
          "TRAINING",
          workout.name,
          "BACKEND VERIFIED • +" +
            Number(
              serverResult.profile?.xp != null
                ? workout.xp
                : workout.xp
            ) +
            " XP" +
            (
              bossDamage > 0
                ? " • " +
                  bossDamage +
                  " BOSS DAMAGE"
                : ""
            )
        );

      applyAuthoritativeProfile(
        updated
      );
    } catch (error) {
      console.error(
        "AUTHORITATIVE WORKOUT COMPLETION FAILED:",
        error
      );

      const message =
        String(
          error?.message ||
          ""
        );

      if (
        message.includes(
          "WORKOUT_LOCKED_OR_UNAVAILABLE"
        )
      ) {
        alert(
          "SYSTEM REJECTED THIS WORKOUT: REQUIRED SKILL MASTERY IS NOT COMPLETE."
        );
        return;
      }

      if (
        message.includes(
          "WORKOUT_DUPLICATE_WINDOW"
        )
      ) {
        alert(
          "SYSTEM DETECTED A DUPLICATE TRAINING COMPLETION. No second reward was applied."
        );
        return;
      }

      alert(
        "SYSTEM BACKEND REJECTED THIS TRAINING ACTION. No local XP, attributes, or Boss damage were awarded."
      );
    }
  }

  function triggerEvent() {
    if (!profile) {
      return {
        status:
          "ERROR",
      };
    }

    const today =
      todayKey();

    const now =
      new Date();

    const existing =
      profile.eventScanState ||
      {};

    const state =
      existing.date ===
      today
        ? {
            date:
              today,
            scans:
              Number(
                existing.scans
              ) || 0,
            lastScanAt:
              existing.lastScanAt ||
              "",
            eventFound:
              Boolean(
                existing.eventFound
              ),
          }
        : {
            date:
              today,
            scans: 0,
            lastScanAt: "",
            eventFound: false,
          };

    if (
      state.eventFound
    ) {
      return {
        status:
          "LOCKED_FOUND",
        message:
          "AN EVENT HAS ALREADY BEEN DETECTED TODAY.",
      };
    }

    if (
      state.scans >=
      RARE_EVENT_SCAN.maxScansPerDay
    ) {
      return {
        status:
          "DAILY_LIMIT",
        message:
          "DAILY SCAN LIMIT REACHED.",
      };
    }

    const cooldownMs =
      RARE_EVENT_SCAN.cooldownHours *
      60 *
      60 *
      1000;

    if (
      state.lastScanAt
    ) {
      const last =
        new Date(
          state.lastScanAt
        ).getTime();

      const remaining =
        cooldownMs -
        (
          now.getTime() -
          last
        );

      if (
        remaining > 0
      ) {
        return {
          status:
            "COOLDOWN",
          remaining,
          message:
            "SCANNER RECALIBRATING.",
        };
      }
    }

    const found =
      Math.random() <
      RARE_EVENT_SCAN.chance;

    const nextState = {
      ...state,
      scans:
        state.scans + 1,
      lastScanAt:
        now.toISOString(),
      eventFound:
        found,
    };

    saveProfile({
      ...profile,
      eventScanState:
        nextState,
    });

    if (
      !found
    ) {
      if (
        sfxEnabled
      ) {
        playSFX(
          "click",
          sfxVolume
        );
      }

      return {
        status:
          "EMPTY",
        scans:
          nextState.scans,
        remainingScans:
          Math.max(
            0,
            RARE_EVENT_SCAN.maxScansPerDay -
            nextState.scans
          ),
        message:
          "NO ANOMALY DETECTED.",
      };
    }

    const quest =
      pick(
        EVENT_QUESTS,
        String(
          Date.now()
        )
      );

    setEvent({
      quest,
      stage:
        "alert",
    });

    if (
      sfxEnabled
    ) {
      playSFX(
        "event",
        sfxVolume
      );
    }

    return {
      status:
        "FOUND",
      quest,
      message:
        "RARE EVENT DETECTED.",
    };
  }

  const stableSaveProfile = useStableHandler(saveProfile);
  const stableApplyProfile = useStableHandler(applyAuthoritativeProfile);
  const stableCompleteWorkout = useStableHandler(completeWorkout);
  const stableStartTimer = useStableHandler(startTimedWorkout);
  const stableCompleteTimer = useStableHandler(completeTimedWorkout);

  if (!profile) {
    return (
      <>
        <LoginScreen
          onComplete={
            beginSystemInitialization
          }
        />
      </>
    );
  }

  const path =
    PATHS[
      profile.path
    ];

  return (
    <div
      className={
        "app " +
        theme +
        " class-" +
        profile.path.toLowerCase() +
        (profile.level >= 101
          ? " evolved"
          : "")
      }
      style={{
        "--accent":
          path.accent,

        "--secondary":
          path.secondary,

        "--app-bg":
          theme ===
          "dark"
            ? path.darkBg
            : path.lightBg,

        "--panel-bg":
          theme ===
          "dark"
            ? path.darkPanel
            : path.lightPanel,
      }}
    >
      <div
        className="class-emblem-atmosphere"
        aria-hidden="true"
      />

      <ButtonSFX
        enabled={
          sfxEnabled
        }
        volume={
          sfxVolume
        }
      />

      <MusicEngine
        onStatus={setMusicPlaybackStatus}
        enabled={
          musicEnabled &&
          initializationStage ===
            "idle"
        }
        volume={
          musicVolume
        }
        path={
          profile.path
        }
      />

      {initializationStage !==
        "idle" && (
        <div
          className={
            "system-initialization-overlay " +
            (
              initializationStage ===
              "fade"
                ? "is-fading"
                : "is-active"
            )
          }
          aria-live="polite"
        >
          <div className="system-initialization-core">
            <div className="system-initialization-sigil">
              S
            </div>

            <span>
              HUMAN PROGRESSION PROTOCOL
            </span>

            <h1>
              SYSTEM INITIALIZED
            </h1>

            <p>
              WELCOME
            </p>

            <small className="initialization-transition-label">
              ENTERING DASHBOARD
            </small>

            <div className="system-initialization-line" />
          </div>
        </div>
      )}

      <div
        data-system-build="2.10.0"
        data-active-tab={tab}
        className={
          "dashboard-interface " +
          (
            initializationStage ===
            "active"
              ? "is-hidden"
              : initializationStage ===
                  "fade"
                ? "is-revealing"
                : "is-ready"
          )
        }
      >
        <div
          ref={pageTopRef}
          className="page-top-anchor"
          aria-hidden="true"
        />

        <TopBar
          profile={
            profile
          }
        theme={
          theme
        }
        setTheme={
          setTheme
        }
        openOptions={() =>
          setOptionsOpen(
            true
          )
        }
      />

      <Navigation
        tab={tab}
        setTab={setTab}
        profile={
          profile
        }
      />

      <main className="content">
        {tab ===
          "dashboard" && (
          <Dashboard
            profile={
              profile
            }
            setTab={
              setTab
            }
            awareness={
              awareness
            }
            dailyCommand={
              dailyCommand
            }
            dailyCommandStatus={
              dailyCommandStatus
            }
            refreshDailyCommand={
              refreshDailyCommand
            }
            openRoutine={() => {
              setOptionsOpen(
                true
              );

              window.setTimeout(
                () => {
                  document
                    .getElementById(
                      "sleep-shift-settings"
                    )
                    ?.scrollIntoView({
                      behavior:
                        "smooth",
                      block:
                        "center",
                    });
                },
                120
              );
            }}
          />
        )}

        {tab ===
          "attributes" && (
          <Attributes
            profile={
              profile
            }
            applyAuthoritativeProfile={
              applyAuthoritativeProfile
            }
          />
        )}

        {tab ===
          "quests" && (
          <QuestPage
            profile={
              profile
            }
            saveProfile={
              saveProfile
            }
            applyAuthoritativeProfile={
              applyAuthoritativeProfile
            }
            openEvent={
              triggerEvent
            }
            setTab={
              setTab
            }
            dailyCommand={
              dailyCommand
            }
          />
        )}

        <div
          className={
            tab === "training"
              ? "persistent-training-shell"
              : "persistent-training-shell is-hidden"
          }
          aria-hidden={
            tab !== "training"
          }
        >
          <TrainingView
            profile={
              profile
            }
            saveProfile={stableSaveProfile}
            applyAuthoritativeProfile={stableApplyProfile}
            completeWorkout={stableCompleteWorkout}
            startTimedWorkout={stableStartTimer}
            completeTimedWorkout={stableCompleteTimer}
          />
        </div>

        {tab ===
          "class-training" && (
          <SectionBoundary area="CLASS_SPECIAL" resetKey={profile.path}>
          <React.Suspense fallback={<div className="system-loading" role="status"><i/>Preparing your class practice…</div>}>
          <ClassTrainingView
            profile={
              profile
            }
            saveProfile={stableSaveProfile}
            applyAuthoritativeProfile={stableApplyProfile}
            setTab={
              setTab
            }
          />
          </React.Suspense>
          </SectionBoundary>
        )}

        {tab ===
          "fuel" && (
          <FuelSystem
            profile={
              profile
            }
            saveProfile={
              saveProfile
            }
          />
        )}

        {tab ===
          "archive" &&
          profile.path ===
            "MAGE" && (
          <SectionBoundary area="ARCHIVE" resetKey={profile.path}>
          <React.Suspense fallback={<div className="system-loading" role="status"><i/>Opening your Archive…</div>}>
          <MageArchive
            profile={
              profile
            }
            saveProfile={stableSaveProfile}
            applyAuthoritativeProfile={stableApplyProfile}
          />
          </React.Suspense>
          </SectionBoundary>
        )}

        {tab ===
          "progress" && (
          <ProgressPage
            profile={profile}
            saveProfile={saveProfile}
          />
        )}

        {tab ===
          "inventory" && (
          <Inventory
            profile={profile}
            saveProfile={saveProfile}
            applyAuthoritativeProfile={
              applyAuthoritativeProfile
            }
          />
        )}

        {tab ===
          "journey" && (
          <Journey
            profile={profile}
            saveProfile={saveProfile}
            applyAuthoritativeProfile={
              applyAuthoritativeProfile
            }
          />
        )}

        {tab ===
          "trophies" && (
          <TrophyRoom
            profile={
              profile
            }
          />
        )}

        {tab ===
          "system" && (
          <SystemPage
            profile={
              profile
            }
            setTab={
              setTab
            }
            awareness={
              awareness
            }
          />
        )}
      </main>
      </div>

      {initializationStage ===
        "idle" && (
        intelligenceVisited ? <SectionBoundary area="AI" resetKey={profile.path}>
        <React.Suspense fallback={<div className="system-intelligence-float"><button className="system-intelligence-launcher" disabled aria-label="Loading System Intelligence">…</button></div>}>
        <SystemIntelligenceFloat
          profile={
            profile
          }
          open={
            intelligenceOpen
          }
          setOpen={
            setIntelligenceOpen
          }
          awareness={
            awareness
          }
          setTab={
            setTab
          }
        />
        </React.Suspense>
        </SectionBoundary> : <div className="system-intelligence-float"><button type="button" className="system-intelligence-launcher" aria-label="Open System Intelligence" aria-expanded={false} onClick={openIntelligence}><span className="system-intelligence-launcher-icon">{PATHS[profile.path].icon}</span></button></div>
      )}

      {optionsOpen && (
        <Options
          profile={
            profile
          }
          saveProfile={
            saveProfile
          }
          theme={
            theme
          }
          setTheme={
            setTheme
          }
          musicPlaybackStatus={musicPlaybackStatus}
          musicEnabled={
            musicEnabled
          }
          setMusicEnabled={
            setMusicEnabled
          }
          musicVolume={
            musicVolume
          }
          setMusicVolume={
            setMusicVolume
          }
          sfxEnabled={
            sfxEnabled
          }
          setSfxEnabled={
            setSfxEnabled
          }
          sfxVolume={
            sfxVolume
          }
          setSfxVolume={
            setSfxVolume
          }
          close={() =>
            setOptionsOpen(
              false
            )
          }
        />
      )}

      <EventModal
        event={
          event
        }
        setEvent={
          setEvent
        }
        profile={
          profile
        }
        saveProfile={
          saveProfile
        }
        applyAuthoritativeProfile={
          applyAuthoritativeProfile
        }
      />

      <AchievementCelebration
        event={celebrationQueue[0] || null}
        onDismiss={() => setCelebrationQueue(queue => queue.slice(1))}
        onSound={type => { if (sfxEnabled && sfxVolume > 0) playSFX(type, sfxVolume); }}
      />
      {!celebrationQueue.length && <EvolutionModal
        profile={profile}
        saveProfile={saveProfile}
      />}

      <div
        id="system-modal-root"
      />
    </div>
  );
}

export default SystemGame;
