'use client';

// src/components/admin/scoring-health/pipeline-dependency-graph.tsx
// ============================================================================
// PIPELINE DEPENDENCY GRAPH — Visual DAG of learning pipeline
// ============================================================================
//
// Section 7: Visual directed acyclic graph showing all 12 learning
// dimensions, their health status, data flow connections, and
// click-to-inspect detail panels.
//
// Layout: 4 rows × 3 columns CSS grid. Connection lines are absolute-
// positioned divs. No SVG library, no canvas — pure CSS + HTML.
//
// Data: GET /api/admin/scoring-health/pipeline-status
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 12
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { PipelineNodeStatus, NodeHealth } from '@/lib/admin/pipeline-dependencies';
import { getConnectionLines, PIPELINE_NODE_MAP } from '@/lib/admin/pipeline-dependencies';
import { useDrillThrough } from '@/lib/admin/drill-through-context';

// ============================================================================
// CONSTANTS
// ============================================================================

const HEALTH_CONFIG: Record<NodeHealth, {
  icon: string;
  ring: string;
  bg: string;
  text: string;
  label: string;
}> = {
  healthy:  { icon: '🟢', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/5',  text: 'text-emerald-400', label: 'Healthy' },
  warning:  { icon: '🟡', ring: 'ring-amber-500/30',   bg: 'bg-amber-500/5',    text: 'text-amber-400',   label: 'Warning' },
  critical: { icon: '🔴', ring: 'ring-red-500/30',     bg: 'bg-red-500/5',      text: 'text-red-400',     label: 'Critical' },
  unknown:  { icon: '⚪', ring: 'ring-white/10',       bg: 'bg-white/[0.02]',   text: 'text-white/30',    label: 'Unknown' },
};

const GRID_ROWS = 4;
const GRID_COLS = 3;

// ============================================================================
// NODE CARD
// ============================================================================

function NodeCard({
  node,
  isSelected,
  onClick,
}: {
  node: PipelineNodeStatus;
  isSelected: boolean;
  onClick: (id: string) => void;
}) {
  const config = HEALTH_CONFIG[node.health];

  return (
    <button
      type="button"
      onClick={() => onClick(node.id)}
      className={`rounded-lg ring-1 transition-all ${config.ring} ${config.bg} ${
        isSelected ? 'ring-2 ring-violet-500/60 scale-[1.03]' : 'hover:ring-white/20'
      }`}
      style={{
        padding: 'clamp(6px, 0.7vw, 10px) clamp(8px, 0.9vw, 12px)',
        gridRow: node.row + 1,
        gridColumn: node.col + 1,
        zIndex: 2,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)', marginBottom: 'clamp(2px, 0.2vw, 3px)' }}>
        <span style={{ fontSize: 'clamp(10px, 1vw, 13px)', lineHeight: 1 }}>{config.icon}</span>
        <span
          className="font-semibold text-white/80 truncate"
          style={{ fontSize: 'clamp(9px, 0.9vw, 12px)' }}
        >
          {node.label}
        </span>
      </div>
      <p
        className="text-white/25 truncate"
        style={{ fontSize: 'clamp(7px, 0.7vw, 9px)' }}
      >
        {node.dataLabel}
      </p>
    </button>
  );
}

// ============================================================================
// CONNECTION LINES — Pure CSS positioned divs
// ============================================================================

function ConnectionLines({ selectedNode }: { selectedNode: string | null }) {
  const lines = getConnectionLines();

  return (
    <>
      {lines.map((line) => {
        const isHighlighted =
          selectedNode === line.from || selectedNode === line.to;

        // Calculate positions relative to the grid
        // Each cell center: col * (100/3)% + (100/6)%, row * (100/4)% + (100/8)%
        const fromX = (line.fromCol * (100 / GRID_COLS)) + (100 / (GRID_COLS * 2));
        const fromY = (line.fromRow * (100 / GRID_ROWS)) + (100 / (GRID_ROWS * 2));
        const toX = (line.toCol * (100 / GRID_COLS)) + (100 / (GRID_COLS * 2));
        const toY = (line.toRow * (100 / GRID_ROWS)) + (100 / (GRID_ROWS * 2));

        // Simple straight lines using a rotated div
        const dx = toX - fromX;
        const dy = toY - fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <div
            key={`${line.from}-${line.to}`}
            className={`pointer-events-none absolute transition-opacity ${
              isHighlighted ? 'opacity-80' : 'opacity-20'
            }`}
            style={{
              left: `${fromX}%`,
              top: `${fromY}%`,
              width: `${length}%`,
              height: '1px',
              background: isHighlighted
                ? 'linear-gradient(90deg, rgba(139, 92, 246, 0.6), rgba(139, 92, 246, 0.3))'
                : 'rgba(255, 255, 255, 0.15)',
              transformOrigin: '0 50%',
              transform: `rotate(${angle}deg)`,
              zIndex: 1,
            }}
          />
        );
      })}
    </>
  );
}

// ============================================================================
// DETAIL PANEL — Shown when a node is selected
// ============================================================================

function DetailPanel({
  node,
  onJump,
}: {
  node: PipelineNodeStatus;
  onJump: (sectionId: string) => void;
}) {
  const config = HEALTH_CONFIG[node.health];
  const upstreamLabels = node.upstream
    .map((id) => PIPELINE_NODE_MAP.get(id)?.label ?? id)
    .join(', ') || 'None (source node)';
  const downstreamLabels = node.downstream
    .map((id) => PIPELINE_NODE_MAP.get(id)?.label ?? id)
    .join(', ') || 'None (leaf node)';

  return (
    <div
      className={`mt-3 rounded-lg ring-1 ${config.ring} ${config.bg}`}
      style={{ padding: 'clamp(10px, 1vw, 14px) clamp(12px, 1.2vw, 16px)' }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          <span style={{ fontSize: 'clamp(12px, 1.1vw, 15px)' }}>{config.icon}</span>
          <span
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
          >
            {node.label}
          </span>
          <span
            className={`rounded-full font-medium ${config.text} ${config.ring}`}
            style={{
              fontSize: 'clamp(8px, 0.75vw, 10px)',
              padding: '0 clamp(6px, 0.6vw, 8px)',
              border: '1px solid currentColor',
              opacity: 0.7,
            }}
          >
            {config.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onJump(node.dashboardSection)}
          className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
          style={{
            fontSize: 'clamp(9px, 0.85vw, 11px)',
            padding: 'clamp(3px, 0.3vw, 4px) clamp(8px, 0.8vw, 12px)',
          }}
        >
          Jump to Section ↓
        </button>
      </div>

      {/* Detail grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(6px, 0.6vw, 8px)',
        }}
      >
        <DetailRow label="Status" value={node.statusDetail} />
        <DetailRow label="Data" value={node.dataLabel} />
        <DetailRow label="Upstream" value={upstreamLabels} />
        <DetailRow label="Downstream" value={downstreamLabels} />
        <div style={{ gridColumn: '1 / -1' }}>
          <DetailRow label="Impact if down" value={node.impactIfDown} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 9px)' }}>
        {label}
      </span>
      <p className="text-white/60" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
        {value}
      </p>
    </div>
  );
}

// ============================================================================
// API TYPES
// ============================================================================

interface PipelineStatusResponse {
  nodes: PipelineNodeStatus[];
  overallHealth: NodeHealth;
  overallSummary: string;
  generatedAt: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PipelineDependencyGraph() {
  const [nodes, setNodes] = useState<PipelineNodeStatus[]>([]);
  const [overallHealth, setOverallHealth] = useState<NodeHealth>('unknown');
  const [overallSummary, setOverallSummary] = useState('Loading…');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const { drillTo } = useDrillThrough();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/pipeline-status');
      const json = await res.json();
      if (json.ok && json.data) {
        const data = json.data as PipelineStatusResponse;
        setNodes(data.nodes);
        setOverallHealth(data.overallHealth);
        setOverallSummary(data.overallSummary);
        setLastRefresh(new Date());
      } else {
        setError(json.message ?? 'Failed to load pipeline status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id));
  }, []);

  const handleJump = useCallback((sectionId: string) => {
    drillTo(sectionId);
  }, [drillTo]);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const overallConfig = HEALTH_CONFIG[overallHealth];

  // ── Loading / Error states ──────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <div className="animate-pulse text-white/20" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          Loading pipeline graph…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
          <button
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)' }}
          >
            ⟳ Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Pipeline Dependency Graph
          </h2>
          <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)', marginTop: 'clamp(2px, 0.2vw, 3px)' }}>
            <span style={{ fontSize: 'clamp(10px, 1vw, 13px)' }}>{overallConfig.icon}</span>
            <span
              className={overallConfig.text}
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            >
              {overallSummary}
            </span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          {lastRefresh && (
            <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)' }}
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* ── Graph Grid ───────────────────────────────────────────── */}
      <div
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 'clamp(8px, 1vw, 14px)',
          minHeight: 'clamp(250px, 30vw, 400px)',
        }}
      >
        {/* Connection lines (absolute positioned behind nodes) */}
        <ConnectionLines selectedNode={selectedNodeId} />

        {/* Node cards */}
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onClick={handleNodeClick}
          />
        ))}
      </div>

      {/* ── Legend ────────────────────────────────────────────────── */}
      <div
        className="mt-3 flex flex-wrap items-center"
        style={{ gap: 'clamp(8px, 1vw, 14px)', fontSize: 'clamp(8px, 0.75vw, 10px)' }}
      >
        {(['healthy', 'warning', 'critical', 'unknown'] as const).map((h) => (
          <span key={h} className="text-white/30">
            {HEALTH_CONFIG[h].icon} {HEALTH_CONFIG[h].label}
          </span>
        ))}
        <span className="text-white/15">·</span>
        <span className="text-white/20">Click a node for details</span>
      </div>

      {/* ── Detail Panel ─────────────────────────────────────────── */}
      {selectedNode && (
        <DetailPanel node={selectedNode} onJump={handleJump} />
      )}
    </div>
  );
}
