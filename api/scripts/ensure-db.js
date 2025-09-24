// scripts/ensure-db.js
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL || "file:/data/dev.db";

function run(cmd) {
  console.log(`[ensure-db] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  // Make sure Prisma client is ready (harmless if already generated)
  run("npx prisma generate");

  // For SQLite, db push is the simplest way to ensure schema exists
  run(`npx prisma db push --skip-generate --accept-data-loss`);

  console.log(`[ensure-db] DB ready at ${url}`);
} catch (err) {
  console.error("[ensure-db] failed:", err?.message || err);
  process.exit(1);
}
