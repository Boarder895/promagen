/**
 * Rotates ADMIN_BEARER_TOKEN in ./frontend/.env.local and updates ADMIN_TOKEN_ROTATED_AT.
 * Prints the new token for you to copy into tools/scripts that call your admin endpoints.
 *
 * Usage: npm run rotate:admin
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const envPath = resolve(ROOT, ".env.local");

function upsertEnv(lines: string[], key: string, value: string) {
  const i = lines.findIndex(l => l.startsWith(`${key}=`));
  const line = `${key}=${value}`;
  if (i === -1) lines.unshift(line);
  else lines[i] = line;
}

function main() {
  if (!existsSync(envPath)) {
    // ensure file exists, and parent dir always does in Next.js projects
    writeFileSync(envPath, "", { encoding: "utf8" });
  }

  const raw = readFileSync(envPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .filter(l => l.trim().length > 0 && !l.trim().startsWith("#"));

  // Generate a 48-char URL-safe token
  const token = crypto.randomBytes(36).toString("base64url"); // ~48 chars
  const rotatedAt = new Date().toISOString();

  upsertEnv(lines, "ADMIN_BEARER_TOKEN", token);
  upsertEnv(lines, "ADMIN_TOKEN_ROTATED_AT", rotatedAt);

  // Keep IP allowlist if user already had it; otherwise preserve current contents
  const hasAllow = lines.some(l => l.startsWith("ADMIN_IP_ALLOWLIST="));
  if (!hasAllow) {
    lines.unshift("ADMIN_IP_ALLOWLIST=127.0.0.1,::1");
  }

  // Prepend a helpful header (do not duplicate)
  const header = [
    "# --- Admin auth ---",
    "# NOTE: rotate this with `npm run rotate:admin`",
  ].join("\n");

  // Remove any old header duplication
  const cleaned = lines.filter(
    l => l.trim() !== "# --- Admin auth ---" && !l.includes("rotate this with")
  );

  const finalBody = [header, ...cleaned, ""].join("\n");
  writeFileSync(envPath, finalBody, { encoding: "utf8" });

  // Print the new token for convenience
  console.log("\n✅ Admin token rotated.");
  console.log("New ADMIN_BEARER_TOKEN:\n");
  console.log(token, "\n");
  console.log(
    "Reminder: restart your Next.js server so the new env is loaded.\n" +
      "Example:\n  npm run dev -- -p 3002\n"
  );
}

main();






