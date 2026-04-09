/**
 * Sentinel Self-Test Endpoint
 *
 * Runs a mini crawl of 3 known pages, verifies extraction against
 * expected values, and returns pass/fail. Catches parser breakage
 * before Monday.
 *
 * Can be called:
 *   - Manually after deploys: GET /api/sentinel/selftest?secret=...
 *   - As part of deploy verification scripts
 *
 * Does NOT write to the database. Read-only test against live pages.
 *
 * Authority: sentinel.md v1.2.0 (Extra addition)
 * Existing features preserved: Yes
 */

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { crawlPage } from '@/lib/sentinel/crawler';
import type { CrawlResult } from '@/types/sentinel';
import { classifyPage } from '@/lib/sentinel/page-classifier';

// =============================================================================
// TEST DEFINITIONS
// =============================================================================

interface SelfTestCase {
  /** URL path to test (appended to base URL) */
  path: string;
  /** Expected page class */
  expectedClass: string;
  /** Assertions to run on the crawl result */
  assertions: Array<{
    field: string;
    check: 'exists' | 'contains' | 'gt';
    value?: string | number;
    description: string;
  }>;
}

/**
 * Three canonical test pages that cover the main extraction paths.
 *
 * These are chosen because they are:
 *   1. Always live (they're core pages)
 *   2. Structurally stable (unlikely to change layout)
 *   3. Cover different page classes and extraction paths
 */
const TEST_CASES: SelfTestCase[] = [
  {
    path: '/',
    expectedClass: 'homepage',
    assertions: [
      { field: 'statusCode', check: 'exists', description: 'Homepage returns 200' },
      { field: 'title', check: 'exists', description: 'Homepage has a title' },
      { field: 'wordCount', check: 'gt', value: 50, description: 'Homepage has content' },
    ],
  },
  {
    path: '/platforms',
    expectedClass: 'hub',
    assertions: [
      { field: 'statusCode', check: 'exists', description: 'Hub returns 200' },
      { field: 'title', check: 'exists', description: 'Hub has a title' },
      { field: 'schemaTypes', check: 'exists', description: 'Hub has JSON-LD schema' },
      { field: 'wordCount', check: 'gt', value: 100, description: 'Hub has substantial content' },
    ],
  },
  {
    path: '/platforms/negative-prompts',
    expectedClass: 'guide',
    assertions: [
      { field: 'statusCode', check: 'exists', description: 'Guide returns 200' },
      { field: 'title', check: 'exists', description: 'Guide has a title' },
      { field: 'h1', check: 'exists', description: 'Guide has an H1' },
      { field: 'schemaTypes', check: 'exists', description: 'Guide has JSON-LD schema' },
    ],
  },
];

// =============================================================================
// AUTH
// =============================================================================

function validateAuth(request: NextRequest): boolean {
  const secret = env.cron.secret;
  if (!secret || secret.length < 16) return false;

  const url = new URL(request.url);
  const provided = (
    url.searchParams.get('secret') ||
    request.headers.get('x-promagen-cron') ||
    ''
  ).trim();

  if (!provided) return false;

  const aa = Buffer.from(provided, 'utf8');
  const bb = Buffer.from(secret, 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const baseUrl = env.siteUrl;
  const results: Array<{
    path: string;
    expectedClass: string;
    actualClass: string;
    classMatch: boolean;
    assertions: Array<{
      description: string;
      passed: boolean;
      detail: string;
    }>;
    crawlMs: number;
    error: string | null;
  }> = [];

  let allPassed = true;

  for (const testCase of TEST_CASES) {
    const fullUrl = `${baseUrl}${testCase.path}`;
    const crawlStart = Date.now();

    try {
      const crawlResult = await crawlPage(fullUrl);
      const crawlMs = Date.now() - crawlStart;
      const actualClass = classifyPage(testCase.path);
      const classMatch = actualClass === testCase.expectedClass;

      if (!classMatch) allPassed = false;

      const assertionResults = testCase.assertions.map((assertion) => {
        const result = runAssertion(assertion, crawlResult);
        if (!result.passed) allPassed = false;
        return result;
      });

      results.push({
        path: testCase.path,
        expectedClass: testCase.expectedClass,
        actualClass,
        classMatch,
        assertions: assertionResults,
        crawlMs,
        error: crawlResult.error,
      });
    } catch (error) {
      allPassed = false;
      results.push({
        path: testCase.path,
        expectedClass: testCase.expectedClass,
        actualClass: 'error',
        classMatch: false,
        assertions: [],
        crawlMs: Date.now() - crawlStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const totalAssertions = results.reduce((sum, r) => sum + r.assertions.length, 0);
  const passedAssertions = results.reduce(
    (sum, r) => sum + r.assertions.filter((a) => a.passed).length,
    0,
  );

  return NextResponse.json({
    ok: allPassed,
    summary: allPassed
      ? `All ${totalAssertions} assertions passed across ${results.length} pages`
      : `${passedAssertions}/${totalAssertions} assertions passed — FAILURES DETECTED`,
    results,
    durationMs: Date.now() - startTime,
  });
}

// =============================================================================
// ASSERTION RUNNER
// =============================================================================

function runAssertion(
  assertion: SelfTestCase['assertions'][number],
  crawlResult: CrawlResult,
): { description: string; passed: boolean; detail: string } {
  // Dynamic field access — field names validated by SelfTestCase definitions
  const value = (crawlResult as unknown as Record<string, unknown>)[assertion.field];

  switch (assertion.check) {
    case 'exists': {
      if (assertion.field === 'statusCode') {
        const passed = value === 200;
        return {
          description: assertion.description,
          passed,
          detail: passed ? `Status: ${value}` : `Expected 200, got ${value}`,
        };
      }
      if (assertion.field === 'schemaTypes') {
        const arr = value as string[] | null;
        const passed = Array.isArray(arr) && arr.length > 0;
        return {
          description: assertion.description,
          passed,
          detail: passed ? `Found: ${(arr ?? []).join(', ')}` : 'No schema types found',
        };
      }
      const passed = value !== null && value !== undefined && value !== '';
      return {
        description: assertion.description,
        passed,
        detail: passed ? `Value: "${String(value).slice(0, 60)}"` : 'Value is empty/null',
      };
    }

    case 'contains': {
      const str = String(value ?? '');
      const passed = str.includes(String(assertion.value));
      return {
        description: assertion.description,
        passed,
        detail: passed ? `Contains "${assertion.value}"` : `Missing "${assertion.value}" in "${str.slice(0, 60)}"`,
      };
    }

    case 'gt': {
      const num = Number(value ?? 0);
      const threshold = Number(assertion.value ?? 0);
      const passed = num > threshold;
      return {
        description: assertion.description,
        passed,
        detail: passed ? `${num} > ${threshold}` : `${num} ≤ ${threshold}`,
      };
    }

    default:
      return { description: assertion.description, passed: false, detail: 'Unknown check type' };
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
