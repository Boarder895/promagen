// scripts/generate-docs.js
// Build Developers Book, Users Book, and Build Plan from docs/source.json

import fs from 'node:fs';
import path from 'node:path';

// --- helpers ---
const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'docs', 'source.json');
const OUT = path.join(ROOT, 'docs');
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
  console.log('✓ wrote', path.relative(ROOT, filePath));
}

function mdList(items) {
  return items && items.length ? items.map(i => `- ${i}`).join('\n') : '-';
}

function stampEdition(autoFlagOrDate) {
  return autoFlagOrDate === 'auto' ? today : (autoFlagOrDate || today);
}

// --- builders ---
function buildDevelopers(src) {
  const ed = stampEdition(src.edition);
  const wNew = mdList(src.whatsNew?.developers || []);
  const ep = src.entryPoints || {};
  const f = src.features || {};
  const badges = src.badges || {};
  const policy = src.providerPolicy || {};

  return `# 📘 Developers Book — *How to Use Promagen*
**Edition: ${ed}**

### What’s New in This Edition
${wNew}

---

## Entry points
- Marketing → ${ep.marketing || 'https://promagen.com'}
- Web app → ${ep.app || 'https://app.promagen.com'}

## Core features
- **Leaderboard** → ${f.leaderboardPath || '/leaderboard'}
- **Providers Registry** → ${f.providersPath || '/providers'}
- **Prompt Runner** → ${f.promptPath || '/prompt'}
  - Paste prompt → select providers → choose:
    - **Run in Promagen ${badges.api?.split(' ')[0] || '⚡'}** (if \`apiEnabled\` and user key valid)
    - **Copy & Open ${badges.copyOpen?.split(' ')[0] || '✂️'}** (always available)

## Popular Prompts
- ${f.promptsPath || '/prompts'} → ❤️ like · **Refine/Remix**

## Copy & Open ${badges.copyOpen || '✂️ Copy & Open'}
- Always rendered for all providers${policy.alwaysCopyOpen ? ' (policy: true)' : ''}.
- Uses affiliate routing when available.
- Opens embedded view where allowed; falls back to new tab if blocked.
- Fallback if API run fails.

## Provider Capabilities Map
\`\`\`ts
type Provider = {
  id: string;              // canonical 20 IDs
  name: string;
  apiEnabled: boolean;
  copyAndOpenEnabled: true; // enforced policy
  affiliateLink?: string;
  embedAllowed?: boolean;
}
\`\`\`

## Admin (restricted)
- \`${f.admin?.health || 'https://api.promagen.com/health'}\` — API liveness
- \`${f.admin?.ping || '/api/admin/ping'}\` — admin ping
- \`${f.admin?.sync || '/api/admin/sync'}\` — data/score sync
- **Score Adjustment Editor** — inline override, clamped 0–100

## Planned
- API Key Vault \`${f.keysPath || '/keys'}\`
- Docs hub \`${f.docsPath || '/docs'}\`
- Metrics \`${f.metricsPath || '/metrics'}\` (restricted)
`;
}

function buildUsers(src) {
  const ed = stampEdition(src.edition);
  const wNew = mdList(src.whatsNew?.users || []);
  const ep = src.entryPoints || {};
  const f = src.features || {};
  const badges = src.badges || {};

  return `# 📙 Users Book — *Promagen User Guide*
**Edition: ${ed}**

### What’s New in This Edition
${wNew}

---

## 1) Getting Started
Visit \`${ep.marketing || 'https://promagen.com'}\` (info) or \`${ep.app || 'https://app.promagen.com'}\` (tools)
- **Video:** [YouTube: Getting Started with Promagen](#)

## 2) Leaderboard
Check \`${f.leaderboardPath || '/leaderboard'}\` for live rankings
- **Video:** [YouTube: Understanding the Promagen Leaderboard](#)

## 3) Explore Providers
Go to \`${f.providersPath || '/providers'}\`
- **Badges:** ${badges.api || '⚡ API'} · ${badges.copyOpen || '✂️ Copy & Open'} · ${badges.affiliate || '💸 Affiliate'}
- **Video:** [YouTube: Explore AI Providers on Promagen](#)

## 4) Create & Run a Prompt
At \`${f.promptPath || '/prompt'}\`:
- Paste text → select providers → pick:
  - **Run in Promagen ${badges.api?.split(' ')[0] || '⚡'}** — image returns inside Promagen
  - **Copy & Open ${badges.copyOpen?.split(' ')[0] || '✂️'}** — copies prompt and opens provider site
- **Video:** [YouTube: How to Create and Run Prompts](#)

## 5) Popular Prompts
Go to \`${f.promptsPath || '/prompts'}\` → ❤️ like → **Refine/Remix** → run via ${badges.api?.split(' ')[0] || '⚡'} or ${badges.copyOpen?.split(' ')[0] || '✂️'}
- **Video:** [YouTube: Discover and Remix Popular Prompts](#)

## 6) Copy & Open Providers (always available)
- Every provider supports ${badges.copyOpen || '✂️ Copy & Open'}
- Copy prompt → provider opens (inside Promagen or new tab) → paste → run
- **Video:** [YouTube: Using Copy & Open Providers](#)

## 7) Upgrades & Disclosures
Click ${badges.affiliate || '💸 Affiliate'} Upgrade/Join links → disclosure always shown
- **Video:** [YouTube: Upgrading via Promagen (Affiliate Explained)](#)

## 8) Behind the Scenes (Admin only)
Admins can override scores 0–100 safely
- **Video:** [YouTube: Admin Controls and Score Adjustments](#)

## Planned
- Your API Keys (\`${f.keysPath || '/keys'}\`)
- Workspace/History (\`/workspace\`)
- Languages & Clocks
- Subscriptions & Credits
`;
}

function chipList(title, arr, icon) {
  if (!arr || !arr.length) return '';
  const prefix = icon ? `${icon} ` : '- ';
  return arr.map(i => `${prefix}${i}`).join('\n');
}

function buildPlan(src) {
  const ed = stampEdition(src.edition);
  const wNew = mdList(src.whatsNew?.buildPlan || []);
  const bp = src.buildPlan || {};

  return `# 🏗 Promagen Build Plan
**Edition: ${ed}**

### What’s New in This Edition
${wNew}

---

## 1) Foundation & Repos
${chipList('', bp.foundation?.done, '✅')}
${chipList('', bp.foundation?.partial, '🟡')}
${chipList('', bp.foundation?.todo, '⬜')}

## 2) Backend API
${chipList('', bp.backend?.done, '✅')}
${chipList('', bp.backend?.partial, '🟡')}
${chipList('', bp.backend?.todo, '⬜')}

## 3) Frontend
${chipList('', bp.frontend?.done, '✅')}
${chipList('', bp.frontend?.partial, '🟡')}
${chipList('', bp.frontend?.todo, '⬜')}

## 4) Security
${chipList('', bp.security?.done, '✅')}
${chipList('', bp.security?.partial, '🟡')}
${chipList('', bp.security?.todo, '⬜')}

## 5) Provider Integration
${chipList('', bp.providers?.done, '✅')}
${chipList('', bp.providers?.partial, '🟡')}
${chipList('', bp.providers?.todo, '⬜')}

## 6) Leaderboard & Scoring
${chipList('', bp.leaderboard?.done, '✅')}
${chipList('', bp.leaderboard?.partial, '🟡')}
${chipList('', bp.leaderboard?.todo, '⬜')}

## 7) Popular Prompt Grid
${chipList('', bp.prompts?.done, '✅')}
${chipList('', bp.prompts?.partial, '🟡')}
${chipList('', bp.prompts?.todo, '⬜')}

## 8) WordPress ↔ App
${chipList('', bp.wpApp?.done, '✅')}
${chipList('', bp.wpApp?.partial, '🟡')}
${chipList('', bp.wpApp?.todo, '⬜')}

## 9) Observability & Ops
${chipList('', bp.ops?.done, '✅')}
${chipList('', bp.ops?.partial, '🟡')}
${chipList('', bp.ops?.todo, '⬜')}

## 10) Admin & Access
${chipList('', bp.adminAccess?.done, '✅')}
${chipList('', bp.adminAccess?.partial, '🟡')}
${chipList('', bp.adminAccess?.todo, '⬜')}

## 11) Data & Compliance
${chipList('', bp.compliance?.done, '✅')}
${chipList('', bp.compliance?.partial, '🟡')}
${chipList('', bp.compliance?.todo, '⬜')}

## 12) Release & QA
${chipList('', bp.releaseQA?.done, '✅')}
${chipList('', bp.releaseQA?.partial, '🟡')}
${chipList('', bp.releaseQA?.todo, '⬜')}
`;
}

// --- main ---
(function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Missing docs/source.json. Create it first.');
    process.exit(1);
  }
  const src = readJson(SOURCE);

  write(path.join(OUT, 'developers.md'), buildDevelopers(src));
  write(path.join(OUT, 'users.md'), buildUsers(src));
  write(path.join(OUT, 'build-plan.md'), buildPlan(src));
})();
