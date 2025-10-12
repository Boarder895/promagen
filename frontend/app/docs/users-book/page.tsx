// frontend/app/docs/users-book/page.tsx
// Users Book — Promagen
// Last updated: 12 Oct 2025 (Europe/London)

export default function UsersBookPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Users Book</h1>
      <p className="text-sm text-gray-500 mb-8">
        A friendly guide to what Promagen is, how it behaves, and what’s coming next.
      </p>

      {/* What it is */}
      <section className="space-y-3 mb-10">
        <h2 className="text-xl font-semibold">What Promagen is</h2>
        <p>Promagen is a live, desktop-first homepage with two rich surfaces on a single screen:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Providers Board</strong>: 20 image-generation platforms with honest badges,
            offers, pulses and quick links.
          </li>
          <li>
            <strong>Exchange Board</strong>: major stock exchanges in <em>sunrise order</em>, with
            open/close status and subtle cues.
          </li>
        </ul>
        <p className="text-sm text-gray-500">
          Today’s build has the scaffolding, time awareness, and status/health UX; the boards light
          up as data is connected.
        </p>
      </section>

      {/* Live now */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">What’s live right now</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Homepage</strong>: <code>/</code>
          </li>
          <li>
            <strong>Status</strong>: <code>/status</code> — system state &amp; build heartbeat.
          </li>
          <li>
            <strong>Health Check</strong>: <code>/health-check</code> — quick diagnostic.
          </li>
          <li>
            <strong>Docs</strong>: this page and Developers Book at <code>/docs/*</code>.
          </li>
          <li>
            <strong>Server endpoints</strong>:
            <ul className="list-disc pl-6">
              <li>
                <code>GET /api/health</code> — server heartbeat.
              </li>
              <li>
                <code>GET /api/world-clocks</code> — feeds the world-clock widget.
              </li>
            </ul>
          </li>
        </ul>
      </section>

      {/* How it feels */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">How it should feel</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Sunrise ordering</strong>: the page breathes with global timezones.
          </li>
          <li>
            <strong>Minute-tick shimmer</strong>: subtle rhythm so freshness is visible.
          </li>
          <li>
            <strong>Rank pulses</strong>: when providers move up or down.
          </li>
          <li>
            <strong>Open/close bells</strong>: gentle, with a user toggle.
          </li>
          <li>
            <strong>Affiliate clarity</strong>: UK-style ribbons; “Best right now” shading without
            tricks.
          </li>
        </ul>
      </section>

      {/* Assets */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">Icons, audio, and images</h2>
        <p>
          An assets folder (<code>frontend/public/</code>) will hold icons, images, and the market
          bell. It isn’t present yet, so visuals use default placeholders. Nothing blocks launch;
          assets can be added later without layout changes.
        </p>
      </section>

      {/* Roadmap */}
      <section className="space-y-2 mb-10">
        <h2 className="text-xl font-semibold">What’s next</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Connect the <strong>Providers Board</strong> to curated + live data.
          </li>
          <li>
            Light up the <strong>Exchange Board</strong> with open/close windows and weather/sun
            overlays.
          </li>
          <li>
            Add the gentle <strong>chime</strong> and an on/off toggle.
          </li>
          <li>
            Publish a short “What’s New” on <code>/status</code> whenever something meaningful
            ships.
          </li>
        </ul>
      </section>

      {/* Safety */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Safety & transparency</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Clear affiliate ribbons wherever links could earn a commission.</li>
          <li>“Since you looked” markers so changes are obvious, not hidden.</li>
          <li>Time drift guarded (NTP-style) so time-based UI stays trustworthy.</li>
        </ul>
      </section>
    </main>
  );
}
