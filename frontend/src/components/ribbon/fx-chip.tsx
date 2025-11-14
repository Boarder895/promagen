// frontend/src/components/ribbon/fx-chip.tsx
"use client";

import React from "react";

type FxChipProps = {
  base: string;
  quote: string;
  rate?: number | null;
  selected?: boolean;
  onClick?: () => void;
};

function formatRate(rate?: number | null): string {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    return "";
  }
  return rate.toFixed(4);
}

export default function FxChip({
  base,
  quote,
  rate,
  selected = false,
  onClick,
}: FxChipProps): JSX.Element {
  const rateText = formatRate(rate);
  const label = rateText
    ? `${base}/${quote} ${rateText}`
    : `${base}/${quote}`;

  return (
    <button
      type="button"
      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition
        ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}
      `}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
    >
      <span>{base}</span>
      <span className="text-[10px] text-muted-foreground">/</span>
      <span>{quote}</span>
      {rateText ? (
        <span className="text-[10px] text-muted-foreground">{rateText}</span>
      ) : null}
    </button>
  );
}
