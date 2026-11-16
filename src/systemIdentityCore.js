export const SYSTEM_IDENTITY_PILLARS = [
  { value: "DISCIPLINE", label: "DISCIPLINE", description: "Consistency, self-control and keeping commitments." },
  { value: "PHYSICAL", label: "PHYSICAL", description: "Strength, fitness, movement and physical capability." },
  { value: "INTELLECT", label: "INTELLECT", description: "Learning, reasoning, focus and useful skills." },
  { value: "WEALTH", label: "WEALTH", description: "Financial capability, career and building value." },
  { value: "SOCIAL", label: "SOCIAL", description: "Communication, confidence and relationships." },
  { value: "MENTAL", label: "MENTAL", description: "Resilience, emotional regulation and mental clarity." },
  { value: "SPIRITUAL", label: "SPIRITUAL", description: "Purpose, values, reflection and inner direction." },
];

const VALID_PILLARS = new Set(SYSTEM_IDENTITY_PILLARS.map(item => item.value));

export function normalizeIdentity(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const primary = String(source.primary || "").trim().toUpperCase();
  const secondary = Array.isArray(source.secondary) ? source.secondary : [];
  const supporting = [...new Set(secondary.map(item => String(item || "").trim().toUpperCase()))]
    .filter(item => VALID_PILLARS.has(item) && item !== primary)
    .slice(0, 2);
  return {
    primary: VALID_PILLARS.has(primary) ? primary : "",
    secondary: VALID_PILLARS.has(primary) ? supporting : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
  };
}

export function isIdentityReady(value) {
  return Boolean(normalizeIdentity(value).primary);
}
