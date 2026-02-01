// scripts/holiday-detector.mjs
// Verifies that for each exchange we can resolve hoursTemplate + holidaysRef
// using the two data files. It doesn't judge holiday logic, just that keys resolve.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CATALOG = "frontend/src/data/exchanges.catalog.json";
const TEMPLATES = "frontend/src/data/market-hours.templates.json";
const BUNDLE = "frontend/src/data/market-holidays.bundle.free(tpl).json";

function readJsonClean(rel) {
  const p = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(p)) fail(`Missing ${rel}`);
  const raw = fs.readFileSync(p, "utf8").replace(/^[\uFEFF\u200B\u200C\u200D]+/, "");
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in ${rel}: ${e.message}`);
  }
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(2);
}

const cat = readJsonClean(CATALOG);
const tpl = readJsonClean(TEMPLATES);
const hol = readJsonClean(BUNDLE);

const tplKeys = new Set(Object.keys(tpl.templates ?? tpl));
const holKeys = new Set(Object.keys(hol ?? {}));

const problems = [];
for (const row of cat) {
  const id = row?.id;
  if (!id) continue;
  const t = String(row.hoursTemplate ?? "").trim();
  const h = String(row.holidaysRef ?? "").trim();
  if (!t || !tplKeys.has(t)) problems.push(`hoursTemplate missing/unknown for "${id}" -> "${t}"`);
  if (!h || !holKeys.has(h)) problems.push(`holidaysRef missing/unknown for "${id}" -> "${h}"`);
}

if (problems.length) {
  console.error("❌ holiday-detector failed:");
  for (const p of problems) console.error(" -", p);
  process.exit(1);
}

console.log("✅ holiday-detector: all exchanges resolve hoursTemplate + holidaysRef");
