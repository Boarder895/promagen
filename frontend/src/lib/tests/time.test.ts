import { localTime, isoNow, utcOffsetLabel } from '@/lib/time';

describe('time helpers', () => {
  test('isoNow returns an ISO string', () => {
    const iso = isoNow();
    expect(typeof iso).toBe('string');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('localTime returns a string even for bad tz', () => {
    const s = localTime('Bad/Zone', { locale: 'en-GB' });
    expect(typeof s).toBe('string');
  });

  test('utcOffsetLabel returns something like UTC+1', () => {
    const lbl = utcOffsetLabel('Europe/London');
    expect(lbl.startsWith('UTC')).toBe(true);
  });
});
