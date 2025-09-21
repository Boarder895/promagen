import type { Request, Response, NextFunction } from "express";
import logger from "./logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.statusCode ?? 500;
  logger.error({ err, status, url: req.url, method: req.method }, "un-handled error");

  if (process.env.SLACK_WEBHOOK_URL && status >= 500) {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          `:rotating_light: *API ${status}* on \`${req.method} ${req.url}\` (region: ${process.env.FLY_REGION})\n` +
          "```" + (err?.stack ?? String(err)).slice(0, 1800) + "```"
      })
    }).catch(() => {});
  }

  res.status(status).json({ error: "Internal Server Error" });
}

import type { Request, Response, NextFunction } from "express";
import logger from "./logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.statusCode ?? 500;
  logger.error({ err, status, url: req.url, method: req.method }, "un-handled error");

  if (process.env.SLACK_WEBHOOK_URL && status >= 500) {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          `:rotating_light: *API ${status}* on \`${req.method} ${req.url}\` (region: ${process.env.FLY_REGION})\n` +
          "```" + (err?.stack ?? String(err)).slice(0, 1800) + "```"
      })
    }).catch(() => {});
  }

  res.status(status).json({ error: "Internal Server Error" });
}

