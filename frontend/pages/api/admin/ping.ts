// FRONTEND · PAGES ROUTER
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const token = req.headers['x-admin-token']
  const expected = process.env.ADMIN_TOKEN

  // Header may be string | string[]
  const provided = Array.isArray(token) ? token[0] : token

  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  return res.status(200).json({ ok: true, pong: true })
}
