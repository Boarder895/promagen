"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PromptCard from "./PromptCard";
import type { Prompt } from "@/hooks/usePrompts";

export default function ProviderGrid({ prompts, initialId }: { prompts: Prompt[]; initialId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const path = pathname ?? "/";
  const currentId = (search?.get("id") ?? initialId) || undefined;

  function select(id?: string) {
    const qs = new URLSearchParams(search ? search.toString() : "");
    if (id) qs.set("id", id);
    else qs.delete("id");
    router.replace(qs.size ? `${path}?${qs}` : path);
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {prompts.map((p) => (
        <button
          key={p.id}
          className={`text-left ${currentId === p.id ? "ring-2 ring-indigo-500 rounded-xl" : ""}`}
          onClick={() => select(p.id)}
        >
          <PromptCard prompt={p} />
        </button>
      ))}
    </div>
  );
}
