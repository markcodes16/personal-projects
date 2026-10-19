export type EventName = 'session_started' | 'round_started' | 'polarity_flipped' | 'run_crashed' | 'round_ended' | 'reward_offered' | 'reward_requested' | 'reward_granted';
export type PlayEvent = { id: string; name: EventName; at: string; session: string; round?: string; data: Record<string, string | number | boolean> };
const KEY = 'pocket-arcade.events.v1';
let fallback: PlayEvent[] = [];
let sessionId: string | undefined;
let sessionEnsured = false;

export function readEvents(): PlayEvent[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(stored)) return fallback;
    return stored.filter((e): e is PlayEvent => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.at === 'string' && !!e.data).slice(-5000);
  } catch { return fallback; }
}

export function track(name: EventName, data: PlayEvent['data'] = {}, round?: string) {
  if (!sessionId) {
    try {
      sessionId = sessionStorage.getItem('pocket-arcade.session') || crypto.randomUUID();
      sessionStorage.setItem('pocket-arcade.session', sessionId);
    } catch { sessionId = crypto.randomUUID(); }
  }
  const events = [...readEvents(), { id: crypto.randomUUID(), name, at: new Date().toISOString(), session: sessionId, round, data }];
  fallback = events.slice(-5000);
  try { localStorage.setItem(KEY, JSON.stringify(fallback)); } catch { /* Private browsing can still play. */ }
  window.dispatchEvent(new Event('arcade:metrics'));
}

export function ensureSession() {
  if (sessionEnsured) return;
  sessionEnsured = true;
  if (!readEvents().some(e => {
    try { return e.name === 'session_started' && e.session === sessionStorage.getItem('pocket-arcade.session'); }
    catch { return false; }
  })) track('session_started');
}

export function exportEvents() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, scope: 'this browser only', liveAds: false, events: readEvents() }, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pocket-arcade-play-events.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
