export type RunResult = { id: string; distance: number; score: number; coins: number; flips: number; seconds: number; mode: 'endless' | 'daily'; rescued: boolean; at: string };
export type PlayerData = { bestDistance: number; bestScore: number; totalRuns: number; totalCoins: number; sound: boolean; recent: RunResult[] };
const KEY = 'magnet-dash.player.v1';
const initial: PlayerData = { bestDistance: 0, bestScore: 0, totalRuns: 0, totalCoins: 0, sound: false, recent: [] };

export function loadPlayer(): PlayerData {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data || typeof data !== 'object') return { ...initial };
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
    return { bestDistance: number(data.bestDistance), bestScore: number(data.bestScore), totalRuns: number(data.totalRuns), totalCoins: number(data.totalCoins), sound: data.sound === true,
      recent: Array.isArray(data.recent) ? data.recent.filter((r: RunResult) => r && typeof r.id === 'string' && Number.isFinite(r.distance)).slice(0, 8) : [] };
  } catch { return { ...initial }; }
}

export function savePlayer(player: PlayerData) {
  try { localStorage.setItem(KEY, JSON.stringify(player)); } catch { /* The game remains usable without browser storage. */ }
}

export function recordRun(player: PlayerData, run: RunResult): PlayerData {
  // A revived run updates the same record; it does not count as a new round.
  const existing = player.recent.find(r => r.id === run.id);
  return { ...player, bestDistance: Math.max(player.bestDistance, run.distance), bestScore: Math.max(player.bestScore, run.score),
    totalRuns: player.totalRuns + (existing ? 0 : 1), totalCoins: player.totalCoins + run.coins - (existing?.coins ?? 0),
    recent: [run, ...player.recent.filter(r => r.id !== run.id)].slice(0, 8) };
}
