export const WEEKLY_BOSS_OPTIONS = [
  { id: "BREAKFAST", label: "Breakfast ready for the week", description: "Prepare and portion real breakfasts in one session." },
  { id: "LUNCH", label: "Packed lunches ready for the week", description: "Cook, portion and store complete lunches." },
  { id: "OUTFITS", label: "Complete outfits ready for the week", description: "Finish the washing, ironing and assembly now." },
];

export function normalizeWeeklyIntake(input = {}) {
  const need = String(input.need || "BREAKFAST").toUpperCase();
  if (!WEEKLY_BOSS_OPTIONS.some(option => option.id === need)) throw new Error("WEEKLY_NEED_INVALID");
  const days = Number(input.days ?? 7), people = Number(input.people ?? 1);
  if (!Number.isInteger(days) || days < 5 || days > 7 || !Number.isInteger(people) || people < 1 || people > 4) throw new Error("WEEKLY_PORTIONS_INVALID");
  const storage = String(input.storage || "FREEZER").toUpperCase();
  if (!["FREEZER", "FRIDGE", "PANTRY"].includes(storage)) throw new Error("WEEKLY_STORAGE_INVALID");
  return { need, days, people, storage, portions: days * people,
    avoids: String(input.avoids || "").trim().slice(0, 400),
    available: String(input.available || "").trim().slice(0, 600),
    budget: String(input.budget || "Use supplies I already have").trim().slice(0, 120) };
}

const foodSource = "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety";

export function buildWeeklyPlan(raw, level = 1) {
  const intake = normalizeWeeklyIntake(raw);
  const { need, days, people, portions, storage } = intake;
  const base = { version: 1, kind: "WEEKLY_PREPARATION", intake, coverage_days: days, target_count: portions,
    estimated_minutes: [90, 180], reward: { xp: Math.min(1200, 250 + Math.floor(Math.max(1, Number(level) || 1) / 10) * 100),
      attributes: need === "OUTFITS" ? { DISCIPLINE: 4, FOCUS: 2 } : { DISCIPLINE: 4, RECOVERY: 2 } },
    sources: [], notes: [] };
  if (need === "OUTFITS") return { ...base, title: `${days} DAYS, READY TO WEAR`, unit: "complete outfits",
    objective: `${portions} clean, wearable, complete outfits ready for ${days} days for ${people} person(s).`,
    benefit: "Your clothes are ready. Pick up an outfit and start your day.",
    supplies: [`${portions} outfits from clothes you already own`, "Your usual laundry supplies", "Iron or steamer only if needed", "Hangers or a clean dry shelf"],
    steps: [
      { title: "Select complete outfits", detail: `Match ${portions} full outfits to the coming days, including essentials. Reuse clean clothes; do not buy anything for this boss.` },
      { title: "Finish the laundry", detail: "Wash only what needs washing, following garment labels. Let everything dry completely. Start earlier if drying needs more time." },
      { title: "Finish the preparation", detail: "Iron or steam where needed. Check fastenings and pair socks and accessories." },
      { title: "Make each day ready", detail: `Store ${portions} complete, dry outfits together. Count the finished outfits; a clothing plan alone does not complete this boss.` },
    ], notes: ["Active effort is estimated. Drying can take longer; the boss completes when the clothes are actually ready."] };
  // Do not invent allergy substitutions. A familiar alternative needs its own reviewed recipe.
  if (intake.avoids) throw new Error("WEEKLY_RECIPE_ADAPTATION_REQUIRED");
  if (need === "LUNCH" && storage !== "FREEZER") throw new Error("WEEKLY_FREEZER_REQUIRED");
  if (need === "BREAKFAST" && storage === "FRIDGE") throw new Error("WEEKLY_FREEZER_OR_PANTRY_REQUIRED");
  if (need === "BREAKFAST" && storage === "PANTRY") return { ...base, title: "BREAKFAST SUPPLY SECURED", unit: "breakfast packs",
    estimated_minutes: [45, 90], objective: `${portions} ready-to-eat, shelf-stable breakfast packs portioned and stored for ${days} days.`,
    benefit: "Each morning, take one ready breakfast pack. No cooking session needed.",
    supplies: [`${portions} clean dry food-safe containers or bags`, "Ready-to-eat cereal or another familiar shelf-stable breakfast", "Optional dried fruit that you already tolerate"],
    steps: [
      { title: "Check your supplies", detail: "Choose familiar ready-to-eat foods that are labelled for room-temperature storage. Check portions, ingredient labels and use-by dates." },
      { title: "Prepare the whole batch", detail: `Portion ${portions} complete breakfasts using your usual serving size. Keep wet or perishable ingredients out of these packs.` },
      { title: "Pack and label", detail: "Seal each portion in a clean dry container. Label by day and follow the food packaging's storage instructions." },
      { title: "Count your finished supply", detail: `Confirm ${portions} ready-to-eat packs are stored. Nothing remains to cook during the week.` },
    ], notes: ["This is a pantry option. It does not promise a particular calorie or protein target."] };
  const breakfast = need === "BREAKFAST";
  return { ...base, title: breakfast ? "PREPARE YOUR FUEL" : "LUNCH FOR THE ENTIRE WEEK", unit: breakfast ? "breakfast portions" : "lunch portions",
    objective: `${portions} prepared ${breakfast ? "breakfasts" : "lunches"} safely portioned and stored for ${days} days; later-week portions frozen.`,
    benefit: `Your ${breakfast ? "breakfasts" : "lunches"} are made. Take a portion and ${breakfast ? "thaw or reheat" : "reheat"} when needed.`,
    supplies: breakfast ? [`${portions} food-safe freezer containers`, `${60 * portions} g oats`, `${160 * portions} ml milk or a suitable milk alternative you already tolerate`, "Optional familiar fruit or flavouring"] :
      [`${portions} food-safe freezer containers`, `${75 * portions} g dry rice`, `${150 * portions} g cooked beans`, `${150 * portions} g vegetables`, "Your usual seasoning"],
    steps: [
      { title: "Check ingredients and equipment", detail: `Check the full ingredient labels, ${portions} containers and available freezer space. Compare the list with your supplies and check any missing items against your spending limit.` },
      { title: "Prepare your batch", detail: breakfast ?
        `For each portion, combine 60 g oats and 160 ml of your usual milk. Stir in familiar flavourings. Use freezer-safe containers and leave room for expansion when freezing. Portions can soften overnight in the fridge.` :
        `Cook the rice according to its packet instructions. Cook vegetables and combine with already cooked beans and your usual seasoning. Divide evenly into ${portions} complete meals.` },
      { title: "Portion and store promptly", detail: "Use suitable containers, refrigerate promptly at 4°C or colder, and freeze the later-week portions immediately. Do not leave perishable food out for more than two hours, or one hour above 32°C. Never rely on a full week in the fridge." },
      { title: "Label and secure the week's supply", detail: `Count ${portions} finished portions. Label the preparation date and planned day. Keep only the first three days in the fridge and the rest frozen. Thaw in the fridge; reheat cooked leftovers to 74°C.` },
    ], sources: [foodSource], notes: ["Freezing may change texture. Check that your recipe and containers are suitable for freezing.", "Active preparation takes a few hours; chilling, thawing and cooking times vary."] };
}
