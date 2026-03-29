// src/components/prompts/library/library-right-rail.tsx
// ============================================================================
// LIBRARY RIGHT RAIL — PREVIEW PANEL (v1.2.0)
// ============================================================================
// Right rail for the /studio/library page. Replaces exchange rail.
// Three states:
//   1. No selection → Library overview (stats + platform breakdown bars)
//   2. Selected prompt → Full detail view + actions
//   3. Reformat mode → Platform selector + reformatted preview (v1.1.0)
//
// v1.1.0: Added inline reformat mode (renders ReformatPreview component).
//
// Panel styling matches Community Pulse rail exactly:
//   rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10
//
// Human Factors Gate:
// - Feature: Right rail showing full prompt detail with actions
// - Factor: Spatial Framing (Tversky) — the three-column layout creates a
//   spatial metaphor: left = navigate, centre = browse, right = act. The user
//   builds a mental model of "I find on the left, scan in the middle, do on
//   the right." This matches how filing cabinets work physically.
// - Anti-pattern: Actions on every card (clutters browse mode, forces micro-
//   decisions on every card instead of one decision on the selected card)
//
// Authority: saved-page.md §6
// Sizing: All clamp() with 9px floor (code-standard.md §6.0.1)
// Banned: text-slate-500, text-slate-600 (code-standard.md §6.0.2)
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { SavedPrompt, LibraryStats } from '@/types/saved-prompt';
import { ReformatPreview } from './reformat-preview';
import type { PromptSelections } from '@/types/prompt-builder';

// ============================================================================
// PLATFORM COLOURS (subset — matches community-pulse.tsx PLATFORM_COLORS)
// ============================================================================

const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED',
  openai: '#10B981',
  'google-imagen': '#4285F4',
  leonardo: '#EC4899',
  flux: '#F97316',
  stability: '#8B5CF6',
  'adobe-firefly': '#FF6B35',
  ideogram: '#06B6D4',
  playground: '#3B82F6',
  'microsoft-designer': '#0078D4',
  novelai: '#A855F7',
  lexica: '#14B8A6',
  canva: '#00C4CC',
  craiyon: '#FBBF24',
  bluewillow: '#3B82F6',
  dreamstudio: '#A855F7',
  clipdrop: '#6366F1',
  'imagine-meta': '#0668E1',
};

const DEFAULT_PLATFORM_COLOR = '#3B82F6';

// ============================================================================
// TYPES
// ============================================================================

export interface LibraryRightRailProps {
  /** Currently selected prompt (null = show overview) */
  selectedPrompt: SavedPrompt | null;
  /** Library stats (for overview mode) */
  stats: LibraryStats;
  /** All prompts (for deriving platform display names in overview) */
  allPrompts: SavedPrompt[];
  /** Folder list (for "Move to folder" dropdown) */
  folders: string[];
  /** Callback: copy prompt text */
  onCopy: (text: string) => void;
  /** Callback: load prompt into builder */
  onLoad: (prompt: SavedPrompt) => void;
  /** Callback: update prompt fields (notes, tags, name) */
  onUpdate: (id: string, updates: Partial<SavedPrompt>) => void;
  /** Callback: move to folder */
  onMoveToFolder: (promptId: string, folder: string | undefined) => void;
  /** Callback: delete prompt */
  onDelete: (id: string) => void;
  /** Callback: deselect current prompt (return to overview) */
  onDeselect?: () => void;
  /** Callback: open reformat (Phase 8 placeholder) */
  onReformat?: (prompt: SavedPrompt) => void;
  /** Callback: save a reformatted prompt as new */
  onSaveAsNew?: (data: {
    positivePrompt: string;
    negativePrompt?: string;
    platformId: string;
    platformName: string;
    selections: PromptSelections;
    customValues: SavedPrompt['customValues'];
    families: string[];
    mood: SavedPrompt['mood'];
    coherenceScore: number;
    source: 'builder';
    tier: number;
  }) => void;
}

// ============================================================================
// RAIL WINDOW — commodity-style bordered panel (matches commodity-mover-card.tsx)
// ============================================================================

function RailWindow({
  colour,
  title,
  children,
}: {
  colour: string;
  title: string;
  children: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const glowBright = colour.replace(/[\d.]+\)$/, '0.5)');
  const glowSoft = colour.replace(/[\d.]+\)$/, '0.3)');

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        border: `2px solid ${colour}`,
        background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
        boxShadow: isHovered
          ? `0 0 20px 4px ${glowBright}, 0 0 40px 8px ${glowSoft}, inset 0 0 15px 2px ${glowBright}`
          : 'none',
        transition: 'box-shadow 200ms ease-out, background 200ms ease-out',
        padding: 'clamp(8px, 0.7vw, 12px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glowBright} 0%, transparent 70%)`,
            opacity: 0.6,
            borderRadius: 'inherit',
          }}
        />
      )}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
            opacity: 0.4,
            borderRadius: 'inherit',
          }}
        />
      )}
      <div className="relative z-10">
        <h4
          className="text-white font-semibold uppercase tracking-wider"
          style={{
            fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)',
            marginBottom: 'clamp(6px, 0.5vw, 8px)',
          }}
        >
          {title}
        </h4>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ============================================================================
// OVERVIEW MODE (no selection)
// ============================================================================

function OverviewPanel({
  stats,
  allPrompts,
}: {
  stats: LibraryStats;
  allPrompts: SavedPrompt[];
}) {
  // Derive platform display names
  const platformNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of allPrompts) {
      if (!map[p.platformId]) map[p.platformId] = p.platformName;
    }
    return map;
  }, [allPrompts]);

  // Platform entries sorted by count
  const platformEntries = useMemo(() => {
    return Object.entries(stats.platformBreakdown)
      .map(([id, count]) => ({ id, name: platformNames[id] || id, count }))
      .sort((a, b) => b.count - a.count);
  }, [stats.platformBreakdown, platformNames]);

  const maxCount = platformEntries.length > 0
    ? Math.max(...platformEntries.map((e) => e.count))
    : 1;

  const platformCount = Object.keys(stats.platformBreakdown).length;

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(10px, 0.9vw, 16px)' }}>
      {/* Co-located animation — same pattern as community-pulse.tsx */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes library-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes library-hint-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .library-dot-pulse {
          animation: library-dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .library-hint-pulse {
          animation: library-hint-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .library-dot-pulse, .library-hint-pulse { animation: none; }
        }
      `,
        }}
      />

      {/* Heading — mirrors Community Pulse exactly */}
      <div
        className="flex items-center justify-center"
        style={{ gap: 'clamp(4px, 0.4vw, 8px)', marginBottom: 'clamp(2px, 0.2vw, 4px)' }}
      >
        <div
          className="library-dot-pulse rounded-full"
          style={{
            backgroundColor: '#10B981',
            width: 'clamp(6px, 0.35vw, 10px)',
            height: 'clamp(6px, 0.35vw, 10px)',
          }}
          aria-hidden="true"
        />
        <span
          className="font-semibold leading-tight"
          style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1.2rem)' }}
        >
          <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            Library Overview
          </span>
        </span>
      </div>

      {/* Hint subtitle — mirrors Community Pulse subtitle */}
      <p
        className="library-hint-pulse truncate italic text-amber-400/80"
        style={{
          fontSize: 'clamp(0.625rem, 0.75vw, 1rem)',
          marginBottom: 'clamp(3px, 0.3vw, 5px)',
          textAlign: 'center',
        }}
      >
        Select a prompt to preview, load, or reformat
      </p>

      {/* Stats summary — big gradient numbers */}
      <div className="flex flex-col" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
        <div className="flex items-center justify-between">
          <span className="text-white/80" style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)' }}>
            Total
          </span>
          <span
            className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent font-bold"
            style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)' }}
          >
            {stats.totalPrompts} prompts
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/80" style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)' }}>
            Avg score
          </span>
          <span
            className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent font-bold"
            style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)' }}
          >
            {stats.averageCoherence}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/80" style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)' }}>
            Platforms
          </span>
          <span
            className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-bold"
            style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)' }}
          >
            {platformCount}
          </span>
        </div>
      </div>

      {/* Platform split — coloured blocks with count inside */}
      {platformEntries.length > 0 && (
        <div>
          <h4
            className="text-white/80 uppercase tracking-wider font-medium"
            style={{
              fontSize: 'clamp(0.625rem, 0.6vw, 0.85rem)',
              marginBottom: 'clamp(8px, 0.7vw, 12px)',
            }}
          >
            Platform Split
          </h4>
          <div className="flex flex-col" style={{ gap: 'clamp(5px, 0.4vw, 8px)' }}>
            {platformEntries.map(({ id, name, count }) => {
              const color = PLATFORM_COLORS[id] || DEFAULT_PLATFORM_COLOR;
              const widthPct = Math.max((count / maxCount) * 100, 25);
              return (
                <div key={id} className="flex items-center" style={{ gap: 'clamp(8px, 0.6vw, 10px)' }}>
                  <div
                    className="relative rounded-md overflow-hidden flex items-center"
                    style={{
                      width: `${widthPct}%`,
                      minWidth: 'clamp(40px, 3vw, 60px)',
                      height: 'clamp(20px, 1.5vw, 26px)',
                      background: `${color}25`,
                      border: `1px solid ${color}50`,
                      boxShadow: `0 0 10px ${color}20`,
                    }}
                  >
                    <span
                      className="text-white font-bold"
                      style={{
                        fontSize: 'clamp(0.625rem, 0.55vw, 0.75rem)',
                        paddingLeft: 'clamp(6px, 0.5vw, 8px)',
                        textShadow: `0 0 8px ${color}`,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                  <span
                    className="text-white/80 truncate"
                    style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.85rem)' }}
                  >
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {stats.totalPrompts === 0 && (
        <p
          className="text-white/80 text-center"
          style={{
            fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)',
            marginTop: 'clamp(8px, 0.7vw, 12px)',
          }}
        >
          Save prompts using the 💾 icon on any prompt surface.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// SELECTED PROMPT MODE
// ============================================================================

function SelectedPromptPanel({
  prompt,
  folders,
  onCopy,
  onLoad,
  onUpdate,
  onMoveToFolder,
  onDelete,
  onReformat,
  onDeselect,
}: {
  prompt: SavedPrompt;
  folders: string[];
  onCopy: (text: string) => void;
  onLoad: (prompt: SavedPrompt) => void;
  onUpdate: (id: string, updates: Partial<SavedPrompt>) => void;
  onMoveToFolder: (promptId: string, folder: string | undefined) => void;
  onDelete: (id: string) => void;
  onReformat?: (prompt: SavedPrompt) => void;
  onDeselect?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [showScrollShadow, setShowScrollShadow] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const promptTextRef = useRef<HTMLDivElement>(null);

  // Reset states when prompt changes
  useEffect(() => {
    setCopied(false);
    setShowDeleteConfirm(false);
    setShowFolderMenu(false);
  }, [prompt.id]);

  // Close folder menu on outside click
  useEffect(() => {
    if (!showFolderMenu) return;
    const handleClick = () => setShowFolderMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showFolderMenu]);

  // Scroll shadow: detect if prompt text is scrollable
  useEffect(() => {
    const el = promptTextRef.current;
    if (!el) return;

    const checkShadow = () => {
      const isScrollable = el.scrollHeight > el.clientHeight + 2;
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setShowScrollShadow(isScrollable && !isAtBottom);
    };

    checkShadow();
    el.addEventListener('scroll', checkShadow);
    return () => el.removeEventListener('scroll', checkShadow);
  }, [prompt.id, prompt.positivePrompt]);

  const handleCopy = useCallback(() => {
    onCopy(prompt.positivePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [onCopy, prompt.positivePrompt]);

  const handleLoad = useCallback(() => {
    onLoad(prompt);
  }, [onLoad, prompt]);

  const handleNotesBlur = useCallback(() => {
    const newNotes = notesRef.current?.value ?? '';
    if (newNotes !== (prompt.notes ?? '')) {
      onUpdate(prompt.id, { notes: newNotes || undefined });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  }, [onUpdate, prompt.id, prompt.notes]);

  const handleMoveToFolder = useCallback(
    (folder: string | undefined) => {
      onMoveToFolder(prompt.id, folder);
      setShowFolderMenu(false);
    },
    [onMoveToFolder, prompt.id]
  );

  const handleDelete = useCallback(() => {
    if (showDeleteConfirm) {
      onDelete(prompt.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  }, [onDelete, prompt.id, showDeleteConfirm]);

  return (
    <div
      className="flex flex-col overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
      style={{ gap: 'clamp(10px, 1vw, 16px)' }}
    >
      {/* ── Name + Platform + Deselect ── */}
      <div>
        <div className="flex items-start justify-between" style={{ marginBottom: 'clamp(2px, 0.2vw, 4px)' }}>
          <h3
            className="text-slate-100 font-semibold truncate flex-1"
            style={{ fontSize: 'clamp(0.85rem, 1.2vw, 1.5rem)' }}
          >
            {prompt.name}
          </h3>
          {onDeselect && (
            <button
              type="button"
              onClick={onDeselect}
              className="cursor-pointer shrink-0 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              style={{
                width: 'clamp(22px, 1.8vw, 28px)',
                height: 'clamp(22px, 1.8vw, 28px)',
                fontSize: 'clamp(0.85rem, 1vw, 1.2rem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Back to overview"
              aria-label="Deselect prompt"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.3vw, 6px)' }}>
          <span
            className="relative shrink-0 overflow-hidden rounded-sm"
            style={{ width: 'clamp(14px, 1.1vw, 18px)', height: 'clamp(14px, 1.1vw, 18px)' }}
          >
            <Image
              src={`/icons/providers/${prompt.platformId}.png`}
              alt={prompt.platformName}
              fill
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))' }}
            />
          </span>
          <span
            className="text-slate-300"
            style={{ fontSize: 'clamp(0.7rem, 0.85vw, 1rem)' }}
          >
            {prompt.platformName}
          </span>
        </div>
      </div>

      {/* ═══ PROMPT TEXT WINDOW — cyan border ═══ */}
      <RailWindow colour="rgba(6, 182, 212, 0.40)" title="Prompt">
        <div className="relative">
          <div
            ref={promptTextRef}
            className="font-mono text-slate-200 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 whitespace-pre-wrap break-words"
            style={{
              fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
              maxHeight: 'clamp(120px, 18vw, 240px)',
              lineHeight: '1.7',
            }}
          >
            {prompt.positivePrompt}
            {prompt.negativePrompt && (
              <>
                <div
                  className="border-t border-white/10"
                  style={{ margin: 'clamp(8px, 0.7vw, 10px) 0' }}
                />
                <span className="text-red-400 font-semibold">Negative: </span>
                {prompt.negativePrompt}
              </>
            )}
          </div>
          {showScrollShadow && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 rounded-b-xl"
              style={{
                height: 'clamp(24px, 2.5vw, 36px)',
                background: 'linear-gradient(to top, rgba(15, 23, 42, 0.9), transparent)',
              }}
            />
          )}
        </div>
        <div
          className="flex items-center"
          style={{ gap: 'clamp(10px, 0.8vw, 14px)', marginTop: 'clamp(6px, 0.5vw, 8px)' }}
        >
          {prompt.coherenceScore > 0 && (
            <span className="text-white" style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}>
              Score: <strong>{prompt.coherenceScore}%</strong>
            </span>
          )}
          <span className="text-white/70" style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}>
            {prompt.characterCount} chars
          </span>
          <span className="text-white/70" style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}>
            {formatRelativeTime(prompt.createdAt)}
          </span>
        </div>
        {prompt.families.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 'clamp(4px, 0.3vw, 6px)', marginTop: 'clamp(4px, 0.3vw, 6px)' }}>
            {prompt.families.map((f) => (
              <span
                key={f}
                className="bg-white/5 text-white/80 rounded-md"
                style={{
                  padding: 'clamp(2px, 0.15vw, 3px) clamp(6px, 0.5vw, 8px)',
                  fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        )}
        <div
          className="flex items-center"
          style={{ gap: 'clamp(6px, 0.4vw, 8px)', marginTop: 'clamp(4px, 0.3vw, 6px)' }}
        >
          <span className="text-white/70" style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}>
            Folder: <span className="text-white">{prompt.folder ?? 'Unsorted'}</span>
          </span>
        </div>
      </RailWindow>

      {/* ═══ NOTES WINDOW — amber border ═══ */}
      <RailWindow colour="rgba(245, 158, 11, 0.40)" title="Notes">
        <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(4px, 0.3vw, 6px)' }}>
          <span className="text-white/70" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}>
            Click below to add notes. Saves when you click away.
          </span>
          {notesSaved && (
            <span className="text-emerald-400 font-medium" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}>
              Saved ✓
            </span>
          )}
        </div>
        <textarea
          id={`library-notes-${prompt.id}`}
          ref={notesRef}
          defaultValue={prompt.notes ?? ''}
          key={prompt.id}
          onBlur={handleNotesBlur}
          placeholder="Add notes…"
          className="w-full bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-all scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20"
          style={{
            padding: 'clamp(8px, 0.7vw, 12px)',
            fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
            minHeight: 'clamp(60px, 6vw, 100px)',
          }}
          rows={3}
        />
      </RailWindow>

      {/* ═══ ACTIONS WINDOW — pink border ═══ */}
      <RailWindow colour="rgba(236, 72, 153, 0.40)" title="Actions">
        <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
          {/* Copy + Load */}
          <div className="flex" style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}>
            <button
              type="button"
              onClick={handleCopy}
              className={`cursor-pointer flex-1 flex items-center justify-center rounded-lg transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              style={{
                padding: 'clamp(8px, 0.7vw, 12px)',
                fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
                gap: 'clamp(4px, 0.35vw, 6px)',
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}>
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleLoad}
              className="cursor-pointer flex-1 flex items-center justify-center rounded-lg bg-gradient-to-r from-sky-400/10 to-emerald-400/10 text-sky-400 border border-sky-400/20 hover:border-sky-400/40 transition-all"
              style={{
                padding: 'clamp(8px, 0.7vw, 12px)',
                fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
                gap: 'clamp(4px, 0.35vw, 6px)',
              }}
              title="Open in prompt builder"
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Load</span>
            </button>
          </div>

          {/* Reformat */}
          <button
            type="button"
            onClick={() => onReformat?.(prompt)}
            disabled={!onReformat}
            className="cursor-pointer w-full flex items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all"
            style={{
              padding: 'clamp(8px, 0.7vw, 12px)',
              fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
              gap: 'clamp(4px, 0.35vw, 6px)',
            }}
            title="See this prompt on a different platform"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Try another platform</span>
          </button>

          {/* Move to folder */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowFolderMenu(!showFolderMenu); }}
              className="cursor-pointer w-full flex items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all"
              style={{
                padding: 'clamp(8px, 0.7vw, 12px)',
                fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
                gap: 'clamp(4px, 0.35vw, 6px)',
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Move to folder</span>
            </button>

            {showFolderMenu && (
              <div
                role="listbox"
                aria-label="Select folder"
                className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-lg overflow-hidden overflow-y-auto"
                style={{
                  background: 'rgba(15, 23, 42, 0.97)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
                  maxHeight: 'clamp(140px, 14vw, 220px)',
                }}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!prompt.folder}
                  onClick={() => handleMoveToFolder(undefined)}
                  className={`cursor-pointer w-full text-left transition-colors ${
                    !prompt.folder ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                  style={{
                    padding: 'clamp(6px, 0.5vw, 8px) clamp(10px, 0.8vw, 12px)',
                    fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
                  }}
                >
                  Unsorted
                </button>
                {folders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="option"
                    aria-selected={prompt.folder === f}
                    onClick={() => handleMoveToFolder(f)}
                    className={`cursor-pointer w-full text-left truncate transition-colors ${
                      prompt.folder === f ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                    style={{
                      padding: 'clamp(6px, 0.5vw, 8px) clamp(10px, 0.8vw, 12px)',
                      fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          {showDeleteConfirm ? (
            <div className="flex" style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="cursor-pointer flex-1 flex items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                style={{
                  padding: 'clamp(8px, 0.7vw, 12px)',
                  fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer flex-1 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                style={{
                  padding: 'clamp(8px, 0.7vw, 12px)',
                  fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
                }}
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="cursor-pointer w-full flex items-center justify-center rounded-lg text-red-400 hover:bg-white/5 transition-all"
              style={{
                padding: 'clamp(8px, 0.7vw, 12px)',
                fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
                gap: 'clamp(4px, 0.35vw, 6px)',
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
          )}
        </div>
      </RailWindow>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LibraryRightRail({
  selectedPrompt,
  stats,
  allPrompts,
  folders,
  onCopy,
  onLoad,
  onUpdate,
  onMoveToFolder,
  onDelete,
  onDeselect,
  onReformat,
  onSaveAsNew,
}: LibraryRightRailProps) {
  const [showReformat, setShowReformat] = useState(false);

  // Reset reformat when prompt changes
  useEffect(() => {
    setShowReformat(false);
  }, [selectedPrompt?.id]);

  const handleReformat = useCallback(
    (prompt: SavedPrompt) => {
      onReformat?.(prompt);
      setShowReformat(true);
    },
    [onReformat]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedPrompt && showReformat && onSaveAsNew ? (
        <ReformatPreview
          prompt={selectedPrompt}
          onSaveAsNew={onSaveAsNew}
          onClose={() => setShowReformat(false)}
        />
      ) : selectedPrompt ? (
        <SelectedPromptPanel
          prompt={selectedPrompt}
          folders={folders}
          onCopy={onCopy}
          onLoad={onLoad}
          onUpdate={onUpdate}
          onMoveToFolder={onMoveToFolder}
          onDelete={onDelete}
          onReformat={handleReformat}
          onDeselect={onDeselect}
        />
      ) : (
        <OverviewPanel stats={stats} allPrompts={allPrompts} />
      )}
    </div>
  );
}

export default LibraryRightRail;
