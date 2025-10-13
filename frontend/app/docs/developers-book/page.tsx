// frontend/app/docs/developers-book/page.tsx
// Developers Book â€” Promagen
// Last updated: 12 Oct 2025 (Europe/London)

export default function DevelopersBookPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Developers Book</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ground truth for Promagenâ€™s architecture, workflows, and upgrade path. This page reflects
        the current repo state.
      </p>

      {/* === Fundamentals ================================================== */}
      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold">0) Fundamentals (do not drift)</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Next.js App Router only</strong> (no Pages Router).
          </li>
          <li>
            <strong>Homepage vision</strong>: two boards on one screen â€” ProvidersBoard &amp;
            ExchangeBoard (Stage-1).
          </li>
          <li>
            <strong>Option A â†’ Option B</strong>: start with local/canonical data + light route
            handlers; upgrade to a full API with typed endpoints and secret handling.
          </li>
          <li>
            <strong>Affiliate-safe UX</strong>: disclaimers, â€œBest right nowâ€ badges, no dark
            patterns.
          </li>
          <li>
            <strong>Design pulses</strong>: rank-change pulses, minute-tick shimmer, sunrise
            ordering, bells on open/close.
          </li>
        </ul>
      </section>

      {/* === Monorepo layout ============================================== */}
      <section className="space-y-3 mb-10">
        <h2 className="text-xl font-semibold">1) Monorepo layout (current reality)</h2>
        <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
          {String.raw`promagen/
  frontend/
    app/                 # App Router routes & route handlers
      api/health/route.ts
      api/world-clocks/route.ts
      docs/developers-book/page.tsx
      docs/users-book/page.tsx
      health-check/page.tsx
      settings/keys/page.tsx
      status/page.tsx
      layout.tsx
      page.tsx
      error.tsx
      globals.css
    components/
      ui/{badge,button,card,input}.tsx
      health/{HealthBanner,HealthContext}.tsx
      {CopyButton,CreditsBanner,LanguageSwitcher,Leaderboard,LiveChip,
       PlatformLiveDrawer,PromagenMVP,ProviderCard,ProviderCountryChips,
       RequestIdCopy,StockTicker,WorldClocks}.tsx
    # assets: frontend/public/  (not present yet)
    # styling: Tailwind config (not present); CSS/PostCSS in use

  api/
    src/                 # backend server code (present in extra seed)
    prisma/
      schema.prisma
      migrations/...     # migration files (lock + sql)

  .github/workflows/     # api.yml, api-ci.yml, api-deploy.yml, frontend.yml, frontend-ci.yml, lint.yml
`}
        </pre>
      </section>

      {/* === Routes ======================================================== */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">2) Frontend routing map</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <code>/</code> â†’ <code>app/page.tsx</code>
          </li>
          <li>
            <code>/status</code> â†’ <code>app/status/page.tsx</code>
          </li>
          <li>
            <code>/health-check</code> â†’ <code>app/health-check/page.tsx</code>
          </li>
          <li>
            <code>/settings/keys</code> â†’ <code>app/settings/keys/page.tsx</code>
          </li>
          <li>
            <code>/docs/developers-book</code> â†’ <code>app/docs/developers-book/page.tsx</code>
          </li>
          <li>
            <code>/docs/users-book</code> â†’ <code>app/docs/users-book/page.tsx</code>
          </li>
          <li>
            API route handlers:
            <ul className="list-disc pl-6">
              <li>
                <code>GET /api/health</code> â†’ <code>app/api/health/route.ts</code>
              </li>
              <li>
                <code>GET /api/world-clocks</code> â†’ <code>app/api/world-clocks/route.ts</code>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      {/* === Components ==================================================== */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">3) Components (key sets)</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>UI primitives</strong>: Badge, Button, Card, Input (shadcn-style).
          </li>
          <li>
            <strong>System/UX</strong>: HealthBanner / HealthContext, WorldClocks, CopyButton,
            RequestIdCopy.
          </li>
          <li>
            <strong>Boards scaffolding</strong>: Leaderboard, ProviderCard, ProviderCountryChips,
            LiveChip, PlatformLiveDrawer, PromagenMVP, StockTicker.
          </li>
        </ul>
      </section>

      {/* === Adapters placement =========================================== */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">4) Adapters (current placement & recommendation)</h2>
        <p>
          Adapter files exist for many image providers under <code>app/adapters/*</code> (OpenAI,
          Stability, Midjourney, Runway, Leonardo, Firefly, etc.).
        </p>
        <p className="mt-2">
          <strong>Recommendation:</strong> move to <code>frontend/lib/adapters/*</code> and import
          via <code>@/lib/adapters/*</code> to keep <code>app/</code> purely routes.
        </p>
        <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
          {String.raw`// Example import after move:
import { generate } from '@/lib/adapters/openai'`}
        </pre>
      </section>

      {/* === Styling & assets ============================================= */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">5) Styling & assets</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Present:</strong> <code>app/globals.css</code>, <code>postcss.config.cjs</code>.
          </li>
          <li>
            <strong>Not configured:</strong> Tailwind config (<code>tailwind.config.*</code>{' '}
            absent). Proceed CSS-only for now.
          </li>
          <li>
            <strong>Assets:</strong> <code>frontend/public/</code> not present yet. Add
            icons/images/audio when ready; no redesign required.
          </li>
        </ul>
      </section>

      {/* === Backend / Prisma ============================================= */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">6) Backend & data model (Prisma/PostgreSQL)</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>DB:</strong> PostgreSQL.
          </li>
          <li>
            <strong>Entities:</strong> <code>User</code> (unique <code>email</code>),{' '}
            <code>Key</code> (FKâ†’User), <code>Metric</code>, <code>Score</code>,{' '}
            <code>Override</code>.
          </li>
          <li>
            <strong>Enum Provider</strong>: 20 platforms (OpenAI, Stability, Leonardo, DeepAI,
            NightCafe, Bing, Google, Midjourney, Runway, Fotor, and more).
          </li>
        </ul>
        <p className="text-sm text-gray-500">
          Full <code>api/src/**</code> routes will be documented here when included in the next
          seed.
        </p>
      </section>

      {/* === Env & secrets ================================================= */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">7) Environment & secrets</h2>
        <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
          {String.raw`# frontend/.env.local (if needed)
NEXT_PUBLIC_API_BASE=http://localhost:4000

# api/.env
PORT=4000
DATABASE_URL=postgres://user:pass@localhost:5432/promagen
OPENAI_API_KEY=sk-***`}
        </pre>
        <p className="text-sm">
          Commit <code>.env.example</code>; never commit real <code>.env</code> files.
        </p>
      </section>

      {/* === Dev & CI ====================================================== */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">8) Dev & CI quickstart</h2>
        <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
          {String.raw`# Frontend
cd frontend
pnpm install
pnpm run dev  # http://localhost:3000

# Backend
cd ../api
pnpm install
# npx prisma generate
# npx tsx src/index.ts  (or: pnpm run dev, if script exists)`}
        </pre>
        <p>
          Workflows present: <code>frontend(-ci).yml</code>, <code>api(-ci/-deploy).yml</code>,{' '}
          <code>lint.yml</code>.
        </p>
      </section>

      {/* === Option A -> B ================================================ */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">9) Option A â†’ Option B</h2>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Keep Option A running: local/canonical data + minimal route handlers.</li>
          <li>Promote adapters into the API as services (hide keys; add typed endpoints).</li>
          <li>
            Create <code>frontend/lib/dataGateway.ts</code> and consume the API.
          </li>
          <li>
            Add <code>public/</code> assets for audio/icons; wire â€œminute-tickâ€ shimmer and bells.
          </li>
          <li>Add affiliate ribbons &amp; disclaimers as a shared component.</li>
        </ol>
      </section>
    </main>
  );
}


