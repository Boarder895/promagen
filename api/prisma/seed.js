// Seed providers → then overrides → then one demo audit.
// Works on SQLite or Postgres.

const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');
const prisma = new PrismaClient();

// Keep in sync with providers.ts
const PROVIDERS = [
  { id: 'openai',     name: 'OpenAI DALL·E/GPT-Image' },
  { id: 'stability',  name: 'Stability AI' },
  { id: 'leonardo',   name: 'Leonardo AI' },
  { id: 'midjourney', name: 'Midjourney' },
  { id: 'adobe',      name: 'Adobe Firefly' },
];

async function seedProviders() {
  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { id: p.id },
      update: { name: p.name },
      create: { id: p.id, name: p.name },
    });
  }
}

async function seedOverrides() {
  const rows = [
    { providerId: 'openai',     scoreAdjustment: +8,  isHardOverride: false, finalScore: null, notes: 'demo: slight boost' },
    { providerId: 'midjourney', scoreAdjustment: +6,  isHardOverride: false, finalScore: null, notes: 'demo: slight boost' },
    { providerId: 'adobe',      scoreAdjustment: -2,  isHardOverride: false, finalScore: null, notes: 'demo: conservative' },
    { providerId: 'stability',  scoreAdjustment:  0,  isHardOverride: true,  finalScore: 80,   notes: 'demo: hard cap' },
  ];
  for (const r of rows) {
    await prisma.providerOverride.upsert({
      where: { providerId: r.providerId }, // providerId is @unique in schema
      update: {
        scoreAdjustment: r.scoreAdjustment,
        isHardOverride: r.isHardOverride,
        finalScore: r.finalScore,
        notes: r.notes,
      },
      create: r,
    });
  }
}

function clamp0to100(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function csvf(v) {
  if (typeof v !== 'string') return String(v ?? '');
  return (v.includes('"') || v.includes(',') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function seedOneAudit() {
  const base = 72;
  const byId = new Map((await prisma.providerOverride.findMany()).map(o => [o.providerId, o]));
  const rows = PROVIDERS.map(p => {
    const ov = byId.get(p.id) || null;
    let resolvedScore = null;
    let reason = 'none';
    if (ov?.isHardOverride && typeof ov.finalScore === 'number') {
      resolvedScore = clamp0to100(ov.finalScore);
      reason = 'hard';
    } else {
      const adj = typeof ov?.scoreAdjustment === 'number' ? ov.scoreAdjustment : 0;
      resolvedScore = clamp0to100(base + adj);
      reason = adj ? 'adjusted' : 'base';
    }
    return { id: p.id, name: p.name, resolvedScore, reason };
  }).sort((a, b) => (b.resolvedScore ?? -1) - (a.resolvedScore ?? -1));

  const payload = { base, rows };
  const json = JSON.stringify(payload);

  const signature = crypto.createHash('sha256').update(json).digest('hex');
  const secret = (process.env.AUDIT_HMAC_SECRET || '').trim();
  const hmacSignature = secret ? crypto.createHmac('sha256', secret).update(json).digest('hex') : null;

  const generatedAt = new Date().toISOString();
  const header = [
    '# promagen-leaderboard',
    `# generated_at: ${generatedAt}`,
    '# reviewer: seed',
    '# period: demo',
    `# signature: ${signature}`,
    secret ? `# hmac: ${hmacSignature}` : null,
    '#',
  ].filter(Boolean).join('\n');

  const csv = [
    header,
    'id,name,resolvedScore,reason',
    ...rows.map(r => `${csvf(r.id)},${csvf(r.name)},${r.resolvedScore ?? ''},${csvf(r.reason)}`)
  ].join('\n');

  await prisma.leaderboardAudit.create({
    data: {
      reviewer: 'seed',
      period: 'demo',
      base,
      bases: {},
      signature,
      hmacSignature: hmacSignature ?? undefined,
      jsonPayload: payload,
      csvPayload: csv,
    },
  });
}

async function main() {
  if ((process.env.SEED_CLEAR || '').toLowerCase() === 'true') {
    await prisma.leaderboardAudit.deleteMany({});
    await prisma.providerOverride.deleteMany({});
    await prisma.provider.deleteMany({});
  }
  await seedProviders();   // <-- create FK parents first
  await seedOverrides();   // <-- then children
  await seedOneAudit();
  console.log('Seed complete ✓');
}

main().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
