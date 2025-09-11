import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

type Platform = {
  id: string;
  name: string;
  rank: number;
  kind: "api" | "affiliate" | "ui_only";
  markers: string[];
  notes?: string;
};

export default function PlatformsPage() {
  const [items, setItems] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/platforms");
        const j = await r.json();
        if (!alive) return;
        setItems((j?.data || []).sort((a: Platform, b: Platform) => a.rank - b.rank));
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <Head>
        <title>Promagen — Platforms</title>
        <meta name="description" content="The 20 Promagen platforms, ordered by popularity, with integration type and badges." />
      </Head>

      <main className="wrap">
        <header className="hero">
          <h1>Platforms</h1>
          <p>Top 20 platforms on Promagen (ordered by popularity). API integrations are a later upgrade; today we focus on sleek listing & on-site flows.</p>
        </header>

        {loading ? (
          <div className="loading">Loading platforms…</div>
        ) : (
          <ul className="grid" aria-label="Platforms">
            {items.map(p => (
              <li key={p.id} className="card">
                <div className="row">
                  <span className="rank">#{p.rank}</span>
                  <div className="name">{p.name}</div>
                  <div className="badges" title={p.notes || ""}>
                    {p.markers.map((m, i) => <span key={i} className="badge">{m}</span>)}
                  </div>
                </div>
                <div className="sub">
                  {p.kind === "api" && <span className="pill api" title="Planned API integration">API planned</span>}
                  {p.kind === "affiliate" && <span className="pill aff" title="Affiliate-first">Affiliate</span>}
                  {p.kind === "ui_only" && <span className="pill ui" title="UI-only / no public API">UI-only</span>}
                </div>
                <div className="actions">
                  {/* Keep users inside Promagen; this button can open your PlatformLiveDrawer */}
                  <button className="btn" onClick={() => alert(`Open in-site panel for ${p.name}`)}>
                    View on Promagen
                  </button>
                  {/* Optional: future deep-link (new tab) */}
                  {/* <Link href={`/go/${p.id}`} className="link">Visit site ↗</Link> */}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <style jsx>{`
        .wrap { max-width: 1080px; margin: 0 auto; padding: 1rem; }
        .hero { border-bottom: 1px solid rgba(0,0,0,.06); margin-bottom: .75rem; }
        .hero h1 { margin: 0 0 .25rem; }
        .loading { padding: 1rem; opacity: .7; }

        .grid {
          list-style: none; padding: 0; margin: 0;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: .9rem;
        }
        .card {
          border: 1px solid rgba(0,0,0,.08);
          border-radius: .9rem;
          padding: .9rem;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
          display: flex; flex-direction: column; gap: .6rem;
        }
        .row { display: grid; grid-template-columns: 3rem 1fr auto; align-items: center; gap: .6rem; }
        .rank { font-weight: 700; font-variant-numeric: tabular-nums; color: #666; }
        .name { font-weight: 600; }
        .badges { display: inline-flex; gap: .35rem; }
        .badge { font-size: 1rem; }
        .sub { display: flex; gap: .4rem; }
        .pill {
          font-size: .75rem; padding: .15rem .4rem; border-radius: 999px;
          border: 1px solid rgba(0,0,0,.08); background: rgba(0,0,0,.03);
        }
        .pill.api { background: rgba(11,95,255,.08); border-color: rgba(11,95,255,.25); }
        .pill.aff { background: rgba(0,200,83,.10); border-color: rgba(0,200,83,.25); }
        .pill.ui  { background: rgba(0,0,0,.06); }
        .actions { display: flex; gap: .5rem; margin-top: .25rem; }
        .btn {
          padding: .45rem .7rem; border-radius: .55rem; border: 1px solid rgba(0,0,0,.1);
          background: #0b5fff; color: #fff; cursor: pointer;
        }
        .btn:hover { background: #0a53e6; }
        .link { align-self: center; }
      `}</style>
    </>
  );
}
