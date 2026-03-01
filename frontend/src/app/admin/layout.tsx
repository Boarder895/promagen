// src/app/admin/layout.tsx
// ============================================================================
// ADMIN LAYOUT — Shared navigation for all admin pages
// ============================================================================
//
// Provides:
//   - Sticky header with nav links to all admin pages
//   - Active-link highlighting via client nav component
//   - Dark admin theme (bg-black + white text)
//
// IMPORTANT: No <html> or <body> here — the root layout (src/app/layout.tsx)
// provides those. Nested <html>/<body> causes hydration errors.
//
// The root layout sets overflow-hidden + text-slate-900 on <body>.
// This wrapper overrides both: enables scrolling and sets admin colours.
//
// Pages:
//   /admin                   — Dashboard overview
//   /admin/scoring-health    — Scoring health dashboard (Phase 7.11)
//   /admin/vocab-submissions — Vocabulary crowdsourcing review (Phase 7.7)
//   /admin/scene-candidates  — Scene candidate review
//   /admin/exchanges         — Exchange editor
//   /admin/providers         — Provider browser
//
// Version: 3.0.0 — Fix hydration error + bg-black + scroll override
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import { AdminNav } from './admin-nav';

export const metadata = {
  title: 'Admin · Promagen',
  description: 'Internal control panel for Promagen data sources.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          {/* Brand */}
          <a
            href="/admin"
            className="shrink-0 font-bold"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Promagen Admin
          </a>

          {/* Nav links — client component for active state */}
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
