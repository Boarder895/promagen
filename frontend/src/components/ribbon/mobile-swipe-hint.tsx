'use client';

import React, { useEffect, useState } from 'react';

const KEY = 'promagen.fx.swipehint.dismissed';

export default function MobileSwipeHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') {return;}
    const dismissed = window.localStorage.getItem(KEY) === '1';
    if (!dismissed && window.innerWidth < 768) {setShow(true);}
  }, []);
  if (!show) {return null;}

  function dismiss() {
    try { window.localStorage.setItem(KEY, '1'); } catch {}
    setShow(false);
  }

  return (
    <div className="sm:hidden mt-1 flex items-center justify-center">
      <button
        type="button"
        onClick={dismiss}
        className="text-[11px] text-neutral-400 bg-white/5 ring-1 ring-white/10 rounded-full px-2 py-0.5"
        aria-label="Dismiss swipe hint"
      >
        Swipe to view ⟶
      </button>
    </div>
  );
}
