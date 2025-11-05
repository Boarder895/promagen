"use client";

import { type ReactNode } from "react";

export function PromptRunnerLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-4xl p-4">{children}</div>;
}

export default PromptRunnerLayout;

