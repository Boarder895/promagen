export type MarketId =
  | "tokyo" | "hongkong" | "singapore" | "mumbai" | "dubai" | "moscow"
  | "frankfurt" | "london" | "paris" | "newyork" | "toronto" | "saopaulo";

export type MarketDef = {
  id: MarketId;
  city: string;
  exchange: string;
  indexName: string;
  tz: string; // IANA
  session: { start: string; end: string; lunch?: { start: string; end: string } };
  symbolHint?: string; // for your market data provider
  lat: number; lon: number; // for weather, optional
};

export const MARKETS: MarketDef[] = [
  { id:"tokyo", city:"Tokyo", exchange:"TSE", indexName:"Nikkei 225", tz:"Asia/Tokyo",
    session:{ start:"09:00", end:"15:00", lunch:{ start:"11:30", end:"12:30" }}, lat:35.676, lon:139.65 },
  { id:"hongkong", city:"Hong Kong", exchange:"HKEX", indexName:"Hang Seng", tz:"Asia/Hong_Kong",
    session:{ start:"09:30", end:"16:00", lunch:{ start:"12:00", end:"13:00" }}, lat:22.3193, lon:114.1694 },
  { id:"singapore", city:"Singapore", exchange:"SGX", indexName:"Straits Times", tz:"Asia/Singapore",
    session:{ start:"09:00", end:"17:00" }, lat:1.3521, lon:103.8198 },
  { id:"mumbai", city:"Mumbai", exchange:"NSE", indexName:"Nifty 50", tz:"Asia/Kolkata",
    session:{ start:"09:15", end:"15:30" }, lat:19.076, lon:72.8777 },
  { id:"dubai", city:"Dubai", exchange:"DFM", indexName:"DFM General", tz:"Asia/Dubai",
    session:{ start:"10:00", end:"15:00" }, lat:25.2048, lon:55.2708 },
  { id:"moscow", city:"Moscow", exchange:"MOEX", indexName:"MOEX Russia", tz:"Europe/Moscow",
    session:{ start:"10:00", end:"18:45" }, lat:55.7558, lon:37.6173 },
  { id:"frankfurt", city:"Frankfurt", exchange:"XETRA", indexName:"DAX", tz:"Europe/Berlin",
    session:{ start:"09:00", end:"17:30" }, lat:50.1109, lon:8.6821 },
  { id:"london", city:"London", exchange:"LSE", indexName:"FTSE 100", tz:"Europe/London",
    session:{ start:"08:00", end:"16:30" }, lat:51.5072, lon:-0.1276 },
  { id:"paris", city:"Paris", exchange:"Euronext", indexName:"CAC 40", tz:"Europe/Paris",
    session:{ start:"09:00", end:"17:30" }, lat:48.8566, lon:2.3522 },
  { id:"newyork", city:"New York", exchange:"NYSE", indexName:"S&P 500", tz:"America/New_York",
    session:{ start:"09:30", end:"16:00" }, lat:40.7128, lon:-74.006 },
  { id:"toronto", city:"Toronto", exchange:"TSX", indexName:"S&P/TSX Composite", tz:"America/Toronto",
    session:{ start:"09:30", end:"16:00" }, lat:43.6532, lon:-79.3832 },
  { id:"saopaulo", city:"São Paulo", exchange:"B3", indexName:"Ibovespa", tz:"America/Sao_Paulo",
    session:{ start:"10:00", end:"17:30" }, lat:-23.5558, lon:-46.6396 },
];
