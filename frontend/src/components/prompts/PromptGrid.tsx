"use client";
import React from "react";
import { usePromptsSWR } from "@/lib/hooks/usePrompts";
import type { PromptQuery } from "@/lib/api";

export default function PromptGrid(props: { query?: PromptQuery }) {
  const { data, isLoading, error } = usePromptsSWR(props.query ?? { page: 1, pageSize: 20 });

  if (isLoading) return <div className="p-4">Loadingâ€¦</div>;
  if (error) return <div className="p-4 text-red-600">Failed to load prompts.</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {data.items.map((p) => (
        <div key={p.id} className="border rounded-lg p-3">
          <div className="font-semibold">{p.title}</div>
          <div className="text-sm opacity-80">{p.prompt}</div>
          <div className="text-xs mt-2">â¤ï¸ {p.likes}</div>
        </div>
      ))}
    </div>
  );
}
