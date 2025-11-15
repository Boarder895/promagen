// Waits for a URL to respond with 2xx/3xx before proceeding (used in CI).
// Usage: node scripts/server-wait.mjs http://localhost:3000 120000
const url = process.argv[2] || "http://localhost:3000";
const timeoutMs = Number(process.argv[3] || 120000);

const until = Date.now() + timeoutMs;

async function ping() {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

(async () => {
  process.stdout.write(`[wait] Waiting for ${url} ...\n`);

  while (Date.now() < until) {
    const ok = await ping();
    if (ok) {
      process.stdout.write("[wait] Server is up.\n");
      process.exit(0);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.error(`[wait] Timed out after ${timeoutMs}ms`);
  process.exit(1);
})();
