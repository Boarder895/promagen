'use server';

import { apiFetch } from '@/lib/api';

export async function echoExample() {
  return apiFetch<{ ok: string }>('/v1/echo', {
    method: 'POST',
    json: { hello: 'world' },
  });
}
