import type { Request, Response, NextFunction } from "express";

export function metricsHandler(_req: Request, res: Response, _next: NextFunction) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send("# metrics temporarily disabled\n");
}



