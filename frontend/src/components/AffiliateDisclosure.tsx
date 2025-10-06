'use client';

import { useEffect, useState } from 'react';

export const AffiliateDisclosure = () => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const v = window.localStorage.getItem('af_disclosure_ack');
    if (v === '1') setVisible(false);
  }, []);
  if (!visible) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-200 via-fuchsia-200 to-sky-200 px-4 py-2 text-xs text-slate-900 shadow">
      Some links are affiliate links. We may earn a commissionÃ¢â‚¬â€at no extra cost to you.{' '}
      <button
        className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold shadow"
        onClick={() => {
          window.localStorage.setItem('af_disclosure_ack', '1');
          setVisible(false);
        }}
      >
        Got it
      </button>
    </div>
  );
};

