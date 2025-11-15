"use client";

import * as React from "react";
import Button from "@/components/ui/button";

export default function PromptPlayground() {
  const [text, setText] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  const pct = Math.min(100, text.length % 101);

  const handleRun = () => {
    if (!text.trim()) {
      setStatus("Add a prompt first to try the playground.");
      return;
    }

    setStatus("Prompt captured locally. Wiring to a model comes next.");
  };

  return (
    <div className="space-y-4 p-6">
      <textarea
        className="w-full rounded-2xl border border-white/15 bg-black/30 p-3 text-sm text-white outline-none"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a prompt…"
      />

      <div className="flex items-centre gap-3">
        <Button type="button" onClick={handleRun}>
          Run
        </Button>
        <span className="text-sm text-white/60">{pct}%</span>
      </div>

      {status && (
        <p className="text-xs text-white/70" aria-live="polite">
          {status}
        </p>
      )}

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-white/50 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
