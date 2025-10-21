// frontend/src/app/api/ribbon/route.ts
import { NextResponse } from "next/server";
import type { RibbonPayload } from "@/types/ribbon";

export const dynamic = "force-dynamic";

export async function GET() {
  // --- 12 global stock exchanges (east ➜ west) ---
  const markets: RibbonPayload["markets"] = [
    {
      exchange: {
        id: "asx",
        city: "Sydney",
        exchange: "ASX",
        country: "Australia",
        iso2: "AU",
        tz: "Australia/Sydney",
        longitude: 151.2093,
      },
      weather: { tempC: null, condition: "clear" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "tse",
        city: "Tokyo",
        exchange: "TSE",
        country: "Japan",
        iso2: "JP",
        tz: "Asia/Tokyo",
        longitude: 139.6917,
      },
      weather: { tempC: null, condition: "clear" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "hkex",
        city: "Hong Kong",
        exchange: "HKEX",
        country: "Hong Kong",
        iso2: "HK",
        tz: "Asia/Hong_Kong",
        longitude: 114.1694,
      },
      weather: { tempC: null, condition: "cloud" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "sgx",
        city: "Singapore",
        exchange: "SGX",
        country: "Singapore",
        iso2: "SG",
        tz: "Asia/Singapore",
        longitude: 103.8198,
      },
      weather: { tempC: null, condition: "cloud" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "bse",
        city: "Mumbai",
        exchange: "BSE",
        country: "India",
        iso2: "IN",
        tz: "Asia/Kolkata",
        longitude: 72.8777,
      },
      weather: { tempC: null, condition: "hot" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "dfm",
        city: "Dubai",
        exchange: "DFM",
        country: "United Arab Emirates",
        iso2: "AE",
        tz: "Asia/Dubai",
        longitude: 55.2708,
      },
      weather: { tempC: null, condition: "clear" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "jse",
        city: "Johannesburg",
        exchange: "JSE",
        country: "South Africa",
        iso2: "ZA",
        tz: "Africa/Johannesburg",
        longitude: 28.0473,
      },
      weather: { tempC: null, condition: "clear" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "xetra",
        city: "Frankfurt",
        exchange: "Xetra",
        country: "Germany",
        iso2: "DE",
        tz: "Europe/Berlin",
        longitude: 8.6821,
      },
      weather: { tempC: null, condition: "cloud" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "lse",
        city: "London",
        exchange: "LSE",
        country: "United Kingdom",
        iso2: "GB",
        tz: "Europe/London",
        longitude: -0.1276,
      },
      weather: { tempC: null, condition: "rain" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "nyse",
        city: "New York",
        exchange: "NYSE",
        country: "United States",
        iso2: "US",
        tz: "America/New_York",
        longitude: -74.006,
      },
      weather: { tempC: null, condition: "snow" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "tsx",
        city: "Toronto",
        exchange: "TSX",
        country: "Canada",
        iso2: "CA",
        tz: "America/Toronto",
        longitude: -79.3832,
      },
      weather: { tempC: null, condition: "cloud" },
      state: { status: "unknown" },
    },
    {
      exchange: {
        id: "cme",
        city: "Chicago",
        exchange: "CME",
        country: "United States",
        iso2: "US",
        tz: "America/Chicago",
        longitude: -87.6298,
      },
      weather: { tempC: null, condition: "cloud" },
      state: { status: "unknown" },
    },
  ];

  // --- Your canonical 20 AI image-generation providers (from your master sheet) ---
  const providers: RibbonPayload["providers"] = [
    { id: "openai",     name: "OpenAI DALL·E / GPT-Image",        url: "https://openai.com/dall-e" },
    { id: "stability",  name: "Stability AI / Stable Diffusion",  url: "https://stability.ai" },
    { id: "leonardo",   name: "Leonardo AI",                       url: "https://leonardo.ai" },
    { id: "i23rf",      name: "I23RF AI Generator",                url: "https://www.123rf.com/ai" },
    { id: "artistly",   name: "Artistly",                          url: "https://artistly.ai" },
    { id: "adobe",      name: "Adobe Firefly",                     url: "https://www.adobe.com/sensei/generative-ai/firefly.html" },
    { id: "midjourney", name: "Midjourney",                        url: "https://www.midjourney.com" },
    { id: "canva",      name: "Canva Text-to-Image",               url: "https://www.canva.com" },
    { id: "bing",       name: "Bing Image Creator",                url: "https://www.bing.com/create" },
    { id: "ideogram",   name: "Ideogram",                          url: "https://ideogram.ai" },
    { id: "picsart",    name: "Picsart",                           url: "https://picsart.com" },
    { id: "fotor",      name: "Fotor",                             url: "https://www.fotor.com" },
    { id: "nightcafe",  name: "NightCafe",                         url: "https://creator.nightcafe.studio" },
    { id: "playground", name: "Playground AI",                     url: "https://playground.com" },
    { id: "pixlr",      name: "Pixlr",                             url: "https://pixlr.com" },
    { id: "deepai",     name: "DeepAI",                            url: "https://deepai.org" },
    { id: "novelai",    name: "NovelAI",                           url: "https://novelai.net" },
    { id: "lexica",     name: "Lexica",                            url: "https://lexica.art" },
    { id: "openart",    name: "OpenArt",                           url: "https://openart.ai" },
    { id: "flux",       name: "Flux Schnell",                      url: "https://blackforestlabs.ai/flux" },
  ];

  const payload: RibbonPayload = { markets, providers };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}











