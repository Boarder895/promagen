import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { providerId } = await req.json()
    if (!providerId) {
      return NextResponse.json({ ok: false, error: 'providerId required' }, { status: 400 })
    }

    // Stage 1: console log; Stage 2+: write to KV/DB/analytics
    console.info('[affiliate-click]', { providerId, at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[affiliate-click][error]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}





