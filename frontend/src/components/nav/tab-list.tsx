// src/components/nav/tab-list.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import providersTabs from "@/data/tabs/providers.json";
import type { TabItem } from "@/types/nav";
import NavTab from "./tab";

function isActivePath(current: string, href: string) {
  return current === href || (href !== "/" && current.startsWith(href));
}

export default function ProvidersTabList() {
  const pathname = usePathname() || "/";

  // Treat JSON as the typed, single source of truth
  const items = providersTabs as TabItem[];

  const listRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Overflow detection + edge shadow state
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const check = () => {
      const overflow = el.scrollWidth > el.clientWidth + 2;
      setHasOverflow(overflow);
      setAtStart(el.scrollLeft <= 1);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  // Ensure the active tab is scrolled into view on route changes
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("[aria-current='page']");
    active?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [pathname]);

  return (
    <div className="relative">
      {/* Peek shadows */}
      {hasOverflow && !atStart && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[rgba(0,0,0,.08)] to-transparent dark:from-[rgba(255,255,255,.08)]" />
      )}
      {hasOverflow && !atEnd && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[rgba(0,0,0,.08)] to-transparent dark:from-[rgba(255,255,255,.08)]" />
      )}

      <nav
        ref={listRef}
        role="tablist"
        aria-label="Providers"
        className="flex gap-1 rounded-2xl bg-neutral-50 p-1 dark:bg-neutral-900/40 overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700"
      >
        {items.map((t) => (
          <NavTab
            key={t.id}
            id={t.id}
            label={t.label}
            href={t.href!}
            isActive={isActivePath(pathname, t.href!)}
            disabled={t.disabled}
            icon={t.icon}
            badge={t.badge}
          />
        ))}
      </nav>
    </div>
  );
}

