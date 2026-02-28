// src/app/admin/layout.tsx
// ============================================================================
// ADMIN LAYOUT — Shared navigation for all admin pages
// ============================================================================
//
// Provides:
//   - Sticky header with nav links to all admin pages
//   - Active-link highlighting via client nav component
//   - Dark admin theme (bg gradient + white text)
//
// Pages:
//   /admin                   — Dashboard overview
//   /admin/vocab-submissions — Vocabulary crowdsourcing review (Phase 7.7)
//   /admin/scene-candidates  — Scene candidate review
//   /admin/exchanges         — Exchange editor
//   /admin/providers         — Provider browser
//
// Version: 2.0.0 — Phase 7.7 Part 6 (navigation)
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import '@/app/globals.css';
import { AdminNav } from './admin-nav';

export const metadata = {
  title: 'Admin · Promagen',
  description: 'Internal control panel for Promagen data sources.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-gradient-to-b from-[#0b1220] to-[#111827] text-white">
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
      </body>
    </html>
  );
}
