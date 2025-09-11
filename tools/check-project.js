// tools/check-project.js
const fs = require('fs');
const path = require('path');

const mustExist = [
  'package.json',
  'tsconfig.json',
  '.gitignore',
  '.env.example',
  'README.md',

  'src/server.ts',
  'src/config/env.ts',
  'src/middleware/security.ts',
  'src/lib/crypto.ts',
  'src/routes/openai.ts',
  'src/routes/health.ts',

  'prisma/schema.prisma',
];

const niceToHave = [
  '.env',
  'prisma/seed.ts',
  'web/index.html',
  'web/main.ts',
];

function check(file) {
  const p = path.join(process.cwd(), file);
  return fs.existsSync(p);
}

let missing = [];
console.log('=== Promagen file check ===');
for (const f of mustExist) {
  const ok = check(f);
  console.log(`${ok ? '✅' : '❌'} ${f}`);
  if (!ok) missing.push(f);
}
console.log('\n--- Optional files ---');
for (const f of niceToHave) {
  const ok = check(f);
  console.log(`${ok ? '🟢' : '⚪'} ${f}`);
}

if (missing.length) {
  console.error('\nMissing required files:\n' + missing.map(m => ` - ${m}`).join('\n'));
  process.exit(1);
} else {
  console.log('\nAll required files are present. ✅');
}
