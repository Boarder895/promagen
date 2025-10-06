// BACKEND · Seed canonical providers + criteria + totals (NEW)
// Run with: npm run ts-node -- scripts/seedProviders.ts

import { prisma } from "../src/db";

type Row = {
  slug: string;
  name: string;
  total: number | null; // null = TBD
  hasApi: boolean;
  hasAffiliate: boolean;
};

const CRITERIA = [
  { key: "adoption", name: "Adoption & Ecosystem", weight: 27 },
  { key: "quality", name: "Image Quality", weight: 23 },
  { key: "speed", name: "Speed & Uptime", weight: 18 },
  { key: "cost", name: "Cost & Free Tier", weight: 14 },
  { key: "trust", name: "Trust & Safety", weight: 9 },
  { key: "automation", name: "Automation & Innovation", weight: 5 },
  { key: "ethics", name: "Ethical & Environmental", weight: 4 },
] as const;

const PROVIDERS: Row[] = [
  { slug: "adobe",      name: "Adobe Firefly (CC/Express)", total: 89.8, hasApi: true,  hasAffiliate: true },
  { slug: "leonardo",   name: "Leonardo AI",                total: 87.6, hasApi: true,  hasAffiliate: true },
  { slug: "artistly",   name: "Artistly",                   total: 87.1, hasApi: false, hasAffiliate: true },
  { slug: "lexica",     name: "Lexica (Aperture)",          total: 83.9, hasApi: true,  hasAffiliate: false },
  { slug: "openai",     name: "OpenAI (DALL·E / GPT-Image)",total: 83.7, hasApi: true,  hasAffiliate: false },
  { slug: "fotor",      name: "Fotor",                      total: 82.9, hasApi: true,  hasAffiliate: true },
  { slug: "nightcafe",  name: "NightCafe",                  total: 82.9, hasApi: false, hasAffiliate: true },
  { slug: "openart",    name: "OpenArt",                    total: 82.8, hasApi: false, hasAffiliate: true },
  { slug: "stability",  name: "Stability AI (Stable Diffusion API)", total: 82.5, hasApi: true, hasAffiliate: false },
  { slug: "canva",      name: "Canva Text-to-Image",        total: 82.5, hasApi: false, hasAffiliate: true },
  { slug: "pixlr",      name: "Pixlr",                      total: 81.7, hasApi: true,  hasAffiliate: true },
  { slug: "i23rf",      name: "I23RF AI Generator",         total: 81.3, hasApi: true,  hasAffiliate: true },
  { slug: "picsart",    name: "Picsart",                    total: 80.8, hasApi: true,  hasAffiliate: true },
  { slug: "midjourney", name: "MidJourney (Discord)",       total: 84.2, hasApi: false, hasAffiliate: false },
  { slug: "novelai",    name: "NovelAI (Image)",            total: 78.0, hasApi: true,  hasAffiliate: false },
  { slug: "deepai",     name: "DeepAI",                     total: 71.7, hasApi: true,  hasAffiliate: false },
  // The 4 canonical with TBD:
  { slug: "bing",       name: "Bing Image Creator",         total: null, hasApi: null as any, hasAffiliate: null as any },
  { slug: "ideogram",   name: "Ideogram",                   total: null, hasApi: null as any, hasAffiliate: null as any },
  { slug: "playground", name: "Playground AI",              total: null, hasApi: null as any, hasAffiliate: null as any },
  { slug: "flux",       name: "Flux Schnell",               total: null, hasApi: null as any, hasAffiliate: null as any },
];

const clamp01 = (n: number) => Math.max(0, Math.min(100, n));

const distributeSubscores = (total: number) => {
  // proportionally distribute to raw subscores (integers) so that sum(weighted) ≈ total.
  // Start with equal raw=80 then scale.
  const weights = CRITERIA.map((c) => c.weight);
  const base = 80;
  let weightedBase = weights.reduce((acc, w) => acc + (base * w) / 100, 0);
  const scale = total / weightedBase;

  const raws = CRITERIA.map((c) => clamp01(Math.round(base * scale)));
  // Minor tweak to match rounding drift: re-compute and adjust last slot
  const recomputed = raws.reduce((acc, r, i) => acc + (r * CRITERIA[i].weight) / 100, 0);
  const drift = Math.round((total - recomputed) * 10) / 10;
  if (Math.abs(drift) >= 0.1) {
    // Nudge 'quality' then 'adoption'
    const qi = CRITERIA.findIndex((c) => c.key === "quality");
    raws[qi] = clamp01(raws[qi] + (drift > 0 ? 1 : -1));
  }
  return raws;
};

async function main() {
  // criteria upsert
  for (const c of CRITERIA) {
    await prisma.criterion.upsert({
      where: { key: c.key },
      create: { key: c.key, name: c.name, weight: c.weight },
      update: { name: c.name, weight: c.weight },
    });
  }

  for (const p of PROVIDERS) {
    const provider = await prisma.provider.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        displayName: p.name,
        hasApi: Boolean(p.hasApi),
        hasAffiliate: Boolean(p.hasAffiliate),
      },
      update: {
        displayName: p.name,
        hasApi: Boolean(p.hasApi),
        hasAffiliate: Boolean(p.hasAffiliate),
      },
    });

    if (p.total == null) {
      // create neutral zeros to signal "needs input"
      for (const c of CRITERIA) {
        await prisma.providerScore.upsert({
          where: { providerId_criterionId: { providerId: provider.id, criterionId: (await prisma.criterion.findUnique({ where: { key: c.key } }))!.id } },
          create: { providerId: provider.id, criterionId: (await prisma.criterion.findUnique({ where: { key: c.key } }))!.id, raw: 0 },
          update: { raw: 0 },
        });
      }
      continue;
    }

    const raws = distributeSubscores(p.total);
    for (let i = 0; i < CRITERIA.length; i++) {
      const c = CRITERIA[i];
      const crit = await prisma.criterion.findUnique({ where: { key: c.key } });
      await prisma.providerScore.upsert({
        where: { providerId_criterionId: { providerId: provider.id, criterionId: crit!.id } },
        create: { providerId: provider.id, criterionId: crit!.id, raw: raws[i] },
        update: { raw: raws[i] },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
