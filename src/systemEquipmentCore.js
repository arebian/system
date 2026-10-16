import { ATTRIBUTE_NAMES } from "./systemAttributesCore.js";

// Display only server-returned loadout totals. Earned attributes remain intact
// for progression, achievements and the analysis of real-world development.
export function effectiveAttributes(profile) {
  return Object.fromEntries(ATTRIBUTE_NAMES.map(name => {
    const base = Number(profile?.attributes?.[name]) || 0;
    const bonus = Math.max(0, Number(profile?.equipment?.bonuses?.[name]) || 0);
    return [name, base + bonus];
  }));
}
