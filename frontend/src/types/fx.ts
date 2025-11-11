export type FxPair = {
  id: string;                 // e.g. "EURUSD"
  base: string;               // e.g. "EUR"
  quote: string;              // e.g. "USD"
  label: string;              // e.g. "EUR / USD"
  precision?: number;         // decimals for display
  demo?: {
    value: number;            // demo starting point
    prevClose: number;        // demo reference
  };
};
