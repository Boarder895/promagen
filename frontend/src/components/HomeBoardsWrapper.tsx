"use client";

import React from "react";
import { NowCursorProvider } from "@/contexts/NowCursorContext";

export function HomeBoardsWrapper({ children }: { children: React.ReactNode }) {
  // Single place to host shared cursor/any future shared board context.
  return <NowCursorProvider>{children}</NowCursorProvider>;
}

