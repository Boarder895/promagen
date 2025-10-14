"use client";
import * as React from "react";
export default function Card({ children }: { children: React.ReactNode }) {
  return <div style={{padding:16, border:"1px solid #eee", borderRadius:12}}>{children}</div>;
}
