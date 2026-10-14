/* =========================================================
   THE SYSTEM 2.8.1 — FUEL SYSTEM
   Personal food logging is advisory/local. It never awards XP or changes
   attributes; class progression remains on the authoritative backend.
   ========================================================= */

export const FUEL_GOALS = ["CUT", "MAINTAIN", "BULK"];

const protocol = (base) => ({
  disclaimer:
    "Guidance only — set targets that suit your body, health needs and clinician advice.",
  ...base,
});

const mealPlan = (...items) =>
  items.map(([slot, title, guide]) => ({ slot, title, guide }));

export const FUEL_PROTOCOLS = {
  TANK: {
    CUT: protocol({
      mealRhythm: "3 MEALS + 1 PROTEIN SNACK",
      focus: "Keep protein high while using a controlled calorie target so strength has a chance to stay with you.",
      foods: ["eggs", "chicken or beef", "beans", "potatoes or rice", "plain yoghurt", "greens"],
      meals: mealPlan(
        ["BREAKFAST", "PROTEIN FOUNDATION", "Eggs with oats or potatoes; add fruit if it fits your target."],
        ["LUNCH", "STRENGTH PLATE", "Chicken, beef or beans with rice, ugali or potatoes and greens."],
        ["DINNER", "LEAN RECOVERY", "A repeatable protein source, vegetables and a measured carbohydrate portion."],
        ["SNACK", "PROTEIN CHECK", "Plain yoghurt, milk or beans when the day is short on protein."],
      ),
    }),
    MAINTAIN: protocol({
      mealRhythm: "3 MEALS + 1 RECOVERY SNACK",
      focus: "Build steady recovery around strength work instead of swinging between under-eating and overeating.",
      foods: ["eggs", "milk or yoghurt", "rice", "potatoes", "beans", "fruit"],
      meals: mealPlan(
        ["BREAKFAST", "STRENGTH START", "Eggs, oats or potatoes, plus fruit or milk."],
        ["LUNCH", "MAIN LIFT FUEL", "Chicken, beef or beans with rice, ugali or potatoes."],
        ["SNACK", "RECOVERY WINDOW", "Yoghurt or milk with fruit after training or between long gaps."],
        ["DINNER", "STEADY FINISH", "Protein, vegetables and a dependable carbohydrate source."],
      ),
    }),
    BULK: protocol({
      mealRhythm: "4 MEALS + 1 CALORIE-DENSE SNACK",
      focus: "Use regular meals and easy protein rather than trying to force one huge meal.",
      foods: ["eggs", "milk", "beef or chicken", "rice", "potatoes", "beans", "peanut butter"],
      meals: mealPlan(
        ["BREAKFAST", "BUILDING START", "Eggs, oats and milk; make this a consistent first meal."],
        ["MEAL", "SECOND PLATE", "Rice, beans and fruit before the day gets too busy."],
        ["LUNCH", "MASS FUEL", "Chicken or beef, rice or potatoes, beans and greens."],
        ["SNACK", "CALORIE-DENSE RECOVERY", "Milk or yoghurt with banana and peanut butter or nuts."],
        ["DINNER", "FINAL BUILD", "Eggs, beans or meat with rice, potatoes or ugali."],
      ),
    }),
  },
  RANGER: {
    CUT: protocol({
      mealRhythm: "3 MEALS + 1 LIGHT FUEL SNACK",
      focus: "Stay light enough to move well, while keeping enough carbohydrate for walks, runs and conditioning.",
      foods: ["oats or porridge", "bananas", "beans", "chicken", "rice or ugali", "vegetables"],
      meals: mealPlan(
        ["BREAKFAST", "MOVEMENT START", "Oats or porridge with fruit and eggs or yoghurt."],
        ["LUNCH", "ENDURANCE PLATE", "Chicken or beans, vegetables and rice or ugali."],
        ["DINNER", "LIGHT RECOVERY", "Protein, vegetables and the carbohydrate portion your activity needs."],
        ["SNACK", "ON-THE-MOVE FUEL", "Banana, yoghurt or a simple bean-and-fruit option before a long session."],
      ),
    }),
    MAINTAIN: protocol({
      mealRhythm: "3 MEALS + 1–2 MOVEMENT SNACKS",
      focus: "Distribute energy across the day so training does not start empty.",
      foods: ["oats", "fruit", "eggs", "rice", "beans", "water"],
      meals: mealPlan(
        ["BREAKFAST", "TRAIL START", "Oats, fruit and eggs before the first movement block."],
        ["SNACK", "MOVEMENT FUEL", "Fruit, yoghurt or a simple portion of beans before or after activity."],
        ["LUNCH", "ENDURANCE LUNCH", "Rice or ugali with chicken or beans and vegetables."],
        ["DINNER", "RECOVER + RESET", "A balanced protein, carbohydrate and vegetable plate."],
      ),
    }),
    BULK: protocol({
      mealRhythm: "4 MEALS + 1 RECOVERY SNACK",
      focus: "Add energy gradually without losing the mobility and endurance that define the Ranger path.",
      foods: ["oats", "bananas", "eggs", "chicken", "rice", "milk or yoghurt"],
      meals: mealPlan(
        ["BREAKFAST", "ENDURANCE BUILD", "Oats, eggs, milk or yoghurt and fruit."],
        ["MEAL", "TRAIL TOP-UP", "Rice or ugali with beans between movement blocks."],
        ["LUNCH", "MAIN RECOVERY", "Chicken, rice and vegetables after the day’s hardest work."],
        ["SNACK", "EASY CALORIES", "Banana with milk, yoghurt, nuts or peanut butter."],
        ["DINNER", "MOBILITY-SAFE FINISH", "Protein, vegetables and a satisfying carbohydrate source."],
      ),
    }),
  },
  ASSASSIN: {
    CUT: protocol({
      mealRhythm: "3 STRUCTURED MEALS + OPTIONAL PROTEIN SNACK",
      focus: "Keep choices deliberate: protein, fibre and enough fuel for precision training.",
      foods: ["eggs", "fish or chicken", "vegetables", "fruit", "potatoes", "rice"],
      meals: mealPlan(
        ["BREAKFAST", "PRECISION START", "Eggs with fruit and a measured oats, rice or potato base."],
        ["LUNCH", "CONTROLLED PLATE", "Fish or chicken, vegetables and rice or potatoes."],
        ["DINNER", "CLEAN FINISH", "Protein, vegetables and the carbohydrate portion your training requires."],
        ["SNACK", "OPTIONAL PROTEIN", "Yoghurt, milk, eggs or beans only if the day needs it."],
      ),
    }),
    MAINTAIN: protocol({
      mealRhythm: "3 STRUCTURED MEALS + 1 CONTROLLED SNACK",
      focus: "Protect energy and focus without constant grazing.",
      foods: ["eggs", "chicken", "beans", "fruit", "yoghurt", "rice"],
      meals: mealPlan(
        ["BREAKFAST", "FOCUS START", "Eggs, fruit and oats or a simple rice-and-beans plate."],
        ["LUNCH", "TRAINING PLATE", "Chicken or beans with rice and vegetables."],
        ["SNACK", "CONTROLLED TOP-UP", "Fruit with yoghurt or a small bean-based option."],
        ["DINNER", "CONSISTENT CLOSE", "Protein, vegetables and a repeatable carbohydrate source."],
      ),
    }),
    BULK: protocol({
      mealRhythm: "4 MEALS + 1 PROTEIN SNACK",
      focus: "Build without turning the plan into chaos; use measured portions and repeatable meals.",
      foods: ["eggs", "chicken", "rice", "potatoes", "beans", "milk", "nuts"],
      meals: mealPlan(
        ["BREAKFAST", "STRUCTURED BUILD", "Eggs, oats or potatoes, plus milk or yoghurt."],
        ["MEAL", "SECOND MISSION", "Rice and beans with fruit before afternoon work."],
        ["LUNCH", "REPEATABLE BULK PLATE", "Chicken, rice or potatoes, beans and vegetables."],
        ["SNACK", "PROTEIN TOP-UP", "Milk, yoghurt, eggs or nuts when you need another meal."],
        ["DINNER", "CALM FINISH", "A familiar protein-and-carbohydrate plate you can repeat daily."],
      ),
    }),
  },
  MAGE: {
    CUT: protocol({
      mealRhythm: "3 STEADY MEALS + 1 FOCUS SNACK",
      focus: "Avoid long gaps and energy crashes during study, while keeping your target controlled.",
      foods: ["eggs", "oats", "beans", "fruit", "yoghurt", "fish or chicken"],
      meals: mealPlan(
        ["BREAKFAST", "FOCUS FOUNDATION", "Oats with eggs, fruit or yoghurt before deep work."],
        ["LUNCH", "STUDY FUEL", "Fish, chicken or beans with rice and vegetables."],
        ["DINNER", "STEADY CLOSE", "A balanced protein, fibre and carbohydrate plate."],
        ["SNACK", "FOCUS RESET", "Fruit, yoghurt, nuts or beans between long study blocks."],
      ),
    }),
    MAINTAIN: protocol({
      mealRhythm: "3 STEADY MEALS + 1 FOCUS SNACK",
      focus: "Feed long reading and deep-work blocks with regular meals rather than caffeine alone.",
      foods: ["oats", "eggs", "nuts", "fruit", "yoghurt", "fish or chicken"],
      meals: mealPlan(
        ["BREAKFAST", "DEEP-WORK START", "Oats, eggs, fruit and water before the first focus block."],
        ["LUNCH", "MENTAL ENDURANCE", "Fish, chicken or beans with rice and vegetables."],
        ["SNACK", "FOCUS SNACK", "Fruit with yoghurt or nuts rather than running on caffeine alone."],
        ["DINNER", "RECOVERY MEAL", "Protein, vegetables and a dependable carbohydrate source."],
      ),
    }),
    BULK: protocol({
      mealRhythm: "4 MEALS + 1 EASY SNACK",
      focus: "Increase energy gradually while protecting concentration and digestion.",
      foods: ["oats", "eggs", "milk", "rice", "beans", "fruit", "peanut butter"],
      meals: mealPlan(
        ["BREAKFAST", "FOCUS + BUILD", "Oats, eggs, milk and fruit."],
        ["MEAL", "STUDY BREAK PLATE", "Rice and beans before the long afternoon block."],
        ["LUNCH", "MAIN FUEL", "Eggs, chicken or beans with rice and vegetables."],
        ["SNACK", "EASY ENERGY", "Milk or yoghurt with fruit and peanut butter or nuts."],
        ["DINNER", "CALM FINISH", "A familiar protein-and-carbohydrate meal that does not interrupt sleep."],
      ),
    }),
  },
  COMMANDER: {
    CUT: protocol({
      mealRhythm: "3 BALANCED MEALS + 1 PLANNED SNACK",
      focus: "Keep energy stable for leadership, communication and a busy schedule without heavy swings.",
      foods: ["eggs", "chicken", "beans", "fruit", "rice or potatoes", "vegetables"],
      meals: mealPlan(
        ["BREAKFAST", "COMMAND START", "Eggs, fruit and oats or potatoes before the first responsibility."],
        ["LUNCH", "STEADY LEADERSHIP PLATE", "Chicken or beans with rice or potatoes and vegetables."],
        ["DINNER", "BALANCED CLOSE", "Protein, vegetables and a deliberate carbohydrate portion."],
        ["SNACK", "PLANNED ENERGY", "Fruit, yoghurt or beans so a busy day does not turn into missed meals."],
      ),
    }),
    MAINTAIN: protocol({
      mealRhythm: "3 BALANCED MEALS + 1 FLEXIBLE SNACK",
      focus: "Use a dependable meal rhythm that supports clear decisions and social energy.",
      foods: ["eggs", "chicken or fish", "rice", "beans", "fruit", "yoghurt"],
      meals: mealPlan(
        ["BREAKFAST", "CLEAR START", "Eggs, oats or fruit with water before the day accelerates."],
        ["LUNCH", "EXECUTION PLATE", "Chicken, fish or beans with rice and vegetables."],
        ["SNACK", "FLEXIBLE SUPPORT", "Fruit with yoghurt, milk or nuts between commitments."],
        ["DINNER", "RESET MEAL", "A balanced protein, carbohydrate and vegetable plate."],
      ),
    }),
    BULK: protocol({
      mealRhythm: "4 BALANCED MEALS + 1 RECOVERY SNACK",
      focus: "Raise food intake consistently while keeping the routine practical around work and leadership demands.",
      foods: ["eggs", "milk", "chicken or beef", "rice", "potatoes", "beans", "fruit"],
      meals: mealPlan(
        ["BREAKFAST", "HIGH-OUTPUT START", "Eggs, oats, milk and fruit."],
        ["MEAL", "MEETING-BLOCK TOP-UP", "Rice, beans and fruit before the afternoon is taken over."],
        ["LUNCH", "MAIN OUTPUT PLATE", "Chicken or beef, rice or potatoes, beans and vegetables."],
        ["SNACK", "RECOVERY SUPPORT", "Milk or yoghurt with fruit and nuts or peanut butter."],
        ["DINNER", "CONSISTENT CLOSE", "Protein, vegetables and a substantial carbohydrate source."],
      ),
    }),
  },
};

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeFuelGoal(value) {
  const goal = String(value || "").trim().toUpperCase();
  return FUEL_GOALS.includes(goal) ? goal : "";
}

export function getFuelProtocol(path, goal) {
  const safePath = String(path || "COMMANDER").toUpperCase();
  const safeGoal = normalizeFuelGoal(goal) || "MAINTAIN";
  return FUEL_PROTOCOLS[safePath]?.[safeGoal] || FUEL_PROTOCOLS.COMMANDER[safeGoal];
}

export function getFuelMealPlan(path, goal) {
  const meals = getFuelProtocol(path, goal)?.meals;
  return Array.isArray(meals) ? meals : [];
}

export function normalizeFuelState(value) {
  const raw = value && typeof value === "object" ? value : {};
  const logs = raw.logs && typeof raw.logs === "object" ? raw.logs : {};

  const cleanedLogs = Object.fromEntries(
    Object.entries(logs).map(([day, entries]) => [
      day,
      Array.isArray(entries)
        ? entries
            .map((entry) => ({
              id: String(entry?.id || ""),
              meal: String(entry?.meal || "MEAL").trim().slice(0, 80) || "MEAL",
              calories: numberOrZero(entry?.calories),
              protein: numberOrZero(entry?.protein),
              slot: String(entry?.slot || "MEAL").trim().toUpperCase().slice(0, 32) || "MEAL",
              loggedAt: String(entry?.loggedAt || ""),
            }))
            .filter((entry) => entry.id)
        : [],
    ]),
  );

  return {
    goal: normalizeFuelGoal(raw.goal),
    calorieTarget: numberOrZero(raw.calorieTarget),
    proteinTarget: numberOrZero(raw.proteinTarget),
    logs: cleanedLogs,
  };
}

export function summarizeFuelDay(entries, calorieTarget = 0, proteinTarget = 0) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const calories = safeEntries.reduce((total, entry) => total + numberOrZero(entry?.calories), 0);
  const protein = safeEntries.reduce((total, entry) => total + numberOrZero(entry?.protein), 0);
  const calorieGoal = numberOrZero(calorieTarget);
  const proteinGoal = numberOrZero(proteinTarget);

  return {
    calories,
    protein,
    calorieRemaining: calorieGoal ? calorieGoal - calories : null,
    proteinRemaining: proteinGoal ? proteinGoal - protein : null,
    caloriePercent: calorieGoal ? Math.min(100, Math.round((calories / calorieGoal) * 100)) : 0,
    proteinPercent: proteinGoal ? Math.min(100, Math.round((protein / proteinGoal) * 100)) : 0,
  };
}

export function recentFuelConsistency(logs, days) {
  const safeLogs = logs && typeof logs === "object" ? logs : {};
  const safeDays = Array.isArray(days) ? days : [];
  const loggedDays = safeDays.filter((day) => Array.isArray(safeLogs[day]) && safeLogs[day].length > 0);
  return {
    loggedDays: loggedDays.length,
    totalDays: safeDays.length,
  };
}
