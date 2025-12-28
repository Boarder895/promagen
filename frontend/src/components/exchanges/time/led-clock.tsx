// frontend/src/components/exchanges/time/led-clock.tsx
'use client';

import * as React from 'react';

export type LedClockProps = {
  /**
   * IANA timezone identifier (e.g. "Asia/Tokyo", "Europe/London")
   */
  tz: string;

  /**
   * Whether to show seconds
   * @default false
   */
  showSeconds?: boolean;

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
 * 7-segment display digit patterns.
 * Segments are arranged as:
 *   aaa
 *  f   b
 *   ggg
 *  e   c
 *   ddd
 *
 * Each digit maps to which segments are "on" (true).
 */
const DIGIT_SEGMENTS: Record<string, boolean[]> = {
  //       a      b      c      d      e      f      g
  '0': [true,  true,  true,  true,  true,  true,  false],
  '1': [false, true,  true,  false, false, false, false],
  '2': [true,  true,  false, true,  true,  false, true ],
  '3': [true,  true,  true,  true,  false, false, true ],
  '4': [false, true,  true,  false, false, true,  true ],
  '5': [true,  false, true,  true,  false, true,  true ],
  '6': [true,  false, true,  true,  true,  true,  true ],
  '7': [true,  true,  true,  false, false, false, false],
  '8': [true,  true,  true,  true,  true,  true,  true ],
  '9': [true,  true,  true,  true,  false, true,  true ],
};

type SegmentProps = {
  /** Whether this segment is "on" (lit) */
  on: boolean;
  /** SVG path data for this segment */
  d: string;
};

/**
 * Single segment of a 7-segment display.
 */
function Segment({ on, d }: SegmentProps) {
  return (
    <path
      d={d}
      fill={on ? 'rgb(52, 211, 153)' : 'rgba(52, 211, 153, 0.1)'} // emerald-400 on, dim when off
      className="transition-[fill] duration-75"
    />
  );
}

type SevenSegmentDigitProps = {
  /** The digit to display (0-9) */
  digit: string;
  /** X offset for positioning */
  x: number;
};

/**
 * Single 7-segment digit display.
 * ViewBox assumes each digit is 24 units wide, 44 units tall.
 */
function SevenSegmentDigit({ digit, x }: SevenSegmentDigitProps) {
  const segments = DIGIT_SEGMENTS[digit] ?? DIGIT_SEGMENTS['8'];

  // Segment paths (relative to digit origin)
  // Each segment is a small polygon/path
  const segmentPaths = [
    // a (top horizontal)
    `M${x + 3},0 L${x + 21},0 L${x + 19},4 L${x + 5},4 Z`,
    // b (top-right vertical)
    `M${x + 22},2 L${x + 22},20 L${x + 18},18 L${x + 18},4 Z`,
    // c (bottom-right vertical)
    `M${x + 22},24 L${x + 22},42 L${x + 18},40 L${x + 18},26 Z`,
    // d (bottom horizontal)
    `M${x + 3},44 L${x + 21},44 L${x + 19},40 L${x + 5},40 Z`,
    // e (bottom-left vertical)
    `M${x + 2},24 L${x + 2},42 L${x + 6},40 L${x + 6},26 Z`,
    // f (top-left vertical)
    `M${x + 2},2 L${x + 2},20 L${x + 6},18 L${x + 6},4 Z`,
    // g (middle horizontal)
    `M${x + 4},21 L${x + 20},21 L${x + 18},24 L${x + 6},24 L${x + 4},21 Z`,
  ];

  return (
    <>
      {segmentPaths.map((d, i) => (
        <Segment key={i} on={segments[i]} d={d} />
      ))}
    </>
  );
}

type ColonProps = {
  /** X position for the colon */
  x: number;
  /** Whether to show the colon (for blinking effect) */
  visible: boolean;
};

/**
 * Colon separator between digit pairs.
 */
function Colon({ x, visible }: ColonProps) {
  const fill = visible ? 'rgb(52, 211, 153)' : 'rgba(52, 211, 153, 0.1)';
  return (
    <>
      <circle cx={x + 4} cy={14} r={3} fill={fill} />
      <circle cx={x + 4} cy={30} r={3} fill={fill} />
    </>
  );
}

/**
 * LedClock - Retro 7-segment LED display clock.
 *
 * Design:
 * - Classic LCD/LED aesthetic with green digits
 * - 7-segment display for each digit
 * - Dim segments visible when "off" (authentic LED look)
 * - Colon blinks every second
 *
 * Features:
 * - Updates every second using setInterval
 * - Uses native Intl.DateTimeFormat for timezone handling
 * - Optional seconds display
 * - Cleans up interval on unmount
 *
 * @example
 * ```tsx
 * <LedClock tz="Asia/Tokyo" />
 * <LedClock tz="Europe/London" showSeconds />
 * ```
 */
export const LedClock = React.memo(function LedClock({
  tz,
  showSeconds = false,
  className = '',
  ariaLabel = 'Local time',
}: LedClockProps) {
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

  // Format time strings
  const h1 = String(Math.floor(time.h / 10));
  const h2 = String(time.h % 10);
  const m1 = String(Math.floor(time.m / 10));
  const m2 = String(time.m % 10);
  const s1 = String(Math.floor(time.s / 10));
  const s2 = String(time.s % 10);

  // Blink colon on odd seconds
  const colonVisible = time.s % 2 === 0;

  // Calculate SVG width based on whether seconds are shown
  // Each digit is 24 units, colon is 10 units, spacing is 2 units
  const digitWidth = 24;
  const colonWidth = 10;
  const spacing = 2;

  // HH:MM = 4 digits + 1 colon = 24*4 + 10 + spacing*4 = 96 + 10 + 8 = 114
  // HH:MM:SS = 6 digits + 2 colons = 24*6 + 20 + spacing*6 = 144 + 20 + 12 = 176
  const svgWidth = showSeconds ? 176 : 114;
  const svgHeight = 44;

  // Digit positions
  const positions = {
    h1: 0,
    h2: digitWidth + spacing,
    colon1: (digitWidth + spacing) * 2,
    m1: (digitWidth + spacing) * 2 + colonWidth + spacing,
    m2: (digitWidth + spacing) * 2 + colonWidth + spacing + digitWidth + spacing,
    colon2: (digitWidth + spacing) * 2 + colonWidth + spacing + (digitWidth + spacing) * 2,
    s1: (digitWidth + spacing) * 2 + colonWidth + spacing + (digitWidth + spacing) * 2 + colonWidth + spacing,
    s2: (digitWidth + spacing) * 2 + colonWidth + spacing + (digitWidth + spacing) * 2 + colonWidth + spacing + digitWidth + spacing,
  };

  const timeStr = showSeconds
    ? `${h1}${h2}:${m1}${m2}:${s1}${s2}`
    : `${h1}${h2}:${m1}${m2}`;

  return (
    <div
      className={`inline-flex items-center justify-center rounded bg-slate-900/80 px-2 py-1.5 ring-1 ring-slate-700/50 ${className}`}
      role="timer"
      aria-label={`${ariaLabel}: ${timeStr}`}
    >
      <svg
        width={showSeconds ? 88 : 57}
        height={22}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hour digits */}
        <SevenSegmentDigit digit={h1} x={positions.h1} />
        <SevenSegmentDigit digit={h2} x={positions.h2} />

        {/* First colon */}
        <Colon x={positions.colon1} visible={colonVisible} />

        {/* Minute digits */}
        <SevenSegmentDigit digit={m1} x={positions.m1} />
        <SevenSegmentDigit digit={m2} x={positions.m2} />

        {/* Seconds (optional) */}
        {showSeconds && (
          <>
            <Colon x={positions.colon2} visible={colonVisible} />
            <SevenSegmentDigit digit={s1} x={positions.s1} />
            <SevenSegmentDigit digit={s2} x={positions.s2} />
          </>
        )}
      </svg>
    </div>
  );
});

export default LedClock;
