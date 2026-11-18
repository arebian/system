export const DAILY_PILLAR_ORDER = ["DISCIPLINE", "PHYSICAL", "MENTAL"];

export function normalizeDailyPillarDirectives(command) {
  const source = Array.isArray(command?.pillar_directives)
    ? command.pillar_directives
    : [];

  return DAILY_PILLAR_ORDER.map((pillar) => {
    const directive = source.find(
      (item) => String(item?.pillar || item?.target_pillar || "").toUpperCase() === pillar
    );

    return {
      pillar,
      title: directive?.title || `${pillar} PILLAR`,
      objective: directive?.objective || "Waiting for the authoritative pillar quest to synchronize.",
      status: String(directive?.status || "SYNCING").toUpperCase(),
      xp: Math.max(0, Number(directive?.xp) || 0),
      completedMissions: Math.min(3, Math.max(0, Number(directive?.completed_missions) || 0)),
      totalMissions: 3,
      cement: Math.max(0, Number(directive?.cement) || 0),
      expiresAt: directive?.expires_at || null,
      questId: directive?.quest_id || null,
    };
  });
}
