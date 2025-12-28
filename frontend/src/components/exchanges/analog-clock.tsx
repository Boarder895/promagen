// frontend/src/components/exchanges/time/analog-clock.tsx
'use client';

import * as React from 'react';

export type AnalogClockProps = {
  /**
   * IANA timezone identifier (e.g. "Asia/Tokyo", "Europe/London")
   */
  tz: string;

  /**
   * Clock diameter in pixels
   * @default 40
   */
  size?: number;

  /**
   * Optional CSS class name for the wrapper
   */
  className?: string;

  /**
   * Optional aria-label for accessibility
   * @default "Analog clock"
   */
  ariaLabel?: string;
};

/**
 * AnalogClock - Minimalist SVG analog clock with 3 hands.
 *
 * Design:
 * - Clean face with subtle 12 hour marks
 * - Hour hand: short, thick, slate color
 * - Minute hand: medium, medium thickness, slate color
 * - Second hand: long, thin, red accent
 * - Center dot for polish
 *
 * Features:
 * - Updates every second using setInterval
 * - Uses native Intl.DateTimeFormat for timezone handling
 * - Smooth hand positions (no snapping)
 * - Respects prefers-reduced-motion (hides second hand)
 * - Cleans up interval on unmount
 *
 * @example
 * ```tsx
 * <AnalogClock tz="Asia/Tokyo" size={48} />
 * <AnalogClock tz="Europe/London" className="drop-shadow" />
 * ```
 */
export const AnalogClock = React.memo(function AnalogClock({
  tz,
  size = 40,
  className = '',
  ariaLabel = 'Analog clock',
}: AnalogClockProps) {
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

  // Calculate hand rotations (degrees from 12 o'clock)
  // Hour hand: 30° per hour + 0.5° per minute (smooth movement)
  const hourRotation = (time.h % 12) * 30 + time.m * 0.5;
  // Minute hand: 6° per minute + 0.1° per second (smooth movement)
  const minuteRotation = time.m * 6 + time.s * 0.1;
  // Second hand: 6° per second
  const secondRotation = time.s * 6;

  // SVG dimensions (viewBox is 100x100 for easy math)
  const center = 50;
  const faceRadius = 45;

  // Hand lengths (from center)
  const hourLength = 22;
  const minuteLength = 32;
  const secondLength = 38;

  // Generate hour markers (12 tick marks)
  const hourMarkers = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180); // Start from 12 o'clock
    const innerRadius = 38;
    const outerRadius = 43;
    return {
      x1: center + innerRadius * Math.cos(angle),
      y1: center + innerRadius * Math.sin(angle),
      x2: center + outerRadius * Math.cos(angle),
      y2: center + outerRadius * Math.sin(angle),
    };
  });

  return (
    <div
      className={className}
      role="img"
      aria-label={`${ariaLabel}: ${String(time.h).padStart(2, '0')}:${String(time.m).padStart(2, '0')}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Clock face - subtle circle */}
        <circle
          cx={center}
          cy={center}
          r={faceRadius}
          fill="rgba(255, 255, 255, 0.03)"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1"
        />

        {/* Hour markers - subtle ticks */}
        {hourMarkers.map((marker, i) => (
          <line
            key={i}
            x1={marker.x1}
            y1={marker.y1}
            x2={marker.x2}
            y2={marker.y2}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth={i % 3 === 0 ? 2 : 1} // Thicker at 12, 3, 6, 9
            strokeLinecap="round"
          />
        ))}

        {/* Hour hand - short and thick */}
        <line
          x1={center}
          y1={center}
          x2={center + hourLength * Math.sin((hourRotation * Math.PI) / 180)}
          y2={center - hourLength * Math.cos((hourRotation * Math.PI) / 180)}
          stroke="rgb(203, 213, 225)" // slate-300
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Minute hand - medium length and thickness */}
        <line
          x1={center}
          y1={center}
          x2={center + minuteLength * Math.sin((minuteRotation * Math.PI) / 180)}
          y2={center - minuteLength * Math.cos((minuteRotation * Math.PI) / 180)}
          stroke="rgb(203, 213, 225)" // slate-300
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Second hand - long and thin, red accent */}
        <line
          x1={center}
          y1={center}
          x2={center + secondLength * Math.sin((secondRotation * Math.PI) / 180)}
          y2={center - secondLength * Math.cos((secondRotation * Math.PI) / 180)}
          stroke="rgb(239, 68, 68)" // red-500
          strokeWidth="1"
          strokeLinecap="round"
          className="motion-safe:block motion-reduce:hidden"
        />

        {/* Center dot */}
        <circle cx={center} cy={center} r="3" fill="rgb(203, 213, 225)" />

        {/* Second hand center cap (red) */}
        <circle
          cx={center}
          cy={center}
          r="2"
          fill="rgb(239, 68, 68)"
          className="motion-safe:block motion-reduce:hidden"
        />
      </svg>
    </div>
  );
});

export default AnalogClock;
