"use client";
export default function ModeChip({ mode }: { mode: "real" | "simulated" | "disabled" }) {
  const map = {
    real:       { t: "API",       c: "border-green-300 bg-green-50", dot: "#16a34a" },
    simulated:  { t: "Simulated", c: "border-gray-300 bg-gray-50",  dot: "#6b7280" },
    disabled:   { t: "Disabled",  c: "border-amber-300 bg-amber-50", dot: "#d97706" },
  }[mode];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs border ${map.c}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: map.dot }} />
      {map.t}
    </span>
  );
}




