// src/pages/api/cron/import.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // placeholder: we'll wire this to your master workbook importer later
  await prisma.$executeRaw`SELECT 1`;

  res.status(200).json({ ok: true, imported: 0 });
}
