/**
 * Sentinel Auto-Suppression Rules Engine
 *
 * Instead of manually inserting suppression SQL, define rules
 * in a JSON config. The engine reads rules and creates/expires
 * suppressions automatically during each Monday run.
 *
 * Rule types:
 *   - "always": permanently suppress (e.g. "h1_changed on product pages")
 *   - "post_deploy": suppress for N days after any deploy (detected by
 *     checking if the cron is running on the same day as a Vercel deploy)
 *   - "temporary": suppress until a specific date
 *
 * The rules file is the SSOT — suppressions created by the engine are
 * tagged created_by='auto' and are cleaned up when the rule is removed.
 *
 * Authority: sentinel.md v1.2.0 (Extra addition)
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';
import type { PageClass, RegressionType } from '@/types/sentinel';

// =============================================================================
// RULE TYPES
// =============================================================================

export interface SuppressionRule {
  /** Unique rule ID for tracking */
  id: string;
  /** Human-readable description */
  description: string;
  /** Which page classes this rule applies to ('*' = all) */
  pageClasses: PageClass[] | '*';
  /** Which regression types to suppress ('*' = all) */
  regressionTypes: RegressionType[] | '*';
  /** Rule type */
  type: 'always' | 'temporary';
  /** For 'temporary': ISO date when rule expires */
  expiresAt?: string;
  /** Whether this rule is active */
  enabled: boolean;
}

// =============================================================================
// RULES DEFINITION (embedded SSOT — no separate JSON file needed)
// =============================================================================

/**
 * Auto-suppression rules.
 *
 * Edit this array to add/remove/modify rules.
 * Changes take effect on the next Monday cron run.
 */
export const AUTO_SUPPRESSION_RULES: SuppressionRule[] = [
  {
    id: 'product-h1-changes',
    description: 'Product pages change H1 frequently by design',
    pageClasses: ['product'],
    regressionTypes: ['h1_changed'],
    type: 'always',
    enabled: true,
  },
  {
    id: 'homepage-content-flux',
    description: 'Homepage content changes are intentional',
    pageClasses: ['homepage'],
    regressionTypes: ['content_shrink_20', 'h1_changed'],
    type: 'always',
    enabled: true,
  },
  // Example: temporary suppression for a rebuild
  // {
  //   id: 'inspire-rebuild',
  //   description: 'Inspire page being rebuilt this sprint',
  //   pageClasses: '*',
  //   regressionTypes: '*',
  //   expiresAt: '2026-05-01',
  //   type: 'temporary',
  //   enabled: false,
  // },
];

// =============================================================================
// ENGINE
// =============================================================================

export interface AutoSuppressionResult {
  rulesEvaluated: number;
  suppressionsCreated: number;
  suppressionsExpired: number;
  details: Array<{
    ruleId: string;
    action: 'created' | 'expired' | 'skipped';
    url: string;
    regressionType: string;
  }>;
}

/**
 * Evaluate all auto-suppression rules and create/expire suppressions.
 *
 * Called during the Monday cron run, after regression detection.
 * This is additive — it creates new suppressions from rules and
 * expires auto-created suppressions whose rules are disabled/removed.
 */
export async function evaluateAutoSuppressionRules(): Promise<AutoSuppressionResult> {
  const sql = db();
  const result: AutoSuppressionResult = {
    rulesEvaluated: 0,
    suppressionsCreated: 0,
    suppressionsExpired: 0,
    details: [],
  };

  const enabledRules = AUTO_SUPPRESSION_RULES.filter((r) => r.enabled);
  result.rulesEvaluated = enabledRules.length;

  // Get all unsuppressed regressions
  const unsuppressed = await sql<{
    id: string;
    url: string;
    page_class: string;
    regression_type: string;
  }[]>`
    SELECT id, url, page_class, regression_type
    FROM sentinel_regressions
    WHERE resolved = FALSE AND suppressed = FALSE
  `;

  // Apply rules to unsuppressed regressions
  for (const reg of unsuppressed) {
    for (const rule of enabledRules) {
      if (!ruleMatchesRegression(rule, reg.page_class as PageClass, reg.regression_type as RegressionType)) {
        continue;
      }

      // Check if temporary rule has expired
      if (rule.type === 'temporary' && rule.expiresAt) {
        if (new Date(rule.expiresAt) < new Date()) continue;
      }

      // Check if suppression already exists for this URL+type
      const existing = await sql<{ id: string }[]>`
        SELECT id FROM sentinel_suppressions
        WHERE url = ${reg.url}
          AND (regression_type = ${reg.regression_type} OR regression_type = '*')
          AND created_by = 'auto'
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `;

      if (existing.length > 0) continue; // Already suppressed

      // Create auto-suppression
      const expiresAt = rule.type === 'temporary' && rule.expiresAt
        ? rule.expiresAt
        : null;

      await sql`
        INSERT INTO sentinel_suppressions (url, regression_type, reason, expires_at, created_by)
        VALUES (${reg.url}, ${reg.regression_type}, ${`Auto: ${rule.description}`}, ${expiresAt}, 'auto')
      `;

      // Mark the regression as suppressed
      const suppRow = await sql<{ id: string }[]>`
        SELECT id FROM sentinel_suppressions
        WHERE url = ${reg.url} AND regression_type = ${reg.regression_type} AND created_by = 'auto'
        ORDER BY created_at DESC LIMIT 1
      `;

      if (suppRow[0]) {
        await sql`
          UPDATE sentinel_regressions
          SET suppressed = TRUE, suppression_id = ${suppRow[0].id}
          WHERE id = ${reg.id}
        `;
      }

      result.suppressionsCreated++;
      result.details.push({
        ruleId: rule.id,
        action: 'created',
        url: reg.url,
        regressionType: reg.regression_type,
      });

      break; // One rule match per regression is enough
    }
  }

  // Expire auto-suppressions whose rules are no longer enabled/present
  const autoSuppressions = await sql<{
    id: string;
    url: string;
    regression_type: string;
    reason: string;
  }[]>`
    SELECT id, url, regression_type, reason
    FROM sentinel_suppressions
    WHERE created_by = 'auto'
      AND (expires_at IS NULL OR expires_at > NOW())
  `;

  for (const supp of autoSuppressions) {
    // Extract rule ID from reason ("Auto: description" — match by description)
    const matchingRule = enabledRules.find(
      (r) => supp.reason === `Auto: ${r.description}`,
    );

    if (!matchingRule) {
      // Rule removed or disabled — expire the suppression
      await sql`
        UPDATE sentinel_suppressions
        SET expires_at = NOW()
        WHERE id = ${supp.id}
      `;

      // Un-suppress the regression
      await sql`
        UPDATE sentinel_regressions
        SET suppressed = FALSE, suppression_id = NULL
        WHERE suppression_id = ${supp.id}
      `;

      result.suppressionsExpired++;
      result.details.push({
        ruleId: 'removed',
        action: 'expired',
        url: supp.url,
        regressionType: supp.regression_type,
      });
    }
  }

  return result;
}

// =============================================================================
// HELPERS
// =============================================================================

function ruleMatchesRegression(
  rule: SuppressionRule,
  pageClass: PageClass,
  regressionType: RegressionType,
): boolean {
  // Check page class
  if (rule.pageClasses !== '*') {
    if (!rule.pageClasses.includes(pageClass)) return false;
  }

  // Check regression type
  if (rule.regressionTypes !== '*') {
    if (!rule.regressionTypes.includes(regressionType)) return false;
  }

  return true;
}
