"use client";
import * as React from "react";

/**
 * Dependency-free Button (no radix, no cva, no cn).
 * Keeps the same API: `variant`, `size`, `className`, and passes through native props.
 */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "sm" | "default" | "lg" | "icon";
};

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const byVariant: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

const bySize: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 rounded-md px-3",
  default: "h-9 px-4 py-2",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
};

export default function Button({
  className = "",
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[base, byVariant[variant], bySize[size], className].join(" ").trim()}
      {...props}
    />
  );
}



