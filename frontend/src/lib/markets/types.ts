// frontend/src/lib/markets/types.ts
export type Exchange = {
  id: string;
  name?: string;
  city?: string;
  tz?: string;
  country?: string;
  iso2?: string;
  longitude?: number;
  latitude?: number;
};
