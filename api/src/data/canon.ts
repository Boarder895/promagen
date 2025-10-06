import type { ProviderApi, MarketApi, CriterionId } from '../types';

export const CRITERIA: { id: CriterionId; weight: number; label: string }[] = [
  { id: 'adoption', weight: 27, label: 'Adoption/Ecosystem' },
  { id: 'quality', weight: 23, label: 'Image Quality' },
  { id: 'speed', weight: 18, label: 'Speed/Uptime' },
  { id: 'cost', weight: 14, label: 'Cost/Free Tier' },
  { id: 'safety', weight: 9,  label: 'Trust/Safety' },
  { id: 'innovation', weight: 5, label: 'Automation/Innovation' },
  { id: 'ethics', weight: 4, label: 'Ethical/Environmental' }
];

export const PROVIDER_CANON: Array<Pick<ProviderApi,'id'|'name'|'logoUrl'|'blurb'|'siteUrl'>> = [
  { id:'openai',name:'OpenAI DALL·E/GPT-Image',logoUrl:'/logos/openai.svg',blurb:'High-quality image generation via OpenAI.',siteUrl:'https://openai.com' },
  { id:'stability',name:'Stability AI',logoUrl:'/logos/stability.svg',blurb:'Stable Diffusion models and API.',siteUrl:'https://stability.ai' },
  { id:'leonardo',name:'Leonardo AI',logoUrl:'/logos/leonardo.svg',blurb:'Generalist with strong presets.',siteUrl:'https://leonardo.ai' },
  { id:'i23rf',name:'I23RF',logoUrl:'/logos/i23rf.svg',blurb:'Stock/AI hybrid workflows.',siteUrl:'https://www.123rf.com' },
  { id:'artistly',name:'Artistly',logoUrl:'/logos/artistly.svg',blurb:'Fast prompt-to-image with styles.',siteUrl:'https://artistly.ai' },
  { id:'adobe',name:'Adobe Firefly',logoUrl:'/logos/adobe.svg',blurb:'Adobe-integrated gen.',siteUrl:'https://www.adobe.com/products/firefly.html' },
  { id:'midjourney',name:'Midjourney',logoUrl:'/logos/midjourney.svg',blurb:'Discord-native aesthetic.',siteUrl:'https://www.midjourney.com' },
  { id:'canva',name:'Canva Text-to-Image',logoUrl:'/logos/canva.svg',blurb:'Design-first generation.',siteUrl:'https://www.canva.com' },
  { id:'bing',name:'Bing Image Creator',logoUrl:'/logos/bing.svg',blurb:'Copilot-powered gen on web.',siteUrl:'https://www.bing.com/create' },
  { id:'ideogram',name:'Ideogram',logoUrl:'/logos/ideogram.svg',blurb:'Great typography.',siteUrl:'https://ideogram.ai' },
  { id:'picsart',name:'Picsart',logoUrl:'/logos/picsart.svg',blurb:'Social-leaning tools.',siteUrl:'https://picsart.com' },
  { id:'fotor',name:'Fotor',logoUrl:'/logos/fotor.svg',blurb:'Accessible suite.',siteUrl:'https://fotor.com' },
  { id:'nightcafe',name:'NightCafe',logoUrl:'/logos/nightcafe.svg',blurb:'Credits + community.',siteUrl:'https://creator.nightcafe.studio' },
  { id:'playground',name:'Playground AI',logoUrl:'/logos/playground.svg',blurb:'Power-user UI.',siteUrl:'https://playgroundai.com' },
  { id:'pixlr',name:'Pixlr',logoUrl:'/logos/pixlr.svg',blurb:'Browser editor.',siteUrl:'https://pixlr.com' },
  { id:'deepai',name:'DeepAI',logoUrl:'/logos/deepai.svg',blurb:'Simple API + free tier.',siteUrl:'https://deepai.org' },
  { id:'novelai',name:'NovelAI',logoUrl:'/logos/novelai.svg',blurb:'Anime-focused.',siteUrl:'https://novelai.net' },
  { id:'lexica',name:'Lexica',logoUrl:'/logos/lexica.svg',blurb:'Search + generate.',siteUrl:'https://lexica.art' },
  { id:'openart',name:'OpenArt',logoUrl:'/logos/openart.svg',blurb:'Discovery + marketplace.',siteUrl:'https://openart.ai' },
  { id:'flux',name:'Flux Schnell',logoUrl:'/logos/flux.svg',blurb:'Fast new family.',siteUrl:'https://blackforestlabs.ai' }
];

export const MARKET_CANON: Array<Pick<MarketApi,'id'|'displayName'|'timeZone'|'indexSymbol'>> = [
  { id:'asx',displayName:'ASX (Sydney)',timeZone:'Australia/Sydney',indexSymbol:'ASX200' },
  { id:'tse',displayName:'TSE (Tokyo)',timeZone:'Asia/Tokyo',indexSymbol:'NIKKEI225' },
  { id:'sse',displayName:'SSE (Shanghai)',timeZone:'Asia/Shanghai',indexSymbol:'SSECOMP' },
  { id:'dfm',displayName:'DFM (Dubai)',timeZone:'Asia/Dubai',indexSymbol:'DFMGI' },
  { id:'moex',displayName:'MOEX (Moscow)',timeZone:'Europe/Moscow',indexSymbol:'IMOEX' },
  { id:'jse',displayName:'JSE (Johannesburg)',timeZone:'Africa/Johannesburg',indexSymbol:'TOP40' },
  { id:'euronext',displayName:'Euronext Paris',timeZone:'Europe/Paris',indexSymbol:'CAC40' },
  { id:'xetra',displayName:'Xetra (Frankfurt)',timeZone:'Europe/Berlin',indexSymbol:'DAX' },
  { id:'lse',displayName:'LSE (London)',timeZone:'Europe/London',indexSymbol:'FTSE100' },
  { id:'nyse',displayName:'NYSE (New York)',timeZone:'America/New_York',indexSymbol:'DJIA' },
  { id:'nasdaq',displayName:'NASDAQ (New York)',timeZone:'America/New_York',indexSymbol:'IXIC' },
  { id:'buenosaires',displayName:'Buenos Aires Stock Exchange',timeZone:'America/Argentina/Buenos_Aires',indexSymbol:'MERVAL' },
  { id:'tsx',displayName:'Toronto Stock Exchange (TSX)',timeZone:'America/Toronto',indexSymbol:'SPTSX' },
  { id:'b3',displayName:'B3 (São Paulo)',timeZone:'America/Sao_Paulo',indexSymbol:'IBOV' },
  { id:'hkex',displayName:'HKEX (Hong Kong)',timeZone:'Asia/Hong_Kong',indexSymbol:'HSI' },
  { id:'sgx',displayName:'SGX (Singapore)',timeZone:'Asia/Singapore',indexSymbol:'STI' }
];
