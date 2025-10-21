// frontend/src/app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { RibbonMarket, RibbonPayload, MarketStatus, ProviderTile } from '@/types/ribbon';
import ExchangeColumn from '@/components/markets/ExchangeColumn';
import ProviderTable from '@/components/providers/ProviderTable';

// Single source of truth for local provider data
import providersJson from '@/data/providers.json';

const HEARTBEAT_MS = 180_000;

/* ----------------------------- visuals: heart ----------------------------- */

function Heartline({ eastHue, westHue }: { eastHue: number; westHue: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.9, 0] }}
      transition={{ duration: 1.4, ease: 'easeOut' }}
      className="pointer-events-none absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 blur-[2px]"
      style={{
        background: `linear-gradient(90deg, hsl(${eastHue} 70% 55%), rgba(255,255,255,0.4), hsl(${westHue} 70% 55%))`,
        maskImage:
          'linear-gradient(90deg, transparent 0%, black 25%, black 75%, transparent 100%)',
      }}
      aria-hidden
    />
  );
}

function HeartOrb({ hue, strength }: { hue: number; strength: number }) {
  const controls = useAnimationControls();
  useEffect(() => {
    controls.start({
      scale: [0.9, 1 + strength * 0.06, 0.9],
      opacity: [0.25, 0.45 + strength * 0.2, 0.25],
      transition: { duration: 2.2, ease: 'easeOut' },
    });
  }, [strength, controls]);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0.25 }}
      animate={controls}
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background: `radial-gradient(40% 55% at 50% 50%, hsl(${hue} 70% 45% / 0.25), transparent 65%)`,
        filter: 'blur(18px)',
      }}
      aria-hidden
    />
  );
}

/* ------------------------------ data loaders ------------------------------ */

async function fetchRibbon(): Promise<RibbonPayload> {
  const res = await fetch('/api/ribbon', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load ribbon');
  return res.json() as Promise<RibbonPayload>;
}

/* ---------------------------------- page ---------------------------------- */

export default function HomePage() {
  const [data, setData] = useState<RibbonPayload | null>(null);

  useEffect(() => {
    fetchRibbon()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const markets: RibbonMarket[] = useMemo(() => data?.markets ?? [], [data]);

  // Fallback providers: use local JSON when API sends none
  const providers: ProviderTile[] = useMemo(() => {
    const api = data?.providers ?? [];
    if (api.length) return api as ProviderTile[];

    type ProviderJson = {
      id?: string;
      name?: string;
      displayName?: string;
      url?: string;
      website?: string;
      affiliateUrl?: string | null;
      tagline?: string;
    };

    const slug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const src = Array.isArray(providersJson) ? (providersJson as ProviderJson[]) : [];

    return src.map((p): ProviderTile => {
      const name = String(p.name ?? p.displayName ?? 'Unknown');
      const url = String(p.url ?? p.website ?? '#');
      const id = String(p.id ?? slug(name)); // required by ProviderTile

      return {
        id,
        name,
        url,
        affiliateUrl: p.affiliateUrl ?? undefined,
        tagline: p.tagline ?? undefined,
        score: 0,
        trend: 'flat', // ✅ match ProviderTile union ('flat' | 'up' | 'down')
      };
    });
  }, [data]); // <-- close map, then close useMemo

  /* ---------------------- temperature → hue helper funcs --------------------- */

  const tempOf = (m: RibbonMarket) => m.weather?.tempC ?? 12;
  const avg = (xs: RibbonMarket[]) =>
    xs.length ? xs.reduce((s, m) => s + tempOf(m), 0) / xs.length : 12;
  const toHue = (t: number) => {
    const min = -20,
      max = 40;
    const cl = Math.max(0, Math.min(1, (t - min) / (max - min)));
    return Math.round(220 + (10 - 220) * cl);
  };

  const east = markets
    .filter((m) => m.exchange.longitude > 0)
    .sort((a, b) => a.exchange.longitude - b.exchange.longitude);

  const west = markets
    .filter((m) => m.exchange.longitude <= 0)
    .sort((a, b) => a.exchange.longitude - b.exchange.longitude);

  const eastHue = toHue(avg(east));
  const westHue = toHue(avg(west));

  const status = (m: RibbonMarket): MarketStatus => m.state?.status ?? 'unknown';
  const openCount = markets.filter((d) => status(d) === 'open').length;
  const strength = markets.length ? openCount / markets.length : 0;
  const orbHue = Math.round((eastHue + westHue) / 2);

  const [beatKey, setBeatKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBeatKey((k) => k + 1), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-2xl px-6 py-8">
        <div className="relative grid grid-cols-[320px,1fr,320px] items-start gap-6">
          {/* Heartline + Orb */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
            <HeartOrb hue={orbHue} strength={strength} />
            <div key={beatKey}>
              <Heartline eastHue={eastHue} westHue={westHue} />
            </div>
          </div>

          {/* Left ribbon (East) */}
          <ExchangeColumn title="EASTERN MARKETS" items={east} />

          {/* Center: 10×2 provider table */}
          <div className="z-10 flex min-w-0 flex-col gap-3">
            <h1 className="text-center text-2xl font-semibold">AI Image-Generation Platforms</h1>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              <ProviderTable items={providers} title="TOP 20 • LIVE LEADERBOARD" />
            </div>
          </div>

          {/* Right ribbon (West) */}
          <ExchangeColumn title="WESTERN MARKETS" items={west} />
        </div>
      </div>
    </main>
  );
}










