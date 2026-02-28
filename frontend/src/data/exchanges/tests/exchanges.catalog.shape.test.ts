// frontend/src/data/exchanges/tests/exchanges.catalog.shape.test.ts

/**
 * Shape + sanity checks for exchanges.catalog.json
 *
 * This is the hard fence: no malformed exchanges get into the app.
 */

import catalog from '../exchanges.catalog.json';

type CatalogRow = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
  latitude: number;
  hoursTemplate: string;
  holidaysRef: string;
  hemisphere: string;
  status?: 'active' | 'inactive' | 'planned';
  tier?: 'core' | 'extended' | 'bench';
  // Room for future optional metadata if needed.
  name?: string;
};

const ALLOWED_HOURS_TEMPLATES = [
  'africa-botswana',    'africa-ghana',         'africa-kenya',
  'africa-mauritius',   'africa-morocco',       'africa-namibia',
  'africa-nigeria',     'africa-south-africa',  'africa-standard',
  'africa-tanzania',    'americas-brazil',      'americas-us',
  'asia-bangladesh',    'asia-china',           'asia-hk',
  'asia-india',         'asia-indonesia',       'asia-kazakhstan',
  'asia-laos',          'asia-malaysia',        'asia-mongolia',
  'asia-pakistan',       'asia-philippines',     'asia-srilanka',
  'asia-taiwan',        'asia-thailand',        'asia-tokyo',
  'asia-vietnam',       'australasia-standard', 'australia-standard',
  'europe-austria',     'europe-baltic',        'europe-bosnia',
  'europe-croatia',     'europe-czech',         'europe-euronext',
  'europe-germany',     'europe-greece',        'europe-hungary',
  'europe-iceland',     'europe-ireland',       'europe-italy',
  'europe-luxembourg',  'europe-macedonia',     'europe-montenegro',
  'europe-nordic',      'europe-russia',        'europe-serbia',
  'europe-slovakia',    'europe-slovenia',      'europe-spain',
  'europe-switzerland', 'europe-turkey',        'europe-uk',
  'europe-ukraine',     'gulf-bahrain',         'gulf-jordan',
  'gulf-kuwait',        'gulf-lebanon',         'gulf-oman',
  'gulf-qatar',         'gulf-uae',             'latam-argentina',
  'latam-chile',        'latam-colombia',       'latam-ecuador',
  'latam-mexico',       'latam-peru',           'latam-venezuela',
] as const;

const ALLOWED_HEMISPHERES = ['NE', 'NW', 'SE', 'SW'] as const;

const ALLOWED_STATUS = ['active', 'inactive', 'planned'] as const;

const ALLOWED_TIER = ['core', 'extended', 'bench'] as const;

function asRows(input: unknown): CatalogRow[] {
  if (!Array.isArray(input)) return [];
  return input as CatalogRow[];
}

describe('exchanges.catalog.json shape', () => {
  const rows = asRows(catalog);

  it('is a non-empty array', () => {
    expect(Array.isArray(catalog)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('every entry has the required fields with correct primitive types', () => {
    for (const row of rows) {
      expect(typeof row.id).toBe('string');
      expect(row.id.trim().length).toBeGreaterThan(0);

      expect(typeof row.city).toBe('string');
      expect(row.city.trim().length).toBeGreaterThan(0);

      expect(typeof row.exchange).toBe('string');
      expect(row.exchange.trim().length).toBeGreaterThan(0);

      expect(typeof row.country).toBe('string');
      expect(row.country.trim().length).toBeGreaterThan(0);

      expect(typeof row.iso2).toBe('string');
      expect(row.iso2.trim().length).toBe(2);

      expect(typeof row.tz).toBe('string');
      expect(row.tz.trim().length).toBeGreaterThan(0);

      expect(typeof row.longitude).toBe('number');
      expect(Number.isFinite(row.longitude)).toBe(true);

      expect(typeof row.latitude).toBe('number');
      expect(Number.isFinite(row.latitude)).toBe(true);

      expect(typeof row.hoursTemplate).toBe('string');
      expect(row.hoursTemplate.trim().length).toBeGreaterThan(0);

      expect(typeof row.holidaysRef).toBe('string');
      expect(row.holidaysRef.trim().length).toBeGreaterThan(0);

      expect(typeof row.hemisphere).toBe('string');
      expect(row.hemisphere.trim().length).toBeGreaterThan(0);
    }
  });

  it('ids are kebab-case strings', () => {
    const kebabRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    for (const row of rows) {
      expect(kebabRegex.test(row.id)).toBe(true);
    }
  });

  it('ISO2 codes are two uppercase letters', () => {
    const isoRegex = /^[A-Z]{2}$/;

    for (const row of rows) {
      expect(isoRegex.test(row.iso2)).toBe(true);
    }
  });

  it('timezones look like valid IANA zone identifiers', () => {
    // Allow multiple segments: e.g. "America/Argentina/Buenos_Aires"
    const tzRegex = /^[A-Za-z_]+(?:\/[A-Za-z0-9_\-+]+)+$/;

    for (const row of rows) {
      expect(tzRegex.test(row.tz)).toBe(true);
    }
  });

  it('longitudes and latitudes are within sane geographic bounds', () => {
    for (const row of rows) {
      expect(row.longitude).toBeGreaterThanOrEqual(-180);
      expect(row.longitude).toBeLessThanOrEqual(180);

      expect(row.latitude).toBeGreaterThanOrEqual(-90);
      expect(row.latitude).toBeLessThanOrEqual(90);
    }
  });

  it('hoursTemplate values are from the allowed set', () => {
    const allowed = new Set<string>(ALLOWED_HOURS_TEMPLATES);

    for (const row of rows) {
      expect(allowed.has(row.hoursTemplate)).toBe(true);
    }
  });

  it('hemisphere values are from the allowed set', () => {
    const allowed = new Set<string>(ALLOWED_HEMISPHERES);

    for (const row of rows) {
      expect(allowed.has(row.hemisphere)).toBe(true);
    }
  });

  it('optional status/tier values, if present, are from the allowed sets', () => {
    const allowedStatus = new Set<string>(ALLOWED_STATUS);
    const allowedTier = new Set<string>(ALLOWED_TIER);

    for (const row of rows) {
      if (row.status != null) {
        expect(allowedStatus.has(row.status)).toBe(true);
      }
      if (row.tier != null) {
        expect(allowedTier.has(row.tier)).toBe(true);
      }
    }
  });

  it('ids are unique across the catalogue', () => {
    const seen = new Set<string>();

    for (const row of rows) {
      expect(seen.has(row.id)).toBe(false);
      seen.add(row.id);
    }

    expect(seen.size).toBe(rows.length);
  });

  it('no duplicate (city, exchange) pairs exist', () => {
    const seen = new Set<string>();

    for (const row of rows) {
      const key = `${row.city}:::${row.exchange}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('holidaysRef is non-empty and stable per id', () => {
    const byId = new Map<string, string>();

    for (const row of rows) {
      expect(row.holidaysRef.trim().length).toBeGreaterThan(0);

      const existing = byId.get(row.id);
      if (existing) {
        expect(existing).toBe(row.holidaysRef);
      } else {
        byId.set(row.id, row.holidaysRef);
      }
    }
  });
});
