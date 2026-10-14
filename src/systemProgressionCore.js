// Display/forecast mirror of public.system_xp_required. Rewards and levels
// remain authoritative in PostgreSQL; this module never awards progression.
export function xpRequired(level) {
  return Math.max(10, Math.round(10 * Math.pow(Math.max(1, Number(level) || 1), 1.62)));
}

export function getRank(level) {
  if (level >= 81) return 'S-RANK';
  if (level >= 61) return 'A-RANK';
  if (level >= 41) return 'B-RANK';
  if (level >= 26) return 'C-RANK';
  if (level >= 11) return 'D-RANK';
  return 'E-RANK';
}
