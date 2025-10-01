"use client";

import { useState } from "react";

/**
 * Client Component that owns its interactivity.
 * This prevents the â€œEvent handlers cannot be passed to Client Component propsâ€
 * error you saw when handlers were created in a Server Component.
 */
export default function RunPanel({ initialLabel }: { initialLabel: string }) {
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState(initialLabel);

  function handleClick() {
    // Do whatever you need here (navigate, start a job, etc.)
    setCount((c) => c + 1);
    setLabel((l) => (l === "Run" ? "Runningâ€¦" : "Run"));
    // Example: console log to prove it works
    console.log("RunPanel clicked; count =", count + 1);
  }

  return (
    <section className="rounded-2xl border p-4 space-y-3">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-xl border px-4 py-2 hover:bg-gray-50"
        aria-label={label}
        title={label}
      >
        {label}
      </button>

      <div className="text-sm opacity-70">
        Clicked <span className="font-mono">{count}</span> time{count === 1 ? "" : "s"}.
      </div>
    </section>
  );
}


