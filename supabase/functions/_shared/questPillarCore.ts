export function expectedDailyPillarForQuestCategory(category: unknown): string | null {
  const normalized = String(category || "").trim().toUpperCase();
  if (normalized === "FOCUS") return "MENTAL";
  return ["DISCIPLINE", "PHYSICAL", "MENTAL"].includes(normalized) ? normalized : null;
}

export function questTasksMatchPillar(
  taskRows: Array<{ id?: unknown; pillar?: unknown }> | null | undefined,
  taskIds: string[],
  expectedPillar: string | null,
): boolean {
  if (!expectedPillar || !Array.isArray(taskRows) || !Array.isArray(taskIds)) return false;
  const requested = new Set(taskIds.map(String));
  const returned = new Set(taskRows.map(task => String(task.id || "")));
  return requested.size === taskIds.length
    && taskRows.length === taskIds.length
    && returned.size === requested.size
    && taskRows.every(task =>
      requested.has(String(task.id || "")) &&
      String(task.pillar || "").trim().toUpperCase() === expectedPillar
    );
}
