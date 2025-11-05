"use client";

import * as React from "react";

export type ProgressBarProps = {
  /** 0..100 */
  value: number;
  className?: string;
  label?: string;
};

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      {label ? <div className="mb-1 text-sm opacity-70">{label}</div> : null}
      <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800">
        <div
          className="h-2 rounded bg-blue-600 transition-[width]"
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
    </div>
  );
}

// Allow both `import ProgressBar from ...` and `import { ProgressBar } from ...`
export default ProgressBar;








