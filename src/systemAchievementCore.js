import { getRank } from "./systemProgressionCore.js";

// Presentation only. Call with two backend-confirmed snapshots, never a draft.
export function achievementEvents(before, after) {
  if (!before || !after || before.fingerprint !== after.fingerprint) return [];
  const events = [];
  const gains = Object.entries(after.attributes || {}).flatMap(([name, value]) => {
    const delta = Number(value) - Number(before.attributes?.[name]);
    return Number.isFinite(delta) && delta > 0 ? [{ name, delta }] : [];
  });
  const previousBosses = new Map((before.bossQuests || []).map(b => [String(b.id), b]));
  for (const boss of after.bossQuests || []) {
    // Newly hydrated historical victories are not new achievements.
    if (boss.status !== "COMPLETE" || previousBosses.get(String(boss.id))?.status !== "ACTIVE") continue;
    events.push({ id: `boss:${boss.id}`, kind: "BOSS", title: "BOSS DEFEATED", name: boss.name,
      description: boss.metadata?.weekly_plan?.benefit || "Your real-world effort has been recorded.",
      xp: Number(boss.xp) || 0, gains, level: Number(after.level), rank: getRank(after.level) });
  }
  if (Number(after.level) > Number(before.level)) {
    const ascension = Number(before.level) < 101 && Number(after.level) >= 101;
    const rankUp = getRank(after.level) !== getRank(before.level);
    events.push({ id: `level:${after.level}`, kind: ascension ? "ASCENSION" : rankUp ? "RANK" : "LEVEL",
      title: ascension ? "ASCENSION ACHIEVED" : rankUp ? "RANK ADVANCED" : "LEVEL ACHIEVED",
      name: ascension ? "LEVEL 101" : rankUp ? getRank(after.level) : `LEVEL ${after.level}`,
      description: "Your effort is becoming progress.", level: Number(after.level), rank: getRank(after.level),
      // A simultaneous boss card already shows these actual gains.
      gains: events.length ? [] : gains });
  }
  return events;
}

export function appendAchievements(queue, incoming, seen) {
  const ids = new Set([...seen, ...queue.map(event => event.id)]);
  return [...queue, ...incoming.filter(event => !ids.has(event.id) && ids.add(event.id))];
}
