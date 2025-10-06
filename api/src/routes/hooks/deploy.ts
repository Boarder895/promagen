import { type Express } from "express";
import { recordEvent } from "../../lib/events"; // <-- correct
import { prisma } from "../../db"; // <-- correct

export const registerDeployHookRoutes = (app: Express) => {
  app.post("/api/v1/hooks/deploy", async (req, res) => {
    const { version, status, url } = req.body || {};
    await recordEvent("deploy", "fly", { version, status, url });
    res.json({ ok: true });
  });

  app.post("/api/v1/hooks/health", async (req, res) => {
    const { up, evidenceUrl } = req.body || {};
    if (up === true) {
      const open = await prisma.incident.findMany({ where: { status: "open" } });
      for (const inc of open) {
        await prisma.incident.update({ where: { id: inc.id }, data: { status: "resolved", resolvedAt: new Date() } });
      }
      await recordEvent("health_up", "uptime", { evidenceUrl });
    } else if (up === false) {
      await prisma.incident.create({ data: { status: "open", severity: "major", source: "uptime", evidenceUrl } });
      await recordEvent("health_down", "uptime", { evidenceUrl });
    }
    res.json({ ok: true });
  });
};
