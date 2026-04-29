'use client';

// src/app/admin/page.tsx
// ============================================================================
// ADMIN DASHBOARD — Internal control panel hub
// ============================================================================
//
// Reduced in Pass 6f to a single card pointing at /admin/sentinel. The
// previous admin tools (builder-quality, scoring-health, vocab-submissions,
// scene-candidates, providers-admin, exchanges-admin) were tied to the dead
// prompt-builder + learning + vocabulary subsystems and have been retired.
// ============================================================================

import Link from 'next/link';

const TOOLS = [
  {
    href: '/admin/sentinel',
    label: 'Sentinel',
    description:
      'Weekly digest dashboard for the Sentinel monitoring system: page health, regressions, AI crawler activity, citation tracking.',
    icon: '✦',
    colour: 'bg-sky-500/15 ring-sky-500/30 hover:bg-sky-500/25',
  },
] as const;

export default function AdminDashboard() {
  return (
    <div>
      <h1
        style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}
        className="mb-2 font-bold"
      >
        Admin Dashboard
      </h1>
      <p
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
        className="mb-8 text-white/50"
      >
        Internal control panel for Promagen.
      </p>

      <h2
        className="mb-3 font-semibold text-white/60"
        style={{ fontSize: 'clamp(12px, 1.1vw, 14px)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}
      >
        Tools
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map(({ href, label, description, icon, colour }) => (
          <Link
            key={href}
            href={href}
            className={`group cursor-pointer rounded-xl ring-1 transition-all ${colour}`}
            style={{ padding: 'clamp(16px, 2vw, 24px)' }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span style={{ fontSize: 'clamp(20px, 2vw, 28px)' }}>{icon}</span>
              <h2
                className="font-semibold text-white/90"
                style={{ fontSize: 'clamp(15px, 1.5vw, 20px)' }}
              >
                {label}
              </h2>
              <span
                className="ml-auto text-white/20 transition-transform group-hover:translate-x-1"
                style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
              >
                →
              </span>
            </div>
            <p
              className="text-white/40"
              style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
            >
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
