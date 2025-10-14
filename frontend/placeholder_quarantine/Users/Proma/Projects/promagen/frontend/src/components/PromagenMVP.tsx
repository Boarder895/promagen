// PromagenMVP.tsx — FULL FILE (replace existing)
// MVP: Live Leaderboard + Provider Page + Admin Scores panel
// - Manual score adjustments (override / adjustment)
// - Automated movement placeholder (autoScore + delta)
// - Favicon site icons next to provider names
// - LocalStorage persistence for admin edits
// - Affiliate /out/[slug] redirect (see note at bottom)

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  ExternalLink,
  Lock,
  Copy,
  ClipboardCheck,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// -------------------------------------------------------------------------------
// Types & Data
// -------------------------------------------------------------------------------

type Provider = {
  id: string;
  name: string;
  site: string; // base domain for favicon and info
  autoScore: number; // 0..100 from collectors
  manualAdjustment: number; // -100..+100
  hardOverrideScore?: number | null; // if set, final score = this
  delta: number; // daily movement in points (UI)
  hasApi: boolean;
  category: string;
  tagline: string;
  affiliateUrl: string; // /out/slug — mapped to real affiliate
};

const DEFAULTS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    site: 'openai.com',
    autoScore: 87.3,
    manualAdjustment: 0,
    hardOverrideScore: null,
    delta: 1.4,
    hasApi: true,
    category: 'Image',
    tagline: 'Fast multi-modal models and robust APIs.',
    affiliateUrl: '/out/openai',
  },
  {
    id: 'leonardo',
    name: 'Leonardo AI',
    site: 'leonardo.ai',
    autoScore: 84.1,
    manualAdjustment: 0,
    hardOverrideScore: null,
    delta: -0.6,
    hasApi: true,
    category: 'Image',
    tagline: 'High-quality models and community assets.',
    affiliateUrl: '/out/leonardo',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    site: 'midjourney.com',
    autoScore: 81.9,
    manualAdjustment: 0,
    hardOverrideScore: null,
    delta: 0.2,
    hasApi: false,
    category: 'Image',
    tagline: 'Exquisite aesthetics (Discord workflow).',
    affiliateUrl: '/out/midjourney',
  },
  {
    id: 'canva',
    name: 'Canva',
    site: 'canva.com',
    autoScore: 76.4,
    manualAdjustment: 0,
    hardOverrideScore: null,
    delta: 0.8,
    hasApi: false,
    category: 'Design Suite',
    tagline: 'Design, book creation and social tools.',
    affiliateUrl: '/out/canva',
  },
];

// -------------------------------------------------------------------------------
// Utils
// -------------------------------------------------------------------------------

function clsx(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const scoreOf = (p: Provider) => p.hardOverrideScore ?? clamp(p.autoScore + p.manualAdjustment);
const faviconFor = (site: string, size = 64) =>
  `https://www.google.com/s2/favicons?domain=${site}&sz=${size}`;

function rankBadge(rank: number) {
  if (rank === 1) return <Badge className="rounded-2xl">#1</Badge>;
  if (rank <= 5)
    return (
      <Badge variant="secondary" className="rounded-2xl">
        Top 5
      </Badge>
    );
  return (
    <Badge variant="outline" className="rounded-2xl">
      #{rank}
    </Badge>
  );
}

// -------------------------------------------------------------------------------
// Sparkline (stub)
// -------------------------------------------------------------------------------
function Sparkline({ trend = [74, 75, 76, 75.5, 76.4] }: { trend?: number[] }) {
  const path = React.useMemo(() => {
    const w = 100,
      h = 28,
      max = Math.max(...trend),
      min = Math.min(...trend);
    const scaleX = (i: number) => (i / (trend.length - 1)) * w;
    const scaleY = (v: number) => h - ((v - min) / Math.max(1, max - min || 1)) * h;
    return trend.map((v, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(v)}`).join(' ');
  }, [trend]);
  return (
    <svg viewBox="0 0 100 28" className="w-24 h-7">
      <path d={path} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// -------------------------------------------------------------------------------
// Row — Leaderboard
// -------------------------------------------------------------------------------
function ProviderRow({ i, p, onOpen }: { i: number; p: Provider; onOpen: (p: Provider) => void }) {
  const up = p.delta >= 0;
  const finalScore = scoreOf(p);
  return (
    <motion.button
      onClick={() => onOpen(p)}
      className="grid grid-cols-[48px_1fr_90px_120px_110px] items-center gap-3 rounded-2xl p-3 text-left hover:shadow-md hover:bg-white/60 dark:hover:bg-white/5 transition"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
    >
      <div className="flex items-center justify-center text-sm opacity-70">{rankBadge(i + 1)}</div>
      <div className="flex items-center gap-3">
        <Image
          src={faviconFor(p.site)}
          alt=""
          width={36}
          height={36}
          className="size-9 rounded-xl border"
          unoptimized
        />
        <div className="flex flex-col">
          <span className="font-medium leading-tight">{p.name}</span>
          <span className="text-xs opacity-60 leading-tight">{p.tagline}</span>
        </div>
      </div>
      <div className="font-semibold tabular-nums text-right">{finalScore.toFixed(1)}</div>
      <div
        className={clsx(
          'flex items-center gap-1 justify-end font-medium tabular-nums',
          up ? 'text-emerald-600' : 'text-rose-600',
        )}
      >
        {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
        {up ? '+' : ''}
        {p.delta.toFixed(1)}
      </div>
      <div className="justify-self-end">
        <Sparkline />
      </div>
    </motion.button>
  );
}

// -------------------------------------------------------------------------------
// Provider Page (universal)
// -------------------------------------------------------------------------------
function ProviderView({ p, onBack }: { p: Provider; onBack: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const [prompt, setPrompt] = React.useState(
    'A whimsical mushroom metropolis with glowing caps and fiber-optic trees under a golden-to-crimson sky; semi-real cartoon characters over ultra-photorealistic background, cinematic lighting.',
  );
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  function openAffiliateWrapped() {
    window.open(p.affiliateUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" onClick={onBack} className="rounded-2xl">
          <ChevronLeft className="mr-2 size-4" /> Back to Leaderboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Image
                    src={faviconFor(p.site)}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-2xl border"
                    unoptimized
                  />
                  {p.name}
                  <Badge variant="secondary" className="rounded-2xl">
                    {p.category}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-2">{p.tagline}</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold tabular-nums">{scoreOf(p).toFixed(1)}</div>
                <div
                  className={clsx(
                    'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm',
                    p.delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                  )}
                >
                  {p.delta >= 0 ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                  {p.delta >= 0 ? '+' : ''}
                  {p.delta.toFixed(1)} today
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="text-sm font-medium">Prompt</label>
            <div className="grid grid-cols-1 gap-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[140px] w-full rounded-2xl border bg-white/70 dark:bg-white/5 p-4 leading-relaxed focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Your generated prompt appears here…"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleCopy} className="rounded-2xl">
                  {copied ? (
                    <>
                      <ClipboardCheck className="mr-2 size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 size-4" />
                      Copy Prompt
                    </>
                  )}
                </Button>
                <Button onClick={openAffiliateWrapped} variant="secondary" className="rounded-2xl">
                  <ExternalLink className="mr-2 size-4" />
                  Open {p.name} in Promagen Window
                </Button>
                <Badge variant="outline" className="rounded-2xl">
                  Affiliate link — we may earn a commission
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" /> Live Rank Signals
            </CardTitle>
            <CardDescription>7-criteria weighted score; updated hourly/nightly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">7-day trend</span>
              <Sparkline />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Adoption/Ecosystem</div>
                <div className="text-xl font-semibold">86</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Image Quality</div>
                <div className="text-xl font-semibold">89</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Speed/Uptime</div>
                <div className="text-xl font-semibold">82</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Cost/Free Tier</div>
                <div className="text-xl font-semibold">74</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Trust/Safety</div>
                <div className="text-xl font-semibold">91</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Automation/Innovation</div>
                <div className="text-xl font-semibold">88</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs opacity-60">Ethical/Environmental</div>
                <div className="text-xl font-semibold">71</div>
              </div>
            </div>
            <p className="text-xs opacity-70">
              Scores are normalized 0–100 with evidence-based sources; movement debounced.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardHeader>
          <CardTitle>API Lane</CardTitle>
          <CardDescription>
            Optional upgrade path — consistent UI for all providers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled className="rounded-2xl">
            <Lock className="mr-2 size-4" /> Use via API (Coming Soon)
          </Button>
          <p className="text-sm opacity-70">
            When enabled, prompts send directly via your saved API key and results appear inside
            Promagen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------------------------
// Leaderboard
// -------------------------------------------------------------------------------
function LeaderboardView({
  providers,
  onOpen,
  onAdmin,
}: {
  providers: Provider[];
  onOpen: (p: Provider) => void;
  onAdmin: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    return providers
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [providers, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">PROMAGEN</span>
          <Badge variant="outline" className="rounded-2xl">
            AI Tools Ranked Live
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={onAdmin}>
            Admin: Scores
          </Button>
          <div className="text-xs opacity-70">
            Affiliate disclosure: we may earn commissions on outbound links.
          </div>
        </div>
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="pb-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers…"
                className="pl-9 rounded-2xl w-64"
              />
            </div>
            <Button variant="outline" className="rounded-2xl">
              <Filter className="mr-2 size-4" /> Filter by criteria
            </Button>
          </div>
          <CardDescription className="mt-4">
            Stock-market style movement with debounced updates and 7-day sparklines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {filtered.map((p, i) => (
              <ProviderRow key={p.id} i={i} p={p} onOpen={onOpen} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------------------------
// Admin Scores Panel — manual adjustments (MVP)
// FinalScore = hardOverride ?? clamp(autoScore + manualAdjustment)
// -------------------------------------------------------------------------------
function AdminScores({
  providers,
  onClose,
  onSave,
}: {
  providers: Provider[];
  onClose: () => void;
  onSave: (id: string, patch: Partial<Provider>) => void;
}) {
  const [draft, setDraft] = React.useState<Provider[]>(providers);
  function setField(id: string, field: keyof Provider, value: any) {
    setDraft((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }
  function commit() {
    draft.forEach((p) =>
      onSave(p.id, {
        autoScore: p.autoScore,
        manualAdjustment: p.manualAdjustment,
        hardOverrideScore: p.hardOverrideScore ?? null,
        delta: p.delta,
      }),
    );
    onClose();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin · Manual Score Adjustments</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-2xl">
            Close
          </Button>
          <Button onClick={commit} className="rounded-2xl">
            Save Changes
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Providers</CardTitle>
          <CardDescription>
            FinalScore = hardOverride ?? clamp(autoScore + manualAdjustment)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_140px_160px_160px_120px] gap-3 items-center">
            <div className="text-xs uppercase tracking-wide opacity-60">Provider</div>
            <div className="text-xs uppercase tracking-wide opacity-60 text-right">AutoScore</div>
            <div className="text-xs uppercase tracking-wide opacity-60 text-right">Manual Adj</div>
            <div className="text-xs uppercase tracking-wide opacity-60 text-right">
              Hard Override
            </div>
            <div className="text-xs uppercase tracking-wide opacity-60 text-right">? Today</div>
          </div>
          <div className="divide-y mt-2">
            {draft.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_140px_160px_160px_120px] gap-3 items-center py-2"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={faviconFor(p.site)}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-lg border"
                    unoptimized
                  />
                  <div className="leading-tight">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-60">{p.site}</div>
                  </div>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  value={p.autoScore}
                  onChange={(e) => setField(p.id, 'autoScore', parseFloat(e.target.value))}
                  className="text-right"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={p.manualAdjustment}
                  onChange={(e) => setField(p.id, 'manualAdjustment', parseFloat(e.target.value))}
                  className="text-right"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={p.hardOverrideScore ?? ''}
                  placeholder="(blank = none)"
                  onChange={(e) =>
                    setField(
                      p.id,
                      'hardOverrideScore',
                      e.target.value === '' ? null : parseFloat(e.target.value),
                    )
                  }
                  className="text-right"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={p.delta}
                  onChange={(e) => setField(p.id, 'delta', parseFloat(e.target.value))}
                  className="text-right"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs opacity-70">
        MVP persistence: these values save to localStorage. In production, wire this to your DB with
        admin auth and feed <em>autoScore</em> from your collectors; apply debouncing and snapshots.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------------------
// Root
// -------------------------------------------------------------------------------
export default function PromagenMVP() {
  const [providers, setProviders] = React.useState<Provider[]>(() => {
    if (typeof window === 'undefined') return DEFAULTS as Provider[];
    try {
      const raw = localStorage.getItem('promagen.providers');
      if (raw) return JSON.parse(raw) as Provider[];
    } catch {}
    return DEFAULTS as Provider[];
  }); // TSX single-file quickfix

  const [active, setActive] = React.useState<Provider | null>(null);
  const [admin, setAdmin] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem('promagen.providers', JSON.stringify(providers));
    } catch {}
  }, [providers]);

  function updateProvider(id: string, patch: Partial<Provider>) {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-50">
      {admin ? (
        <AdminScores
          providers={providers}
          onClose={() => setAdmin(false)}
          onSave={updateProvider}
        />
      ) : active ? (
        <ProviderView p={active} onBack={() => setActive(null)} />
      ) : (
        <LeaderboardView providers={providers} onOpen={setActive} onAdmin={() => setAdmin(true)} />
      )}
    </div>
  );
}
