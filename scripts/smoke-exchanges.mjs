// scripts/smoke-exchanges.mjs
// Robust smoke: ensures exchanges in catalog have hoursTemplate + holidaysRef,
// and that each holidaysRef exists in the holiday bundle.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---- Paths (presence check only for templates/bundle) ----
const CATALOG = "frontend/src/data/exchanges.catalog.json";
const TEMPLATES = "frontend/src/data/market-hours.templates.json";
const BUNDLE = "frontend/src/data/market-holidays.bundle.free(tpl).json"; // adjust name if yours differs

// ---- Your selected rail (kept as before; edit to your exact ids) ----
const REQUIRED_IDS = [
  "tse-tokyo",
  "hkex-hong-kong",
  "nse-mumbai",
  "dfm-dubai",
  "lse-london",
  "cboe-chicago",
  "tsx-toronto",
  "b3-sao-paulo"
];

// ---- Helpers ----
function readJsonClean(rel) {
  const p = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(p)) fail(`Missing file: ${rel}`);
  try {
    let raw = fs.readFileSync(p, "utf8");
    // strip UTF-8 BOM + common zero-width chars
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    raw = raw.replace(/^[\uFEFF\u200B\u200C\u200D]+/, "");
    return JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in ${rel}: ${e.message}`);
  }
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(2);
}
function ok(msg) {
  console.log("✓", msg);
}

// ---- Load data ----
const catalog = readJsonClean(CATALOG);

// presence only (these files can be stubs)
if (!fs.existsSync(TEMPLATES)) fail(`Missing ${TEMPLATES}`);
if (!fs.existsSync(BUNDLE)) fail(`Missing ${BUNDLE}`);

const bundle = readJsonClean(BUNDLE);
const bundleKeys = new Set(Object.keys(bundle || {}));

// ---- Checks ----
const idToRow = new Map();
for (const row of catalog) {
  if (!row || typeof row !== "object") continue;
  if (typeof row.id !== "string" || !row.id.trim()) continue;
  idToRow.set(row.id.trim(), row);
}

const problems = [];

// Require your chosen IDs to exist
for (const id of REQUIRED_IDS) {
  if (!idToRow.has(id)) problems.push(`Exchange not found in catalog: ${id}`);
}

for (const [id, row] of idToRow.entries()) {
  if (row.hoursTemplate == null || typeof row.hoursTemplate !== "string" || !row.hoursTemplate.trim()) {
    problems.push(`hoursTemplate missing/invalid for "${id}"`);
  }
  if (row.holidaysRef == null || typeof row.holidaysRef !== "string" || !row.holidaysRef.trim()) {
    problems.push(`holidaysRef missing/invalid for "${id}"`);
  } else if (!bundleKeys.has(row.holidaysRef)) {
    problems.push(`Holiday bundle has no entry for holidaysRef "${row.holidaysRef}" (${id})`);
  }
}

if (problems.length) {
  console.error("❌ Smoke failed:");
  for (const p of problems) console.error(" -", p);
  process.exit(1);
}

ok("All required exchanges have hoursTemplate + holidaysRef, and holiday bundle matches.");
