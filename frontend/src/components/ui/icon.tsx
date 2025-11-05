"use client";

import * as React from "react";
import { Emoji, type EmojiName } from "@/components/ui/emoji";

/**
 * Icon facade v2 (scaffold):
 * - Default set: "emoji" (uses your emoji bank)
 * - "lucide" placeholder path returns an <abbr> fallback so callers don't break
 *   You can wire lucide-react later without touching callers.
 */

export type IconSet = "emoji" | "lucide";

export type IconProps = {
  name?: EmojiName | string | null;
  set?: IconSet;
  className?: string;
  title?: string;
};

export default function Icon({ name, set = "emoji", className, title }: IconProps) {
  if (!name) return null;

  if (set === "emoji") {
    return <Emoji name={name as EmojiName} className={className} title={title} />;
  }

  // lucide scaffold: show a tiny, unobtrusive fallback token until wired
  return (
    <abbr
      className={`font-mono text-[0.8em] opacity-70 ${className ?? ""}`}
      title={typeof name === "string" ? name : undefined}
      aria-hidden
    >
      âŒ€
    </abbr>
  );
}

