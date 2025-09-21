// src/middleware/adminAuth.ts
import type { Request, Response, NextFunction } from "express";

// Minimal admin guard using a shared header token.
// Rotate ADMIN_TOKEN and keep it only in .env.
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(500).json({ ok: false, error: "ADMIN_TOKEN_NOT_SET" });
  }
  if (!token || token !== expected) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }
  next();
}


