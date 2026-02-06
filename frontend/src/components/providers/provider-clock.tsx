// src/components/providers/provider-clock.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatTimeInTimezone, isWithinSupportHours } from '@/lib/utils/timezone';

export type ProviderClockProps = {
  timezone: string;
  supportHours?: string;
};

export function ProviderClock({ timezone, supportHours }: ProviderClockProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const colonRef = useRef<HTMLSpanElement>(null);

  // Clock update - only re-renders once per minute
  useEffect(() => {
    function updateClock() {
      const time = formatTimeInTimezone(timezone);
      const available = supportHours === '24/7' || isWithinSupportHours(timezone, supportHours);

      setCurrentTime(time);
      setIsAvailable(available);
    }

    updateClock();
    const timeInterval = setInterval(updateClock, 60_000);

    return () => clearInterval(timeInterval);
  }, [timezone, supportHours]);

  // Blink colon via DOM ref — no setState, no re-renders
  useEffect(() => {
    let visible = true;
    const blinkInterval = setInterval(() => {
      visible = !visible;
      if (colonRef.current) {
        colonRef.current.style.opacity = visible ? '1' : '0';
      }
    }, 500);

    return () => clearInterval(blinkInterval);
  }, []);

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
        ref={colonRef}
        className="provider-clock-colon"
        style={{
          opacity: 1,
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
