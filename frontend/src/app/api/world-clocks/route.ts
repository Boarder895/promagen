// BACKEND â€” NEXT.JS (API Route)
// frontend/app/api/world-clocks/route.ts
// Public JSON for world clocks. CORS enabled for simple GETs from WordPress.

import { NextResponse } from 'next/server';

export type WorldClockCity = {
  id: string;
  name: string;
  timeZone: string;
  lat: number;
  lon: number;
  flag?: string;
};

const CITIES: WorldClockCity[] = [
  {
    id: 'london',
    name: 'London',
    timeZone: 'Europe/London',
    lat: 51.5074,
    lon: -0.1278,
    flag: 'ðŸ‡¬ðŸ‡§',
  },
  {
    id: 'newyork',
    name: 'New York',
    timeZone: 'America/New_York',
    lat: 40.7128,
    lon: -74.006,
    flag: 'ðŸ‡ºðŸ‡¸',
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    timeZone: 'Asia/Shanghai',
    lat: 31.2304,
    lon: 121.4737,
    flag: 'ðŸ‡¨ðŸ‡³',
  },
  { id: 'tokyo', name: 'Tokyo', timeZone: 'Asia/Tokyo', lat: 35.6895, lon: 139.6917, flag: 'ðŸ‡¯ðŸ‡µ' },
  {
    id: 'sydney',
    name: 'Sydney',
    timeZone: 'Australia/Sydney',
    lat: -33.8688,
    lon: 151.2093,
    flag: 'ðŸ‡¦ðŸ‡º',
  },
  {
    id: 'buenosaires',
    name: 'Buenos Aires',
    timeZone: 'America/Argentina/Buenos_Aires',
    lat: -34.6037,
    lon: -58.3816,
    flag: 'ðŸ‡¦ðŸ‡·',
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    timeZone: 'Africa/Johannesburg',
    lat: -26.2041,
    lon: 28.0473,
    flag: 'ðŸ‡¿ðŸ‡¦',
  },
  { id: 'dubai', name: 'Dubai', timeZone: 'Asia/Dubai', lat: 25.2048, lon: 55.2708, flag: 'ðŸ‡¦ðŸ‡ª' }, // â† included
];

export async function GET() {
  const res = NextResponse.json({ cities: CITIES }, { status: 200 });
  // Public read-only; allow any origin to GET this JSON
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res;
}






