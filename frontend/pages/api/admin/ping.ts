// pages/api/admin/ping.ts  (Next.js Pages Router)
//
// Returns 200 JSON if X-Admin-Token matches process.env.ADMIN_TOKEN.
// Otherwise 401 JSON. Method: GET (idempotent “ping”).

import type { NextApiRequest, NextApiResponse } from 'next'

type Data =
  | { ok: true; pong: true; ts: string }
  | { ok: false; error: string }

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'Server not configured (ADMIN_TOKEN missing)' })
  }

  const provided = (req.headers['x-admin-token'] || req.headers['X-Admin-Token']) as string | undefined
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  return res.status(200).json({ ok: true, pong: true, ts: new Date().toISOString() })
}
