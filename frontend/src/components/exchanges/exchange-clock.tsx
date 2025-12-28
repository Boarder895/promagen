'use client';

import * as React from 'react';
import { formatClockInTZ } from '@/lib/clock';

export type ExchangeClockProps = {
  /**
   * IANA timezone identifier (e.g. "Asia/Tokyo", "Europe/London")
   */
  tz: string;

  /**
   * Optional CSS class name for styling
   */
  className?: string;

  /**
   * Optional aria-label for accessibility
   * @default "Local time"
   */
  ariaLabel?: string;
};

/**
 * ExchangeClock - Displays a live ticking clock for a specific timezone.
 *
 * Features:
 * - Updates every second using setInterval
 * - Uses native Intl.DateTimeFormat (zero dependencies)
 * - Cleans up interval on unmount
 * - Gracefully handles invalid timezones (shows "--:--:--")
 * - Memoized to prevent unnecessary parent re-renders
 *
 * @example
 * ```tsx
 * <ExchangeClock tz="Asia/Tokyo" />
 * <ExchangeClock tz="Europe/London" className="text-lg font-mono" />
 * ```
 */
export const ExchangeClock = React.memo(function ExchangeClock({
  tz,
  className = '',
  ariaLabel = 'Local time',
}: ExchangeClockProps) {
  const [time, setTime] = React.useState<string>('--:--:--');

  React.useEffect(() => {
    // Update function to get current time in the specified timezone
    const updateTime = () => setTime(formatClockInTZ(tz));

    // Initial update
    updateTime();

    // Set up interval to update every second (1000ms)
    const intervalId = setInterval(updateTime, 1000);

    // Cleanup: clear interval when component unmounts or tz changes
    return () => clearInterval(intervalId);
  }, [tz]);

  return (
    <time
      dateTime={new Date().toISOString()}
      className={className}
      aria-label={ariaLabel}
      aria-live="off" // Don't announce every second to screen readers
    >
      {time}
    </time>
  );
});

export default ExchangeClock;
