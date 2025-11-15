// src/components/nav/tab.tsx
import type { ButtonHTMLAttributes } from "react";
import React from "react";

export type TabBadge = { text: string } | undefined;

export type TabProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  id: string;
  label: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
  disabled?: boolean;
  icon?: string;
  badge?: TabBadge;
};

export default function Tab({
  id,
  label,
  selected = false,
  onSelect,
  disabled,
  icon,
  badge,
  ...rest
}: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`${id}-panel`}
      id={id}
      disabled={disabled}
      onClick={() => onSelect?.(id)}
      className={`rounded-xl border px-3 py-2 ${
        selected ? "bg-neutral-100" : "bg-white"
      }`}
      {...rest}
    >
      <span className="inline-flex items-centre gap-2">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
        {badge ? (
          <span
            className="rounded-full border px-1.5 py-0.5 text-[10px]"
            aria-label={`badge ${badge.text}`}
          >
            {badge.text}
          </span>
        ) : null}
      </span>
    </button>
  );
}
