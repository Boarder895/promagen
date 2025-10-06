// BACKEND · Express router for exporting the latest audit as CSV.
// Self-contained: no DB needed. It receives a getter for the "latestAudit" object.

import { Router } from "express";

type LatestAudit = Record<string, unknown> | null;

function toCsvRows(obj: Record<string, unknown>): string[] {
  const keys = Object.keys(obj);
  const vals = keys.map((k) => {
    const v = (obj as any)[k];
    const s =
      v === null || v === undefined
        ? ""
        : typeof v === "string" || typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : JSON.stringify(v);
    // Escape CSV cells by wrapping in quotes and doubling any quotes inside
    return `"${s.replace(/"/g, '""')}"`;
  });

  const header = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",");
  const row = vals.join(",");
  return [header, row];
}

export function makeAuditRouter(getLatestAudit: () => LatestAudit) {
  const r = Router();

  // GET /api/v1/audit/latest.csv
  r.get("/latest.csv", (_req, res) => {
    const latest = getLatestAudit();
    if (!latest || Object.keys(latest).length === 0) {
      return res.status(204).end();
    }
    const [header, row] = toCsvRows(latest as Record<string, unknown>);
    const csv = [header, row].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="latest-audit.csv"');
    return res.status(200).send(csv);
  });

  return r;
}

