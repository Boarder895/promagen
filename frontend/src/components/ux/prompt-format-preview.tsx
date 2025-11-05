'use client';

import { useMemo } from 'react';

interface Props {
  providerId: string;
  corePrompt: string;
  negatives?: string;
  ar?: string;     // e.g. "16:9"
  version?: string; // e.g. "5"
  styleLabel?: string; // e.g. "cute"
}

export default function PromptFormatPreview({
  providerId,
  corePrompt,
  negatives,
  ar,
  version,
  styleLabel,
}: Props) {
  const preview = useMemo(() => {
    const base = corePrompt.trim();

    switch (providerId) {
      case 'midjourney': {
        const flags = [
          ar ? `--ar ${ar}` : null,
          version ? `--v ${version}` : null,
          styleLabel ? `--style ${styleLabel}` : null,
          negatives ? `--no ${negatives}` : null,
        ]
          .filter(Boolean)
          .join(' ');
        return `${base}${flags ? ' ' + flags : ''}`;
      }
      case 'stability':
      case 'lexica':
      case 'playground':
      case 'nightcafe':
        return [
          `Positive: ${base}`,
          negatives ? `Negative: ${negatives}` : null,
        ]
          .filter(Boolean)
          .join('  |  ');
      default:
        return base;
    }
  }, [providerId, corePrompt, negatives, ar, version, styleLabel]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
      <div className="font-medium mb-1">Prompt preview ({providerId})</div>
      <pre className="whitespace-pre-wrap break-words">{preview}</pre>
    </div>
  );
}



