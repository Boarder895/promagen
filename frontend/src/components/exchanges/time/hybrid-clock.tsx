// frontend/src/components/exchanges/time/hybrid-clock.tsx
'use client';

import * as React from 'react';

export type HybridClockProps = {
  /**
   * IANA timezone identifier (e.g. "Asia/Tokyo", "Europe/London")
   */
  tz: string;

  /**
   * Analog clock diameter in pixels
   * @default 32
   */
  analogSize?: number;

  /**
   * Optional CSS class name for the wrapper
   */
  className?: string;

  /**
   * Optional aria-label for accessibility
   * @default "Local time"
   */
  ariaLabel?: string;
};

/**
 * HybridClock - Digital time display with small analog clock below.
 *
 * Design:
 * ┌─────────────┐
 * │   14:23     │  ← Digital readout (HH:MM, 24-hour)
 * │   ╭───╮     │
 * │   │ ╲ │     │  ← Small analog clock
 * │   ╰───╯     │
 * └─────────────┘
 *
 * Features:
 * - Digital time for quick reading (HH:MM format)
 * - Analog clock for visual appeal
 * - Updates every second
 * - Uses native Intl.DateTimeFormat for timezone handling
 * - Respects prefers-reduced-motion (hides second hand)
 * - Cleans up interval on unmount
 *
 * @example
 * ```tsx
 * <HybridClock tz="Asia/Tokyo" />
 * <HybridClock tz="Europe/London" analogSize={28} />
 * ```
 */
export const HybridClock = React.memo(function HybridClock({
  tz,
  analogSize = 32,
  className = '',
  ariaLabel = 'Local time',
}: HybridClockProps) {
  const [time, setTime] = React.useState<{ h: number; m: number; s: number }>({
    h: 0,
    m: 0,
    s: 0,
  });

  React.useEffect(() => {
    const updateTime = () => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        const parts = formatter.formatToParts(new Date());
        const getValue = (type: string): number => {
          const part = parts.find((p) => p.type === type);
          return part ? parseInt(part.value, 10) : 0;
        };

        setTime({
          h: getValue('hour'),
          m: getValue('minute'),
          s: getValue('second'),
        });
      } catch {
        // Invalid timezone - show 12:00:00
        setTime({ h: 12, m: 0, s: 0 });
      }
    };

    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, [tz]);

  // Format digital time (HH:MM)
  const digitalTime = `${String(time.h).padStart(2, '0')}:${String(time.m).padStart(2, '0')}`;

  // Calculate hand rotations (degrees from 12 o'clock)
  const hourRotation = (time.h % 12) * 30 + time.m * 0.5;
  const minuteRotation = time.m * 6 + time.s * 0.1;
  const secondRotation = time.s * 6;

  // SVG dimensions
  const center = 50;
  const faceRadius = 45;
  const hourLength = 20;
  const minuteLength = 30;
  const secondLength = 36;

  // Generate hour markers (12 tick marks)
  const hourMarkers = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const innerRadius = 36;
    const outerRadius = 42;
    return {
      x1: center + innerRadius * Math.cos(angle),
      y1: center + innerRadius * Math.sin(angle),
      x2: center + outerRadius * Math.cos(angle),
      y2: center + outerRadius * Math.sin(angle),
    };
  });

  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${className}`}
      role="group"
      aria-label={`${ariaLabel}: ${digitalTime}`}
    >
      {/* Digital time display */}
      <time
        dateTime={new Date().toISOString()}
        className="font-mono text-base font-semibold tabular-nums text-slate-100"
        aria-hidden="true"
      >
        {digitalTime}
      </time>

      {/* Analog clock */}
      <svg
        width={analogSize}
        height={analogSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Clock face */}
        <circle
          cx={center}
          cy={center}
          r={faceRadius}
          fill="rgba(255, 255, 255, 0.03)"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1.5"
        />

        {/* Hour markers */}
        {hourMarkers.map((marker, i) => (
          <line
            key={i}
            x1={marker.x1}
            y1={marker.y1}
            x2={marker.x2}
            y2={marker.y2}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={i % 3 === 0 ? 3 : 1.5}
            strokeLinecap="round"
          />
        ))}

        {/* Hour hand */}
        <line
          x1={center}
          y1={center}
          x2={center + hourLength * Math.sin((hourRotation * Math.PI) / 180)}
          y2={center - hourLength * Math.cos((hourRotation * Math.PI) / 180)}
          stroke="rgb(226, 232, 240)" // slate-200
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <line
          x1={center}
          y1={center}
          x2={center + minuteLength * Math.sin((minuteRotation * Math.PI) / 180)}
          y2={center - minuteLength * Math.cos((minuteRotation * Math.PI) / 180)}
          stroke="rgb(226, 232, 240)" // slate-200
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Second hand */}
        <line
          x1={center}
          y1={center}
          x2={center + secondLength * Math.sin((secondRotation * Math.PI) / 180)}
          y2={center - secondLength * Math.cos((secondRotation * Math.PI) / 180)}
          stroke="rgb(239, 68, 68)" // red-500
          strokeWidth="1.5"
          strokeLinecap="round"
          className="motion-safe:block motion-reduce:hidden"
        />

        {/* Center dot */}
        <circle cx={center} cy={center} r="4" fill="rgb(226, 232, 240)" />
        <circle
          cx={center}
          cy={center}
          r="2.5"
          fill="rgb(239, 68, 68)"
          className="motion-safe:block motion-reduce:hidden"
        />
      </svg>
    </div>
  );
});

export default HybridClock;
