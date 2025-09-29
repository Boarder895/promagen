// SERVER SOURCE OF TRUTH — 20 providers

export type ProviderId =
  | 'openai' | 'stability' | 'leonardo' | 'i23rf' | 'artistly'
  | 'adobe' | 'midjourney' | 'canva' | 'bing' | 'ideogram'
  | 'picsart' | 'fotor' | 'nightcafe' | 'playground' | 'pixlr'
  | 'deepai' | 'novelai' | 'lexica' | 'openart' | 'flux'

export interface ProviderInfo {
  id: ProviderId
  name: string
  apiEnabled: boolean
  copyOpen: true
  affiliate?: boolean
  url?: string
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai',    name: 'OpenAI DALL·E / GPT-Image', apiEnabled: true,  copyOpen: true, url: 'https://platform.openai.com/' },
  { id: 'stability', name: 'Stability AI',              apiEnabled: true,  copyOpen: true, url: 'https://platform.stability.ai/' },
  { id: 'leonardo',  name: 'Leonardo AI',               apiEnabled: true,  copyOpen: true, url: 'https://leonardo.ai/' },
  { id: 'i23rf',     name: 'I23RF',                     apiEnabled: false, copyOpen: true, url: 'https://www.123rf.com/' },
  { id: 'artistly',  name: 'Artistly',                  apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://artistly.ai/' },
  { id: 'adobe',     name: 'Adobe Firefly',             apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://www.adobe.com/products/firefly.html' },
  { id: 'midjourney',name: 'Midjourney',                apiEnabled: false, copyOpen: true, url: 'https://www.midjourney.com/' },
  { id: 'canva',     name: 'Canva Text-to-Image',       apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://www.canva.com/' },
  { id: 'bing',      name: 'Bing Image Creator',        apiEnabled: false, copyOpen: true, url: 'https://www.bing.com/images/create' },
  { id: 'ideogram',  name: 'Ideogram',                  apiEnabled: false, copyOpen: true, url: 'https://ideogram.ai/' },
  { id: 'picsart',   name: 'Picsart',                   apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://picsart.com/' },
  { id: 'fotor',     name: 'Fotor',                     apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://www.fotor.com/' },
  { id: 'nightcafe', name: 'NightCafe',                 apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://creator.nightcafe.studio/' },
  { id: 'playground',name: 'Playground AI',             apiEnabled: false, copyOpen: true, url: 'https://playgroundai.com/' },
  { id: 'pixlr',     name: 'Pixlr',                     apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://pixlr.com/' },
  { id: 'deepai',    name: 'DeepAI',                    apiEnabled: true,  copyOpen: true, url: 'https://deepai.org/' },
  { id: 'novelai',   name: 'NovelAI',                   apiEnabled: false, copyOpen: true, url: 'https://novelai.net/' },
  { id: 'lexica',    name: 'Lexica',                    apiEnabled: true,  copyOpen: true, url: 'https://lexica.art/' },
  { id: 'openart',   name: 'OpenArt',                   apiEnabled: false, copyOpen: true, affiliate: true, url: 'https://openart.ai/' },
  { id: 'flux',      name: 'Flux Schnell',              apiEnabled: false, copyOpen: true, url: 'https://blackforestlabs.ai/' }
]

export const UPDATED_AT = new Date().toISOString()
