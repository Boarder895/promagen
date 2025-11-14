// frontend/src/components/ui/live-region.tsx
"use client";

import React from "react";

type LiveRegionProps = {
  /**
   * Text to be announced to assistive technologies.
   * This should be short and avoid rapid changes.
   */
  message: string | null;
};

export default function LiveRegion({ message }: LiveRegionProps): JSX.Element {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
