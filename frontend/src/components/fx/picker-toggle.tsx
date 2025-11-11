'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

const FxPicker = dynamic(() => import('./picker'), { ssr: false });

type Props = {
  onClose?: () => void;
};

export default function FxPickerToggle(_: Props) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <div className="inline-block">
      <button
        className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls="fxpicker"
      >
        FX Pairs
      </button>

      {open && (
        <div id="fxpicker" className="mt-3">
          <FxPicker maxPairs={5} onClose={close} />
        </div>
      )}
    </div>
  );
}
