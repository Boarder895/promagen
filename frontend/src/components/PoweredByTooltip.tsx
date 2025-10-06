"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

type PoweredByTooltipProps = {
  sources: Array<{ name: string; weight?: number; note?: string }>; // top 3
  children: React.ReactNode;
};

export function PoweredByTooltip({ sources, children }: PoweredByTooltipProps) {
  const items = sources.slice(0, 3);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-[320px]">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 opacity-70" />
            <div>
              <div className="text-sm font-medium mb-1">Powered by</div>
              <ul className="text-xs opacity-90 space-y-1">
                {items.map((s, i) => (
                  <li key={i}>
                    <span className="font-semibold">{s.name}</span>
                    {typeof s.weight === "number" ? <span> Ã¢â‚¬â€ {s.weight}%</span> : null}
                    {s.note ? <span className="opacity-80"> Ã‚Â· {s.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

