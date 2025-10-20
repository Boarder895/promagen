'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Canonical 12: East (left) and West (right)
 * Left:  Sydney, Tokyo, Hong Kong, Singapore, Mumbai, Dubai
 * Right: Frankfurt, London, Moscow, New York, Toronto, São Paulo
 */
type MarketCapsule = {
  id: string;
  city: string;
  exchange: string;
  indexName: string;
  tz: string;         // IANA tz
  iso2: string;       // ISO-2 for flag asset in /public/flags/<ISO2>.svg
  tempC?: number;
  weather?: 'sun' | 'cloud' | 'rain' | 'snow' | 'fog';
  open?: boolean;
  last?: number;
  prevClose?: number;
};

const EAST: MarketCapsule[] = [
  { id: 'sydney',   city: 'Sydney',    exchange: 'ASX',            indexName: 'ASX 200',        tz: 'Australia/Sydney', iso2: 'AU' },
  { id: 'tokyo',    city: 'Tokyo',     exchange: 'TSE',            indexName: 'Nikkei 225',     tz: 'Asia/Tokyo',       iso2: 'JP' },
  { id: 'hongkong', city: 'Hong Kong', exchange: 'HKEX',           indexName: 'Hang Seng',      tz: 'Asia/Hong_Kong',   iso2: 'HK' },
  { id: 'singapore',city: 'Singapore', exchange: 'SGX',            indexName: 'Straits Times',  tz: 'Asia/Singapore',   iso2: 'SG' },
  { id: 'mumbai',   city: 'Mumbai',    exchange: 'NSE / BSE',      indexName: 'Nifty 50',       tz: 'Asia/Kolkata',     iso2: 'IN' },
  { id: 'dubai',    city: 'Dubai',     exchange: 'DFM',            indexName: 'DFM General',    tz: 'Asia/Dubai',       iso2: 'AE' },
];

const WEST: MarketCapsule[] = [
  { id: 'frankfurt',city: 'Frankfurt', exchange: 'FWB / DAX',      indexName: 'DAX',            tz: 'Europe/Berlin',    iso2: 'DE' },
  { id: 'london',   city: 'London',    exchange: 'LSE',            indexName: 'FTSE 100',       tz: 'Europe/London',    iso2: 'GB' },
  { id: 'moscow',   city: 'Moscow',    exchange: 'MOEX',           indexName: 'MOEX Russia',    tz: 'Europe/Moscow',    iso2: 'RU' },
  { id: 'newyork',  city: 'New York',  exchange: 'NYSE / NASDAQ',  indexName: 'S&P 500',        tz: 'America/New_York', iso2: 'US' },
  { id: 'toronto',  city: 'Toronto',   exchange: 'TSX',            indexName: 'S&P/TSX Comp.',  tz: 'America/Toronto',  iso2: 'CA' },
  { id: 'saopaulo', city: 'São Paulo', exchange: 'B3',             indexName: 'Ibovespa',       tz: 'America/Sao_Paulo',iso2: 'BR' },
];

/** Canonical 20 AI providers (10×2 table-ish grid) */
type Provider = { id: string; name: string; tagline: string; website: string; affiliateUrl?: string };
const PROVIDERS: Provider[] = [
  { id:'openai',     name:'OpenAI DALL·E / GPT-Image', tagline:'Blueprints of imagination, priced by attention.', website:'https://openai.com/dall-e' },
  { id:'stability',  name:'Stability AI / Stable Diffusion',     tagline:'Diffusing light and liquidity across every canvas.', website:'https://stability.ai' },
  { id:'leonardo',   name:'Leonardo AI',                          tagline:'High-speed creativity with studio-grade control.',  website:'https://leonardo.ai' },
  { id:'i23rf',      name:'I23RF AI Generator',                   tagline:'Stock-grade imagery meets real-world licensing.',    website:'https://www.123rf.com/ai' },
  { id:'artistly',   name:'Artistly',                             tagline:'One-sentence prompts that trade like ideas.',        website:'https://artistly.ai' },
  { id:'firefly',    name:'Adobe Firefly',                        tagline:'Enterprise-calm, gallery-bold.',                     website:'https://www.adobe.com/products/firefly.html' },
  { id:'midjourney', name:'Midjourney',                           tagline:'Where creative futures are traded in dreams.',       website:'https://www.midjourney.com' },
  { id:'canva',      name:'Canva Text-to-Image',                  tagline:'Design flows like liquidity.',                       website:'https://www.canva.com' },
  { id:'bing',       name:'Bing Image Creator',                   tagline:'Daily boosts, instant vibes.',                       website:'https://www.bing.com/images/create' },
  { id:'ideogram',   name:'Ideogram',                             tagline:'Typography that rallies like a market open.',        website:'https://ideogram.ai' },
  { id:'picsart',    name:'Picsart',                              tagline:'Social-native creativity with production polish.',   website:'https://picsart.com' },
  { id:'fotor',      name:'Fotor',                                tagline:'Quick wins, polished finishes.',                     website:'https://www.fotor.com' },
  { id:'nightcafe',  name:'NightCafe',                            tagline:'Community heat, gallery shine.',                     website:'https://creator.nightcafe.studio' },
  { id:'playground', name:'Playground AI',                        tagline:'Fast riffs, pro controls.',                          website:'https://playgroundai.com' },
  { id:'pixlr',      name:'Pixlr',                                tagline:'Lightweight edits at market speed.',                 website:'https://pixlr.com' },
  { id:'deepai',     name:'DeepAI',                               tagline:'Developer-simple, instantly integrated.',            website:'https://deepai.org' },
  { id:'novelai',    name:'NovelAI',                              tagline:'Stories and scenes with a novelist’s cadence.',      website:'https://novelai.net' },
  { id:'lexica',     name:'Lexica',                               tagline:'Search, sample, and sprint to a look.',              website:'https://lexica.art' },
  { id:'openart',    name:'OpenArt',                              tagline:'Discover, remix, and run across models.',            website:'https://openart.ai' },
  { id:'flux',       name:'Flux Schnell',                         tagline:'Latency low, ideas high-frequency.',                 website:'https://flux.dev' },
];

function WeatherGlyph({ kind }: { kind?: MarketCapsule['weather'] }) {
  const m: Record<string, string> = { sun:'☀️', cloud:'⛅', rain:'🌧️', snow:'❄️', fog:'🌫️' };
  return <span className="text-base">{m[kind ?? 'cloud']}</span>;
}

function MarketCard({ m }: { m: MarketCapsule }) {
  const temp = m.tempC ?? 18;
  const open = m.open ?? false;
  const last = m.last ?? 3265.4;
  const prev = m.prevClose ?? 3250.0;
  const delta = last - prev;
  const pct = (delta / prev) * 100;

  return (
    <div
      className={[
        'rounded-2xl border p-3 md:p-4',
        'border-white/10 bg-white/5',
        open ? 'ring-1 ring-cyan-300/25' : 'opacity-90',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img
            src={`/flags/${m.iso2}.svg`}
            alt={`${m.city} flag`}
            className="h-4 w-6 rounded-sm shadow-sm border border-white/10"
          />
          <div className="font-semibold">{m.city}</div>
          <div className="rounded-full border border-white/10 px-2 py-0.5 text-xs opacity-80">
            {m.exchange}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WeatherGlyph kind={m.weather ?? 'cloud'} />
          <div className="font-semibold">{Math.round(temp)}°C</div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-white/60">
        <div className="opacity-80">{m.tz.split('/').pop()}</div>
        <div
          className={[
            'rounded-full border px-2 py-0.5',
            open ? 'border-emerald-400/30 text-emerald-300' : 'border-white/15 text-white/60',
          ].join(' ')}
        >
          {open ? 'OPEN' : 'CLOSED'}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-lg font-extrabold md:text-xl">{last.toLocaleString()}</div>
          <div className="text-xs text-white/60">{m.indexName}</div>
        </div>
        <div className="text-right">
          <div className={delta >= 0 ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)} pts
          </div>
          <div className="text-xs text-white/60">{pct.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  // visual heartbeat every 3 minutes
  const [pulseKey, setPulseKey] = useState(0);
  const [lastPulseUtc, setLastPulseUtc] = useState<string>('');

  useEffect(() => {
    const fire = () => {
      setPulseKey((k) => k + 1);
      setLastPulseUtc(new Date().toISOString().slice(11, 16) + ' UTC');
    };
    fire();
    const t = setInterval(fire, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ambient gradient placeholder (until wired to weather)
  const bgStyle = useMemo(() => {
    const east = `hsla(40deg, 70%, 28%, 0.25)`;  // warm
    const west = `hsla(200deg, 60%, 24%, 0.25)`; // cool
    return { backgroundImage: `linear-gradient(90deg, ${east}, transparent 35%, transparent 65%, ${west})` };
  }, []);

  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10" style={bgStyle} />

      <header className="mb-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Where markets move capital, imagination moves images.
        </h1>
        <p className="mt-2 text-white/60">
          Desktop & tablet · 16:9 · East ↔ West rhythm · Heartbeat every 3 minutes (visual).
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left (Eastern) */}
        <div className="col-span-12 md:col-span-2">
          <div className="grid grid-rows-6 gap-4">
            {EAST.map((m) => <MarketCard key={m.id} m={m} />)}
          </div>
        </div>

        {/* Center (10×2) */}
        <div className="relative col-span-12 md:col-span-8">
          <div
            key={pulseKey}
            className="pointer-events-none absolute inset-0 -z-10 animate-[pulse_2.8s_ease-out_1]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
              maskImage: 'linear-gradient(90deg, transparent 0%, black 20%, black 80%, transparent 100%)',
            }}
          />
          <div className="grid grid-cols-10 gap-3">
            {PROVIDERS.map((p, i) => (
              <div
                key={p.id}
                className={[
                  'rounded-xl border border-white/10 bg-white/5 px-3 py-2',
                  i < 10 ? 'ring-1 ring-white/10' : '',
                  'transition-colors hover:border-white/20',
                ].join(' ')}
                title={p.tagline}
              >
                <div className="truncate text-[13px] font-semibold">{p.name}</div>
                <div className="truncate text-xs text-white/60">{p.tagline}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300">92 ▲</span>
                  <a className="font-semibold text-sky-300 hover:underline" href={p.affiliateUrl ?? p.website} target="_blank" rel="noreferrer">
                    Visit
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right (Western) */}
        <div className="col-span-12 md:col-span-2">
          <div className="grid grid-rows-6 gap-4">
            {WEST.map((m) => <MarketCard key={m.id} m={m} />)}
          </div>
        </div>
      </div>

      <footer className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
        <div>Promagen · v1 · Live Markets · Local Intelligence</div>
        <div className="text-white/70">Last Pulse {lastPulseUtc || '—'}</div>
      </footer>
    </section>
  );
}
