"use client";

import { DateTime } from "luxon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type DualTimeTooltipProps = {
  isoLastUpdate: string;     // ISO string when the row was last refreshed
  label?: string;            // e.g., exchange name or provider name
  children: React.ReactNode; // the element to hover on
};

const LONDON_TZ = "Europe/London";

const fmt = (dt: DateTime) => dt.toFormat("ccc d LLL, HH:mm:ss");

export function DualTimeTooltip({ isoLastUpdate, label = "Status", children }: DualTimeTooltipProps) {
  const last = DateTime.fromISO(isoLastUpdate);
  const localStr = fmt(last.setZone(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const londonStr = fmt(last.setZone(LONDON_TZ));

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-[320px]">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 opacity-70" />
            <div className="space-y-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs opacity-80">
                <div><span className="font-semibold">Last update (Local):</span> {localStr}</div>
                <div><span className="font-semibold">Last update (Europe/London):</span> {londonStr}</div>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

