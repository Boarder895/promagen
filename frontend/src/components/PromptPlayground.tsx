"use client";

import * as React from "react";
import Button from "@/components/ui/button";

export default function PromptPlayground() {
  const [text, setText] = React.useState("");

  const pct = Math.min(100, text.length % 101);

  return (
    <div className="p-6 space-y-4">
      <textarea
        className="w-full border border-white/15 rounded-2xl bg-black/30 p-3 outline-none"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a prompt…"
      />

      <div className="flex items-center gap-3">
        <Button onClick={() => alert(text || "No prompt yet")}>Run</Button>
        <span className="text-sm text-white/60">{pct}%</span>
      </div>

      {/* Inline progress (no external ProgressBar component needed) */}
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-white/50 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}





