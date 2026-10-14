/* =========================================================
   PLAYER FOUNDATION SCAN — 2.9.4
   Advisory onboarding only. It personalizes a starting plan,
   but never awards progression or chooses a class for the player.
   ========================================================= */

export const FOUNDATION_FOCUS_OPTIONS = [
  {
    value: "STRENGTH",
    label: "BUILD STRENGTH",
    detail: "Become stronger and more capable.",
  },
  {
    value: "BODY_COMPOSITION",
    label: "CHANGE MY BODY",
    detail: "Build muscle, get leaner, or maintain well.",
  },
  {
    value: "FITNESS",
    label: "MOVE BETTER",
    detail: "Improve fitness, movement and stamina.",
  },
  {
    value: "FOCUS",
    label: "BUILD DISCIPLINE",
    detail: "Become more consistent and focused.",
  },
  {
    value: "CONFIDENCE",
    label: "GROW CONFIDENCE",
    detail: "Become more present, social and decisive.",
  },
  {
    value: "KNOWLEDGE",
    label: "GROW MY MIND",
    detail: "Learn, think deeply and build knowledge.",
  },
];

export const FOUNDATION_EXPERIENCE_OPTIONS = [
  {
    value: "NEW",
    label: "STARTING FRESH",
    detail: "I need a simple, sustainable start.",
  },
  {
    value: "RETURNING",
    label: "RETURNING",
    detail: "I have done this before but lost momentum.",
  },
  {
    value: "REGULAR",
    label: "REGULAR",
    detail: "I already train or practise most weeks.",
  },
  {
    value: "EXPERIENCED",
    label: "EXPERIENCED",
    detail: "I know my basics and want a stronger structure.",
  },
];

export const FOUNDATION_ACTIVITY_OPTIONS = [
  {
    value: "LOW",
    label: "MOSTLY SEATED",
    detail: "Most days involve little movement.",
  },
  {
    value: "MODERATE",
    label: "ON MY FEET",
    detail: "I move around through a normal day.",
  },
  {
    value: "ACTIVE",
    label: "PHYSICALLY ACTIVE",
    detail: "Work or daily life already uses energy.",
  },
  {
    value: "VERY_ACTIVE",
    label: "VERY ACTIVE",
    detail: "I train hard or have demanding physical days.",
  },
];

export const FOUNDATION_OBSTACLE_OPTIONS = [
  {
    value: "CONSISTENCY",
    label: "STAYING CONSISTENT",
  },
  {
    value: "TIME",
    label: "FINDING TIME",
  },
  {
    value: "ENERGY",
    label: "LOW ENERGY",
  },
  {
    value: "DISTRACTIONS",
    label: "DISTRACTIONS",
  },
  {
    value: "CONFIDENCE",
    label: "CONFIDENCE",
  },
];

export const FOUNDATION_TIME_OPTIONS = [10, 20, 30, 45, 60];

export const FOUNDATION_MEAL_OPTIONS = [
  {
    value: "ONE_TO_TWO",
    label: "1–2 MEALS",
  },
  {
    value: "THREE",
    label: "3 MEALS",
  },
  {
    value: "FOUR_PLUS",
    label: "4+ MEALS",
  },
  {
    value: "IRREGULAR",
    label: "IRREGULAR",
  },
];

export const FOUNDATION_EQUIPMENT_OPTIONS = [
  {
    value: "BODYWEIGHT",
    label: "BODYWEIGHT",
    detail: "No equipment needed.",
  },
  {
    value: "HOME",
    label: "HOME SETUP",
    detail: "Bands, dumbbells or a small setup.",
  },
  {
    value: "GYM",
    label: "GYM ACCESS",
    detail: "I can use gym equipment.",
  },
  {
    value: "OUTDOOR",
    label: "OUTDOOR SPACE",
    detail: "Walking, running or outdoor practice works.",
  },
];

export const FOUNDATION_FOOD_PREFERENCE_OPTIONS = [
  {
    value: "NO_RESTRICTIONS",
    label: "NO FOOD RESTRICTIONS",
  },
  {
    value: "VEGETARIAN",
    label: "VEGETARIAN",
  },
  {
    value: "DAIRY_FREE",
    label: "DAIRY FREE",
  },
  {
    value: "PORK_FREE",
    label: "PORK FREE",
  },
];

export const FOUNDATION_FOOD_BUDGET_OPTIONS = [
  {
    value: "BASIC",
    label: "KEEP IT BASIC",
    detail: "Simple, repeatable staples matter most.",
  },
  {
    value: "FLEXIBLE",
    label: "FLEXIBLE",
    detail: "A varied weekly plan is practical.",
  },
  {
    value: "OPEN",
    label: "OPEN",
    detail: "Food cost is not the main constraint right now.",
  },
];

const FOUNDATION_PATHS = [
  "COMMANDER",
  "TANK",
  "ASSASSIN",
  "MAGE",
  "RANGER",
];

const FOUNDATION_FOCUS_VALUES = new Set(
  FOUNDATION_FOCUS_OPTIONS.map((item) => item.value),
);
const FOUNDATION_EXPERIENCE_VALUES = new Set(
  FOUNDATION_EXPERIENCE_OPTIONS.map((item) => item.value),
);
const FOUNDATION_ACTIVITY_VALUES = new Set(
  FOUNDATION_ACTIVITY_OPTIONS.map((item) => item.value),
);
const FOUNDATION_OBSTACLE_VALUES = new Set(
  FOUNDATION_OBSTACLE_OPTIONS.map((item) => item.value),
);
const FOUNDATION_MEAL_VALUES = new Set(
  FOUNDATION_MEAL_OPTIONS.map((item) => item.value),
);
const FOUNDATION_EQUIPMENT_VALUES = new Set(
  FOUNDATION_EQUIPMENT_OPTIONS.map((item) => item.value),
);
const FOUNDATION_FOOD_PREFERENCE_VALUES = new Set(
  FOUNDATION_FOOD_PREFERENCE_OPTIONS.map((item) => item.value),
);
const FOUNDATION_FOOD_BUDGET_VALUES = new Set(
  FOUNDATION_FOOD_BUDGET_OPTIONS.map((item) => item.value),
);

function cleanOption(value, allowed) {
  const normalized = String(value || "").trim().toUpperCase();
  return allowed.has(normalized) ? normalized : "";
}

function cleanNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

function cleanMinutes(value) {
  const parsed = Number(value);
  return FOUNDATION_TIME_OPTIONS.includes(parsed) ? parsed : 0;
}

export function foundationHeightToCm(feet, inches) {
  if (String(feet).trim() === "") return null;
  const wholeFeet = Number(feet);
  const remainingInches = String(inches).trim() === "" ? 0 : Number(inches);
  if (!Number.isInteger(wholeFeet) || wholeFeet < 4 || wholeFeet > 7 || !Number.isInteger(remainingInches) || remainingInches < 0 || remainingInches > 11) return null;
  return cleanNumber((wholeFeet * 12 + remainingInches) * 2.54, 120, 230);
}

function goalForFocus(focus, weightKg, heightCm) {
  if (focus === "BODY_COMPOSITION") {
    return "MAINTAIN";
  }

  if (focus === "STRENGTH" && weightKg && heightCm) {
    const metres = heightCm / 100;
    const bmi = weightKg / (metres * metres);

    if (bmi < 20.5) {
      return "BULK";
    }
  }

  return "MAINTAIN";
}

function fuelReason(scan, goal) {
  if (scan.primaryFocus === "BODY_COMPOSITION") {
    return "Your body-composition goal needs a deliberate choice, so THE SYSTEM starts at maintenance until you choose the direction that fits you.";
  }

  if (goal === "BULK") {
    return "Your stated focus and starting measurements suggest a gradual build is a sensible first direction.";
  }

  if (scan.primaryFocus === "STRENGTH") {
    return "Maintenance gives a new or returning strength plan room to build skill, recovery and consistency first.";
  }

  return "Maintenance is the most stable starting direction while THE SYSTEM learns your real routine.";
}

function buildCalorieTarget(scan, goal) {
  if (!scan.weightKg) {
    return 0;
  }

  const activityMultiplier = {
    LOW: 28,
    MODERATE: 30,
    ACTIVE: 33,
    VERY_ACTIVE: 36,
  }[scan.activityLevel] || 30;

  const adjustment = {
    CUT: -300,
    MAINTAIN: 0,
    BULK: 250,
  }[goal] || 0;

  return Math.round(
    Math.max(
      1200,
      Math.min(5000, scan.weightKg * activityMultiplier + adjustment),
    ) / 25,
  ) * 25;
}

function buildProteinTarget(scan) {
  if (!scan.weightKg) {
    return 0;
  }

  return Math.round(
    Math.max(45, Math.min(250, scan.weightKg * 1.6)),
  );
}

export function normalizeFoundationScan(value) {
  const raw = value && typeof value === "object" ? value : {};
  const primary = cleanOption(raw.primaryFocus, FOUNDATION_FOCUS_VALUES);
  const goals = Array.isArray(raw.focusGoals)
    ? [...new Set(raw.focusGoals.map(goal => cleanOption(goal, FOUNDATION_FOCUS_VALUES)).filter(Boolean))]
    : [];
  const primaryFocus = primary || goals[0] || "";
  const focusGoals = primaryFocus
    ? [primaryFocus, ...goals.filter(goal => goal !== primaryFocus)]
    : [];

  return {
    primaryFocus,
    focusGoals,
    experience: cleanOption(raw.experience, FOUNDATION_EXPERIENCE_VALUES),
    activityLevel: cleanOption(raw.activityLevel, FOUNDATION_ACTIVITY_VALUES),
    mainObstacle: cleanOption(raw.mainObstacle, FOUNDATION_OBSTACLE_VALUES),
    dailyMinutes: cleanMinutes(raw.dailyMinutes),
    weightKg: cleanNumber(raw.weightKg, 30, 350),
    heightCm: cleanNumber(raw.heightCm, 120, 230),
    mealsPerDay: cleanOption(raw.mealsPerDay, FOUNDATION_MEAL_VALUES),
    equipment: cleanOption(raw.equipment, FOUNDATION_EQUIPMENT_VALUES),
    foodPreference: cleanOption(raw.foodPreference, FOUNDATION_FOOD_PREFERENCE_VALUES),
    foodBudget: cleanOption(raw.foodBudget, FOUNDATION_FOOD_BUDGET_VALUES),
  };
}

export function isFoundationScanReady(value) {
  const scan = normalizeFoundationScan(value);
  return Boolean(
    scan.primaryFocus &&
      scan.weightKg &&
      scan.experience &&
      scan.activityLevel &&
      scan.mainObstacle &&
      scan.dailyMinutes &&
      scan.mealsPerDay &&
      scan.equipment &&
      scan.foodPreference &&
      scan.foodBudget,
  );
}

export function getFoundationFuelRecommendation(value) {
  const scan = normalizeFoundationScan(value);
  const goal = goalForFocus(
    scan.primaryFocus,
    scan.weightKg,
    scan.heightCm,
  );

  return {
    goal,
    reason: fuelReason(scan, goal),
    calorieTarget: buildCalorieTarget(scan, goal),
    proteinTarget: buildProteinTarget(scan),
    hasBodyMetrics: Boolean(scan.weightKg),
  };
}

export function getFoundationClassSuggestions(value) {
  const scan = normalizeFoundationScan(value);
  const scores = Object.fromEntries(
    FOUNDATION_PATHS.map((path) => [path, 0]),
  );

  const focusSignals = {
    STRENGTH: { TANK: 4, RANGER: 1 },
    BODY_COMPOSITION: { TANK: 2, RANGER: 2, ASSASSIN: 1 },
    FITNESS: { RANGER: 4, ASSASSIN: 1 },
    FOCUS: { ASSASSIN: 3, MAGE: 2, COMMANDER: 1 },
    CONFIDENCE: { COMMANDER: 4, ASSASSIN: 1 },
    KNOWLEDGE: { MAGE: 4, ASSASSIN: 1 },
  };

  Object.entries(focusSignals[scan.primaryFocus] || {}).forEach(
    ([path, amount]) => {
      scores[path] += amount;
    },
  );

  // The first goal has full weight. Supporting goals influence suggestions
  // without replacing the player's priority or selecting a class for them.
  scan.focusGoals.slice(1).forEach(goal => {
    Object.entries(focusSignals[goal] || {}).forEach(([path, amount]) => {
      scores[path] += amount * 0.35;
    });
  });

  if (scan.equipment === "GYM") {
    scores.TANK += 1;
  }

  if (scan.equipment === "OUTDOOR") {
    scores.RANGER += 1;
  }

  if (scan.equipment === "BODYWEIGHT") {
    scores.ASSASSIN += 1;
  }

  if (scan.activityLevel === "VERY_ACTIVE") {
    scores.RANGER += 1;
  }

  if (scan.experience === "NEW") {
    scores.COMMANDER += 1;
  }

  if (scan.mainObstacle === "CONFIDENCE") {
    scores.COMMANDER += 2;
  }

  if (scan.mainObstacle === "DISTRACTIONS") {
    scores.ASSASSIN += 1;
    scores.MAGE += 1;
  }

  const reasons = {
    COMMANDER: "leadership, confidence and dependable execution",
    TANK: "strength, resilience and physical capacity",
    ASSASSIN: "focus, precision and disciplined follow-through",
    MAGE: "knowledge, analysis and deep concentration",
    RANGER: "movement, endurance and adaptable consistency",
  };

  return FOUNDATION_PATHS
    .map((path) => ({
      path,
      score: scores[path],
      reason: reasons[path],
    }))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, 3);
}

export function getFoundationOpeningPlan({ value, path, fuelGoal }) {
  const scan = normalizeFoundationScan(value);
  const chosenPath = FOUNDATION_PATHS.includes(String(path || "").toUpperCase())
    ? String(path).toUpperCase()
    : "COMMANDER";
  const minutes = scan.dailyMinutes || 20;
  const sessions = ["NEW", "RETURNING"].includes(scan.experience) ? 3 : 4;
  const mealRhythm = {
    ONE_TO_TWO: "add one reliable protein-and-energy meal",
    THREE: "protect your three regular meals",
    FOUR_PLUS: "keep your meals steady rather than random",
    IRREGULAR: "anchor one dependable meal at the same time each day",
  }[scan.mealsPerDay] || "build one dependable meal rhythm";

  const foodSupport = {
    BASIC: "Use dependable staples such as eggs, beans, rice, oats, fruit and vegetables.",
    FLEXIBLE: "Plan a few repeatable meals, then vary the protein and vegetables through the week.",
    OPEN: "Choose foods you can repeat around your real schedule, not one perfect menu.",
  }[scan.foodBudget] || "Use meals you can repeat consistently.";

  const preferenceSupport = {
    VEGETARIAN: "Choose beans, lentils, eggs or other preferred vegetarian proteins.",
    DAIRY_FREE: "Use dairy-free protein and snack options that suit you.",
    PORK_FREE: "Use your preferred protein sources throughout the plan.",
  }[scan.foodPreference] || "Choose protein sources that suit you.";

  const obstacleSupport = {
    CONSISTENCY: "Keep the first target small enough to repeat even on a busy day.",
    TIME: "Protect the chosen time block before adding more volume.",
    ENERGY: "Place the hardest work after a meal and give yourself a lighter recovery day.",
    DISTRACTIONS: "Use one protected block with notifications out of reach.",
    CONFIDENCE: "Treat every repeat as practice, not a performance for other people.",
  }[scan.mainObstacle] || "Leave enough energy to return tomorrow.";

  const classDirective = {
    COMMANDER: {
      title: "COMMAND PRESENCE",
      detail: `Complete a ${minutes}-minute leadership or confidence practice. Keep it private, clear and repeatable.`,
    },
    TANK: {
      title: "FOUNDATION STRENGTH",
      detail: `Complete a ${minutes}-minute strength foundation session at a sustainable pace.`,
    },
    ASSASSIN: {
      title: "PRECISION BLOCK",
      detail: `Protect one ${minutes}-minute distraction-free block and finish one defined task.`,
    },
    MAGE: {
      title: "DEEP-WORK BLOCK",
      detail: `Read, study or build for ${minutes} focused minutes and capture one useful idea.`,
    },
    RANGER: {
      title: "MOVEMENT SIGNAL",
      detail: `Complete a ${minutes}-minute walk, run or conditioning block at an honest pace.`,
    },
  }[chosenPath];

  return [
    {
      type: "CLASS START",
      title: classDirective.title,
      detail: classDirective.detail,
    },
    {
      type: "FUEL ANCHOR",
      title: `${String(fuelGoal || "MAINTAIN").toUpperCase()} WITH CONTROL`,
      detail: `This week, ${mealRhythm} ${foodSupport} ${preferenceSupport}`,
    },
    {
      type: "RECOVERY RULE",
      title: `${sessions} SESSIONS THIS WEEK`,
      detail: `${obstacleSupport} Consistency is the first level-up.`,
    },
  ];
}

export function buildFoundationProfileData(value, selectedFuelGoal) {
  const scan = normalizeFoundationScan(value);
  const recommendation = getFoundationFuelRecommendation(scan);
  const fuelGoal = ["CUT", "MAINTAIN", "BULK"].includes(
    String(selectedFuelGoal || "").toUpperCase(),
  )
    ? String(selectedFuelGoal).toUpperCase()
    : recommendation.goal;

  return {
    ...scan,
    recommendedFuelGoal: recommendation.goal,
    selectedFuelGoal: fuelGoal,
    estimatedCalorieTarget: buildCalorieTarget(scan, fuelGoal),
    estimatedProteinTarget: buildProteinTarget(scan),
    version: 2,
  };
}
