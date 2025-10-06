import { type Express } from "express";
import { prisma } from "../../db"; // <-- correct
import { ensureChecklist, recordEvent } from "../../lib/events"; // <-- correct

export const registerCiHookRoutes = (app: Express) => {
  app.post("/api/v1/hooks/ci", async (req, res) => {
    const { taskShortId, lintOk, testsOk, typesOk, url } = req.body || {};
    if (typeof taskShortId !== "number") return res.status(400).json({ error: "taskShortId required" });

    const task = await prisma.task.findUnique({ where: { shortId: taskShortId } });
    if (!task) return res.status(404).json({ error: "task not found" });

    await ensureChecklist(task.id, "lint passes", !!lintOk, "ci", url);
    await ensureChecklist(task.id, "tests pass", !!testsOk, "ci", url);
    await ensureChecklist(task.id, "types ok", !!typesOk, "ci", url);

    await recordEvent("ci_summary", "github_actions", { taskShortId, lintOk, testsOk, typesOk, url }, task.id);
    res.json({ ok: true });
  });
};
