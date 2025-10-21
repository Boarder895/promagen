#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";

/**
 * Promagen Books CLI
 * - Independent books (Users / Developers / History)
 * - Idempotent `dev --complete` (won't error if already done)
 * - Optional Slack webhook for history ticks via SLACK_WEBHOOK_URL in .env.local
 */

type Books = any;
const file = path.join(process.cwd(), "data", "books.json");
const args = process.argv.slice(2);
const webhook = process.env.SLACK_WEBHOOK_URL; // optional

function load(): Books {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function save(b: Books) {
  fs.writeFileSync(file, JSON.stringify(b, null, 2) + "\n", "utf-8");
}

function usage() {
  console.log(
`Usage:

  # USERS (public manual)
  node scripts/update-book.ts users --section <id> --status draft|in-review|done
  node scripts/update-book.ts users --section <id> --video https://youtu.be/ID
  node scripts/update-book.ts users --section <id> --owner <name> --eta YYYY-MM-DD

  # Users: checklist helpers
  node scripts/update-book.ts users --section <id> --add-check "Write rubric"
  node scripts/update-book.ts users --section <id> --check <checkId> --done true|false
  node scripts/update-book.ts users --section <id> --rm-check <checkId>

  # DEVELOPERS (your build tasks)
  node scripts/update-book.ts dev --complete <taskId>

  # HISTORY (day-to-day log)
  node scripts/update-book.ts history --add "Message" --status done --date YYYY-MM-DD

Notes:
- Wrap URLs/messages in single quotes in PowerShell:  'https://youtu.be/ID'
`
  );
}

async function postSlack(text: string) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
  } catch {
    // ignore webhook errors
  }
}

if (args.length === 0) {
  usage();
  process.exit(0);
}

const cmd = args[0];

/* ----------------------------- USERS COMMAND ----------------------------- */

if (cmd === "users") {
  const sIdx = args.indexOf("--section");
  if (sIdx === -1) throw new Error("Missing --section");
  const sectionId = args[sIdx + 1];

  const b = load();
  const sec = b.usersBook.sections.find((s: any) => s.id === sectionId);
  if (!sec) throw new Error("Section not found: " + sectionId);

  let touched = false;

  if (args.includes("--status")) {
    sec.status = args[args.indexOf("--status") + 1];
    touched = true;
    console.log(`Users: ${sectionId} status -> ${sec.status}`);
  }
  if (args.includes("--video")) {
    sec.videoUrl = args[args.indexOf("--video") + 1];
    touched = true;
    console.log(`Users: ${sectionId} video -> ${sec.videoUrl}`);
  }
  if (args.includes("--owner")) {
    sec.owner = args[args.indexOf("--owner") + 1];
    touched = true;
    console.log(`Users: ${sectionId} owner -> ${sec.owner}`);
  }
  if (args.includes("--eta")) {
    sec.eta = args[args.indexOf("--eta") + 1];
    touched = true;
    console.log(`Users: ${sectionId} ETA -> ${sec.eta}`);
  }

  // Checklist ops
  if (args.includes("--add-check")) {
    const text = args[args.indexOf("--add-check") + 1];
    const id =
      (sec.id.slice(0, 2) +
        "-" +
        text.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 24);
    sec.checklist = sec.checklist || [];
    sec.checklist.push({ id, text, done: false });
    touched = true;
    console.log(`Users: ${sectionId} checklist add -> ${id}`);
  }
  if (args.includes("--check")) {
    const id = args[args.indexOf("--check") + 1];
    const doneIdx = args.indexOf("--done");
    if (doneIdx === -1) throw new Error("Missing --done true|false");
    const doneVal = ["true", "1", "yes"].includes(
      args[doneIdx + 1].toLowerCase()
    );
    sec.checklist = sec.checklist || [];
    const item = sec.checklist.find((c: any) => c.id === id);
    if (!item) throw new Error("Checklist id not found: " + id);
    item.done = doneVal;
    touched = true;
    console.log(`Users: ${sectionId} checklist toggle -> ${id} = ${doneVal}`);
  }
  if (args.includes("--rm-check")) {
    const id = args[args.indexOf("--rm-check") + 1];
    sec.checklist = (sec.checklist || []).filter((c: any) => c.id !== id);
    touched = true;
    console.log(`Users: ${sectionId} checklist removed -> ${id}`);
  }

  if (touched) sec.lastUpdated = new Date().toISOString().slice(0, 10);
  save(b);
  process.exit(0);
}

/* --------------------------- DEVELOPERS COMMAND -------------------------- */

else if (cmd === "dev") {
  const cIdx = args.indexOf("--complete");
  if (cIdx === -1) throw new Error("Missing --complete");
  const id = args[cIdx + 1];

  const b = load();

  // Try to move from inProgress
  let idx = b.developers.inProgress.findIndex((s: any) => s.id === id);
  if (idx !== -1) {
    const item = b.developers.inProgress.splice(idx, 1)[0];
    item.completedAt = new Date().toISOString();
    b.developers.done.unshift(item);
    save(b);
    console.log(`Developers’ Book: completed ${id} (from inProgress)`);
    process.exit(0);
  }

  // Try to move from queued
  idx = b.developers.queued.findIndex((s: any) => s.id === id);
  if (idx !== -1) {
    const item = b.developers.queued.splice(idx, 1)[0];
    item.completedAt = new Date().toISOString();
    b.developers.done.unshift(item);
    save(b);
    console.log(`Developers’ Book: completed ${id} (from queued)`);
    process.exit(0);
  }

  // Already done?
  const already = b.developers.done.find((s: any) => s.id === id);
  if (already) {
    console.log(
      `Developers’ Book: ${id} is already done (${already.completedAt || "no timestamp"})`
    );
    process.exit(0);
  }

  // Not found anywhere
  throw new Error(
    "Task not found in inProgress, queued, or done: " + id
  );
}

/* ------------------------------ HISTORY COMMAND -------------------------- */

else if (cmd === "history") {
  const addIdx = args.indexOf("--add");
  if (addIdx === -1) throw new Error("Missing --add");
  const msg = args[addIdx + 1];
  const status =
    args.includes("--status") ? args[args.indexOf("--status") + 1] : "done";
  const date =
    args.includes("--date")
      ? args[args.indexOf("--date") + 1]
      : new Date().toISOString().slice(0, 10);

  const b = load();
  b.history.entries.unshift({ date, item: msg, status });
  save(b);
  console.log(`History added: [${date}] ${msg} — ${status}`);
  postSlack(`📘 ${msg} — ${status} (${date})`);
  process.exit(0);
}

/* ---------------------------------- FALLBACK ----------------------------- */

else {
  usage();
  process.exit(1);
}




