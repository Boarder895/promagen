// src/components/providers/provider-clock.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { formatTimeInTimezone, isWithinSupportHours } from '@/lib/utils/timezone';

export type ProviderClockProps = {
  timezone: string;
  supportHours?: string;
};

export function ProviderClock({ timezone, supportHours }: ProviderClockProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [colonVisible, setColonVisible] = useState<boolean>(true);

  useEffect(() => {
    function updateClock() {
      const time = formatTimeInTimezone(timezone);
      const available = supportHours === '24/7' || isWithinSupportHours(timezone, supportHours);

      setCurrentTime(time);
      setIsAvailable(available);
    }

    // Update immediately
    updateClock();

    // Update time every minute
    const timeInterval = setInterval(updateClock, 60_000);

    // Blink colon every 500ms for "live" heartbeat effect
    const blinkInterval = setInterval(() => {
      setColonVisible((prev) => !prev);
    }, 500);

    return () => {
      clearInterval(timeInterval);
      clearInterval(blinkInterval);
    };
  }, [timezone, supportHours]);

  // Loading state
  if (!currentTime) {
    return (
      <span className="provider-time provider-time-dim" aria-label="Loading time">
        --<span className="provider-clock-colon">:</span>--
      </span>
    );
  }

  // Split time into hours and minutes (format: "HH:MM")
  const [hours, minutes] = currentTime.split(':');

  return (
    <span
      className={`provider-time ${isAvailable ? 'provider-time-bright' : 'provider-time-dim'}`}
      title={isAvailable ? 'Currently available' : 'Outside business hours'}
    >
      <span className="tabular-nums">{hours}</span>
      <span
        className="provider-clock-colon"
        style={{
          opacity: colonVisible ? 1 : 0,
          marginLeft: '0.05em',
          marginRight: '0.25em',
        }}
        aria-hidden="true"
      >
        :
      </span>
      <span className="tabular-nums">{minutes}</span>

      {/* Screen reader gets the full time without blinking distraction */}
      <span className="sr-only">{currentTime}</span>
    </span>
  );
}
