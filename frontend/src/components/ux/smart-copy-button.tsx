'use client';

import { useState } from 'react';
import Toast from '@/components/ui/toast';
import { pushCopyHistory } from '@/lib/prompt-state';
import { recordEvent } from '@/lib/telemetry';

type Props = {
  providerId: string;
  providerName: string;
  prompt: string;
  promptStyle?: string;
  className?: string;
};

export default function SmartCopyButton({
  providerId,
  providerName,
  prompt,
  promptStyle,
  className,
}: Props) {
  const [show, setShow] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(prompt);

      // Keep history payload limited to known fields
      pushCopyHistory({
        providerId,
        providerName,
        promptStyle,
        prompt,
      });

      // Timestamp stays in telemetry (not in history object)
      recordEvent('copies', providerId, Date.now());
      setShow(true);
    } catch {
      // optional: add error toast
    }
  }

  const subtitle = [
    `? ${providerName}`,
    promptStyle ? `?? ${promptStyle}` : null,
    new Date().toLocaleTimeString(),
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <>
      <button
        type="button"
        onClick={onCopy}
        className={`rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 transition ${className ?? ''}`}
      >
        Copy prompt
      </button>
      <Toast
        show={show}
        onDone={() => setShow(false)}
        title="Copied to clipboard"
        subtitle={subtitle}
      />
    </>
  );
}

