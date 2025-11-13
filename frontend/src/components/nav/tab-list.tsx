"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

/**
 * ProvidersTabList
 * A tiny, accessible nav presented as a tablist.
 * Tests expect:
 *  - aria-label "Providers"
 *  - Links labelled "Leaderboard", "Trends", "Compare"
 *  - Deterministic order: Leaderboard < Trends < Compare
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

// If you later add JSON config, swap in a loader here.
// import tabsConfig from "@/data/providers.tabs.json" assert { type: "json" };
// const TABS: TabLink[] = tabsConfig?.tabs?.length ? tabsConfig.tabs : DEFAULT_TABS;
const TABS: TabLink[] = DEFAULT_TABS;

export default function ProvidersTabList(): JSX.Element {
  const pathname = usePathname() || "/providers";

  return (
    <div
      role="tablist"
      aria-label="Providers"
      data-testid="providers-tablist"
      className="flex gap-2"
    >
      {TABS.map((t) => {
        const selected = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="link"
            aria-current={selected ? "page" : undefined}
            className="rounded px-3 py-1 text-sm data-[active=true]:font-semibold outline-none focus-visible:ring"
            data-active={selected ? "true" : "false"}
          >
            {t.label}
          </Link>
        );
      })}
      {TABS.length === 0 && (
        <span role="note" className="text-xs opacity-70">
          No tabs configured.
        </span>
      )}
    </div>
  );
}
