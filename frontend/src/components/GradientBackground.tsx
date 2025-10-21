"use client";
import { useMemo } from "react";
import { tempToColor, blend } from "@/lib/color";
import type { RibbonMarket } from "@/types/ribbon";

type Props = { markets?: RibbonMarket[] };

export default function GradientBackground({ markets = [] }: Props) {
  const { leftColor, rightColor } = useMemo(() => {
    const east = markets.filter(m => m.exchange.longitude > 0);
    const west = markets.filter(m => m.exchange.longitude <= 0);
    const avg = (xs: RibbonMarket[]) => {
      const vals = xs.map(m => m.weather?.tempC).filter((v): v is number => typeof v === "number");
      if (!vals.length) return 18;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return { leftColor: tempToColor(avg(east)), rightColor: tempToColor(avg(west)) };
  }, [markets]);

  const style = useMemo(() => ({ background: blend(leftColor, rightColor), transition: "background 6s ease" }), [
    leftColor,
    rightColor,
  ]);

  return <div style={{ position: "fixed", inset: 0, zIndex: -1, ...style }} aria-hidden />;
}


