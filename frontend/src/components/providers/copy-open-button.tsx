// src/components/providers/copy-open-button.tsx
"use client";

import { useEffect, useState } from "react";
import CopyHelperPanel from "./copy-helper-panel";
import AffiliateBadge from "@/components/common/affiliate-badge";
import { track } from "@/lib/analytics";
import { writeToClipboard, writeToClipboardFast } from "@/lib/clipboard";
import { saveLocal, loadLocal } from "@/lib/storage";

type Props = {
  providerId: string;
  providerName: string;
  providerUrl: string; // affiliate-safe outbound
  prompt: string;
  tip?: string;
  showAffiliate?: boolean;
  className?: string;
};

const LAST_PROVIDER_KEY = "last-provider";

export default function CopyOpenButton({
  providerId,
  providerName,
  providerUrl,
  prompt,
  tip,
  showAffiliate = true,
  className,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [copiedOk, setCopiedOk] = useState(true);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  useEffect(() => {
    setLastProvider(loadLocal<string | null>(LAST_PROVIDER_KEY, null));
  }, []);

  const openProviderTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onClick = () => {
    // 1) copy fast (no await), 2) open provider immediately, 3) show helper
    writeToClipboardFast(prompt);
    openProviderTab(providerUrl);
    setPanelOpen(true);

    track("copy_open_click", { providerId, providerName });
    saveLocal(LAST_PROVIDER_KEY, providerId);
    setLastProvider(providerId);
  };

  const handleRetryCopy = async () => {
    // Your clipboard util likely returns void; treat success optimistically.
    await writeToClipboard(prompt);
    setCopiedOk(true);
    track("copy_retry", { providerId, ok: true });
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          className={
            className ??
            "inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          }
          aria-label={`Copy prompt and open ${providerName}`}
        >
          Copy & Open in {providerName}
        </button>
        {showAffiliate && <AffiliateBadge />}
      </div>

      {tip ? <p className="mt-2 text-xs text-neutral-500">{tip}</p> : null}
      {lastProvider && lastProvider === providerId ? (
        <p className="mt-1 text-[11px] text-neutral-400">Last used here recently.</p>
      ) : null}

      <CopyHelperPanel
        open={panelOpen}
        providerName={providerName}
        onClose={() => setPanelOpen(false)}
        copiedOk={copiedOk}
        onRetry={copiedOk ? undefined : handleRetryCopy}
      />
    </div>
  );
}

