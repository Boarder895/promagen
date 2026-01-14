/**
 * Promagen Gateway - Fallback Provider Module
 * ============================================
 * Fallback feeds that have no external API provider.
 *
 * GUARDRAIL G2: server.ts imports only from this index file.
 * This is the public API for the fallback module.
 *
 * Currently contains:
 * - Commodities (no provider, demo prices only)
 *
 * Architecture:
 * ```
 * fallback/
 * ├── index.ts          # Public exports (this file)
 * ├── scheduler.ts      # Clock-aligned scheduler (:10/:40)
 * ├── commodities.ts    # Commodities feed handler
 * └── README.md         # Provider documentation
 * ```
 *
 * @module fallback
 */

// =============================================================================
// PUBLIC EXPORTS
// =============================================================================

// Commodities feed
export { commoditiesHandler, validateCommoditiesSelection } from './commodities.js';

// Scheduler (for trace/diagnostics)
export { commoditiesScheduler } from './scheduler.js';
