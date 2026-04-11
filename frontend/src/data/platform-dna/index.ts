// src/data/platform-dna/index.ts
// ============================================================================
// PLATFORM DNA PROFILE — Loader
// ============================================================================
// Authority: call-3-quality-architecture-v0.2.0.md §4
// Build plan: call-3-quality-build-plan-v1.md §5.2
//
// Pure data loader. No side effects on import. Validates profiles at load time
// and caches the result. Consumers call getDNA() or getAllDNA() — never read
// the JSON directly.
//
// v1.1.0: Deep tokenBudget validation (min <= max, priority 0–1).
//         _meta integrity check (platformCount + encoderFamilyCounts).
//         knownFailureModes non-empty enforcement.
//         Removed unsafe `as unknown as PlatformDNA` cast.
// ============================================================================

import type {
  PlatformDNA,
  PlatformDNACollection,
  EncoderFamily,
  PromptStylePreference,
  SyntaxMode,
  NegativeMode,
  TransformId,
  HarmonyStatus,
  ProfilesMeta,
  TokenBudgetEntry,
} from './types';

import profilesRaw from './profiles.json';

// ── Validation constants ────────────────────────────────────────────────────

const VALID_ENCODER_FAMILIES: ReadonlySet<EncoderFamily> = new Set([
  'clip', 't5', 'llm_rewrite', 'llm_semantic', 'proprietary',
]);

const VALID_PROMPT_STYLES: ReadonlySet<PromptStylePreference> = new Set([
  'weighted_keywords', 'structured_nl', 'freeform_nl', 'mixed',
]);

const VALID_SYNTAX_MODES: ReadonlySet<SyntaxMode> = new Set([
  'parenthetical', 'double_colon', 'curly_brace', 'none',
]);

const VALID_NEGATIVE_MODES: ReadonlySet<NegativeMode> = new Set([
  'separate_field', 'inline', 'converted', 'none', 'counterproductive',
]);

const VALID_TRANSFORMS: ReadonlySet<TransformId> = new Set([
  'T_SUBJECT_FRONT', 'T_ATTENTION_SEQUENCE', 'T_WEIGHT_REBALANCE',
  'T_TOKEN_MERGE', 'T_SEMANTIC_COMPRESS', 'T_REDUNDANCY_STRIP',
  'T_QUALITY_POSITION', 'T_PARAM_VALIDATE', 'T_WEIGHT_VALIDATE',
  'T_CLAUSE_FRONT', 'T_SCENE_PREMISE', 'T_PROSE_RESTRUCTURE',
  'T_NARRATIVE_ARMOUR', 'T_NEGATIVE_GENERATE', 'T_CHAR_ENFORCE',
  'T_SYNTAX_CLEANUP',
]);

const VALID_HARMONY_STATUSES: ReadonlySet<HarmonyStatus> = new Set([
  'verified', 'in_progress', 'untested',
]);

// ── Validation helpers ──────────────────────────────────────────────────────

/** Type guard: is this a valid enum member? */
function isValidEnum<T extends string>(value: unknown, validSet: ReadonlySet<T>): value is T {
  return typeof value === 'string' && validSet.has(value as T);
}

/**
 * Validates a single tokenBudget entry.
 * Enforces: min >= 0, max >= min, priority in [0, 1].
 */
function validateTokenBudgetEntry(
  id: string,
  category: string,
  entry: Record<string, unknown>,
): TokenBudgetEntry {
  const min = entry['min'];
  const max = entry['max'];
  const priority = entry['priority'];

  if (typeof min !== 'number' || min < 0) {
    throw new Error(`DNA[${id}].tokenBudget.${category}.min must be >= 0, got ${String(min)}`);
  }
  if (typeof max !== 'number' || max < min) {
    throw new Error(`DNA[${id}].tokenBudget.${category}.max must be >= min (${min}), got ${String(max)}`);
  }
  if (typeof priority !== 'number' || priority < 0 || priority > 1) {
    throw new Error(`DNA[${id}].tokenBudget.${category}.priority must be 0.0–1.0, got ${String(priority)}`);
  }

  return { min, max, priority };
}

// ── Profile validation ──────────────────────────────────────────────────────

/**
 * Validates a single platform DNA profile at runtime.
 * Throws descriptive errors for malformed data.
 *
 * Returns a properly typed PlatformDNA object constructed from validated
 * fields — no unsafe casts.
 */
function validateProfile(id: string, raw: Record<string, unknown>): PlatformDNA {
  // ── id ────────────────────────────────────────────────────────────
  if (raw['id'] !== id) {
    throw new Error(`DNA[${id}]: id field "${String(raw['id'])}" does not match key "${id}"`);
  }

  // ── Enum fields ───────────────────────────────────────────────────
  const encoderFamily = raw['encoderFamily'];
  if (!isValidEnum(encoderFamily, VALID_ENCODER_FAMILIES)) {
    throw new Error(`DNA[${id}]: invalid encoderFamily "${String(encoderFamily)}"`);
  }

  const promptStylePreference = raw['promptStylePreference'];
  if (!isValidEnum(promptStylePreference, VALID_PROMPT_STYLES)) {
    throw new Error(`DNA[${id}]: invalid promptStylePreference "${String(promptStylePreference)}"`);
  }

  const syntaxMode = raw['syntaxMode'];
  if (!isValidEnum(syntaxMode, VALID_SYNTAX_MODES)) {
    throw new Error(`DNA[${id}]: invalid syntaxMode "${String(syntaxMode)}"`);
  }

  const negativeMode = raw['negativeMode'];
  if (!isValidEnum(negativeMode, VALID_NEGATIVE_MODES)) {
    throw new Error(`DNA[${id}]: invalid negativeMode "${String(negativeMode)}"`);
  }

  const harmonyStatus = raw['harmonyStatus'];
  if (!isValidEnum(harmonyStatus, VALID_HARMONY_STATUSES)) {
    throw new Error(`DNA[${id}]: invalid harmonyStatus "${String(harmonyStatus)}"`);
  }

  // ── Numeric fields ────────────────────────────────────────────────
  const tokenLimit = raw['tokenLimit'];
  if (tokenLimit !== null && typeof tokenLimit !== 'number') {
    throw new Error(`DNA[${id}]: tokenLimit must be number or null, got ${typeof tokenLimit}`);
  }

  const charCeiling = raw['charCeiling'];
  if (typeof charCeiling !== 'number' || charCeiling <= 0) {
    throw new Error(`DNA[${id}]: charCeiling must be positive, got ${String(charCeiling)}`);
  }

  // ── Processing profile ────────────────────────────────────────────
  const pp = raw['processingProfile'] as Record<string, unknown> | undefined;
  if (!pp || typeof pp !== 'object') {
    throw new Error(`DNA[${id}]: processingProfile is required`);
  }

  const frontLoadImportance = pp['frontLoadImportance'];
  if (typeof frontLoadImportance !== 'number' || frontLoadImportance < 0 || frontLoadImportance > 1) {
    throw new Error(`DNA[${id}]: frontLoadImportance must be 0.0–1.0, got ${String(frontLoadImportance)}`);
  }

  const rewritesPrompt = pp['rewritesPrompt'];
  if (typeof rewritesPrompt !== 'boolean') {
    throw new Error(`DNA[${id}]: rewritesPrompt must be boolean`);
  }

  const qualityTagsEffective = pp['qualityTagsEffective'];
  if (typeof qualityTagsEffective !== 'boolean') {
    throw new Error(`DNA[${id}]: qualityTagsEffective must be boolean`);
  }

  // ── Transforms ────────────────────────────────────────────────────
  const transforms = raw['allowedTransforms'];
  if (!Array.isArray(transforms) || transforms.length === 0) {
    throw new Error(`DNA[${id}]: allowedTransforms must be a non-empty array`);
  }

  const validatedTransforms: TransformId[] = [];
  const seenTransforms = new Set<string>();
  for (const t of transforms) {
    if (!isValidEnum(t, VALID_TRANSFORMS)) {
      throw new Error(`DNA[${id}]: invalid transform "${String(t)}"`);
    }
    if (seenTransforms.has(t)) {
      throw new Error(`DNA[${id}]: duplicate transform "${t}"`);
    }
    seenTransforms.add(t);
    validatedTransforms.push(t);
  }

  // ── GPT fields ────────────────────────────────────────────────────
  const requiresGPT = raw['requiresGPT'];
  if (typeof requiresGPT !== 'boolean') {
    throw new Error(`DNA[${id}]: requiresGPT must be boolean`);
  }

  const gptTemperature = raw['gptTemperature'];
  if (requiresGPT && gptTemperature === null) {
    throw new Error(`DNA[${id}]: requiresGPT is true but gptTemperature is null`);
  }
  if (!requiresGPT && gptTemperature !== null) {
    throw new Error(`DNA[${id}]: requiresGPT is false but gptTemperature is ${String(gptTemperature)}`);
  }
  if (gptTemperature !== null && typeof gptTemperature !== 'number') {
    throw new Error(`DNA[${id}]: gptTemperature must be number or null`);
  }

  // ── Retry ─────────────────────────────────────────────────────────
  const retryEnabled = raw['retryEnabled'];
  if (typeof retryEnabled !== 'boolean') {
    throw new Error(`DNA[${id}]: retryEnabled must be boolean`);
  }

  // ── Token budget (deep validation) ────────────────────────────────
  const tokenBudgetRaw = raw['tokenBudget'];
  let tokenBudget: PlatformDNA['tokenBudget'] = null;

  if (tokenBudgetRaw !== null) {
    if (typeof tokenBudgetRaw !== 'object' || Array.isArray(tokenBudgetRaw)) {
      throw new Error(`DNA[${id}]: tokenBudget must be object or null`);
    }
    const validated: Record<string, TokenBudgetEntry> = {};
    for (const [category, entry] of Object.entries(tokenBudgetRaw as Record<string, unknown>)) {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`DNA[${id}]: tokenBudget.${category} must be an object`);
      }
      validated[category] = validateTokenBudgetEntry(id, category, entry as Record<string, unknown>);
    }
    tokenBudget = validated as PlatformDNA['tokenBudget'];
  }

  // ── Known failure modes (non-empty) ───────────────────────────────
  const knownFailureModes = raw['knownFailureModes'];
  if (!Array.isArray(knownFailureModes) || knownFailureModes.length === 0) {
    throw new Error(`DNA[${id}]: knownFailureModes must be a non-empty array`);
  }
  for (const fm of knownFailureModes) {
    if (typeof fm !== 'string' || fm.length === 0) {
      throw new Error(`DNA[${id}]: each knownFailureMode must be a non-empty string`);
    }
  }

  // ── Hallucination map ─────────────────────────────────────────────
  const hallucinationMap = raw['hallucinationMap'];
  if (hallucinationMap !== null && (typeof hallucinationMap !== 'object' || Array.isArray(hallucinationMap))) {
    throw new Error(`DNA[${id}]: hallucinationMap must be object or null`);
  }

  // ── Measurement fields ────────────────────────────────────────────
  const assembledBaseline = raw['assembledBaseline'];
  const optimisedScore = raw['optimisedScore'];
  const availableHeadroom = raw['availableHeadroom'];

  for (const [name, val] of [
    ['assembledBaseline', assembledBaseline],
    ['optimisedScore', optimisedScore],
    ['availableHeadroom', availableHeadroom],
  ] as const) {
    if (val !== null && typeof val !== 'number') {
      throw new Error(`DNA[${id}]: ${name} must be number or null`);
    }
  }

  // ── Encoder notes (optional) ──────────────────────────────────────
  const encoderNotes = raw['encoderNotes'];
  if (encoderNotes !== undefined && typeof encoderNotes !== 'string') {
    throw new Error(`DNA[${id}]: encoderNotes must be string or undefined`);
  }

  // ── Construct typed object (no unsafe cast) ───────────────────────
  const profile: PlatformDNA = {
    id,
    encoderFamily,
    promptStylePreference,
    syntaxMode,
    negativeMode,
    tokenLimit: tokenLimit as number | null,
    charCeiling,
    processingProfile: {
      frontLoadImportance,
      rewritesPrompt,
      qualityTagsEffective,
    },
    allowedTransforms: validatedTransforms,
    requiresGPT,
    gptTemperature: gptTemperature as number | null,
    retryEnabled,
    tokenBudget,
    knownFailureModes: knownFailureModes as string[],
    hallucinationMap: hallucinationMap as PlatformDNA['hallucinationMap'],
    assembledBaseline: assembledBaseline as number | null,
    optimisedScore: optimisedScore as number | null,
    availableHeadroom: availableHeadroom as number | null,
    harmonyStatus,
    ...(encoderNotes !== undefined ? { encoderNotes: encoderNotes as string } : {}),
  };

  return profile;
}

// ── _meta validation ────────────────────────────────────────────────────────

/**
 * Validates that _meta.platformCount and _meta.encoderFamilyCounts match
 * the actual loaded profiles. Catches drift between metadata and data.
 */
function validateMeta(
  meta: Record<string, unknown>,
  profiles: Record<string, PlatformDNA>,
): void {
  const actualCount = Object.keys(profiles).length;
  const declaredCount = meta['platformCount'];

  if (typeof declaredCount === 'number' && declaredCount !== actualCount) {
    throw new Error(
      `DNA _meta: platformCount declares ${declaredCount} but ${actualCount} profiles loaded`,
    );
  }

  const declaredCounts = meta['encoderFamilyCounts'] as Record<string, number> | undefined;
  if (declaredCounts && typeof declaredCounts === 'object') {
    const actualCounts: Record<string, number> = {};
    for (const dna of Object.values(profiles)) {
      actualCounts[dna.encoderFamily] = (actualCounts[dna.encoderFamily] ?? 0) + 1;
    }

    for (const [family, declared] of Object.entries(declaredCounts)) {
      const actual = actualCounts[family] ?? 0;
      if (declared !== actual) {
        throw new Error(
          `DNA _meta: encoderFamilyCounts[${family}] declares ${declared} but found ${actual}`,
        );
      }
    }
  }
}

// ── Profile loading and caching ─────────────────────────────────────────────

let cachedProfiles: PlatformDNACollection | null = null;

function loadProfiles(): PlatformDNACollection {
  if (cachedProfiles) return cachedProfiles;

  const raw = profilesRaw as Record<string, Record<string, unknown>>;
  const profiles: Record<string, PlatformDNA> = {};
  let meta: Record<string, unknown> | null = null;

  for (const [key, value] of Object.entries(raw)) {
    if (key === '_meta') {
      meta = value;
      continue;
    }
    profiles[key] = validateProfile(key, value);
  }

  // Validate _meta integrity against loaded profiles
  if (meta) {
    validateMeta(meta, profiles);
  }

  cachedProfiles = profiles;
  return profiles;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the DNA profile for a specific platform.
 * @returns The platform's DNA profile, or null if not found
 */
export function getDNA(platformId: string): PlatformDNA | null {
  const profiles = loadProfiles();
  return profiles[platformId] ?? null;
}

/**
 * Get all DNA profiles as a keyed collection.
 * @returns All platform DNA profiles keyed by platform ID
 */
export function getAllDNA(): PlatformDNACollection {
  return loadProfiles();
}

/**
 * Get all platform IDs that have DNA profiles.
 * @returns Sorted array of platform IDs
 */
export function getAllDNAIds(): string[] {
  return Object.keys(loadProfiles()).sort();
}

/**
 * Get all platforms belonging to a specific encoder family.
 * @param family - The encoder family to filter by
 * @returns Array of DNA profiles for that family
 */
export function getDNAByEncoderFamily(family: EncoderFamily): PlatformDNA[] {
  return Object.values(loadProfiles())
    .filter((dna) => dna.encoderFamily === family);
}

/**
 * Get all platforms that require GPT for at least one transform.
 * @returns Array of DNA profiles where requiresGPT is true
 */
export function getGPTPlatforms(): PlatformDNA[] {
  return Object.values(loadProfiles())
    .filter((dna) => dna.requiresGPT);
}

/**
 * Get all platforms that are fully deterministic (zero GPT cost).
 * @returns Array of DNA profiles where requiresGPT is false
 */
export function getDeterministicPlatforms(): PlatformDNA[] {
  return Object.values(loadProfiles())
    .filter((dna) => !dna.requiresGPT);
}

/**
 * Check whether a specific transform is allowed for a platform.
 * @returns true if the transform is in the platform's allowedTransforms
 */
export function isTransformAllowed(platformId: string, transformId: TransformId): boolean {
  const dna = getDNA(platformId);
  if (!dna) return false;
  return dna.allowedTransforms.includes(transformId);
}

/**
 * Get the raw _meta block from profiles.json for inspection.
 * Used by tests to validate metadata integrity.
 */
export function getProfilesMeta(): ProfilesMeta | null {
  const raw = profilesRaw as Record<string, unknown>;
  const meta = raw['_meta'] as ProfilesMeta | undefined;
  return meta ?? null;
}
