// src/lib/promptState.ts
// Local, privacy-friendly copy history for Stage-2.

const KEY = "pmg.copyHistory";
const CAP = 100;

export type CopyItem = {
  at: number;            // epoch ms
  providerId: string;
  providerName: string;
  prompt: string;
  promptStyle?: string;
};

function read(): CopyItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CopyItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: CopyItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-CAP)));
  } catch {
    /* ignore quota errors */
  }
}

export function pushCopyHistory(item: Omit<CopyItem, "at">) {
  const list = read();
  list.push({ at: Date.now(), ...item });
  write(list);
}

export function getCopyHistory(): CopyItem[] {
  return read();
}


