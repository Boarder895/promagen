import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function POST() {
  const data = await apiFetch<{ ok: string }>('/v1/echo', {
    method: 'POST',
    json: { hello: 'world' },
  });
  return NextResponse.json(data);
}
