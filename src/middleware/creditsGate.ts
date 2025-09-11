// src/middleware/creditsGate.ts
import type { Request, Response, NextFunction } from "express";
import { canProceed } from "../lib/credits";

export function creditsGate(
  provider: string,
  estimate: (req: Request) => number = () => 1
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Adjust to your auth solution; fallback to header for local testing.
      const userId =
        (req as any).user?.id ??
        req.header("x-user-id");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
      }

      const estimatedCost = Math.max(1, estimate(req));
      const check = await canProceed({ userId, provider, estimatedCost });

      if (!check.ok) {
        if (check.reason === "INSUFFICIENT_CREDITS") {
          return res.status(402).json({
            ok: false,
            error: "INSUFFICIENT_CREDITS",
            balance: check.balance ?? 0,
          });
        }
        return res.status(400).json({ ok: false, error: check.reason });
      }

      (req as any).__creditMode = check.mode;
      (req as any).__creditEstimated = estimatedCost;
      (req as any).__userId = userId;

      next();
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: "CREDITS_GATE_ERROR",
        detail: err?.message,
      });
    }
  };
}
