/**
 * Tests for lib/clock.ts
 * Ensures clock formatting utilities work correctly across timezones
 */

import { formatClock, formatClockInTZ, nowInTZ } from '@/lib/clock';

describe('lib/clock', () => {
  describe('formatClock', () => {
    it('should format a Date object as HH:MM:SS', () => {
      const date = new Date('2024-01-15T14:23:45Z');
      const result = formatClock(date);

      // Should be in HH:MM:SS format
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should pad single-digit hours, minutes, and seconds with zeros', () => {
      const date = new Date('2024-01-15T01:02:03Z');
      const result = formatClock(date);

      // Should have leading zeros
      expect(result).toMatch(/^0\d:0\d:0\d$/);
    });
  });

  describe('formatClockInTZ', () => {
    it('should format current time in a valid timezone', () => {
      const result = formatClockInTZ('Asia/Tokyo');

      // Should be in HH:MM:SS format (24-hour)
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should handle multiple valid timezones', () => {
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland',
      ];

      timezones.forEach((tz) => {
        const result = formatClockInTZ(tz);
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      });
    });

    it('should return "--:--:--" for invalid timezone', () => {
      const result = formatClockInTZ('Invalid/Timezone');
      expect(result).toBe('--:--:--');
    });

    it('should return "--:--:--" for empty string timezone', () => {
      const result = formatClockInTZ('');
      expect(result).toBe('--:--:--');
    });

    it('should use 24-hour format (no AM/PM)', () => {
      const result = formatClockInTZ('America/New_York');

      // Should not contain AM or PM
      expect(result).not.toMatch(/AM|PM/i);

      // Should be exactly 8 characters (HH:MM:SS)
      expect(result).toHaveLength(8);
    });
  });

  describe('nowInTZ', () => {
    it('should return a Date object for valid timezone', () => {
      const result = nowInTZ('Asia/Tokyo');
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).not.toBeNaN();
    });

    it('should return current Date for invalid timezone (fallback)', () => {
      const before = Date.now();
      const result = nowInTZ('Invalid/Timezone');
      const after = Date.now();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle multiple valid timezones', () => {
      const timezones = [
        'America/Chicago',
        'Europe/Paris',
        'Asia/Shanghai',
      ];

      timezones.forEach((tz) => {
        const result = nowInTZ(tz);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).not.toBeNaN();
      });
    });
  });

  describe('Integration: formatClock + nowInTZ', () => {
    it('should format current time in a timezone using both utilities', () => {
      const tokyo = nowInTZ('Asia/Tokyo');
      const formatted = formatClock(tokyo);

      expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });
});
