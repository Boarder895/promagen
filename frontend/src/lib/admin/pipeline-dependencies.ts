// src/lib/admin/pipeline-dependencies.ts
// ============================================================================
// PIPELINE DEPENDENCY MAP — Static DAG definition + health evaluation
// ============================================================================
//
// Defines the 12 learning pipeline nodes, their upstream/downstream
// connections, and health evaluation logic. Used by both the
// pipeline-status API and the visual graph component.
//
// Pure data + pure functions. No fetch, no DOM, no side effects.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 12
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type NodeHealth = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface PipelineNode {
  /** Unique node ID */
  id: string;
  /** Display label */
  label: string;
  /** Short description */
  description: string;
  /** Grid row position (0-based, top to bottom) */
  row: number;
  /** Grid column position (0-based, left to right) */
  col: number;
  /** Which dashboard section this maps to */
  dashboardSection: string;
  /** Upstream dependencies (must complete before this node) */
  upstream: string[];
  /** Downstream dependents (fed by this node) */
  downstream: string[];
}

export interface PipelineNodeStatus extends PipelineNode {
  /** Current health */
  health: NodeHealth;
  /** Status detail text */
  statusDetail: string;
  /** Data volume or metric label */
  dataLabel: string;
  /** Impact description if this node is down */
  impactIfDown: string;
}

// ============================================================================
// STATIC DEPENDENCY MAP — The DAG
// ============================================================================

export const PIPELINE_NODES: PipelineNode[] = [
  // ── Row 0: Sources ──────────────────────────────────────────────────
  {
    id: 'telemetry',
    label: 'Telemetry',
    description: 'Raw prompt event ingestion',
    row: 0, col: 0,
    dashboardSection: 'scorer-health',
    upstream: [],
    downstream: ['co-occurrence', 'iteration', 'skill-seg', 'feedback', 'platform'],
  },
  {
    id: 'co-occurrence',
    label: 'Co-occurrence',
    description: 'Term pair co-occurrence matrix',
    row: 0, col: 1,
    dashboardSection: 'term-quality',
    upstream: ['telemetry'],
    downstream: ['weight-recal', 'negative-patterns'],
  },
  {
    id: 'weight-recal',
    label: 'Weight Recal',
    description: 'Scoring weight recalibration',
    row: 0, col: 2,
    dashboardSection: 'weight-drift',
    upstream: ['co-occurrence', 'negative-patterns'],
    downstream: ['ab-testing', 'compression'],
  },

  // ── Row 1: Processing ───────────────────────────────────────────────
  {
    id: 'iteration',
    label: 'Iteration',
    description: 'Multi-attempt tracking',
    row: 1, col: 0,
    dashboardSection: 'scorer-health',
    upstream: ['telemetry'],
    downstream: ['skill-seg'],
  },
  {
    id: 'negative-patterns',
    label: 'Anti-Patterns',
    description: 'Collision & conflict detection',
    row: 1, col: 1,
    dashboardSection: 'anti-patterns',
    upstream: ['co-occurrence'],
    downstream: ['weight-recal', 'ab-testing'],
  },
  {
    id: 'ab-testing',
    label: 'A/B Testing',
    description: 'Statistical significance engine',
    row: 1, col: 2,
    dashboardSection: 'ab-tests',
    upstream: ['weight-recal', 'negative-patterns'],
    downstream: [],
  },

  // ── Row 2: Derived ──────────────────────────────────────────────────
  {
    id: 'skill-seg',
    label: 'Skill Seg',
    description: 'User skill segmentation',
    row: 2, col: 0,
    dashboardSection: 'skill-distribution',
    upstream: ['telemetry', 'iteration'],
    downstream: [],
  },
  {
    id: 'temporal',
    label: 'Temporal',
    description: 'Seasonal & trending intelligence',
    row: 2, col: 1,
    dashboardSection: 'temporal-trends',
    upstream: [],
    downstream: ['compression'],
  },
  {
    id: 'compression',
    label: 'Compression',
    description: 'Weight compression profiles',
    row: 2, col: 2,
    dashboardSection: 'control-panel',
    upstream: ['weight-recal', 'temporal'],
    downstream: [],
  },

  // ── Row 3: Independent ──────────────────────────────────────────────
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'User feedback ingestion',
    row: 3, col: 0,
    dashboardSection: 'feedback-summary',
    upstream: ['telemetry'],
    downstream: [],
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'Platform-specific learning',
    row: 3, col: 1,
    dashboardSection: 'scorer-health',
    upstream: ['telemetry'],
    downstream: [],
  },
  {
    id: 'redundancy',
    label: 'Redundancy',
    description: 'Term redundancy detection',
    row: 3, col: 2,
    dashboardSection: 'term-quality',
    upstream: [],
    downstream: [],
  },
];

/** Quick lookup by node ID */
export const PIPELINE_NODE_MAP = new Map(
  PIPELINE_NODES.map((n) => [n.id, n]),
);

// ============================================================================
// CONNECTION LINES — Pre-computed for rendering
// ============================================================================

export interface ConnectionLine {
  from: string;
  to: string;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

/** Pre-compute all connection lines from the dependency map */
export function getConnectionLines(): ConnectionLine[] {
  const lines: ConnectionLine[] = [];
  for (const node of PIPELINE_NODES) {
    for (const downId of node.downstream) {
      const target = PIPELINE_NODE_MAP.get(downId);
      if (!target) continue;
      lines.push({
        from: node.id,
        to: target.id,
        fromRow: node.row,
        fromCol: node.col,
        toRow: target.row,
        toCol: target.col,
      });
    }
  }
  return lines;
}

// ============================================================================
// HEALTH EVALUATION — Pure functions
// ============================================================================

/** Determine overall graph health from individual node statuses */
export function getOverallHealth(
  nodes: PipelineNodeStatus[],
): { health: NodeHealth; summary: string } {
  const critical = nodes.filter((n) => n.health === 'critical').length;
  const warning = nodes.filter((n) => n.health === 'warning').length;
  const unknown = nodes.filter((n) => n.health === 'unknown').length;
  const healthy = nodes.filter((n) => n.health === 'healthy').length;
  const total = nodes.length;

  if (critical > 0) {
    return {
      health: 'critical',
      summary: `${critical} critical, ${warning} warning of ${total} nodes`,
    };
  }
  if (warning > 0) {
    return {
      health: 'warning',
      summary: `${warning} warning of ${total} nodes`,
    };
  }
  if (unknown > 0) {
    return {
      health: 'unknown',
      summary: `${unknown} unknown, ${healthy} healthy of ${total} nodes`,
    };
  }
  return {
    health: 'healthy',
    summary: `All ${total} nodes healthy`,
  };
}

/**
 * Find all downstream nodes that would be affected if a given node goes down.
 * BFS traversal through downstream connections.
 */
export function getDownstreamImpact(nodeId: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [];

  const startNode = PIPELINE_NODE_MAP.get(nodeId);
  if (!startNode) return [];

  for (const d of startNode.downstream) {
    queue.push(d);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = PIPELINE_NODE_MAP.get(current);
    if (node) {
      for (const d of node.downstream) {
        if (!visited.has(d)) queue.push(d);
      }
    }
  }

  return [...visited];
}

/**
 * Build a human-readable impact statement for a failing node.
 */
export function buildImpactStatement(nodeId: string): string {
  const downstream = getDownstreamImpact(nodeId);
  if (downstream.length === 0) return 'No downstream impact — leaf node.';

  const labels = downstream
    .map((id) => PIPELINE_NODE_MAP.get(id)?.label ?? id)
    .join(', ');

  return `Affects ${downstream.length} downstream: ${labels}`;
}
