import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge Tailwind class names safely.
 * Used across shadcn-style components (Buttons, Cards, Tabs, etc.).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
