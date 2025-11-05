export type CopyMeta = {
  providerId: string;
  providerName: string;
  promptStyle?: string;
  prompt: string;
  ts: number;
};

const SESSION_KEY = (id: string) => `pmg.designer.${id}.prompt`;
const LAST_PROVIDER = 'pmg.lastProvider';
const HISTORY = 'pmg.promptHistory';

export function storePromptSession(prompt: string, providerId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY(providerId), prompt);
  localStorage.setItem(LAST_PROVIDER, JSON.stringify({ providerId, ts: Date.now() }));
}

export function getLastPrompt(): { prompt: string; providerId: string } | null {
  if (typeof window === 'undefined') return null;
  const rawId = localStorage.getItem(LAST_PROVIDER);
  const obj = rawId ? (JSON.parse(rawId) as { providerId: string }) : null;
  const pid = obj?.providerId ?? sessionStorage.getItem('last-provider') ?? '';
  const prompt = sessionStorage.getItem(SESSION_KEY(pid)) ?? sessionStorage.getItem('last-prompt') ?? '';
  if (prompt && pid) return { prompt, providerId: pid };
  return null;
}

export function getLastProvider(withinMinutes = 15): { providerId: string; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_PROVIDER);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { providerId: string; ts: number };
    if (Date.now() - obj.ts <= withinMinutes * 60_000) return obj;
    return null;
  } catch {
    return null;
  }
}

export function pushCopyHistory(entry: CopyMeta) {
  if (typeof window === 'undefined') return;
  const list = getCopyHistory();
  const next = [entry, ...list].slice(0, 3);
  localStorage.setItem(HISTORY, JSON.stringify(next));
}

export function getCopyHistory(): CopyMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY);
    return raw ? (JSON.parse(raw) as CopyMeta[]) : [];
  } catch {
    return [];
  }
}




