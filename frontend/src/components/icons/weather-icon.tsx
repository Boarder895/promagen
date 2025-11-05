// Minimal, dependency-free weather icons.
// kind: "clear" | "partly-cloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "showers"
//       | "snow" | "snow-showers" | "thunder" | "thunder-hail" | "unknown"

import * as React from "react";

type Props = {
  kind: string;
  className?: string;
};

// One stroke style that works for both <path> and <circle>
type StrokeAttrs = Partial<React.SVGProps<SVGPathElement> & React.SVGProps<SVGCircleElement>>;
const strokeAttrs: StrokeAttrs = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export default function WeatherIcon({ kind, className }: Props) {
  const k = (kind || "unknown").toLowerCase();

  if (k === "clear") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="clear">
        <circle cx="12" cy="12" r="4.5" {...strokeAttrs} />
        <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "partly-cloudy") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="partly cloudy">
        <circle cx="8" cy="8" r="3.5" {...strokeAttrs} />
        <path d="M9 17h7a3 3 0 0 0 0-6 4.5 4.5 0 0 0-8.6-1.6" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "cloudy") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="cloudy">
        <path d="M7 17h9a4 4 0 0 0 0-8 6 6 0 0 0-11.5-2" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "fog") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="fog">
        <path d="M6 9h12M4 13h16M6 17h12" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "drizzle") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="drizzle">
        <path d="M7 15h9a3 3 0 0 0 0-6 5.5 5.5 0 0 0-10.4-1.9" {...strokeAttrs} />
        <path d="M9 19l-1 2M12 19l-1 2M15 19l-1 2" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "rain" || k === "showers") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="rain">
        <path d="M7 14h9a3.5 3.5 0 0 0 0-7 6 6 0 0 0-11.5-2" {...strokeAttrs} />
        <path d="M8 16l-1.2 3M12 16l-1.2 3M16 16l-1.2 3" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "snow" || k === "snow-showers") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="snow">
        <path d="M7 14h9a3.5 3.5 0 0 0 0-7 6 6 0 0 0-11.5-2" {...strokeAttrs} />
        <path d="M8 18l.5.5M10.5 19.5l.5.5M13 18l.5.5M15.5 19.5l.5.5M11 21l.5.5" {...strokeAttrs} />
      </svg>
    );
  }

  if (k === "thunder" || k === "thunder-hail") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="thunder">
        <path d="M7 13h9a3.2 3.2 0 0 0 0-6.4A6 6 0 0 0 4.5 4" {...strokeAttrs} />
        <path d="M11 14l-2 4h3l-1 4 4-6h-3l2-2z" {...strokeAttrs} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="unknown">
      <circle cx="12" cy="12" r="9" {...strokeAttrs} />
      <path d="M9 9a3 3 0 1 1 5 2c-.8.7-1 1-1 2M12 18h.01" {...strokeAttrs} />
    </svg>
  );
}




