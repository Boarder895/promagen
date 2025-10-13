<<<<<<< HEAD
// frontend/app/docs/developers-book/page.tsx
// Developers Book — Promagen
// Last updated: 12 Oct 2025 (Europe/London)

export default function DevelopersBookPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Developers Book</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ground truth for Promagen’s architecture, workflows, and upgrade path. This page reflects
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
            <strong>Homepage vision</strong>: two boards on one screen — ProvidersBoard &amp;
            ExchangeBoard (Stage-1).
          </li>
          <li>
            <strong>Option A → Option B</strong>: start with local/canonical data + light route
            handlers; upgrade to a full API with typed endpoints and secret handling.
          </li>
          <li>
            <strong>Affiliate-safe UX</strong>: disclaimers, “Best right now” badges, no dark
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
            <code>/</code> → <code>app/page.tsx</code>
          </li>
          <li>
            <code>/status</code> → <code>app/status/page.tsx</code>
          </li>
          <li>
            <code>/health-check</code> → <code>app/health-check/page.tsx</code>
          </li>
          <li>
            <code>/settings/keys</code> → <code>app/settings/keys/page.tsx</code>
          </li>
          <li>
            <code>/docs/developers-book</code> → <code>app/docs/developers-book/page.tsx</code>
          </li>
          <li>
            <code>/docs/users-book</code> → <code>app/docs/users-book/page.tsx</code>
          </li>
          <li>
            API route handlers:
            <ul className="list-disc pl-6">
              <li>
                <code>GET /api/health</code> → <code>app/api/health/route.ts</code>
              </li>
              <li>
                <code>GET /api/world-clocks</code> → <code>app/api/world-clocks/route.ts</code>
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
            <code>Key</code> (FK→User), <code>Metric</code>, <code>Score</code>,{' '}
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
        <h2 className="text-xl font-semibold">9) Option A → Option B</h2>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Keep Option A running: local/canonical data + minimal route handlers.</li>
          <li>Promote adapters into the API as services (hide keys; add typed endpoints).</li>
          <li>
            Create <code>frontend/lib/dataGateway.ts</code> and consume the API.
          </li>
          <li>
            Add <code>public/</code> assets for audio/icons; wire “minute-tick” shimmer and bells.
          </li>
          <li>Add affiliate ribbons &amp; disclaimers as a shared component.</li>
        </ol>
      </section>
    </main>
  );
}
=======
export default function DevelopersBookPage() {
  return (
    <article>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🧱 Promagen — Developers Book</h1>
        <p className="meta">Edition: 2025-09-27</p>
      </header>

      <section id="principles" aria-labelledby="principles-h" className="mb-8">
        <h2 id="principles-h" className="mb-3 text-lg font-semibold">
          Principles (the “6 things” + uniformity)
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Functionality first</strong> — ship features that work, safe and correct.</li>
          <li><strong>Modern, pleasing design</strong> — clean UI polish.</li>
          <li><strong>Longevity</strong> — maintainable code; stable stack.</li>
          <li><strong>Ease &amp; simplicity</strong> — low friction for devs &amp; users.</li>
          <li><strong>Cost-effective scaling</strong> — start lean; upgrade as revenue grows.</li>
          <li><strong>Uniformity</strong> — consistent patterns, naming and UX.</li>
        </ul>
      </section>

      <section id="shipped" aria-labelledby="shipped-h" className="mb-8">
        <h2 id="shipped-h" className="mb-3 text-lg font-semibold">✅ Shipped</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>App Router skeleton &amp; base routes (<code>/status</code>, <code>/metrics</code>, <code>/providers</code>, <code>/docs/*</code>).</li>
          <li>Option A provider registry and demo generation simulator.</li>
          <li>Docs structure tidy and UI wiring.</li>
          <li>Layout: sticky book shell with route-scoped styles.</li>
          <li><code>/report</code> playground (simulated run).</li>
          <li><code>/leaderboard</code> page (provider list).</li>
        </ul>
      </section>

      <section id="in-progress" aria-labelledby="inprogress-h" className="mb-8">
        <h2 id="inprogress-h" className="mb-3 text-lg font-semibold">🛠️ In progress</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Docs TOC wiring &amp; content tidy.</li>
          <li>Demo polish (badge/segment/type areas, type clean-ups).</li>
          <li>Logging pipeline — Logtail (with redaction).</li>
          <li>AES-256-GCM helpers — vault flow in design.</li>
        </ul>
      </section>

      <section id="todo" aria-labelledby="todo-h" className="mb-8">
        <h2 id="todo-h" className="mb-3 text-lg font-semibold">📋 To-Do (near-term)</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Dark mode (site-wide toggle).</li>
          <li>Header toggle + dark variants; persist via <code>localStorage</code>.</li>
          <li>Accessibility polish (skip-links, focus rings, roles/labels) — design uniformity.</li>
          <li>
            <strong>Provider selector wired to registry</strong> (canonical 20 providers; badges for
            <em> API</em> / <em> Pay</em> / <em> Copy &amp; Open</em> / <em> Affiliate</em>).
          </li>
          <li>Partial “unified prompt runner” (manual UI providers first).</li>
          <li>Transient/placeholder provider cards; mini-thumbnails; optimistic nav.</li>
          <li>Persistent progress indicator for non-API providers (preview → thumbnail state).</li>
          <li>Docs polish pass: Developers, Users (links, screenshots, consistency).</li>
        </ul>
      </section>

      <section id="medium-term" aria-labelledby="medium-h" className="mb-8">
        <h2 id="medium-h" className="mb-3 text-lg font-semibold">🧩 Medium-term</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Backend API integration for real providers (feature-flagged).</li>
          <li>Rate limiting &amp; safety (helmet + CSP, express-rate-limit, Zod validation).</li>
          <li>Collectors: hourly (speed/uptime) &amp; nightly (all criteria) + overrides UI.</li>
          <li>Provider admin tools + read-only audits.</li>
          <li>Automation for score snapshots &amp; deltas.</li>
          <li>Cookie banner + analytics (later).</li>
        </ul>
      </section>

      <section id="provider-canon" aria-labelledby="canon-h" className="mb-8">
        <h2 id="canon-h" className="mb-3 text-lg font-semibold">📚 Provider Canon (locked — keep list intact)</h2>
        <p className="mb-2">
          openai, stability, leonardo, i23rf, artistly, adobe, midjourney, canva, bing, ideogram, picsart,
          fotor, nightcafe, playground, pixlr, deepai, novelai, lexica, openart, flux (Flux Schnell).
        </p>
        <p className="text-sm text-neutral-600">
          Canonical list used across registry and UI. Changes require an explicit decision log.
        </p>
      </section>
    </article>
  );
}


>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955
