// src/lib/commodities/retail-units.ts
// ============================================================================
// COMMODITY RETAIL UNIT MAPPING
// ============================================================================
// Converts industrial commodity units (tonnes, bushels, barrels) into
// consumer-friendly retail units (kg, litres, grams) for the conversion
// price lines on the Movers Grid.
//
// Each commodity has per-region configs:
//   US  — pounds, gallons, bags (imperial)
//   UK  — kg, litres, pints (mixed)
//   EU  — kg, litres, grams (metric)
//
// The factor converts from the API unit to the retail unit:
//   retail_price = api_price_in_target_currency × factor
//
// Example: Aluminum at €2,632.80 / tonne
//   UK factor = 0.001 (1/1000 for tonne→kg)
//   → €2,632.80 × 0.001 = €2.63 / kg
//
// v1.0: Initial 78-commodity mapping (8 Feb 2026)
// Authority: commodity-retail-unit-mapping.xlsx
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface RetailUnitConfig {
  /** Display label shown after price (e.g., "kg", "250g", "gal") */
  unit: string;
  /** Multiplier: retail_price = converted_price × factor */
  factor: number;
}

export interface CommodityRetailUnit {
  us: RetailUnitConfig;
  uk: RetailUnitConfig;
  eu: RetailUnitConfig;
}

// ============================================================================
// CONVERSION CONSTANTS (reference)
// ============================================================================
// 1 tonne        = 1,000 kg = 2,204.62 lbs
// 1 lb           = 453.592 g
// 1 troy oz      = 31.1035 g
// 1 US barrel    = 158.987 L = 42 US gal
// 1 US gallon    = 3.78541 L
// 1 UK pint      = 0.56826 L
// 1 US cwt       = 100 lbs = 45.3592 kg
// 1 bushel wheat = 60 lbs = 27.216 kg
// 1 bushel corn  = 56 lbs = 25.4012 kg
// 1 bushel oats  = 32 lbs = 14.515 kg
// 1 MMBtu        = 293.07 kWh
// 1 MWh          = 1,000 kWh
// 1 therm        = 29.3071 kWh
// 1 MTU          = 10 kg of contained metal
// ============================================================================

const T_TO_KG = 1000;
const T_TO_LB = 2204.62;
const LB_TO_G = 453.592;
const TROY_OZ_TO_G = 31.1035;
const BBL_TO_L = 158.987;
const BBL_TO_GAL = 42;
const GAL_TO_L = 3.78541;
const CWT_TO_KG = 45.3592;
const CWT_TO_LB = 100;
const BU_WHEAT_KG = 27.216; // wheat, soybeans
const BU_CORN_KG = 25.4012;
const BU_OAT_KG = 14.515;
const MMBTU_TO_KWH = 293.07;
const MWH_TO_KWH = 1000;
const THERM_TO_KWH = 29.3071;

// ============================================================================
// RETAIL UNIT MAP (keyed by catalog ID)
// ============================================================================

const RETAIL_UNITS: Record<string, CommodityRetailUnit> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENERGY
  // ═══════════════════════════════════════════════════════════════════════════

  brent: {
    us: { unit: 'gal', factor: 1 / BBL_TO_GAL },
    uk: { unit: 'L', factor: 1 / BBL_TO_L },
    eu: { unit: 'L', factor: 1 / BBL_TO_L },
  },
  crude_oil: {
    us: { unit: 'gal', factor: 1 / BBL_TO_GAL },
    uk: { unit: 'L', factor: 1 / BBL_TO_L },
    eu: { unit: 'L', factor: 1 / BBL_TO_L },
  },
  gasoline: {
    us: { unit: 'gal', factor: 1 },
    uk: { unit: 'L', factor: 1 / GAL_TO_L },
    eu: { unit: 'L', factor: 1 / GAL_TO_L },
  },
  heating_oil: {
    us: { unit: 'gal', factor: 1 },
    uk: { unit: 'L', factor: 1 / GAL_TO_L },
    eu: { unit: 'L', factor: 1 / GAL_TO_L },
  },
  ethanol: {
    us: { unit: 'gal', factor: 1 },
    uk: { unit: 'L', factor: 1 / GAL_TO_L },
    eu: { unit: 'L', factor: 1 / GAL_TO_L },
  },
  propane: {
    us: { unit: 'gal', factor: 1 },
    uk: { unit: 'L', factor: 1 / GAL_TO_L },
    eu: { unit: 'L', factor: 1 / GAL_TO_L },
  },
  natural_gas: {
    us: { unit: 'kWh', factor: 1 / MMBTU_TO_KWH },
    uk: { unit: 'kWh', factor: 1 / MMBTU_TO_KWH },
    eu: { unit: 'kWh', factor: 1 / MMBTU_TO_KWH },
  },
  ttf_gas: {
    us: { unit: 'kWh', factor: 1 / MWH_TO_KWH },
    uk: { unit: 'kWh', factor: 1 / MWH_TO_KWH },
    eu: { unit: 'kWh', factor: 1 / MWH_TO_KWH },
  },
  uk_gas: {
    us: { unit: 'kWh', factor: 1 / THERM_TO_KWH },
    uk: { unit: 'kWh', factor: 1 / THERM_TO_KWH },
    eu: { unit: 'kWh', factor: 1 / THERM_TO_KWH },
  },
  coal: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  naphtha: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  methanol: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'L', factor: 1 / (T_TO_KG / 0.791) }, // density 0.791 kg/L
  },
  bitumen: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE — GRAINS & OILSEEDS
  // ═══════════════════════════════════════════════════════════════════════════

  wheat: {
    us: { unit: 'lb', factor: 1 / 60 }, // 1 bu = 60 lbs
    uk: { unit: 'kg', factor: 1 / BU_WHEAT_KG },
    eu: { unit: 'kg', factor: 1 / BU_WHEAT_KG },
  },
  corn: {
    us: { unit: 'lb', factor: 1 / 56 }, // 1 bu = 56 lbs
    uk: { unit: 'kg', factor: 1 / BU_CORN_KG },
    eu: { unit: 'kg', factor: 1 / BU_CORN_KG },
  },
  soybeans: {
    us: { unit: 'lb', factor: 1 / 60 },
    uk: { unit: 'kg', factor: 1 / BU_WHEAT_KG },
    eu: { unit: 'kg', factor: 1 / BU_WHEAT_KG },
  },
  oat: {
    us: { unit: 'lb', factor: 1 / 32 }, // 1 bu = 32 lbs
    uk: { unit: '500g', factor: 0.5 / BU_OAT_KG },
    eu: { unit: '500g', factor: 0.5 / BU_OAT_KG },
  },
  barley: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  rice: {
    us: { unit: 'lb', factor: 1 / CWT_TO_LB },
    uk: { unit: 'kg', factor: 1 / CWT_TO_KG },
    eu: { unit: 'kg', factor: 1 / CWT_TO_KG },
  },
  canola: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'L oil', factor: 1 / ((T_TO_KG * 0.42) / 0.91) }, // 42% extraction, 0.91 density
    eu: { unit: 'L oil', factor: 1 / ((T_TO_KG * 0.42) / 0.91) },
  },
  rapeseed: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'L oil', factor: 1 / ((T_TO_KG * 0.42) / 0.91) },
    eu: { unit: 'L oil', factor: 1 / ((T_TO_KG * 0.42) / 0.91) },
  },
  palm_oil: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'L', factor: 1 / (T_TO_KG / 0.9) }, // density 0.9 kg/L
    eu: { unit: 'L', factor: 1 / (T_TO_KG / 0.9) },
  },
  sunflower_oil: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'L', factor: 1 / (T_TO_KG / 0.92) }, // density 0.92 kg/L
    eu: { unit: 'L', factor: 1 / (T_TO_KG / 0.92) },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE — SOFTS
  // ═══════════════════════════════════════════════════════════════════════════

  coffee: {
    us: { unit: '12oz', factor: 12 / 16 }, // 12oz bag = 0.75 lbs
    uk: { unit: '250g', factor: 250 / LB_TO_G },
    eu: { unit: '500g', factor: 500 / LB_TO_G },
  },
  cocoa: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: '100g', factor: 100 / 1e6 }, // 100g out of 1,000,000g
    eu: { unit: '100g', factor: 100 / 1e6 },
  },
  sugar: {
    us: { unit: '4lb', factor: 4 },
    uk: { unit: 'kg', factor: 1000 / LB_TO_G }, // ~2.205 lbs per kg
    eu: { unit: 'kg', factor: 1000 / LB_TO_G },
  },
  cotton: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: '100g', factor: 100 / LB_TO_G },
    eu: { unit: '100g', factor: 100 / LB_TO_G },
  },
  orange_juice: {
    us: { unit: '64oz', factor: 64 / 16 }, // 64 fl oz carton ≈ 4 lbs solids
    uk: { unit: 'L', factor: 1000 / LB_TO_G },
    eu: { unit: 'L', factor: 1000 / LB_TO_G },
  },
  tea: {
    us: { unit: 'oz', factor: 1 / 35.274 }, // 1kg = 35.274 oz
    uk: { unit: '100g', factor: 0.1 },
    eu: { unit: '100g', factor: 0.1 },
  },
  rubber: {
    us: { unit: 'lb', factor: LB_TO_G / 1000 }, // cents/kg → cents/lb
    uk: { unit: 'kg', factor: 1 },
    eu: { unit: 'kg', factor: 1 },
  },
  lumber: {
    us: { unit: 'bf', factor: 1 / 1000 }, // per board foot
    uk: { unit: 'm', factor: 1 / 424 },
    eu: { unit: 'm', factor: 1 / 424 },
  },
  wool: {
    us: { unit: 'lb', factor: 1 / (100 * 2.20462) }, // 100kg → lbs
    uk: { unit: '100g', factor: 0.1 / 100 },
    eu: { unit: '100g', factor: 0.1 / 100 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE — LIVESTOCK & DAIRY
  // ═══════════════════════════════════════════════════════════════════════════
  // live_cattle, lean_hogs, feeder_cattle: quoted in cents/lb by the exchange
  // (converted to $/lb by the gateway). Factor 1 for US (already per lb),
  // 2.204624 for UK/EU to convert lb→kg.
  // ═══════════════════════════════════════════════════════════════════════════

  live_cattle: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: 'kg', factor: 1000 / LB_TO_G },
    eu: { unit: 'kg', factor: 1000 / LB_TO_G },
  },
  lean_hogs: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: 'kg', factor: 1000 / LB_TO_G },
    eu: { unit: 'kg', factor: 1000 / LB_TO_G },
  },
  feeder_cattle: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: 'kg', factor: 1000 / LB_TO_G },
    eu: { unit: 'kg', factor: 1000 / LB_TO_G },
  },

  beef: {
    us: { unit: 'lb', factor: 1 / (15 * 2.20462) }, // BRL/15kg → per lb
    uk: { unit: 'kg', factor: 1 / 15 },
    eu: { unit: 'kg', factor: 1 / 15 },
  },
  poultry: {
    us: { unit: 'lb', factor: LB_TO_G / 1000 },
    uk: { unit: 'kg', factor: 1 },
    eu: { unit: 'kg', factor: 1 },
  },
  salmon: {
    us: { unit: 'lb', factor: LB_TO_G / 1000 },
    uk: { unit: '200g', factor: 0.2 },
    eu: { unit: '200g', factor: 0.2 },
  },
  eggs_us: {
    us: { unit: 'dozen', factor: 1 },
    uk: { unit: '6 eggs', factor: 0.5 },
    eu: { unit: '10 eggs', factor: 10 / 12 },
  },
  eggs_ch: {
    us: { unit: 'dozen', factor: (12 * 0.063) / 1000 }, // avg egg 63g, dozen = 756g per tonne
    uk: { unit: '6 eggs', factor: (6 * 0.063) / 1000 },
    eu: { unit: '10 eggs', factor: (10 * 0.063) / 1000 },
  },
  milk: {
    us: { unit: 'gal', factor: GAL_TO_L / (CWT_TO_KG / 1.033) }, // milk density 1.033
    uk: { unit: 'pt', factor: 0.56826 / (CWT_TO_KG / 1.033) }, // UK pint = 568ml
    eu: { unit: 'L', factor: 1 / (CWT_TO_KG / 1.033) },
  },
  butter: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: '250g', factor: 250 / 1e6 },
    eu: { unit: '250g', factor: 250 / 1e6 },
  },
  cheese: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: '200g', factor: 200 / LB_TO_G },
    eu: { unit: '250g', factor: 250 / LB_TO_G },
  },
  potatoes: {
    us: { unit: '5lb', factor: (5 * LB_TO_G) / (100 * 1000) },
    uk: { unit: 'kg', factor: 1 / 100 },
    eu: { unit: 'kg', factor: 1 / 100 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE — FERTILISERS
  // ═══════════════════════════════════════════════════════════════════════════

  'di-ammonium': {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  urea: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // METALS — PRECIOUS
  // ═══════════════════════════════════════════════════════════════════════════

  gold: {
    us: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    uk: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    eu: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
  },
  silver: {
    us: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    uk: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    eu: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
  },
  platinum: {
    us: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    uk: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    eu: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
  },
  palladium: {
    us: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    uk: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    eu: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
  },
  rhodium: {
    us: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    uk: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
    eu: { unit: 'g', factor: 1 / TROY_OZ_TO_G },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // METALS — BASE
  // ═══════════════════════════════════════════════════════════════════════════

  aluminum: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  copper: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: 'kg', factor: 1000 / LB_TO_G },
    eu: { unit: 'kg', factor: 1000 / LB_TO_G },
  },
  lead: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  nickel: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  tin: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  zinc: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  iron_ore: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  iron_ore_cny: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  hrc_steel: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  steel: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // METALS — BATTERY & RARE
  // ═══════════════════════════════════════════════════════════════════════════

  cobalt: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  lithium: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  gallium: {
    us: { unit: 'oz', factor: 1 / 35.274 },
    uk: { unit: 'g', factor: 1 / 1000 },
    eu: { unit: 'g', factor: 1 / 1000 },
  },
  germanium: {
    us: { unit: 'oz', factor: 1 / 35.274 },
    uk: { unit: 'g', factor: 1 / 1000 },
    eu: { unit: 'g', factor: 1 / 1000 },
  },
  indium: {
    us: { unit: 'oz', factor: 1 / 35.274 },
    uk: { unit: 'g', factor: 1 / 1000 },
    eu: { unit: 'g', factor: 1 / 1000 },
  },
  magnesium: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  manganese: {
    us: { unit: 'lb', factor: 1 / (10 * 2.20462) }, // 1 MTU = 10 kg
    uk: { unit: 'kg', factor: 1 / 10 },
    eu: { unit: 'kg', factor: 1 / 10 },
  },
  molybdenum: {
    us: { unit: 'oz', factor: 1 / 35.274 },
    uk: { unit: 'g', factor: 1 / 1000 },
    eu: { unit: 'g', factor: 1 / 1000 },
  },
  neodymium: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  tellurium: {
    us: { unit: 'oz', factor: 1 / 35.274 },
    uk: { unit: 'g', factor: 1 / 1000 },
    eu: { unit: 'g', factor: 1 / 1000 },
  },
  titanium: {
    us: { unit: 'oz', factor: 1 / 35.274 },
    uk: { unit: 'g', factor: 1 / 1000 },
    eu: { unit: 'g', factor: 1 / 1000 },
  },
  uranium: {
    us: { unit: 'lb', factor: 1 },
    uk: { unit: 'kg', factor: 1000 / LB_TO_G },
    eu: { unit: 'kg', factor: 1000 / LB_TO_G },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDUSTRIAL / CHEMICALS
  // ═══════════════════════════════════════════════════════════════════════════

  soda_ash: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  kraft_pulp: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  polyethylene: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  polypropylene: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
  polyvinyl: {
    us: { unit: 'lb', factor: 1 / T_TO_LB },
    uk: { unit: 'kg', factor: 1 / T_TO_KG },
    eu: { unit: 'kg', factor: 1 / T_TO_KG },
  },
};

// ============================================================================
// LOOKUP FUNCTION
// ============================================================================

/**
 * Get retail unit config for a commodity by catalog ID.
 * Returns null if no mapping exists (shouldn't happen for the 78 active).
 */
export function getRetailUnit(catalogId: string): CommodityRetailUnit | null {
  return RETAIL_UNITS[catalogId] ?? null;
}

/**
 * Get the retail config for a specific region by country code.
 * @param catalogId - Commodity catalog ID (e.g., "gold", "coffee")
 * @param countryCode - ISO country code from conversion line (e.g., "US", "GB", "EU")
 * @returns Retail unit config or null
 */
export function getRetailConfigForRegion(
  catalogId: string,
  countryCode: string,
): RetailUnitConfig | null {
  const retail = RETAIL_UNITS[catalogId];
  if (!retail) return null;

  switch (countryCode) {
    case 'US':
      return retail.us;
    case 'GB':
      return retail.uk;
    case 'EU':
      return retail.eu;
    default:
      return null;
  }
}
