export const ATTRIBUTE_NAMES = Object.freeze([
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
]);

// A class is a growth bias, not a hard cap. These values establish a coherent
// starting identity while real verified actions can still develop every stat.
export const CLASS_ATTRIBUTE_BLUEPRINTS = Object.freeze({
  MAGE: Object.freeze({
    core: Object.freeze(["INTELLIGENCE", "FOCUS", "CREATIVITY"]),
    support: Object.freeze(["DISCIPLINE", "RECOVERY"]),
    baseline: Object.freeze({
      STRENGTH: 4,
      SPEED: 5,
      ENDURANCE: 5,
      INTELLIGENCE: 15,
      FOCUS: 13,
      DISCIPLINE: 9,
      WEALTH: 5,
      CHARISMA: 5,
      CREATIVITY: 11,
      RECOVERY: 8,
    }),
  }),
  COMMANDER: Object.freeze({
    core: Object.freeze(["CHARISMA", "DISCIPLINE", "FOCUS"]),
    support: Object.freeze(["WEALTH", "INTELLIGENCE"]),
    baseline: Object.freeze({
      STRENGTH: 5,
      SPEED: 5,
      ENDURANCE: 6,
      INTELLIGENCE: 8,
      FOCUS: 11,
      DISCIPLINE: 13,
      WEALTH: 10,
      CHARISMA: 15,
      CREATIVITY: 7,
      RECOVERY: 8,
    }),
  }),
  TANK: Object.freeze({
    core: Object.freeze(["STRENGTH", "ENDURANCE", "DISCIPLINE"]),
    support: Object.freeze(["RECOVERY", "FOCUS"]),
    baseline: Object.freeze({
      STRENGTH: 15,
      SPEED: 5,
      ENDURANCE: 14,
      INTELLIGENCE: 6,
      FOCUS: 8,
      DISCIPLINE: 12,
      WEALTH: 4,
      CHARISMA: 5,
      CREATIVITY: 5,
      RECOVERY: 10,
    }),
  }),
  ASSASSIN: Object.freeze({
    core: Object.freeze(["SPEED", "FOCUS", "DISCIPLINE"]),
    support: Object.freeze(["STRENGTH", "CREATIVITY"]),
    baseline: Object.freeze({
      STRENGTH: 7,
      SPEED: 15,
      ENDURANCE: 8,
      INTELLIGENCE: 7,
      FOCUS: 14,
      DISCIPLINE: 12,
      WEALTH: 5,
      CHARISMA: 5,
      CREATIVITY: 10,
      RECOVERY: 7,
    }),
  }),
  RANGER: Object.freeze({
    core: Object.freeze(["ENDURANCE", "SPEED", "RECOVERY"]),
    support: Object.freeze(["FOCUS", "DISCIPLINE"]),
    baseline: Object.freeze({
      STRENGTH: 8,
      SPEED: 13,
      ENDURANCE: 15,
      INTELLIGENCE: 7,
      FOCUS: 10,
      DISCIPLINE: 9,
      WEALTH: 4,
      CHARISMA: 5,
      CREATIVITY: 6,
      RECOVERY: 12,
    }),
  }),
});

export function normalizeClassPath(value) {
  const path = String(value || "").trim().toUpperCase();
  return CLASS_ATTRIBUTE_BLUEPRINTS[path] ? path : "COMMANDER";
}

export function getClassAttributeBlueprint(path) {
  return CLASS_ATTRIBUTE_BLUEPRINTS[normalizeClassPath(path)];
}

export function createClassAttributeBaseline(path) {
  return {
    ...getClassAttributeBlueprint(path).baseline,
  };
}

export function getAttributeTier(path, attribute) {
  const name = String(attribute || "").trim().toUpperCase();
  const blueprint = getClassAttributeBlueprint(path);
  if (blueprint.core.includes(name)) return "CORE";
  if (blueprint.support.includes(name)) return "SUPPORT";
  return "OPEN";
}

export function sortAttributesForClass(attributes, path) {
  const priority = {
    CORE: 0,
    SUPPORT: 1,
    OPEN: 2,
  };

  return Object.entries(attributes || {})
    .filter(([name]) => ATTRIBUTE_NAMES.includes(String(name).toUpperCase()))
    .sort(([left], [right]) => {
      const tierDifference =
        priority[getAttributeTier(path, left)] -
        priority[getAttributeTier(path, right)];
      if (tierDifference !== 0) return tierDifference;
      return ATTRIBUTE_NAMES.indexOf(left) - ATTRIBUTE_NAMES.indexOf(right);
    });
}

export function calculateClassAlignment(path, attributes) {
  const blueprint = getClassAttributeBlueprint(path);
  const values = ATTRIBUTE_NAMES.map((name) =>
    Math.max(0, Number(attributes?.[name]) || 0)
  );
  const baseline = ATTRIBUTE_NAMES.map((name) => blueprint.baseline[name]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const baselineTotal = baseline.reduce((sum, value) => sum + value, 0);

  if (total <= 0 || baselineTotal <= 0) {
    return {
      score: 0,
      coreAverage: 0,
      supportAverage: 0,
      core: blueprint.core,
      support: blueprint.support,
    };
  }

  const distance = ATTRIBUTE_NAMES.reduce((sum, name, index) => {
    const actualShare = values[index] / total;
    const targetShare = baseline[index] / baselineTotal;
    return sum + Math.abs(actualShare - targetShare);
  }, 0);

  const averageFor = (names) =>
    names.reduce((sum, name) => sum + (Number(attributes?.[name]) || 0), 0) /
    Math.max(1, names.length);

  return {
    score: Math.max(0, Math.min(100, Math.round(100 - distance * 100))),
    coreAverage: Math.round(averageFor(blueprint.core) * 10) / 10,
    supportAverage: Math.round(averageFor(blueprint.support) * 10) / 10,
    core: blueprint.core,
    support: blueprint.support,
  };
}

export function normalizeAttributeCredit(row) {
  const awarded = Math.max(0, Number(row?.credits_awarded) || 0);
  const spent = Math.max(0, Number(row?.credits_spent) || 0);
  const eligible = Array.isArray(row?.eligible_attributes)
    ? row.eligible_attributes
        .map((value) => String(value || "").trim().toUpperCase())
        .filter((value) => ATTRIBUTE_NAMES.includes(value))
    : [];

  return {
    id: String(row?.id || ""),
    sourceTitle: String(row?.source_title || "VERIFIED QUEST"),
    sourceCategory: String(row?.source_category || "CLASS").toUpperCase(),
    awarded,
    spent: Math.min(awarded, spent),
    available: Math.max(0, awarded - spent),
    eligibleAttributes: eligible,
    createdAt: row?.created_at || null,
  };
}
