// src/components/pro-promagen/scene-grid-preview.tsx
// ============================================================================
// SCENE GRID PREVIEW — Locked Scene Starter Grid
// ============================================================================
// 5×4 grid of scene starter thumbnails. Row 1 fully visible (free),
// rows 2-4 progressively blurred with lock overlay and "175 more with Pro".
// Human Factor: Scarcity + Peek Effect — glimpse of locked content.
//
// Authority: docs/authority/human-factors.md §Scarcity
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState } from 'react';
import { freeScenes, proScenes } from '@/data/scenes';
import { ALL_WORLDS } from '@/data/scenes/worlds';

// ============================================================================
// TYPES
// ============================================================================

interface GridScene {
  emoji: string;
  name: string;
  description: string;
  worldEmoji: string;
  isFree: boolean;
}

// ============================================================================
// DATA — Build grid from real scene data
// ============================================================================

function buildGrid(): GridScene[] {
  const worldMap = new Map(ALL_WORLDS.map((w) => [w.slug, w]));

  // Row 1: 5 free scenes (fully visible)
  const freeItems: GridScene[] = freeScenes.slice(0, 5).map((s) => ({
    emoji: s.emoji,
    name: s.name,
    description: s.description,
    worldEmoji: worldMap.get(s.world)?.emoji ?? '🎨',
    isFree: true,
  }));

  // Rows 2-4: 15 pro scenes (progressively blurred)
  const proItems: GridScene[] = proScenes.slice(0, 15).map((s) => ({
    emoji: s.emoji,
    name: s.name,
    description: s.description,
    worldEmoji: worldMap.get(s.world)?.emoji ?? '🔒',
    isFree: false,
  }));

  return [...freeItems, ...proItems];
}

// ============================================================================
// SCENE CELL
// ============================================================================

function SceneCell({
  scene,
  rowIndex,
}: {
  scene: GridScene;
  rowIndex: number;
}) {
  const [isPeeking, setIsPeeking] = useState(false);

  // Progressive blur: row 0 = clear, row 1 = slight, row 2 = medium, row 3 = heavy
  const blurPx = scene.isFree ? 0 : rowIndex === 1 ? 2 : rowIndex === 2 ? 4 : 6;
  const dimOpacity = scene.isFree ? 1 : rowIndex === 1 ? 0.7 : rowIndex === 2 ? 0.5 : 0.35;

  // Peek: temporarily unblur on hover for locked scenes
  const effectiveBlur = isPeeking ? 0 : blurPx;
  const effectiveOpacity = isPeeking ? 0.9 : dimOpacity;

  // World colour based on free/pro
  const borderColor = scene.isFree ? 'rgba(52, 211, 153, 0.4)' : `rgba(255, 255, 255, ${0.06 * dimOpacity})`;

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-lg px-1.5 py-2 text-center transition-all duration-300 cursor-pointer"
      style={{
        background: scene.isFree ? 'rgba(52, 211, 153, 0.06)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${borderColor}`,
        filter: `blur(${effectiveBlur}px)`,
        opacity: effectiveOpacity,
        minHeight: 'clamp(48px, 4.5vw, 64px)',
      }}
      onMouseEnter={() => { if (!scene.isFree) setIsPeeking(true); }}
      onMouseLeave={() => setIsPeeking(false)}
    >
      {/* Emoji */}
      <span style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.3rem)' }}>{scene.emoji}</span>

      {/* Name — truncated */}
      <span
        className="text-white/70 font-medium truncate w-full"
        style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}
      >
        {scene.name}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SceneGridPreview() {
  const grid = React.useMemo(() => buildGrid(), []);

  // Split into rows of 5
  const rows: GridScene[][] = [];
  for (let i = 0; i < grid.length; i += 5) {
    rows.push(grid.slice(i, i + 5));
  }

  return (
    <div className="mb-4 relative">
      <h3
        className="text-sm font-semibold text-white/70 mb-2"
        style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.8rem)' }}
      >
        Scene Starters — one-click prompt presets
      </h3>

      {/* Grid */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
            {row.map((scene, colIdx) => (
              <SceneCell key={`${rowIdx}-${colIdx}`} scene={scene} rowIndex={rowIdx} />
            ))}
          </div>
        ))}
      </div>

      {/* Frosted overlay on bottom rows */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-xl pointer-events-none"
        style={{
          height: '55%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(2, 6, 23, 0.7) 50%, rgba(2, 6, 23, 0.95) 100%)',
        }}
      >
        <span
          className="px-4 py-2 rounded-full bg-amber-500/15 text-amber-400 font-semibold ring-1 ring-amber-500/25 pointer-events-auto"
          style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)' }}
        >
          175 more scenes with Pro
        </span>
      </div>
    </div>
  );
}

export default SceneGridPreview;
