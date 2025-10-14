"use client";
import * as React from "react";
export default function Chip({ children }: { children: React.ReactNode }) {
  return <span style={{padding:"2px 8px", border:"1px solid #ddd", borderRadius:999}}>{children}</span>;
}
