'use client';
import { useEffect, useState } from 'react';

export function ToastCopyFeedback({
  provider,
  style,
}: {
  provider: string;
  style?: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {return null;}

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white shadow-xl">
        <span>?? Prompt copied for</span>
        <strong className="text-indigo-300">{provider}</strong>
        {style && <span className="text-zinc-400">({style})</span>}
        <span className="text-zinc-400">• {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}




