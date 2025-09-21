// App Router API: /api/world-clocks
// Minimal, dependency-free fallback; tries to use '@/lib/sunrise' if available.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Clock = { city: string; tz: string; time: string };

function fallbackClocks(): Clock[] {
  const cities: Array<{ city: string; tz: string }> = [
    { city: 'London', tz: 'Europe/London' },
    { city: 'New York', tz: 'America/New_York' },
    { city: 'Dubai', tz: 'Asia/Dubai' },
    { city: 'Johannesburg', tz: 'Africa/Johannesburg' },
    { city: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
    { city: 'São Paulo', tz: 'America/Sao_Paulo' },
    { city: 'Paris', tz: 'Europe/Paris' },
    { city: 'Tokyo', tz: 'Asia/Tokyo' },
    { city: 'Shanghai', tz: 'Asia/Shanghai' },
    { city: 'Sydney', tz: 'Australia/Sydney' }
  ];

  return cities.map(({ city, tz }) => ({
    city,
    tz,
    time: new Date().toLocaleString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }));
}

export async function GET(_req: Request) {
  // Try optional project helper first; fall back gracefully if missing.
  try {
    // If your tsconfig has "paths": { "@/*": ["src/*"] }, this will resolve.
    const mod: any = await import('@/lib/sunrise').catch(() => null);
    if (mod?.buildWorldClocks) {
      const data = await mod.buildWorldClocks();
      return Response.json({ clocks: data }, { status: 200 });
    }
  } catch {
    // ignore and use fallback
  }

  return Response.json({ clocks: fallbackClocks() }, { status: 200 });
}
