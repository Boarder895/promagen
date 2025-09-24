"use client";

import type { Prompt } from "@/hooks/usePrompts";
import { getAffiliateUrl } from "@/lib/api";
import RunAcrossProvidersButton from "@/components/RunAcrossProvidersButton";

export default function PromptDrawer({ prompt }: { prompt: Prompt }) {
  const text = prompt.body || prompt.summary || prompt.title;
  const affiliateUrl = prompt.provider
    ? getAffiliateUrl(prompt.provider, text, { id: prompt.id, title: prompt.title })
    : null;

  return (
    <div className="space-y-3">
      <div className="text-sm">{text}</div>
      <div className="flex gap-2">
        {affiliateUrl ? (
          <a
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open provider
          </a>
        ) : null}
        <RunAcrossProvidersButton prompt={prompt} />
      </div>
    </div>
  );
}
