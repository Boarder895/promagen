import catalog from './exchanges.catalog.json';

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
  // any optional extras:
  name?: string;
};

const EXCHANGES: Exchange[] = (catalog as any) as Exchange[];
export default EXCHANGES;
