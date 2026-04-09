// src/components/authority/breadcrumb.tsx
// ============================================================================
// AUTHORITY BREADCRUMB — Reusable navigation component
// ============================================================================
// Typed, accessible breadcrumb with proper ARIA markup and consistent styling.
//
// Previously duplicated as raw JSX in:
//   - src/app/platforms/page.tsx (hub)
//   - src/app/platforms/[platformId]/page.tsx (profile)
//
// RULES:
//   - All sizing via clamp()
//   - cursor-pointer on link elements
//   - Zero banned greys — amber for links, white for current
//   - Proper ARIA: aria-label="Breadcrumb", aria-current="page" on last item
//
// Authority: code-standard.md §14 (No grey text)
// ============================================================================

import React from 'react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        fontSize: 'clamp(12px, 0.85vw, 14px)',
        marginBottom: 'clamp(16px, 2vw, 28px)',
      }}
    >
      <ol className="flex items-center" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <React.Fragment key={item.label}>
              {i > 0 && (
                <li className="text-white" aria-hidden="true">
                  /
                </li>
              )}
              <li>
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-white font-medium" aria-current={isLast ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
