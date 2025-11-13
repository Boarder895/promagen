// src/components/nav/tab.tsx
import React, { ButtonHTMLAttributes } from "react";

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

export function Tab({
  id,
  label,
  selected = false,
  onSelect,
  disabled = false,
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
      className={`px-3 py-2 rounded-xl border ${
        selected ? "bg-neutral-100" : "bg-white"
      }`}
      {...rest}
    >
      <span className="inline-flex items-center gap-2">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
        {badge ? (
          <span
            className="text-[10px] rounded-full border px-1.5 py-0.5"
            aria-label={`badge ${badge.text}`}
          >
            {badge.text}
          </span>
        ) : null}
      </span>
    </button>
  );
}
