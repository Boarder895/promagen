"use client";

import { ResponsiveContainer, LineChart, Line, Tooltip as RTooltip, ReferenceLine } from "recharts";
import { useNowCursor } from "@/contexts/NowCursorContext";

type SparkPoint = { t: number; v: number }; // t = index or epoch minutes, v = value
type SparklineProps = {
  data: SparkPoint[];
  height?: number;
};

export function Sparkline({ data, height = 28 }: SparklineProps) {
  const { x, setX } = useNowCursor();
  const idxNow = Math.max(0, data.length - 1);

  return (
    <div className="h-[28px] w-full" onMouseLeave={() => setX(null)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          onMouseMove={(e: any) => {
            if (e?.activeTooltipIndex != null) setX(e.activeTooltipIndex);
          }}
        >
          <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <RTooltip cursor={false} content={<div />} />
          <ReferenceLine x={x ?? idxNow} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

