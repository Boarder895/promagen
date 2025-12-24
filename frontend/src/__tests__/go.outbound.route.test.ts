/** @jest-environment node */
// C:\Users\Proma\Projects\promagen\frontend\src\__tests__\go.outbound.route.test.ts

// server-only throws under Jest because Jest doesn't resolve the `react-server` export condition.
// We still want the guard in real Next builds, so we stub it here.
jest.mock('server-only', () => ({}));

import type { NextRequest } from 'next/server';

describe('/go/[providerId] outbound redirect', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('buildGoHref generates a /go link with src (no sid in Node)', async () => {
    const { buildGoHref } = await import('@/lib/affiliate/outbound');

    // In Jest/Node, there is no window/localStorage, so sid is not attached.
    expect(buildGoHref('openai', 'leaderboard')).toBe('/go/openai?src=leaderboard');
  });

  test('returns 400 when src is missing', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'openai',
          name: 'OpenAI',
          website: 'https://openai.com',
          affiliateUrl: null,
        },
      ];
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request('https://promagen.local/go/openai') as unknown as NextRequest;
    const res = await GET(req, { params: { providerId: 'openai' } });

    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  test('returns 404 for unknown provider', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'known',
          name: 'Known',
          website: 'https://example.com',
          affiliateUrl: null,
        },
      ];
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request(
      'https://promagen.local/go/unknown?src=leaderboard',
    ) as unknown as NextRequest;
    const res = await GET(req, { params: { providerId: 'unknown' } });

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  test('prefers affiliateUrl when present and appends click_id + utm_source + utm_medium', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'openai',
          name: 'OpenAI',
          website: 'https://openai.com/dall-e',
          affiliateUrl: 'https://partner.example.com/r/openai',
          requiresDisclosure: true,
          // affiliate object is optional; default behaviour is enabled.
        },
      ];
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request(
      'https://promagen.local/go/openai?src=leaderboard',
      // no special headers needed for this test
    ) as unknown as NextRequest;

    const res = await GET(req, { params: { providerId: 'openai' } });

    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeTruthy();

    const url = new URL(location as string);

    expect(url.hostname).toBe('partner.example.com');

    const clickId = url.searchParams.get('click_id');
    expect(clickId).toBeTruthy();

    expect(url.searchParams.get('utm_source')).toBe('promagen');
    // By design: defaults to src unless utm_medium is explicitly passed.
    expect(url.searchParams.get('utm_medium')).toBe('leaderboard');
  });

  test('uses website when affiliateUrl is null; utm_medium defaults to src', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'lexica',
          name: 'Lexica',
          website: 'https://lexica.art',
          affiliateUrl: null,
          requiresDisclosure: false,
        },
      ];
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request(
      'https://promagen.local/go/lexica?src=provider_detail',
    ) as unknown as NextRequest;
    const res = await GET(req, { params: { providerId: 'lexica' } });

    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeTruthy();

    const url = new URL(location as string);

    expect(url.hostname).toBe('lexica.art');
    expect(url.searchParams.get('click_id')).toBeTruthy();
    expect(url.searchParams.get('utm_source')).toBe('promagen');
    expect(url.searchParams.get('utm_medium')).toBe('provider_detail');
  });

  test('accepts explicit utm_medium and does not override it', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'openart',
          name: 'OpenArt',
          website: 'https://openart.ai',
          affiliateUrl: null,
        },
      ];
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request(
      'https://promagen.local/go/openart?src=leaderboard&utm_medium=email',
    ) as unknown as NextRequest;

    const res = await GET(req, { params: { providerId: 'openart' } });

    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeTruthy();

    const url = new URL(location as string);
    expect(url.hostname).toBe('openart.ai');
    expect(url.searchParams.get('utm_medium')).toBe('email');
  });

  test('sets required redirect headers and does not set cookies', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'openart',
          name: 'OpenArt',
          website: 'https://openart.ai',
          affiliateUrl: null,
          requiresDisclosure: false,
        },
      ];
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request(
      'https://promagen.local/go/openart?src=leaderboard',
    ) as unknown as NextRequest;
    const res = await GET(req, { params: { providerId: 'openart' } });

    expect(res.status).toBe(302);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
