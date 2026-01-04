"use client";
import * as React from "react";

/** Minimal tooltip shim; replace with Radix or shadcn later */
export function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return <span title={text} className="cursor-help">{children}</span>;
}
export default Tooltip;
