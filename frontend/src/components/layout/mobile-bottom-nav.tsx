// src/components/layout/mobile-bottom-nav.tsx
// ============================================================================
// MOBILE BOTTOM NAV — Persistent navigation for <768px screens (Part 1)
// ============================================================================
// Solves the "trapped on one page" problem: mobile users can now reach
// every key section of Promagen from any page.
//
// Shows on ALL pages below md breakpoint (768px).
// Hidden on tablet+ via md:hidden — desktop/laptop completely untouched.
//
// Design: Glass-dark bottom bar, 4 navigation items.
// Active state: sky-400 with gradient accent bar above icon.
// Safe area: Accounts for iPhone home indicator via env(safe-area-inset-bottom).
//
// Items: Home | Pro | Lab (Desktop badge) | Saved
//
// Existing features preserved: Yes — zero changes to tablet/desktop rendering
// ============================================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ============================================================================
// NAV ICONS — Inline SVGs, sized with clamp() per code-standard.md
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

function ProIcon({ active }: { active: boolean }) {
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
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function LabIcon({ active }: { active: boolean }) {
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
      <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.456 1.455A2.25 2.25 0 005.13 20h13.74a2.25 2.25 0 001.586-3.845L19 14.5M5 14.5h14" />
    </svg>
  );
}

function SavedIcon({ active }: { active: boolean }) {
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
      <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
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
  /** Small badge shown below label (e.g. "Desktop") */
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/pro-promagen', label: 'Pro', icon: ProIcon },
  { href: '/studio/playground', label: 'Lab', icon: LabIcon, badge: 'Desktop' },
  { href: '/studio/library', label: 'Saved', icon: SavedIcon },
];

// ============================================================================
// ACTIVE STATE DETECTION
// ============================================================================

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
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
          height: 'clamp(28px, 7vw, 36px)',
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
              {/* Active indicator — gradient bar above icon */}
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

              {/* Icon */}
              <Icon active={active} />

              {/* Label */}
              <span
                className="font-medium leading-none"
                style={{ fontSize: 'clamp(0.5rem, 2vw, 0.6rem)' }}
              >
                {item.label}
              </span>

              {/* Optional badge (e.g. "Desktop" on Lab) */}
              {item.badge && (
                <span
                  className="rounded-full border font-medium leading-none"
                  style={{
                    fontSize: 'clamp(0.4rem, 1.5vw, 0.45rem)',
                    padding: '1px 4px',
                    borderColor: active
                      ? 'rgba(56, 189, 248, 0.4)'
                      : 'rgba(255, 255, 255, 0.15)',
                    color: active ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
