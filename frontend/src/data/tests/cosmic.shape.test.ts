import { z } from 'zod';
import cosmic from '@/data/cosmic.events.json';

const CosmicEvent = z.object({
  id: z.string().min(3),
  kind: z.enum(['solstice', 'equinox', 'eclipse', 'supermoon']),
  label: z.string().min(3),
  start: z.string().min(10),
  end: z.string().min(10),
  hemisphere: z.enum(['north', 'south', 'global']),
  impact: z.enum(['calm', 'subtle', 'notable']),
});

describe('cosmic events shape', () => {
  test('each event valid', () => {
    const arr = cosmic as unknown[];
    expect(Array.isArray(arr)).toBe(true);
    for (const it of arr) {
      const res = CosmicEvent.safeParse(it);
      if (!res.success) console.error(res.error);
      expect(res.success).toBe(true);
    }
  });
});
