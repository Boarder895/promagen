import { promises as fs } from "fs";
import path from "path";

type Counts = { likes: number; uses: number; remixes: number };
type Snapshot = Record<string, Counts>;

const DATA_DIR = process.env.DATA_DIR || "/data";
const FILE = path.join(DATA_DIR, "counters.json");

let db: Snapshot = {};
let loaded = false;
let saving = Promise.resolve();

async function ensureDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

export async function load(): Promise<void> {
  if (loaded) return;
  await ensureDir();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    db = JSON.parse(raw) as Snapshot;
  } catch {
    db = {};
  }
  loaded = true;
}

function scheduleSave() {
  saving = saving.then(async () => {
    try {
      await ensureDir();
      await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
    } catch {}
  });
}

function get(id: string): Counts {
  if (!db[id]) db[id] = { likes: 0, uses: 0, remixes: 0 };
  return db[id];
}

export async function init() { await load(); }

export function like(id: string) {
  const rec = get(id);
  rec.likes += 1;
  scheduleSave();
  return { id, ...rec };
}

export function useCount(id: string) {
  const rec = get(id);
  rec.uses += 1;
  scheduleSave();
  return { id, ...rec };
}

export function remix(id: string) {
  const rec = get(id);
  rec.remixes += 1;
  scheduleSave();
  return { id, ...rec };
}

export function snapshot(): Snapshot {
  return JSON.parse(JSON.stringify(db));
}
