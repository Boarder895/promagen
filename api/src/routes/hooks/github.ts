import { type Express } from "express";
import { prisma } from "../../db"; // <-- correct (hooks/ -> ../../db.ts)
import { recordEvent, setTaskStatusByShortId } from "../../lib/events"; // <-- correct
import { extractTaskShortIds } from "../../lib/utils"; // <-- correct

export const registerGithubHookRoutes = (app: Express) => {
  app.post("/api/v1/hooks/github", async (req, res) => {
    const event = req.header("X-GitHub-Event") || "unknown";
    const body = req.body || {};

    if (event === "push" && body.head_commit) {
      const text = `${body.head_commit.message}\n${(body.commits || []).map((c: any) => c.message).join("\n")}`;
      const ids = extractTaskShortIds(text);
      for (const sid of ids) await setTaskStatusByShortId(sid, "doing");
      await recordEvent("push", "github", body);
    }

    if (event === "pull_request" && body.pull_request) {
      const pr = body.pull_request;
      const text = `${pr.title}\n${pr.body || ""}`;
      const ids = extractTaskShortIds(text);

      if (pr.state === "open") {
        for (const sid of ids) await setTaskStatusByShortId(sid, "doing");
        await recordEvent("pr_opened", "github", { number: pr.number, title: pr.title, url: pr.html_url });
      }

      if (pr.merged === true || (pr.state === "closed" && pr.merge_commit_sha)) {
        for (const sid of ids) await setTaskStatusByShortId(sid, "done");
        await recordEvent("pr_merged", "github", { number: pr.number, title: pr.title, url: pr.html_url });
      }
    }

    res.json({ ok: true });
  });
};
