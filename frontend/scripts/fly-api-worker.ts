import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { readFile, writeFile, mkdir } = fs.promises;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'src', 'data', 'api');
const reportsDir = path.join(rootDir, 'reports');
const outputPath = path.join(reportsDir, 'api-schedule-plan.json');

// --- Types that mirror the API brain JSON shape (simplified) ---

interface QuotaBucket {
  max_calls: number | null;
  window_seconds: number | null;
}

interface ProviderQuota {
  plan: string;
  per_second?: QuotaBucket | null;
  per_minute?: QuotaBucket | null;
  per_day?: QuotaBucket | null;
  per_month?: QuotaBucket | null;
}

interface Provider {
  id: string;
  name: string;
  quota?: ProviderQuota | null;
}

interface ProvidersCatalog {
  providers: Provider[];
}

type RoleId = string;

interface EndpointDefinition {
  id: string;
  provider_id: string;
  // NOTE: this is `role`, not `role_id`
  role?: RoleId | null;
}

interface EndpointsCatalog {
  endpoints: EndpointDefinition[];
}

interface ProviderTickPlan {
  providerId: string;
  roles: RoleId[];
  endpoints: string[];
  safeDailyBudget: number;
  safeCallsPerTick: number;
}

interface SchedulerPlan {
  generatedAt: string;
  timezone: string;
  tickMinutes: number;
  ticksPerDay: number;
  providers: ProviderTickPlan[];
}

// --- Quota maths (adapted from src/lib/api/quota.ts) ---

const TICK_MINUTES = 5;
const MINUTES_PER_DAY = 24 * 60;

function normaliseMax(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.floor(value);
}

function computeSafeDailyBudgetFromQuota(quota: ProviderQuota | null | undefined): number {
  if (!quota) return 0;

  const perDay = quota.per_day?.max_calls ?? null;
  const perMonth = quota.per_month?.max_calls ?? null;
  const perMinute = quota.per_minute?.max_calls ?? null;
  const perSecond = quota.per_second?.max_calls ?? null;

  const candidates: number[] = [];

  const fromDay = normaliseMax(perDay);
  if (fromDay != null) candidates.push(fromDay);

  const fromMonth = normaliseMax(perMonth != null ? perMonth / 31 : null);
  if (fromMonth != null) candidates.push(fromMonth);

  const fromMinute = normaliseMax(perMinute != null ? perMinute * 60 * 24 : null);
  if (fromMinute != null) candidates.push(fromMinute);

  const fromSecond = normaliseMax(perSecond != null ? perSecond * 60 * 60 * 24 : null);
  if (fromSecond != null) candidates.push(fromSecond);

  if (candidates.length === 0) {
    return 0;
  }

  const theoreticalMax = Math.min(...candidates);

  // Safety margin: run the scheduler at 80% of the theoretical maximum
  const withSafetyMargin = Math.floor(theoreticalMax * 0.8);

  return withSafetyMargin > 0 ? withSafetyMargin : 0;
}

// --- Helpers to read the existing API brain JSON ---

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const fullPath = path.join(dataDir, relativePath);
  const raw = await readFile(fullPath, 'utf8');
  return JSON.parse(raw) as T;
}

// --- Build a simple provider-centric schedule plan ---

async function buildSchedulerPlan(): Promise<SchedulerPlan> {
  const providersCatalog = await readJsonFile<ProvidersCatalog>('api.providers.catalog.json');
  const endpointsCatalog = await readJsonFile<EndpointsCatalog>('api.endpoints.catalog.json');

  const endpointsByProvider = new Map<string, EndpointDefinition[]>();
  const rolesByProvider = new Map<string, Set<RoleId>>();

  for (const endpoint of endpointsCatalog.endpoints) {
    if (!endpoint.provider_id) continue;

    const list = endpointsByProvider.get(endpoint.provider_id) ?? [];
    list.push(endpoint);
    endpointsByProvider.set(endpoint.provider_id, list);

    // IMPORTANT: this is endpoint.role, not endpoint.role_id
    if (endpoint.role) {
      const existing = rolesByProvider.get(endpoint.provider_id) ?? new Set<RoleId>();
      existing.add(endpoint.role);
      rolesByProvider.set(endpoint.provider_id, existing);
    }
  }

  const ticksPerDay = MINUTES_PER_DAY / TICK_MINUTES;

  const providerPlans: ProviderTickPlan[] = [];

  for (const provider of providersCatalog.providers) {
    const endpoints = endpointsByProvider.get(provider.id) ?? [];
    if (endpoints.length === 0) {
      // Nothing for this provider to do
      continue;
    }

    const safeDailyBudget = computeSafeDailyBudgetFromQuota(provider.quota ?? null);
    if (safeDailyBudget <= 0) {
      // Effectively unusable quota – skip it for now
      continue;
    }

    const safeCallsPerTick = Math.max(1, Math.floor(safeDailyBudget / ticksPerDay));

    const rolesSet = rolesByProvider.get(provider.id) ?? new Set<RoleId>();

    providerPlans.push({
      providerId: provider.id,
      roles: Array.from(rolesSet).sort(),
      endpoints: endpoints.map((e) => e.id).sort(),
      safeDailyBudget,
      safeCallsPerTick,
    });
  }

  providerPlans.sort((a, b) => a.providerId.localeCompare(b.providerId));

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'UTC',
    tickMinutes: TICK_MINUTES,
    ticksPerDay,
    providers: providerPlans,
  };
}

// --- CLI entrypoint ---

async function main() {
  const plan = await buildSchedulerPlan();

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  console.log(`[api-schedule-plan] Wrote scheduler plan to ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error('[api-schedule-plan] Failed to generate scheduler plan.');
  console.error(error);
  process.exitCode = 1;
});
