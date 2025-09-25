"use client";
import React from "react";
import { usePromptsSWR } from "@/lib/hooks/usePrompts";
import type { PromptQuery } from "@/lib/api";

export default function PromptDrawer(props: { query?: PromptQuery }) {
  const { data, isLoading, error } = usePromptsSWR(props.query ?? { page: 1, pageSize: 10 });

  if (isLoading) return <div className="p-3">Loadingâ€¦</div>;
  if (error) return <div className="p-3 text-red-600">Failed to load.</div>;
  if (!data) return null;

  return (
    <aside className="p-3 border-l">
      <h3 className="font-semibold mb-2">Latest</h3>
      <ul className="space-y-2">
        {data.items.slice(0, 5).map((p) => (
          <li key={p.id} className="text-sm">
            {p.title}
          </li>
        ))}
      </ul>
    </aside>
  );
}
