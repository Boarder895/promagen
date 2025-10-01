﻿export default function DevelopersBookPage() {
  return (
    <article>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">ðŸ§± Promagen â€” Developers Book</h1>
        <p className="meta">Edition: 2025-09-27</p>
      </header>

      <section id="principles" aria-labelledby="principles-h" className="mb-8">
        <h2 id="principles-h" className="mb-3 text-lg font-semibold">
          Principles (the â€œ6 thingsâ€ + uniformity)
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Functionality first</strong> â€” ship features that work, safe and correct.</li>
          <li><strong>Modern, pleasing design</strong> â€” clean UI polish.</li>
          <li><strong>Longevity</strong> â€” maintainable code; stable stack.</li>
          <li><strong>Ease &amp; simplicity</strong> â€” low friction for devs &amp; users.</li>
          <li><strong>Cost-effective scaling</strong> â€” start lean; upgrade as revenue grows.</li>
          <li><strong>Uniformity</strong> â€” consistent patterns, naming and UX.</li>
        </ul>
      </section>

      <section id="shipped" aria-labelledby="shipped-h" className="mb-8">
        <h2 id="shipped-h" className="mb-3 text-lg font-semibold">âœ… Shipped</h2>
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
        <h2 id="inprogress-h" className="mb-3 text-lg font-semibold">ðŸ› ï¸ In progress</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Docs TOC wiring &amp; content tidy.</li>
          <li>Demo polish (badge/segment/type areas, type clean-ups).</li>
          <li>Logging pipeline â€” Logtail (with redaction).</li>
          <li>AES-256-GCM helpers â€” vault flow in design.</li>
        </ul>
      </section>

      <section id="todo" aria-labelledby="todo-h" className="mb-8">
        <h2 id="todo-h" className="mb-3 text-lg font-semibold">ðŸ“‹ To-Do (near-term)</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Dark mode (site-wide toggle).</li>
          <li>Header toggle + dark variants; persist via <code>localStorage</code>.</li>
          <li>Accessibility polish (skip-links, focus rings, roles/labels) â€” design uniformity.</li>
          <li>
            <strong>Provider selector wired to registry</strong> (canonical 20 providers; badges for
            <em> API</em> / <em> Pay</em> / <em> Copy &amp; Open</em> / <em> Affiliate</em>).
          </li>
          <li>Partial â€œunified prompt runnerâ€ (manual UI providers first).</li>
          <li>Transient/placeholder provider cards; mini-thumbnails; optimistic nav.</li>
          <li>Persistent progress indicator for non-API providers (preview â†’ thumbnail state).</li>
          <li>Docs polish pass: Developers, Users (links, screenshots, consistency).</li>
        </ul>
      </section>

      <section id="medium-term" aria-labelledby="medium-h" className="mb-8">
        <h2 id="medium-h" className="mb-3 text-lg font-semibold">ðŸ§© Medium-term</h2>
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
        <h2 id="canon-h" className="mb-3 text-lg font-semibold">ðŸ“š Provider Canon (locked â€” keep list intact)</h2>
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


