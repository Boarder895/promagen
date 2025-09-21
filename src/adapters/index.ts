// src/adapters/index.ts — dynamic loader for 20 adapters
export interface Adapter { test(): Promise<boolean>; }

export async function loadAdapters() {
  return {
    openai: await import("./openai"),
    stability: await import("./stability").catch(()=>null),
    leonardo: await import("./leonardo").catch(()=>null),
    deepai: await import("./deepai").catch(()=>null),
    google_imagen: await import("./google_imagen").catch(()=>null),
    lexica: await import("./lexica").catch(()=>null),
    novelai: await import("./novelai").catch(()=>null),
    edenai: await import("./edenai").catch(()=>null),
    runware: await import("./runware").catch(()=>null),
    hive: await import("./hive").catch(()=>null),
    recraft: await import("./recraft").catch(()=>null),
    artistly: await import("./artistly").catch(()=>null),
    canva: await import("./canva").catch(()=>null),
    adobe_firefly: await import("./adobe_firefly").catch(()=>null),
    midjourney: await import("./midjourney").catch(()=>null),
    bing_image_creator: await import("./bing_image_creator").catch(()=>null),
    nightcafe: await import("./nightcafe").catch(()=>null),
    playground: await import("./playground").catch(()=>null),
    pixlr: await import("./pixlr").catch(()=>null),
    fotor: await import("./fotor").catch(()=>null),
  };
}


