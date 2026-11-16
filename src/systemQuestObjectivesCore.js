const PILLARS = ["DISCIPLINE","PHYSICAL","INTELLECT","WEALTH","SOCIAL","MENTAL","SPIRITUAL"];
const DIFFICULTY_RANK = { EASY: 1, NORMAL: 2, HARD: 3, ELITE: 4 };

export function recommendQuestObjectives(tasks = [], identity = {}, profile = {}, limit = 3) {
  const primary = String(identity?.primary || "DISCIPLINE").toUpperCase();
  const secondary = Array.isArray(identity?.secondary)
    ? identity.secondary.map(value => String(value).toUpperCase())
    : [];
  const preferred = [...new Set(["PHYSICAL", "INTELLECT", primary, ...secondary, ...PILLARS])];

  const log = Array.isArray(profile?.questLog) ? profile.questLog : [];
  const recent = log.filter(item => {
    const date = new Date(item?.date || item?.verifiedAt || 0).getTime();
    return Number.isFinite(date) && Date.now() - date <= 7 * 86400000;
  });
  const completionRate = Number(profile?.recentCompletionRate ?? profile?.completionRate ?? 65);
  const targetRank = completionRate >= 85 && Number(profile?.level || 1) >= 5
    ? 3
    : completionRate < 45
      ? 1
      : 2;

  const candidates = (tasks || []).filter(task =>
    task?.id && task?.active !== false && DIFFICULTY_RANK[String(task.difficulty).toUpperCase()]
  );

  const chosen = [];
  const usedPillars = new Set();
  for (const pillar of preferred) {
    if (chosen.length >= limit) break;
    if (usedPillars.has(pillar)) continue;
    const matches = candidates
      .filter(task => String(task.pillar).toUpperCase() === pillar)
      .sort((a,b) => {
        const da = Math.abs(DIFFICULTY_RANK[String(a.difficulty).toUpperCase()] - targetRank);
        const db = Math.abs(DIFFICULTY_RANK[String(b.difficulty).toUpperCase()] - targetRank);
        return da - db || Number(a.duration_minutes || 0) - Number(b.duration_minutes || 0);
      });
    const task = matches.find(item => !recent.some(done =>
      String(done?.name || done?.title || "").toUpperCase() === String(item.title).toUpperCase()
    )) || matches[0];
    if (!task) continue;
    chosen.push({
      ...task,
      recommendationReason: pillar === primary
        ? "Aligned with your primary identity pillar."
        : pillar === "PHYSICAL" || pillar === "INTELLECT"
          ? "Maintains the No Zero Day foundation."
          : "Supports balanced development across your identity pillars.",
    });
    usedPillars.add(pillar);
  }

  return chosen;
}

export function objectiveProposalSummary(objectives = []) {
  const list = Array.isArray(objectives) ? objectives : [];
  return {
    total: list.length,
    accepted: list.filter(item => item.status === "ACCEPTED").length,
    proposed: list.filter(item => item.status === "PROPOSED").length,
    completed: list.filter(item => item.status === "COMPLETED").length,
    allAccepted: list.length > 0 && list.every(item => item.status === "ACCEPTED" || item.status === "COMPLETED"),
  };
}
