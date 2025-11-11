#!/usr/bin/env node
// Smoke: ensure fx/pairs.json exists and every pair is well-formed.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PAIRS = "frontend/src/data/fx/pairs.json";

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}
function ok(msg) { console.log(`✅ ${msg}`); }

const p = path.resolve(process.cwd(), PAIRS);
if (!fs.existsSync(p)) fail(`Missing ${PAIRS}`);

let arr;
try {
  arr = JSON.parse(fs.readFileSync(p, "utf8"));
} catch (e) {
  fail(`Invalid JSON in ${PAIRS}: ${e.message}`);
}

if (!Array.isArray(arr)) fail("pairs.json must be a JSON array");

const problems = [];
for (const [i, pair] of arr.entries()) {
  const pathStr = `pairs[${i}]`;
  const required = ["id","base","quote","label","precision","demo"];
  for (const k of required) if (!(k in pair)) problems.push(`${pathStr}: missing "${k}"`);

  if (pair.id !== `${String(pair.base).toLowerCase()}-${String(pair.quote).toLowerCase()}`) {
    problems.push(`${pathStr}: id must be "${String(pair.base).toLowerCase()}-${String(pair.quote).toLowerCase()}"`);
  }
  if (typeof pair.precision !== "number") problems.push(`${pathStr}: precision must be number`);
  if (!pair.demo || typeof pair.demo.value !== "number" || typeof pair.demo.prevClose !== "number") {
    problems.push(`${pathStr}: demo.value and demo.prevClose must be numbers`);
  }
}

if (problems.length) {
  console.error("❌ FX pairs smoke failed:");
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}

ok("fx/pairs.json exists and all pairs are well-formed.");
