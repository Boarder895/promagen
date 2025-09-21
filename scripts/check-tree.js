// Run: node scripts/check-tree.js
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd().replace(/\\/g, "/");

// If expected-files.txt exists, use it; otherwise use the built-in list.
const expectedFromFile = (() => {
  const p = path.join(ROOT, "expected-files.txt");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean) : null;
})();

const EXPECTED = expectedFromFile ?? [
  "src/server.ts",
  "src/routes/images.ts",
  "src/providers/types.ts",
  "src/providers/registry.ts",

  // API providers
  "src/providers/api/openai.ts",
  "src/providers/api/stability.ts",
  "src/providers/api/leonardo.ts",
  "src/providers/api/deepai.ts",
  "src/providers/api/google_vertex.ts",
  "src/providers/api/lexica.ts",
  "src/providers/api/novelai.ts",
  "src/providers/api/edenai.ts",
  "src/providers/api/runware.ts",
  "src/providers/api/hive.ts",
  "src/providers/api/recraft.ts",
  "src/providers/api/flux_bfl.ts",
  "src/providers/api/picsart.ts",

  // Copy-paste providers
  "src/providers/copypaste/midjourney.ts",
  "src/providers/copypaste/canva.ts",
  "src/providers/copypaste/firefly.ts",
  "src/providers/copypaste/bing.ts",
  "src/providers/copypaste/nightcafe.ts",
  "src/providers/copypaste/pixlr.ts",
  "src/providers/copypaste/fotor.ts",
  "src/providers/copypaste/a123rf.ts",
  "src/providers/copypaste/artistly.ts",
  "src/providers/copypaste/openart.ts",
  "src/providers/copypaste/myedit.ts",
  "src/providers/copypaste/wombo.ts",
  "src/providers/copypaste/starryai.ts",
  "src/providers/copypaste/craiyon.ts",

  // Scripts & tests & envs
  "scripts/scaffold-providers.js",
  ".env",
  ".env.example",
  "test/providers.conformance.test.ts",
];

// Walk repo for actual files of interest
function listFiles(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...listFiles(full));
    else out.push(full.replace(/\\/g, "/").replace(ROOT + "/", ""));
  }
  return out;
}

// Only compare files we care about (ts in src; the 3 extras explicitly)
function filtered(files) {
  return files.filter(f =>
    f.startsWith("src/providers/") ||
    f === "src/server.ts" ||
    f === "src/routes/images.ts" ||
    f === ".env" ||
    f === ".env.example" ||
    f === "scripts/scaffold-providers.js" ||
    f === "test/providers.conformance.test.ts"
  );
}

const ACTUAL_ALL = listFiles(ROOT);
const ACTUAL = filtered(ACTUAL_ALL);

// Compute sets
const expSet = new Set(EXPECTED.map(n => n.replace(/\\/g, "/")));
const actSet = new Set(ACTUAL.map(n => n.replace(/\\/g, "/")));

const missing = [...expSet].filter(x => !actSet.has(x)).sort();
const unexpected = [...actSet].filter(x => !expSet.has(x)).sort();

// Output
function header(t){ console.log("\n" + t); }
function list(arr){ if(arr.length===0){ console.log("  (none)"); } else arr.forEach(x=>console.log("  - " + x)); }

console.log("✅ Comparing expected vs actual in:", ROOT);
header("Expected count: " + EXPECTED.length);
header("Actual (filtered) count: " + ACTUAL.length);

header("Missing files:");
list(missing);

header("Unexpected files (present but not in expected list):");
list(unexpected);

// Exit code helps in CI
if (missing.length || unexpected.length) process.exit(1);


