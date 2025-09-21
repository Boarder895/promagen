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

async function load() {
  await ensureDir();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    db = JSON.parse(raw) as Snapshot;
  } catch {
    db = {};
  }
  loaded = true;
}

function enqueueSave() {
  // serialize writes to avoid clobbering
  saving = saving.then(async () => {
    const tmp = FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, FILE);
  }).catch(() => {});
  return saving;
}

export async function initCounters(
  seed: Array<{ id: string; likes: numberimport { promises as fs } from "fs";
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

async function load() {
  await ensureDir();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    db = JSON.parse(raw) as Snapshot;
  } catch {
    db = {};
  }
  loaded = true;
}

function enqueueSave() {
  // serialize writes to avoid clobbering
  saving = saving.then(async () => {
    const tmp = FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, FILE);
  }).catch(() => {});
  return saving;
}

export async function initCounters(
  seed: Array<{ id: string; likes: number; uses: number; remixes?: number }>
) {
  if (!loaded) await load();
  // merge seed defaults for any ids we haven't seen yet
  for (const s of seed) {
    if (!db[s.id]) {
      db[s.id] = {
        likes: s.likes ?? 0,
        uses: s.uses ?? 0,
        remixes: s.remixes ?? 0,
      };
    }
  }
  await enqueueSave();
}

export function getCounts(id: string): Counts {
  if (!db[id]) db[id] = { likes: 0, uses: 0, remixes: 0 };
  return db[id];
}

export async function incLike(id: string): Promise<Counts> {
  const c = getCounts(id);
  c.likes += 1;
  await enqueueSave();
  return c;
}

export async function incRemix(id: string): Promise<Counts> {
  const c = getCounts(id);
  c.uses += 1;
  c.remixes += 1;
  await enqueueSave();
  return c;
}

