// BACKEND — NEXT.JS (API Route)
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
    flag: '🇬🇧',
  },
  {
    id: 'newyork',
    name: 'New York',
    timeZone: 'America/New_York',
    lat: 40.7128,
    lon: -74.006,
    flag: '🇺🇸',
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    timeZone: 'Asia/Shanghai',
    lat: 31.2304,
    lon: 121.4737,
    flag: '🇨🇳',
  },
  { id: 'tokyo', name: 'Tokyo', timeZone: 'Asia/Tokyo', lat: 35.6895, lon: 139.6917, flag: '🇯🇵' },
  {
    id: 'sydney',
    name: 'Sydney',
    timeZone: 'Australia/Sydney',
    lat: -33.8688,
    lon: 151.2093,
    flag: '🇦🇺',
  },
  {
    id: 'buenosaires',
    name: 'Buenos Aires',
    timeZone: 'America/Argentina/Buenos_Aires',
    lat: -34.6037,
    lon: -58.3816,
    flag: '🇦🇷',
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    timeZone: 'Africa/Johannesburg',
    lat: -26.2041,
    lon: 28.0473,
    flag: '🇿🇦',
  },
  { id: 'dubai', name: 'Dubai', timeZone: 'Asia/Dubai', lat: 25.2048, lon: 55.2708, flag: '🇦🇪' }, // ← included
];

export async function GET() {
  const res = NextResponse.json({ cities: CITIES }, { status: 200 });
  // Public read-only; allow any origin to GET this JSON
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res;
}






