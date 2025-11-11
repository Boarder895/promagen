import { computeDailyArrow } from '@/lib/fx/compute-daily-arrow';

test('shows up when current > prevClose beyond tolerance', () => {
  expect(computeDailyArrow(100, 100.2, 0.0001)).toBe('up');
});

test('none when within tolerance', () => {
  expect(computeDailyArrow(100, 100.005, 0.001)).toBe('none');
});

test('none when current < prevClose (no red icon by spec)', () => {
  expect(computeDailyArrow(100, 99.9, 0.0001)).toBe('none');
});
