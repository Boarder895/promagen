// scripts/ensure-db.js
import fs from "fs";
import path from "path";

const dbUrl = process.env.DATABASE_URL || "";
// Only care about file-based SQLite URLs like: file:/data/dev.db or file:./dev.db
const m = dbUrl.match(/^file:(.+)$/);
if (!m) {
  console.log("[ensure-db] Non-file DATABASE_URL; nothing to create.");
  process.exit(0);
}

const dbPath = m[1];
const abs = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
const dir = path.dirname(abs);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[ensure-db] Created directory ${dir}`);
} else {
  console.log(`[ensure-db] Directory exists: ${dir}`);
}
