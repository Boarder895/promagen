"use client";
import * as React from "react";

export default function ExchangesRibbon() {
  return (
    <div className="flex gap-2 overflow-x-auto py-2 text-xs">
      {/* TODO: render live exchange statuses */}
      <span className="px-2 py-1 rounded border">NYSE</span>
      <span className="px-2 py-1 rounded border">NASDAQ</span>
      <span className="px-2 py-1 rounded border">LSE</span>
    </div>
  );
}



