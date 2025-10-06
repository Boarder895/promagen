// app/api/admin/books/route.ts
import { NextResponse } from 'next/server';
import { mergeAndSave, type BooksPayload } from '@/lib/books/merge';

const ADMIN_HEADER = 'x-admin-token';

export async function GET() {
  const expected = process.env.ADMIN_TOKEN ?? '';
  const sample =
    expected.length > 0
      ? expected.charAt(0) + '***' + expected.charAt(expected.length - 1)
      : '';
  return NextResponse.json({
    ok: true,
    expected_env_len: expected.length,
    expected_sample: sample,
  });
}

export async function POST(req: Request) {
  const token = req.headers.get(ADMIN_HEADER) ?? '';
  const expected = process.env.ADMIN_TOKEN ?? '';
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const payload = (await req.json()) as BooksPayload;
  const result = await mergeAndSave(payload);
  return NextResponse.json({
    ok: true,
    lastUpdated: result.lastUpdated,
    counts: {
      users: result.users.length,
      developers: result.developers.length,
      history: result.history.length,
    },
  });
}

