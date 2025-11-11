"use client";
import * as React from "react";
import { useTabs } from "./use-tabs";

type Props = {
  id: string;
  panelId: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
};

export default function InpageTab({
  id,
  panelId,
  label,
  icon,
  badge,
  disabled,
}: Props) {
  const { selectedId, setSelectedId } = useTabs();
  const selected = id === selectedId;

  const handleClick = () => {
    if (!disabled) {setSelectedId(id);}
  };

  // Local key handler as a safety net in addition to the container handler
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const key = e.key;
    const code = (e as any).code;
    const isSpace = key === " " || key === "Space" || key === "Spacebar" || code === "Space";
    const isEnter = key === "Enter";
    if ((isSpace || isEnter) && !disabled) {
      e.preventDefault();
      setSelectedId(id);
    }
  };

  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`panel-${panelId}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-md ${
        selected ? "font-semibold underline text-primary" : "opacity-70 hover:opacity-100"
      }`}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      type="button"
    >
      {icon && <span className="text-sm">{icon}</span>}
      <span>{label}</span>
      {badge && <span className="text-xs">{badge}</span>}
    </button>
  );
}

