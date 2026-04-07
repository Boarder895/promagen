// src/components/prompts/library/library-left-rail.tsx
// ============================================================================
// LIBRARY LEFT RAIL (v2.1.0 — Pro Sync Banner)
// ============================================================================
// Left rail for the /studio/library page.
// Each section (Platforms, Sort, Folders) is its own commodity-style window
// with a coloured 2px border and hover glow — same as commodity-mover-card.tsx.
// Each user folder also gets its own mini commodity window.
//
// v2.1.0 (7 April 2026): Pro sync banner at bottom of rail
//   - Amber-bordered conversion card when free user has 10+ local prompts
//   - Links to /pro-promagen
//   - Commodity-window hover glow pattern
//
// Authority: saved-page.md §4, commodity-mover-card.tsx (border/glow pattern)
// Sizing: All clamp() with 9px (0.5625rem) floor
// Animations: Co-located <style jsx>
// Banned: text-slate-500, text-slate-600, opacity dimming, border-l-2 brackets
// Existing features preserved: Yes (all callbacks, folder ops, import/export)
// ============================================================================

'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { LibraryFilters, LibraryStats } from '@/types/saved-prompt';
import type { SavedPrompt } from '@/types/saved-prompt';

// ============================================================================
// CONSTANTS
// ============================================================================

const UNSORTED_KEY = '__unsorted__';
const MAX_FOLDER_NAME_LENGTH = 30;

// ============================================================================
// SECTION WINDOW — commodity-style bordered panel with hover glow
// ============================================================================
// Copied from commodity-mover-card.tsx:
//   border: 2px solid ${colour}
//   background: hover ? rgba(255,255,255,0.08) : rgba(255,255,255,0.03)
//   boxShadow: hover → triple glow
//   Two radial gradient overlays on hover
// ============================================================================

function SectionWindow({
  colour,
  title,
  children,
}: {
  colour: string;
  title: string;
  children: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Pre-compute glow colours from the border colour
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
        padding: 'clamp(6px, 0.5vw, 10px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ethereal glow — top radial */}
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
      {/* Ethereal glow — bottom radial */}
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

      {/* Content above glows */}
      <div className="relative z-10">
        <h3
          className="text-white font-semibold uppercase tracking-wider"
          style={{
            fontSize: 'clamp(0.5625rem, 0.65vw, 0.75rem)',
            marginBottom: 'clamp(4px, 0.35vw, 6px)',
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// FOLDER WINDOW — smaller commodity-style panel for each user folder
// ============================================================================

function FolderWindow({
  colour,
  children,
}: {
  colour: string;
  children: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const glowBright = colour.replace(/[\d.]+\)$/, '0.4)');
  const glowSoft = colour.replace(/[\d.]+\)$/, '0.2)');

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${colour}`,
        background: isHovered ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
        boxShadow: isHovered
          ? `0 0 12px 3px ${glowBright}, inset 0 0 10px 1px ${glowBright}`
          : 'none',
        transition: 'box-shadow 200ms ease-out, background 200ms ease-out',
        padding: 'clamp(3px, 0.3vw, 5px) clamp(5px, 0.4vw, 8px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glowSoft} 0%, transparent 70%)`,
            opacity: 0.5,
            borderRadius: 'inherit',
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ============================================================================
// NAV ITEM — no border-l-2, just background tint for active
// ============================================================================

function NavItem({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer w-full flex items-center justify-between rounded-lg transition-all duration-150 truncate ${
        isActive
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:text-white hover:bg-white/5'
      }`}
      style={{
        padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.7vw, 10px)',
        fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)',
      }}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span
          className="shrink-0 text-white/70"
          style={{ fontSize: 'clamp(0.5625rem, 0.6vw, 0.75rem)' }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// INLINE FOLDER INPUT
// ============================================================================

function InlineFolderInput({
  initialValue,
  onConfirm,
  onCancel,
}: {
  initialValue?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (initialValue) {
      inputRef.current?.select();
    }
  }, [initialValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) onConfirm(trimmed);
        else onCancel();
      }
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [value, onConfirm, onCancel]
  );

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  }, [value, onConfirm, onCancel]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value.slice(0, MAX_FOLDER_NAME_LENGTH))}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      maxLength={MAX_FOLDER_NAME_LENGTH}
      className="w-full rounded-md bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
      style={{
        padding: 'clamp(3px, 0.3vw, 5px) clamp(6px, 0.5vw, 8px)',
        fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)',
      }}
      placeholder="Folder name…"
    />
  );
}

// ============================================================================
// TYPES
// ============================================================================

export interface LibraryLeftRailProps {
  filters: LibraryFilters;
  stats: LibraryStats;
  allPrompts: SavedPrompt[];
  folders: string[];
  onFiltersChange: (partial: Partial<LibraryFilters>) => void;
  onCreateFolder: (name: string) => boolean;
  onRenameFolder: (oldName: string, newName: string) => boolean;
  onDeleteFolder: (name: string) => void;
  /** Data for the Pro conversion banner (show when free user has 10+ local prompts) */
  proSyncBanner?: { show: boolean; promptCount: number };
  /** Current storage backend */
  storageMode?: 'local' | 'cloud' | 'loading';
}

// ============================================================================
// SECTION COLOURS — one per section, all warm/vibrant
// ============================================================================

const SECTION_COLOURS = {
  platforms: 'rgba(139, 92, 246, 0.45)',   // violet
  folders:   'rgba(16, 185, 129, 0.40)',    // emerald
};

// Unique colours for user folder windows (cycle through)
const FOLDER_COLOURS = [
  'rgba(249, 115, 22, 0.40)',   // orange
  'rgba(236, 72, 153, 0.40)',   // pink
  'rgba(168, 85, 247, 0.40)',   // purple
  'rgba(34, 211, 238, 0.40)',   // cyan
  'rgba(250, 204, 21, 0.40)',   // yellow
  'rgba(52, 211, 153, 0.40)',   // teal
  'rgba(239, 68, 68, 0.40)',    // red
  'rgba(99, 102, 241, 0.40)',   // indigo
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LibraryLeftRail({
  filters,
  stats,
  allPrompts,
  folders,
  onFiltersChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  proSyncBanner,
  storageMode,
}: LibraryLeftRailProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [contextMenuFolder, setContextMenuFolder] = useState<string | null>(null);

  // ── Derive platform display names from prompts ──
  const platformDisplayNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of allPrompts) {
      if (!map[p.platformId]) {
        map[p.platformId] = p.platformName;
      }
    }
    return map;
  }, [allPrompts]);

  // ── Platform entries sorted by count descending ──
  const platformEntries = useMemo(() => {
    return Object.entries(stats.platformBreakdown)
      .map(([id, count]) => ({
        id,
        name: platformDisplayNames[id] || id,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.platformBreakdown, platformDisplayNames]);

  // ── Folder counts ──
  const unsortedCount = stats.folderBreakdown[UNSORTED_KEY] ?? 0;

  // ── Handlers ──

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: e.target.value || undefined });
    },
    [onFiltersChange]
  );

  const handlePlatformClick = useCallback(
    (platformId?: string) => {
      onFiltersChange({ platformId });
    },
    [onFiltersChange]
  );

  const handleFolderClick = useCallback(
    (folder?: string) => {
      onFiltersChange({ folder });
    },
    [onFiltersChange]
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      const success = onCreateFolder(name);
      setIsCreatingFolder(false);
      if (success) {
        onFiltersChange({ folder: name });
      }
    },
    [onCreateFolder, onFiltersChange]
  );

  const handleRenameConfirm = useCallback(
    (newName: string) => {
      if (renamingFolder) {
        const success = onRenameFolder(renamingFolder, newName);
        setRenamingFolder(null);
        if (success && filters.folder === renamingFolder) {
          onFiltersChange({ folder: newName });
        }
      }
    },
    [renamingFolder, onRenameFolder, filters.folder, onFiltersChange]
  );

  const handleDeleteFolder = useCallback(
    (folderName: string) => {
      onDeleteFolder(folderName);
      setContextMenuFolder(null);
      if (filters.folder === folderName) {
        onFiltersChange({ folder: undefined });
      }
    },
    [onDeleteFolder, filters.folder, onFiltersChange]
  );

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenuFolder) return;
    const close = () => setContextMenuFolder(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenuFolder]);

  return (
    <nav
      aria-label="Library navigation"
      className="flex h-full min-h-0 flex-col"
    >

      {/* Co-located animation — mirrors community-pulse.tsx / library-right-rail.tsx */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes collection-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes collection-hint-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .collection-dot-pulse {
          animation: collection-dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .collection-hint-pulse {
          animation: collection-hint-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .collection-dot-pulse, .collection-hint-pulse { animation: none; }
        }
      `,
        }}
      />

      {/* Heading — mirrors Community Pulse / Library Overview */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{ gap: 'clamp(4px, 0.4vw, 8px)', marginBottom: 'clamp(2px, 0.2vw, 4px)' }}
      >
        <div
          className="collection-dot-pulse rounded-full"
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
            Your Collection
          </span>
        </span>
      </div>

      {/* Subtitle — storage hint */}
      <p
        className="collection-hint-pulse truncate italic text-amber-400/80 shrink-0"
        style={{
          fontSize: 'clamp(0.5625rem, 0.75vw, 1rem)',
          marginBottom: 'clamp(5px, 0.5vw, 9px)',
          textAlign: 'center',
        }}
      >
        Saved to this browser
      </p>

      {/* ── SEARCH BAR ── */}
      <div className="shrink-0" style={{ marginBottom: 'clamp(8px, 0.7vw, 12px)' }}>
        <div className="relative">
          <input
            type="text"
            value={filters.searchQuery ?? ''}
            onChange={handleSearchChange}
            placeholder="Search prompts…"
            className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{
              padding: 'clamp(5px, 0.5vw, 7px) clamp(8px, 0.7vw, 10px) clamp(5px, 0.5vw, 7px) clamp(28px, 2.5vw, 34px)',
              fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)',
            }}
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{
              width: 'clamp(12px, 1vw, 15px)',
              height: 'clamp(12px, 1vw, 15px)',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 flex flex-col"
        style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}
      >
        {/* ═══ PLATFORMS WINDOW ═══ */}
        <SectionWindow colour={SECTION_COLOURS.platforms} title="Platforms">
          <div className="flex flex-col" style={{ gap: 'clamp(1px, 0.1vw, 2px)' }}>
            <NavItem
              label="All Platforms"
              count={stats.totalPrompts}
              isActive={!filters.platformId}
              onClick={() => handlePlatformClick(undefined)}
            />
            {platformEntries.map(({ id, name, count }) => (
              <NavItem
                key={id}
                label={name}
                count={count}
                isActive={filters.platformId === id}
                onClick={() => handlePlatformClick(id)}
              />
            ))}
          </div>
        </SectionWindow>

        {/* ═══ FOLDERS WINDOW ═══ */}
        <SectionWindow colour={SECTION_COLOURS.folders} title="Folders">
          <div className="flex flex-col" style={{ gap: 'clamp(4px, 0.35vw, 6px)' }}>
            {/* All Prompts + Unsorted as nav items */}
            <NavItem
              label="All Prompts"
              count={stats.totalPrompts}
              isActive={filters.folder === undefined}
              onClick={() => handleFolderClick(undefined)}
            />
            <NavItem
              label="Unsorted"
              count={unsortedCount}
              isActive={filters.folder === UNSORTED_KEY}
              onClick={() => handleFolderClick(UNSORTED_KEY)}
            />

            {/* Each user folder = its own coloured mini window */}
            {folders.map((folderName, idx) => {
              const folderColour = FOLDER_COLOURS[idx % FOLDER_COLOURS.length] ?? 'rgba(249, 115, 22, 0.40)';
              return (
                <div
                  key={folderName}
                  className="relative group"
                  role="group"
                  aria-label={`Folder: ${folderName}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuFolder(folderName);
                  }}
                >
                  {renamingFolder === folderName ? (
                    <InlineFolderInput
                      initialValue={folderName}
                      onConfirm={handleRenameConfirm}
                      onCancel={() => setRenamingFolder(null)}
                    />
                  ) : (
                    <>
                      <FolderWindow colour={folderColour}>
                        <button
                          type="button"
                          onClick={() => handleFolderClick(folderName)}
                          className={`cursor-pointer w-full flex items-center justify-between rounded transition-colors truncate ${
                            filters.folder === folderName
                              ? 'text-white'
                              : 'text-white/70 hover:text-white'
                          }`}
                          style={{
                            fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)',
                          }}
                        >
                          <span className="truncate">{folderName}</span>
                          <span
                            className="shrink-0 text-white/70"
                            style={{ fontSize: 'clamp(0.5625rem, 0.6vw, 0.75rem)' }}
                          >
                            {stats.folderBreakdown[folderName] ?? 0}
                          </span>
                        </button>
                      </FolderWindow>

                      {/* Context menu (right-click) */}
                      {contextMenuFolder === folderName && (
                        <div
                          role="menu"
                          aria-label={`Actions for ${folderName}`}
                          tabIndex={-1}
                          className="absolute right-0 z-50 rounded-lg bg-slate-900 border border-white/10 shadow-xl"
                          style={{
                            top: '100%',
                            minWidth: 'clamp(100px, 10vw, 140px)',
                            marginTop: 'clamp(2px, 0.2vw, 4px)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => { if (e.key === 'Escape') setContextMenuFolder(null); }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setRenamingFolder(folderName);
                              setContextMenuFolder(null);
                            }}
                            className="cursor-pointer w-full text-left text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            style={{
                              padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.7vw, 12px)',
                              fontSize: 'clamp(0.5625rem, 0.6vw, 0.75rem)',
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleDeleteFolder(folderName)}
                            className="cursor-pointer w-full text-left text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                            style={{
                              padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.7vw, 12px)',
                              fontSize: 'clamp(0.5625rem, 0.6vw, 0.75rem)',
                            }}
                          >
                            Delete Folder
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* + New Folder */}
            {isCreatingFolder ? (
              <InlineFolderInput
                onConfirm={handleCreateFolder}
                onCancel={() => setIsCreatingFolder(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="cursor-pointer w-full flex items-center text-emerald-400 hover:text-emerald-300 transition-colors"
                style={{
                  padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.7vw, 10px)',
                  fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)',
                  gap: 'clamp(4px, 0.3vw, 6px)',
                }}
              >
                <svg
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  style={{ width: 'clamp(12px, 1vw, 15px)', height: 'clamp(12px, 1vw, 15px)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Folder</span>
              </button>
            )}
          </div>
        </SectionWindow>
      </div>

      {/* ── Pro Sync Banner — conversion trigger for free users with 10+ prompts ── */}
      {proSyncBanner?.show && storageMode === 'local' && (
        <div className="shrink-0" style={{ marginTop: 'clamp(8px, 0.7vw, 12px)' }}>
          <a
            href="/pro-promagen"
            className="group relative block cursor-pointer rounded-xl overflow-hidden no-underline"
            style={{
              border: '2px solid rgba(245, 158, 11, 0.40)',
              background: 'rgba(245, 158, 11, 0.06)',
              padding: 'clamp(8px, 0.7vw, 12px)',
              transition: 'box-shadow 200ms ease-out, background 200ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)';
              e.currentTarget.style.boxShadow = '0 0 20px 4px rgba(245, 158, 11, 0.3), 0 0 40px 8px rgba(245, 158, 11, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.06)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Cloud icon */}
            <div className="flex items-start" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
              <svg
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                className="shrink-0 text-amber-400"
                style={{
                  width: 'clamp(16px, 1.3vw, 22px)',
                  height: 'clamp(16px, 1.3vw, 22px)',
                  marginTop: 'clamp(1px, 0.1vw, 2px)',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <div>
                <p
                  className="text-amber-300 font-medium"
                  style={{
                    fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)',
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  Your {proSyncBanner.promptCount} prompt{proSyncBanner.promptCount !== 1 ? 's' : ''} live in this browser only
                </p>
                <p
                  className="text-amber-400/70 group-hover:text-amber-300 transition-colors"
                  style={{
                    fontSize: 'clamp(0.5rem, 0.6vw, 0.75rem)',
                    lineHeight: 1.3,
                    margin: 0,
                    marginTop: 'clamp(2px, 0.2vw, 4px)',
                  }}
                >
                  Go Pro to sync across all your devices →
                </p>
              </div>
            </div>
          </a>
        </div>
      )}
    </nav>
  );
}

export default LibraryLeftRail;
