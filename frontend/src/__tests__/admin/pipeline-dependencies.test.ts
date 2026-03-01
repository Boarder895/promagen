/**
 * Phase 7.11i — Pipeline Dependencies Tests
 *
 * Tests:
 *   - PIPELINE_NODES (completeness, no duplicate IDs)
 *   - PIPELINE_NODE_MAP (lookup correctness)
 *   - getConnectionLines (line generation, no self-loops)
 *   - getDownstreamImpact (BFS traversal, leaf nodes, cascading)
 *   - getOverallHealth (critical/warning/healthy/unknown priority)
 *   - buildImpactStatement (human-readable output)
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  PIPELINE_NODES,
  PIPELINE_NODE_MAP,
  getConnectionLines,
  getDownstreamImpact,
  getOverallHealth,
  buildImpactStatement,
  type PipelineNodeStatus,
  type NodeHealth,
} from '@/lib/admin/pipeline-dependencies';

// ============================================================================
// PIPELINE_NODES
// ============================================================================

describe('PIPELINE_NODES', () => {
  it('contains 12 nodes', () => {
    expect(PIPELINE_NODES).toHaveLength(12);
  });

  it('has unique IDs', () => {
    const ids = PIPELINE_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every downstream reference points to a valid node', () => {
    for (const node of PIPELINE_NODES) {
      for (const downId of node.downstream) {
        expect(PIPELINE_NODE_MAP.has(downId)).toBe(true);
      }
    }
  });

  it('every upstream reference points to a valid node', () => {
    for (const node of PIPELINE_NODES) {
      for (const upId of node.upstream) {
        expect(PIPELINE_NODE_MAP.has(upId)).toBe(true);
      }
    }
  });

  it('upstream/downstream are bidirectionally consistent', () => {
    for (const node of PIPELINE_NODES) {
      for (const downId of node.downstream) {
        const target = PIPELINE_NODE_MAP.get(downId)!;
        expect(target.upstream).toContain(node.id);
      }
    }
  });
});

// ============================================================================
// PIPELINE_NODE_MAP
// ============================================================================

describe('PIPELINE_NODE_MAP', () => {
  it('contains all 12 nodes', () => {
    expect(PIPELINE_NODE_MAP.size).toBe(12);
  });

  it('returns correct node by ID', () => {
    const node = PIPELINE_NODE_MAP.get('telemetry');
    expect(node).toBeDefined();
    expect(node!.label).toBe('Telemetry');
  });

  it('returns undefined for non-existent ID', () => {
    expect(PIPELINE_NODE_MAP.get('nonexistent')).toBeUndefined();
  });
});

// ============================================================================
// getConnectionLines
// ============================================================================

describe('getConnectionLines', () => {
  const lines = getConnectionLines();

  it('returns at least one line', () => {
    expect(lines.length).toBeGreaterThan(0);
  });

  it('has no self-loops', () => {
    for (const line of lines) {
      expect(line.from).not.toBe(line.to);
    }
  });

  it('all from/to IDs are valid nodes', () => {
    for (const line of lines) {
      expect(PIPELINE_NODE_MAP.has(line.from)).toBe(true);
      expect(PIPELINE_NODE_MAP.has(line.to)).toBe(true);
    }
  });

  it('telemetry has lines to its downstream nodes', () => {
    const telemetryLines = lines.filter((l) => l.from === 'telemetry');
    const targets = telemetryLines.map((l) => l.to);
    expect(targets).toContain('co-occurrence');
    expect(targets).toContain('iteration');
    expect(targets).toContain('feedback');
  });
});

// ============================================================================
// getDownstreamImpact
// ============================================================================

describe('getDownstreamImpact', () => {
  it('returns empty for leaf nodes (redundancy has no downstream)', () => {
    expect(getDownstreamImpact('redundancy')).toEqual([]);
  });

  it('returns empty for non-existent node', () => {
    expect(getDownstreamImpact('fake-node')).toEqual([]);
  });

  it('returns direct downstream for a single-level node', () => {
    const impact = getDownstreamImpact('temporal');
    expect(impact).toContain('compression');
  });

  it('cascades through multiple levels from telemetry', () => {
    const impact = getDownstreamImpact('telemetry');
    // Telemetry → co-occurrence → weight-recal → ab-testing, compression
    expect(impact).toContain('co-occurrence');
    expect(impact).toContain('weight-recal');
    expect(impact).toContain('ab-testing');
    expect(impact.length).toBeGreaterThan(3);
  });

  it('does not include the source node itself', () => {
    const impact = getDownstreamImpact('telemetry');
    expect(impact).not.toContain('telemetry');
  });
});

// ============================================================================
// getOverallHealth
// ============================================================================

describe('getOverallHealth', () => {
  function makeNode(health: NodeHealth): PipelineNodeStatus {
    return {
      id: 'test', label: 'Test', description: '', row: 0, col: 0,
      dashboardSection: '', upstream: [], downstream: [],
      health, statusDetail: '', dataLabel: '', impactIfDown: '',
    };
  }

  it('returns healthy when all nodes are healthy', () => {
    const result = getOverallHealth([makeNode('healthy'), makeNode('healthy')]);
    expect(result.health).toBe('healthy');
  });

  it('returns warning when any node is warning', () => {
    const result = getOverallHealth([makeNode('healthy'), makeNode('warning')]);
    expect(result.health).toBe('warning');
  });

  it('returns critical when any node is critical', () => {
    const result = getOverallHealth([makeNode('healthy'), makeNode('warning'), makeNode('critical')]);
    expect(result.health).toBe('critical');
  });

  it('returns unknown when no critical/warning but some unknown', () => {
    const result = getOverallHealth([makeNode('healthy'), makeNode('unknown')]);
    expect(result.health).toBe('unknown');
  });

  it('critical takes precedence over warning and unknown', () => {
    const result = getOverallHealth([makeNode('warning'), makeNode('unknown'), makeNode('critical')]);
    expect(result.health).toBe('critical');
  });
});

// ============================================================================
// buildImpactStatement
// ============================================================================

describe('buildImpactStatement', () => {
  it('returns leaf message for nodes with no downstream', () => {
    expect(buildImpactStatement('redundancy')).toContain('No downstream impact');
  });

  it('lists downstream labels for telemetry', () => {
    const statement = buildImpactStatement('telemetry');
    expect(statement).toContain('Affects');
    expect(statement).toContain('Co-occurrence');
  });

  it('returns leaf message for non-existent node', () => {
    expect(buildImpactStatement('fake')).toContain('No downstream impact');
  });
});
