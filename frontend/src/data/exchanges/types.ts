// frontend/src/data/exchanges/types.ts

export type Exchange = {
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
  // Optional extras for future metadata, kept narrow:
  name?: string;
};
