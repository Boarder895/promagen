"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

/**
 * ProvidersTabList
 * A tiny, accessible nav presented as a tablist.
 * Tests expect:
 *  - aria-label "Providers"
 *  - links labelled: Leaderboard • Trends • Compare
 *  - deterministic order: Leaderboard then Trends then Compare
 *  - aria-current="page" when the link matches current route
 */

type TabLink = {
  label: string;
  href: string;
};

const DEFAULT_TABS: TabLink[] = [
  { label: "Leaderboard", href: "/providers" },
  { label: "Trends", href: "/providers/trends" },
  { label: "Compare", href: "/providers/compare" },
];

export default function ProvidersTabList(): JSX.Element {
  const pathname = usePathname() || "/providers";

  return (
    <div>
      <div
        role="tablist"
        aria-label="Providers"
        data-testid="providers-tablist"
        className="flex gap-2"
      >
        {DEFAULT_TABS.map((t) => {
          const isActive =
            pathname === t.href ||
            (t.href !== "/providers" && pathname.startsWith(t.href));

          return (
            <Link
              key={t.href}
              href={t.href}
              role="link"
              aria-current={isActive ? "page" : undefined}
              className="px-3 py-1 text-sm data-[active=true]:font-semibold"
              data-active={isActive ? "true" : "false"}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Small a11y-friendly note when no tabs exist (should never show now) */}
      {DEFAULT_TABS.length === 0 && (
        <span role="note" className="text-xs opacity-70">
          No tabs configured.
        </span>
      )}
    </div>
  );
}
