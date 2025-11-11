const KEY = 'promagen.fxSelections.v1';

export function getUserFxSelections(): string[] | null {
  if (typeof window === 'undefined') {return null;}
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {return null;}
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 5) : null;
  } catch {
    return null;
  }
}

export function setUserFxSelections(ids: string[]) {
  if (typeof window === 'undefined') {return;}
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 5)));
  } catch {
    // no-op
  }
}
