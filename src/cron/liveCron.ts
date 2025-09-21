import cron from "node-cron";
import { runLiveUsageCollector } from "./collectors/liveUsage";
import { runSearchPulseCollector } from "./collectors/searchPulse";
import { runRedditMentionsCollector } from "./collectors/redditMentions";
import { computeLiveScores } from "../services/liveScoring";

async function tick() {
  try {
    await runLiveUsageCollector();
    await runSearchPulseCollector();
    await runRedditMentionsCollector();
    await computeLiveScores();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[liveCron] tick error", e);
  }
}

export function startLiveCron() {
  const expr = process.env.LIVE_COLLECTION_CRON || "*/1 * * * *"; // every minute
  cron.schedule(expr, tick, { timezone: "UTC" });
  // Kick once on boot to warm the board
  tick().catch(() => {});
}


