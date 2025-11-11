"use client";
import * as React from "react";
import { TabsProvider } from "./use-tabs";

export type TabItem = {
  id: string;
  label: string;
  panelId?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  panel?: React.ReactNode;
};

export interface TabsProps {
  items: TabItem[];
  "aria-label"?: string;
  defaultSelectedId?: string;
  persistKey?: string;
  hashSync?: boolean;
  liveLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

function firstEnabled(items: TabItem[]) {
  const f = items.find((t) => !t.disabled);
  return f?.id ?? items[0]?.id ?? "";
}

function readHash() {
  if (typeof window === "undefined") {return null;}
  return window.location.hash ? window.location.hash.slice(1) : null;
}
function writeHash(id: string) {
  if (typeof window === "undefined") {return;}
  if (window.location.hash.slice(1) !== id) {
    window.history.replaceState(null, "", `#${id}`);
  }
}

export default function Tabs({
  items,
  "aria-label": ariaLabel = "tabs",
  defaultSelectedId,
  persistKey,
  hashSync,
  liveLabel = "Tab changed",
  className,
  children,
}: TabsProps) {
  const initial = React.useMemo(() => {
    const h = hashSync ? readHash() : null;
    let p: string | null = null;
    if (persistKey && typeof window !== "undefined") {
      try {
        p = window.localStorage.getItem(persistKey);
      } catch {}
    }
    return h ?? p ?? defaultSelectedId ?? firstEnabled(items);
  }, [items, defaultSelectedId, persistKey, hashSync]);

  const [selectedId, setSelectedId] = React.useState(initial);

  React.useEffect(() => {
    if (hashSync && selectedId) {writeHash(selectedId);}
    if (persistKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(persistKey, selectedId);
      } catch {}
    }
  }, [selectedId, hashSync, persistKey]);

  const liveRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!liveRef.current) {return;}
    const label = items.find((t) => t.id === selectedId)?.label ?? selectedId;
    liveRef.current.textContent = `${liveLabel}: ${label}`;
  }, [selectedId, items, liveLabel]);

  const listRef = React.useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not([disabled])'
    );
    if (!tabs || tabs.length === 0) {return;}

    const arr = Array.from(tabs);
    const currentIndex = arr.findIndex((el) => el === document.activeElement);
    const last = arr.length - 1;

    const focusIndex = (idx: number) => {
      const el = arr[(idx + arr.length) % arr.length];
      if (el) {
        e.preventDefault();
        el.focus();
      }
    };

    const key = e.key;
    const code = (e as any).code;
    const isSpace = key === " " || key === "Space" || key === "Spacebar" || code === "Space";
    const isEnter = key === "Enter";

    switch (key) {
      case "ArrowRight":
        focusIndex(currentIndex + 1);
        return;
      case "ArrowLeft":
        focusIndex(currentIndex - 1);
        return;
      case "Home":
        focusIndex(0);
        return;
      case "End":
        focusIndex(last);
        return;
      default:
        break;
    }

    if (isSpace || isEnter) {
      e.preventDefault();
      const btn = document.activeElement as HTMLButtonElement | null;
      const id = btn?.id?.startsWith("tab-") ? btn.id.slice(4) : null;
      if (id) {setSelectedId(id);}
    }
  };

  const ctx = React.useMemo(
    () => ({ items, selectedId, setSelectedId }),
    [items, selectedId]
  );

  return (
    <TabsProvider value={ctx}>
      <div className={className}>
        <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRef} />
        <div
          role="tablist"
          aria-orientation="horizontal"
          aria-label={ariaLabel}
          ref={listRef}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      </div>
    </TabsProvider>
  );
}

