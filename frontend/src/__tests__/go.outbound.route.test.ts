// C:\Users\Proma\Projects\promagen\frontend\src\__tests__\go.outbound.route.test.ts

describe('/go/[providerId] outbound redirect', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('buildGoHref generates a /go link with src', async () => {
    const { buildGoHref } = await import('@/lib/affiliate/outbound');
    expect(buildGoHref('openai', 'leaderboard')).toBe('/go/openai?src=leaderboard');
  });

  test('returns 404 for unknown provider', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'known',
          name: 'Known',
          website: 'https://example.com',
          affiliateUrl: null,
          requiresDisclosure: false,
        },
      ];
    });

    jest.doMock('@/lib/kv', () => {
      return {
        __esModule: true,
        default: { set: jest.fn() },
      };
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request('https://promagen.local/go/unknown?src=leaderboard');
    const res = await GET(req, { params: { providerId: 'unknown' } });

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  test('prefers affiliateUrl when present and appends click_id + UTMs', async () => {
    jest.doMock('@/data/providers/providers.json', () => {
      return [
        {
          id: 'openai',
          name: 'OpenAI',
          website: 'https://openai.com/dall-e',
          affiliateUrl: 'https://partner.example.com/r/openai',
          requiresDisclosure: true,
        },
      ];
    });

    const kvSet = jest.fn();
    jest.doMock('@/lib/kv', () => {
      return {
        __esModule: true,
        default: { set: kvSet },
      };
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request('https://promagen.local/go/openai?src=leaderboard');
    const res = await GET(req, { params: { providerId: 'openai' } });

    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeTruthy();

    const url = new URL(location as string);
    expect(url.hostname).toBe('partner.example.com');
    expect(url.searchParams.get('click_id')).toBeTruthy();
    expect(url.searchParams.get('utm_source')).toBe('promagen');
    expect(url.searchParams.get('utm_medium')).toBe('affiliate');
    expect(url.searchParams.get('utm_campaign')).toBe('ai_providers_leaderboard');
    expect(url.searchParams.get('utm_content')).toBe('openai');

    // KV log key should equal click_id
    const clickId = url.searchParams.get('click_id') as string;
    expect(kvSet).toHaveBeenCalledTimes(1);
    expect(kvSet.mock.calls[0][0]).toBe('affiliate_click');
    expect(kvSet.mock.calls[0][1]).toBe(clickId);

    const record = kvSet.mock.calls[0][2] as any;
    expect(record.providerId).toBe('openai');
    expect(record.isAffiliate).toBe(true);
    expect(record.requiresDisclosure).toBe(true);
    expect(record.src).toBe('leaderboard');
  });

  test('uses website when affiliateUrl is null and sets medium=referral', async () => {
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

    const kvSet = jest.fn();
    jest.doMock('@/lib/kv', () => {
      return {
        __esModule: true,
        default: { set: kvSet },
      };
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request('https://promagen.local/go/lexica?src=provider_detail');
    const res = await GET(req, { params: { providerId: 'lexica' } });

    expect(res.status).toBe(302);

    const location = res.headers.get('location') as string;
    const url = new URL(location);
    expect(url.hostname).toBe('lexica.art');
    expect(url.searchParams.get('utm_medium')).toBe('referral');
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

    jest.doMock('@/lib/kv', () => {
      return {
        __esModule: true,
        default: { set: jest.fn() },
      };
    });

    const { GET } = await import('@/app/go/[providerId]/route');

    const req = new Request('https://promagen.local/go/openart?src=leaderboard');
    const res = await GET(req, { params: { providerId: 'openart' } });

    expect(res.status).toBe(302);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
