// src/components/layout/mobile-bottom-nav.tsx
// ============================================================================
// MOBILE BOTTOM NAV (v4.0.0)
// ============================================================================
// Items (v4.0.0 — strict commercial-strategy.md):
//   Home | Sentinel | Audit | Contact
//
// Pure Sentinel funnel on mobile. No Platforms, no Lab, no Inspire, no Saved.
// Audit is a deep link to the offer stack at /sentinel#sentinel-offer.
// Contact is a deep link to /sentinel#contact (the SentinelCta block).
//
// Shows on ALL pages below md breakpoint (768px).
// Hidden on tablet+ via md:hidden — desktop/laptop completely untouched.
//
// Authority: docs/authority/commercial-strategy.md §4
// Existing features preserved: Yes — zero changes to tablet/desktop rendering.
// ============================================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ============================================================================
// NAV ICONS — Inline SVGs, sized with clamp() per code-standard
// ============================================================================

const ICON_STYLE: React.CSSProperties = {
  width: 'clamp(14px, 3.5vw, 18px)',
  height: 'clamp(14px, 3.5vw, 18px)',
};

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 1.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={ICON_STYLE}
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function SentinelIcon({ active }: { active: boolean }) {
  // Radar/eye motif — Sentinel watches.
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 1.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={ICON_STYLE}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  );
}

function AuditIcon({ active }: { active: boolean }) {
  // Clipboard with check — pricing / offer stack
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 1.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={ICON_STYLE}
    >
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9z" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  );
}

function ContactIcon({ active }: { active: boolean }) {
  // Envelope
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 1.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={ICON_STYLE}
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 8l9 6 9-6" />
    </svg>
  );
}

// ============================================================================
// NAV ITEMS
// ============================================================================

type NavItem = {
  href: string;
  label: string;
  icon: React.FC<{ active: boolean }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/sentinel', label: 'Sentinel', icon: SentinelIcon },
  { href: '/sentinel#sentinel-offer', label: 'Audit', icon: AuditIcon },
  { href: '/sentinel#contact', label: 'Contact', icon: ContactIcon },
];

// ============================================================================
// ACTIVE STATE DETECTION
// ============================================================================

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  // For anchor links, treat the underlying path as the active match.
  const path = href.split('#')[0];
  if (!path) return false;
  return pathname.startsWith(path);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden shrink-0 border-t border-white/[0.08]"
      aria-label="Mobile navigation"
      style={{
        background: 'rgba(2, 6, 23, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="mx-auto flex items-stretch justify-around"
        style={{
          padding: 'clamp(3px, 0.8vw, 5px) 0',
          maxWidth: '480px',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-row items-center justify-center gap-1 cursor-pointer transition-colors duration-200"
              style={{
                color: active ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)',
              }}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span
                  className="absolute top-0 rounded-full"
                  style={{
                    width: 'clamp(16px, 4vw, 22px)',
                    height: '2px',
                    background: 'linear-gradient(90deg, #38bdf8, #6ee7b7, #818cf8)',
                  }}
                  aria-hidden="true"
                />
              )}

              <Icon active={active} />

              <span
                className="font-medium leading-none"
                style={{ fontSize: 'clamp(0.5rem, 2vw, 0.6rem)' }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
