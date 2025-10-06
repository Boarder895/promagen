// src/lib/books/merge.ts
// Named exports only.

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';

export type Status = 'done' | 'in-progress' | 'todo';

export type BookEntry = {
  date: string;
  title: string;
  body: string;
  tags?: string[];
  status?: Status;
};

export type BooksPayload = {
  users?: BookEntry[];
  developers?: BookEntry[];
  history?: BookEntry[];
  meta?: { actor?: string; source?: string };
};

export type BooksStore = {
  lastUpdated: string;
  users: BookEntry[];
  developers: BookEntry[];
  history: BookEntry[];
};

// Always resolve under the repo root, not the built file location
const DATA_DIR = join(process.cwd(), 'data', 'books');
const USERS_PATH = join(DATA_DIR, 'users.json');
const DEVS_PATH = join(DATA_DIR, 'developers.json');
const HISTORY_PATH = join(DATA_DIR, 'history.json');
const STATE_PATH = join(DATA_DIR, 'state.json');

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(p: string, data: T) {
  await ensureDir(dirname(p));
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

function dedupe(entries: BookEntry[]): BookEntry[] {
  const map = new Map<string, BookEntry>();
  for (const e of entries) {
    const key = `${e.date}::${e.title}`.toLowerCase();
    map.set(key, e);
  }
  return Array.from(map.values());
}

function normalize(e: BookEntry): BookEntry {
  const d = new Date(e.date);
  const dateOnly = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  return {
    date: dateOnly,
    title: e.title.trim(),
    body: e.body.trim(),
    tags: e.tags?.map(t => t.trim()).filter(Boolean),
    status: e.status ?? 'done',
  };
}

export async function loadStore(): Promise<BooksStore> {
  await ensureDir(DATA_DIR);
  const users = await readJson<BookEntry[]>(USERS_PATH, []);
  const developers = await readJson<BookEntry[]>(DEVS_PATH, []);
  const history = await readJson<BookEntry[]>(HISTORY_PATH, []);
  const state = await readJson<{ lastUpdated?: string }>(STATE_PATH, {});
  return {
    lastUpdated: state.lastUpdated ?? new Date().toISOString(),
    users,
    developers,
    history,
  };
}

export async function mergeAndSave(payload: BooksPayload): Promise<BooksStore> {
  const store = await loadStore();

  const nextUsers = payload.users?.map(normalize) ?? [];
  const nextDevs = payload.developers?.map(normalize) ?? [];
  const nextHistory = payload.history?.map(normalize) ?? [];

  const mergedUsers = dedupe([...store.users, ...nextUsers]).sort((a, b) => a.date.localeCompare(b.date));
  const mergedDevs = dedupe([...store.developers, ...nextDevs]).sort((a, b) => a.date.localeCompare(b.date));
  const mergedHistory = dedupe([...store.history, ...nextHistory]).sort((a, b) => a.date.localeCompare(b.date));

  const nowIso = new Date().toISOString();
  await writeJson(USERS_PATH, mergedUsers);
  await writeJson(DEVS_PATH, mergedDevs);
  await writeJson(HISTORY_PATH, mergedHistory);
  await writeJson(STATE_PATH, { lastUpdated: nowIso, meta: payload.meta ?? {} });

  return {
    lastUpdated: nowIso,
    users: mergedUsers,
    developers: mergedDevs,
    history: mergedHistory,
  };
}


