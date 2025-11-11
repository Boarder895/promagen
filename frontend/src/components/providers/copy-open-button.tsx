"use client";

import React, { useEffect, useState } from "react";
import AffiliateBadge from "@/components/common/affiliate-badge"; // default export ?
import { KEYS } from "@/lib/storage.keys";
import { writeSchema, readSchema } from "@/lib/storage";

type Props = {
  providerId: string;
  providerName: string;
  providerUrl: string;
  showAffiliate?: boolean;
  className?: string;
};

const V = 1; // storage schema version

/**
 * CopyOpenButton
 * - Opens the provider URL in a new tab (noopener, noreferrer).
 * - Persists the last visited provider using versioned localStorage.
 * - Shows a tiny helper state on success (no toasts; calm UI).
 */
export default function CopyOpenButton({
  providerId,
  providerName,
  providerUrl,
  showAffiliate = true,
  className,
}: Props) {
  const [opening, setOpening] = useState(false);
  const [lastProviderId, setLastProviderId] = useState<string | null>(null);

  // Read the last known provider id on mount (for subtle UI hints if desired)
  useEffect(() => {
    try {
      const v = readSchema<string | null>(KEYS.providers.lastV1, V, null);
      setLastProviderId(v ?? null);
    } catch {
      setLastProviderId(null);
    }
  }, []);

  function openOutbound(url: string) {
    // Safe outbound open
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (opening) return;
    setOpening(true);

    try {
      // Persist last provider id (versioned)
      writeSchema<string | null>(KEYS.providers.lastV1, V, providerId);

      // Open immediately (optimistic)
      openOutbound(providerUrl);
    } finally {
      setOpening(false);
    }
  }

  // Optional tiny hint if the same as last
  const isRepeat = lastProviderId === providerId;

  return (
    <div className={className}>
      {showAffiliate && <AffiliateBadge />}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open ${providerName} in a new tab`}
        title={`Open ${providerName}`}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-700/60 bg-zinc-900/70 px-3 py-2
                   text-sm text-zinc-100 hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
        data-testid="copy-open-button"
      >
        <span className="i-lucide-external-link" aria-hidden />
        <span>{opening ? "Opening…" : `Open ${providerName}`}</span>
        {isRepeat && (
          <span className="ml-1 text-xs text-emerald-400/90" aria-hidden>
            (last)
          </span>
        )}
      </button>
    </div>
  );
}
