// src/components/PromptGrid.tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import PromptCard from "./PromptCard";
import PromptDrawer from "./PromptDrawer";
import {
  allTags as seedAllTags,
  getCurated,
  getTrending,
  getCommunity,
  seedPrompts,
  type Prompt,
} from "@/data/prompts";
import { usePromptsSWR } from "@/lib/api";

type Tab = "curated" | "trending" | "community";

export default function PromptGrid({ initialId }: { initialId?: string }) {
  const [tab, setTab] = useState<Tab>("curated");
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [open, setOpen] = useState<Prompt | null>(null);

  const sort = tab === "trending" ? "trending" : tab === "curated" ? "trending" : "createdAt";
  const firstTag = activeTags[0];

  const { data, error, isLoading } = usePromptsSWR({
    q: query || undefined,
    tag: firstTag,
    sort,
    limit: 200,
  });

  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const apiItems = data?.items ?? null;

  const items = useMemo(() => {
    let base: Prompt[] =
      apiItems !== null
        ? apiItems.slice()
        : tab === "curated"
        ? getCurated()
        : tab === "trending"
        ? getTrending()
        : getCommunity();

    if (apiItems !== null) {
      if (tab === "curated") base = base.filter((p) => p.curated);
      if (tab === "community") base = base.filter((p) => !p.curated);
    }

    base = base.filter((p) => activeTags.length === 0 || activeTags.every((t) => p.tags.includes(t)));

    if (apiItems === null && query.trim()) {
      const q = query.toLowerCase();
      base = base.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.provider.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return base;
  }, [apiItems, tab, activeTags, query]);

  const currentId = (search.get("id") ?? initialId) || undefined;
  const current = useMemo(
    () => (currentId ? (apiItems ?? seedPrompts).find((x) => x.id === currentId) || null : null),
    [apiItems, currentId],
  );

  const openPrompt = (p: Prompt) => {
    setOpen(p);
    const qs = new URLSearchParams(search.toString());
    qs.set("id", p.id);
    router.replace(`${pathname}?${qs.toString()}`);
  };
  const closePrompt = () => {
    setOpen(null);
    const qs = new URLSearchParams(search.toString());
    qs.delete("id");
    router.replace(qs.size ? `${pathname}?${qs}` : pathname);
  };
  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(["curated", "trending", "community"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs ring-1 ${
              tab === t ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-800 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 rounded-md border px-7 py-1.5 text-sm outline-none ring-0 placeholder:text-gray-400"
            placeholder="Search prompts, tags, authors…"
          />
        </div>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2">
        {(apiItems
          ? Array.from(new Set(apiItems.flatMap((p: any) => p.tags))).sort((a, b) => a.localeCompare(b))
          : seedAllTags()
        ).map((t) => {
          const active = activeTags.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`rounded-full px-3 py-1 text-xs ring-1 ${
                active ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-800 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              #{t}
            </button>
          );
        })}
        {activeTags.length > 0 && (
          <button
            onClick={() => setActiveTags([])}
            className="rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Clear tags
          </button>
        )}
      </div>

      {/* Status */}
      <div className="text-xs text-gray-500">
        {isLoading ? "Loading live prompts…" : error ? "Using fallback prompts (offline)." : "Live prompts loaded."}
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <PromptCard key={p.id} item={p} onOpen={openPrompt} />
        ))}
        {items.length === 0 && (
          <div className="col-span-full rounded-xl border p-6 text-center text-sm text-gray-600">
            No prompts match your filters.
          </div>
        )}
      </div>

      <PromptDrawer prompt={open ?? current} onClose={closePrompt} />
    </div>
  );
}
