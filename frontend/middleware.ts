// FRONTEND · Next.js root middleware (App/Pages compatible)
// - Admin guard: /api/admin/* requires X-Admin-Token header matching process.env.ADMIN_TOKEN
// - Same-origin guard: block cross-origin for mutating methods on /api/*
// - Allows: GETs from anywhere, CORS preflights (OPTIONS), static assets, _next/*

import { NextResponse, type NextRequest } from 'next/server'

/** Allow list of origins (exact + patterns) */
const EXACT_ALLOWED = new Set<string>([
  'https://promagen.com',
  'https://www.promagen.com',
  'https://app.promagen.com',
  'http://localhost:3000',
])

const PREVIEW_REGEX = /^https:\/\/.+\.vercel\.app$/i

function getOrigin(req: NextRequest): string | null {
  // Prefer Origin, fall back to Referer
  const origin = req.headers.get('origin')
  if (origin) return origin
  const ref = req.headers.get('referer')
  if (!ref) return null
  try {
    const u = new URL(ref)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (EXACT_ALLOWED.has(origin)) return true
  if (PREVIEW_REGEX.test(origin)) return true
  return false
}

function json(status: number, body: unknown) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method.toUpperCase()

  // Skip static & Next internals early (safety)
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/static/')
  ) {
    return NextResponse.next()
  }

  // Allow CORS preflight everywhere
  if (method === 'OPTIONS') {
    return NextResponse.next()
  }

  // 1) Admin guard for /api/admin/*
  if (pathname.startsWith('/api/admin/')) {
    const provided = req.headers.get('x-admin-token')
    const expected = process.env.ADMIN_TOKEN
    if (!expected || !provided || provided !== expected) {
      return json(401, { ok: false, error: 'Unauthorized (admin)' })
    }
    // If token good, continue
    return NextResponse.next()
  }

  // 2) Same-origin guard for mutating methods on /api/*
  if (pathname.startsWith('/api/')) {
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const origin = getOrigin(req)
      if (!isAllowedOrigin(origin)) {
        return json(403, { ok: false, error: 'Forbidden (cross-origin)' })
      }
    }
  }

  return NextResponse.next()
}

// Limit middleware to API only; exclude everything else for perf.
export const config = {
  matcher: ['/api/:path*'],
}


