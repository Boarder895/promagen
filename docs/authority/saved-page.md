# Saved Prompts Page — Authority Document

**Last updated:** 9 March 2026  
**Version:** 1.0.0  
**Owner:** Promagen  
**Status:** Specification (pre-build)  
**Route:** `/studio/library` (existing route, full redesign)  
**Authority:** This document defines the Saved Prompts page layout, behaviour, data model, and build plan. It supersedes the current Library implementation at `/studio/library`.

---

## Table of Contents

1. [Purpose & Human Factors](#1-purpose--human-factors)
2. [Design Consistency Rules](#2-design-consistency-rules)
3. [Page Layout](#3-page-layout)
4. [Left Rail — Navigation & Folders](#4-left-rail--navigation--folders)
5. [Centre Column — Card Grid](#5-centre-column--card-grid)
6. [Right Rail — Preview Panel](#6-right-rail--preview-panel)
7. [Save Icon (💾) — Surfaces & Behaviour](#7-save-icon---surfaces--behaviour)
8. [Quick Save Toast (Idea A)](#8-quick-save-toast-idea-a)
9. [Folder System](#9-folder-system)
10. [Reformat Feature](#10-reformat-feature)
11. [Collection Sharing (Idea B)](#11-collection-sharing-idea-b)
12. [Data Model Changes](#12-data-model-changes)
13. [Storage Architecture](#13-storage-architecture)
14. [File Locations](#14-file-locations)
15. [Acceptance Criteria](#15-acceptance-criteria)
16. [Build Order](#16-build-order)
17. [Edge Cases & Open Questions](#17-edge-cases--open-questions)
18. [Non-Regression Rules](#18-non-regression-rules)
19. [Changelog](#19-changelog)

---

## 1. Purpose & Human Factors

### Why this page exists

A user sees a prompt anywhere in Promagen — hovering a flag on World Context, browsing the Prompt of the Moment, looking at Community Pulse cards — and thinks "I want that one." Currently the only option is copy to clipboard. There is no "save to library" action anywhere except deep inside the prompt builder behind a modal.

The Saved Prompts page is where users go to browse, organise, and reload everything they have collected.

### Human factors principles

**1. Pinterest board model — collections, not flat lists.**
People do not want 200 prompts in one scrollable page. They want named collections: "Cyberpunk Series", "Client Work — March", "Landscape Experiments". Spotify playlists, Pinterest boards, Figma projects — the pattern is universal. The act of organising is itself creative and satisfying. A default "Unsorted" folder keeps saves frictionless.

**2. Visual density over text density.**
For visual prompts, users scan by vibe not by reading. The DNA bar, mood colour strip, and family gradient should be the primary visual signal — not 100 characters of truncated text. Think Instagram grid, not email inbox.

**3. Smart auto-grouping.**
Beyond manual folders, the page should show computed views: "Your Midjourney prompts", "Intense mood collection", "Last 7 days". These are not user-created folders — they are live filter sections visible in the left rail. This is what the existing filter system does, but filters today are invisible until clicked. Smart groups should be navigable sections.

**4. Frictionless save, organised later.**
Saving must be one click (💾 icon). No modal, no name prompt. Auto-name as `"{subject} — {platform}"` or `"Untitled — {platform}"`. Users organise later when they have 20+ prompts, not when they are in the flow of browsing. Name, folder, and tags are all editable in the preview panel.

**5. Reformat = unlock repeat value.**
A prompt saved from the Midjourney builder should be reloadable into DALL·E 3 or Flux with one click. This is the killer feature — "I built this once, now I can use it everywhere." The `assemblePrompt()` pipeline already supports this for structured saves (builder-origin). Text-only saves (tooltip-origin) are locked to their original format.

---

## 2. Design Consistency Rules

Every pixel of this page must feel like it belongs on the same site as the homepage, World Context, and prompt builder. These rules are non-negotiable.

### 2.1 Shared Design Tokens (verified against src.zip 9 March 2026)

| Token                  | Value                                                                                                | Source                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Page background        | `bg-slate-950`                                                                                       | `homepage-grid.tsx` line 575                 |
| Panel background       | `bg-slate-950/70`                                                                                    | Used 21× across components                   |
| Panel border radius    | `rounded-3xl`                                                                                        | All panels: left rail, centre, right rail    |
| Panel ring             | `ring-1 ring-white/10`                                                                               | Used 81× across components                   |
| Panel shadow           | `shadow-sm`                                                                                          | All panels                                   |
| Panel padding          | `p-4`                                                                                                | All three-column panels                      |
| Grid columns           | `md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)]`                                     | `homepage-grid.tsx` line 597                 |
| Grid gap               | Inherits from `homepage-grid.tsx` flex gap                                                           |                                              |
| Scrollbar              | `scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30` | Uniform across all rails                     |
| Heading gradient       | `bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent`          | Scene Starters, Community Pulse, Leaderboard |
| Heading font size      | `clamp(0.65rem, 0.9vw, 1.2rem)`                                                                      | Scene Starters line 494                      |
| Subheading font size   | `clamp(0.5625rem, 0.75vw, 1rem)`                                                                     | Scene Starters line 506                      |
| Minimum text size      | 9px (`0.5625rem`) floor                                                                              | `code-standard.md` § 6.0.1                   |
| Banned colours         | `text-slate-500`, `text-slate-600`                                                                   | `code-standard.md` § 6.0.2                   |
| No opacity dimming     | Never use opacity to show state                                                                      | `code-standard.md` § 6.0.3                   |
| Copy feedback: success | `bg-emerald-500/20 text-emerald-400`                                                                 | `prompt-showcase.tsx` line 168               |
| Copy feedback: normal  | `bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200`                                   | `prompt-showcase.tsx` line 169               |
| Button border          | `border border-white/10`                                                                             | Library filters, Mission Control             |
| Input field            | `bg-white/5 border border-white/10 text-white placeholder-white/30 focus:ring-1 focus:ring-white/20` | Library filters search bar                   |
| Animations             | Co-located in `<style jsx>`, not `globals.css`                                                       | `code-standard.md` § 6.2                     |
| All `clamp()` sizing   | Inline style, not Tailwind                                                                           | `code-standard.md` § 6.0                     |

### 2.2 HomepageGrid Integration

The page uses `HomepageGrid` (same as every other page). Grid props:

```typescript
<HomepageGrid
  mainLabel="Prompt Library"
  leftContent={leftRail}          // ← NEW: filters + folders (replaces exchange rails)
  centre={centreContent}          // ← REDESIGNED: card grid
  rightContent={rightRail}        // ← NEW: preview panel (replaces exchange rails)
  showFinanceRibbon={false}       // No finance data
  showEngineBay                   // Provider icons visible
  showMissionControl              // Navigation visible
  hideCommodities                 // No commodity grid
  isStudioSubPage                 // 4-button Mission Control: Home | World Context | Studio | Pro
  providers={providers}
/>
```

### 2.3 Visual Parity Checklist

Before shipping, verify these by eye against the homepage and World Context:

- Left rail panel has identical border radius, background, ring, padding to Scene Starters rail
- Centre panel has identical structure to PotM centre column
- Right rail panel has identical styling to Community Pulse rail
- Heading gradient matches Scene Starters heading exactly (colour, direction, font size)
- Scrollbar styling is pixel-identical across all three columns
- Empty states use `text-white/70` for heading, `text-white/40` for body (matches `prompt-library-grid.tsx`)
- Engine Bay and Mission Control render identically to homepage
- Footer matches homepage footer

---

## 3. Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Promagen — Intelligent Prompt Builder                  ⚡ MISSION CONTROL │
│  [Engine Bay icons]                                     [Home][WC][Stu][Pro]│
├──────────┬──────────────────────────────────────────────┬───────────────────┤
│  0.9fr   │  2.2fr                                      │  0.9fr            │
│          │                                              │                   │
│  ┌─────┐ │  ● Saved Prompts               🔍 ________  │  PREVIEW PANEL    │
│  │FILTR│ │  12 prompts · 87% avg · 4 platforms         │                   │
│  │     │ │                                              │  [Select a prompt │
│  │All  │ │  ┌────────┐ ┌────────┐ ┌────────┐          │   to preview]     │
│  │ 12  │ │  │ ▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓ │          │                   │
│  │─────│ │  │ Name   │ │ Name   │ │ Name   │          │  ── OR ──         │
│  │By   │ │  │ MJ ·95%│ │ Flux·88│ │ DL3·92%│          │                   │
│  │Platf│ │  │ cyberpnk│ │ fantsy │ │ portr  │          │  Full prompt text │
│  │ MJ 5│ │  │ 2m ago │ │ 1h ago │ │ 3d ago │          │  Platform: Flux   │
│  │ Flux3│ │  └────────┘ └────────┘ └────────┘          │  Score: 95%       │
│  │ DL3 4│ │  ┌────────┐ ┌────────┐ ┌────────┐          │  Mood: intense    │
│  │─────│ │  │ ▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓ │          │  Families: cyber..│
│  │Mood │ │  │ Name   │ │ Name   │ │ Name   │          │                   │
│  │ Calm │ │  │ Cnva·78│ │ Stb ·91│ │ OAI·96%│          │  [Copy] [Load]    │
│  │ Intns│ │  │ landsc │ │ anime  │ │ sci-fi │          │  [Reformat for..]│
│  │─────│ │  │ 5d ago │ │ 1w ago │ │ 2w ago │          │  [Move to folder] │
│  │FLDRS│ │  └────────┘ └────────┘ └────────┘          │  [Delete]         │
│  │ All  │ │                                              │                   │
│  │ Unsrt│ │                                              │  ── STATS ──      │
│  │ Cybr.│ │                                              │  12 total         │
│  │ Clnt.│ │                                              │  87% avg coherence│
│  │+ New │ │                                              │  4 platforms      │
│          │                                              │                   │
└──────────┴──────────────────────────────────────────────┴───────────────────┘
```

**Key difference from current Library:** Exchange rails (left + right) are replaced with Library-specific rails. The centre column is wider and more usable. The grid column ratio stays `0.9fr | 2.2fr | 0.9fr` — identical to every other page.

---

## 4. Left Rail — Navigation & Folders

**Panel styling:** `rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10` (matches Scene Starters rail exactly).

**Structure (top to bottom):**

### 4.1 Search Bar

Position: top of rail, always visible (shrink-0). Reuses existing search input styling:

```
bg-white/5 border border-white/10 text-white placeholder-white/30
focus:ring-1 focus:ring-white/20
```

Placeholder: "Search prompts..."

### 4.2 Smart Groups

Below search. These are computed filter sections, not user-created. Each shows a label + count badge. Clicking one filters the centre grid.

**Platform breakdown:**

- "All Platforms" (12) — default active
- "Midjourney" (5)
- "Flux" (3)
- "DALL·E 3" (4)
- etc. (only platforms with saved prompts shown)

**Mood breakdown:**

- "All Moods"
- "Calm" (count)
- "Intense" (count)
- "Neutral" (count)

**Recency:**

- "Recently Updated" — default sort
- "Recently Created"

Active item: `bg-white/10 text-white` with left border `border-l-2 border-sky-400`.
Inactive item: `text-white/50 hover:text-white/70 hover:bg-white/5`.
Count badge: `text-white/30` right-aligned.
Font size: `clamp(0.5625rem, 0.7vw, 0.85rem)`.

### 4.3 Folders Section

Separated from smart groups by `border-t border-white/10 pt-3 mt-3`.

**Heading:** "Folders" in `text-white/40 text-[clamp(0.5rem,0.6vw,0.7rem)] uppercase tracking-wider font-medium`.

**Default folders (always present):**

- "All Prompts" (total count)
- "Unsorted" (count of prompts with no folder)

**User-created folders:**

- Listed alphabetically below defaults
- Each shows folder name + count
- Truncated with `truncate` at rail width

**"+ New Folder" button:**

- Bottom of folder list, always visible
- `text-emerald-400 hover:text-emerald-300`
- Opens inline rename field (same as Figma: click → text input appears, Enter to confirm, Escape to cancel)
- Max 30 characters per folder name

### 4.4 Import / Export

Bottom of rail (shrink-0, always visible).

Two small buttons: "Import" and "Export" — same styling as current (`bg-white/5 border border-white/10 text-white/50`).

Export: exports current folder (or all if "All Prompts" selected) as JSON.
Import: file picker → JSON → merged into current folder.

---

## 5. Centre Column — Card Grid

**Panel styling:** `rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10` (matches PotM centre column).

### 5.1 Header

```
┌─────────────────────────────────────────────────────────┐
│ ● Saved Prompts          [Sort ▼]  🔍 _______  [+ New] │
│ 12 prompts · 87% avg coherence · 4 platforms            │
└─────────────────────────────────────────────────────────┘
```

**"Saved Prompts" heading:** Uses the standard gradient: `bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent`. Font: `clamp(0.65rem, 0.9vw, 1.2rem) font-semibold`. The `●` dot matches the Scene Starters dot.

**Stats line:** Below heading. `text-white/40 text-[clamp(0.5rem,0.65vw,0.75rem)]`. Shows: total count · average coherence · platform count. Updates live when filters change.

**Sort dropdown:** Right-aligned. Same styling as current filter dropdowns. Options: Recently Updated, Recently Created, Name A-Z, Name Z-A, Highest Coherence, Lowest Coherence.

**Search:** Inline with sort, compact. Only visible on centre panel if left rail is hidden (mobile fallback). On desktop, left rail search is primary.

### 5.2 Card Grid

**Layout:** `grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3`

Cards auto-reflow: 1 column on narrow, 2 on medium, 3 on wide. Gap `gap-3` (12px) matches the `space-y-3` used in exchange rails.

### 5.3 Card Design (Redesigned)

Each card is more compact and visual-first than the current design. The DNA bar is the dominant visual element.

```
┌──────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← DNA bar (full width, taller)
│                                      │
│ Cyberpunk Rain Scene          MJ     │  ← Name (truncate) + platform badge
│ cyberpunk hacker, walking thr...     │  ← Prompt preview (1 line, truncate)
│                                      │
│ ● 95%  │  intense  │  cyberpunk      │  ← Score + mood + primary family
│ 2 min ago                    📁 Work │  ← Time + folder badge
└──────────────────────────────────────┘
```

**DNA bar:** Full width, height `h-2` (up from `h-1.5`). Gradient from primary family. Always visible (no hover required). This is the visual fingerprint — users scan DNA bars to find prompts by vibe.

**Name:** `text-white font-semibold text-[clamp(0.6rem,0.75vw,0.9rem)]`. Truncated single line.

**Platform badge:** Right-aligned. `px-2 py-0.5 text-[clamp(0.45rem,0.55vw,0.65rem)] rounded-lg bg-white/5 text-white/50`. Shows short platform name (MJ, Flux, DL3, etc.).

**Prompt preview:** Single line, `text-white/40 text-[clamp(0.5rem,0.6vw,0.75rem)] truncate`. No line-clamp-2 — one line is enough to recognise.

**Stats row:** `text-[clamp(0.45rem,0.55vw,0.65rem)]`. Score dot + percentage (family accent colour). Mood badge (same styling as current). Primary family name.

**Footer row:** Relative time left (`text-white/30`). Folder badge right (if assigned, `text-white/30 bg-white/5 px-1.5 py-0.5 rounded`).

**Hover:** Same ethereal glow as current cards — `boxShadow` with family glow colour. Border brightens to `rgba(255,255,255,0.2)`.

**Click:** Selects the card → populates right rail preview panel. Selected card gets `ring-2 ring-sky-400/50` to indicate selection.

**No action buttons on cards.** All actions (Load, Copy, Delete, Reformat, Move) live in the right rail preview panel. Cards are for browsing, preview panel is for acting. This keeps cards clean and compact.

### 5.4 Empty State

When no prompts exist (or filter returns nothing):

```
┌──────────────────────────────────────┐
│                                      │
│         [bookmark icon, 48px]        │
│                                      │
│       No saved prompts yet           │
│                                      │
│  Save prompts from anywhere in       │
│  Promagen using the 💾 icon.         │
│                                      │
│    [Open Prompt Builder →]           │
│                                      │
└──────────────────────────────────────┘
```

Icon: `w-12 h-12 text-white/20`. Heading: `text-white/70 font-semibold`. Body: `text-white/40 text-sm`. Button: emerald gradient link to `/providers/flux` (default provider).

---

## 6. Right Rail — Preview Panel

**Panel styling:** `rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10` (matches Community Pulse rail).

### 6.1 No Selection State (Default)

When no card is selected, show library statistics:

```
┌────────────────────────┐
│ ● Library Overview     │
│                        │
│ Total: 12 prompts      │
│ Avg coherence: 87%     │
│ Platforms: 4           │
│                        │
│ ── Platform Split ──   │
│ ▓▓▓▓▓▓▓▓ MJ (5)       │
│ ▓▓▓▓▓    Flux (3)      │
│ ▓▓▓▓▓▓▓  DL3 (4)      │
│                        │
│ ── Mood Split ──       │
│ Calm: 4  Intense: 6    │
│ Neutral: 2             │
│                        │
└────────────────────────┘
```

Platform split uses horizontal bars with platform brand colours from `PLATFORM_COLORS`. This gives the empty right rail visual purpose.

### 6.2 Selected Prompt State

When a card is clicked:

```
┌────────────────────────┐
│ Cyberpunk Rain Scene   │
│ ── Midjourney ──       │
│                        │
│ [Full prompt text,     │
│  not truncated,        │
│  scrollable if long,   │
│  monospace font,       │
│  bg-slate-900/50       │
│  rounded-xl p-3]       │
│                        │
│ Score: 95%  Mood: ⚡   │
│ Chars: 342  Created: 2m│
│                        │
│ Families:              │
│ [cyberpunk] [sci-fi]   │
│ [neon] [urban]         │
│                        │
│ Folder: Work           │
│ Tags: client, neon     │
│                        │
│ ── Notes ──            │
│ [editable text area]   │
│                        │
│ ── Actions ──          │
│ [Copy]  [Load → Builder│
│ [Reformat for...]      │
│ [Move to folder ▼]     │
│ [Delete]               │
│                        │
└────────────────────────┘
```

**Full prompt text:** Not truncated. `text-[clamp(0.5rem,0.6vw,0.75rem)] font-mono bg-slate-900/50 rounded-xl p-3 text-white/70`. Scrollable within a max-height container.

**Metadata:** Score, mood, character count, created date. Same styling tokens as card stats.

**Families:** Chips with `bg-white/5 text-white/40 px-2 py-0.5 rounded-md text-[clamp(0.45rem,0.55vw,0.6rem)]`.

**Notes:** Editable `<textarea>`. Saves on blur. Placeholder: "Add notes...". `bg-white/5 border border-white/10 rounded-lg text-white/70`.

**Tags:** Comma-separated input. Saves on blur.

### 6.3 Action Buttons

All actions for the selected prompt live here. Button styling matches the standard Promagen button pattern:

**Primary actions (top):**

- **Copy:** `bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200` → on success: `bg-emerald-500/20 text-emerald-400` for 1.5s
- **Load into Builder:** `bg-gradient-to-r from-sky-400/10 to-emerald-400/10 text-sky-400 border border-sky-400/20 hover:border-sky-400/40` — navigates to `/providers/{platformId}` with prompt pre-loaded via sessionStorage

**Secondary actions (bottom):**

- **Reformat for...:** Dropdown showing all 42 platforms. Selecting one re-assembles the prompt via `assemblePrompt()` and shows the result in a preview. Only enabled for structured saves (has `selections`). Disabled with tooltip "This prompt was saved as text only" for tooltip-origin saves.
- **Move to folder:** Dropdown of all folders. Selecting one moves the prompt.
- **Delete:** Red. `text-red-400/60 hover:text-red-400`. Requires confirmation (inline "Are you sure?" → "Delete" / "Cancel", same as current card pattern).

---

## 7. Save Icon (💾) — Surfaces & Behaviour

A 💾 save icon is added to every surface that shows a copyable prompt. It fires `useSavedPrompts().savePrompt()` with whatever metadata is available.

### 7.1 Save Icon Placement

| Surface                       | Component                                | Position                               | Available Metadata                                                                |
| ----------------------------- | ---------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| Commodity flag prompt tooltip | `commodity-prompt-tooltip.tsx`           | Next to existing copy icon in header   | `positivePrompt`, `platformId`, `platformName`, tier                              |
| Community Pulse card tooltip  | `community-pulse.tsx` PulsePromptTooltip | Next to existing copy icon in header   | `positivePrompt`, `platformId`, `platformName`                                    |
| Prompt of the Moment          | `prompt-showcase.tsx` CopyButton         | New 💾 button next to "Copy prompt"    | Full `positivePrompt`, `platformId`, `platformName`, tier, weather context        |
| Prompt Builder                | `prompt-builder.tsx`                     | Existing "Save" button already present | Full structured data (selections, customValues, families, mood, coherenceScore) ✓ |

### 7.2 Icon Design

Same size as the copy icon on each surface. SVG bookmark/floppy icon. Two states:

- Default: `text-white/30 hover:text-white/60`
- After save: `text-emerald-400` for 1.5s (same timing as copy feedback)

### 7.3 Save Data by Origin

**Builder saves (structured):** Full `SavedPrompt` with `selections`, `customValues`, `families`, `mood`, `coherenceScore`. Can be reformatted. Can be loaded back into builder.

**Tooltip saves (text-only):** Minimal `SavedPrompt` with `positivePrompt`, `platformId`, `platformName`. Empty `selections: {}`, empty `customValues: {}`, `families: []`, `mood: 'neutral'`, `coherenceScore: 0`. Cannot be reformatted (no structured data). Can still be copied, deleted, organised into folders.

The `SavedPrompt.source` field (NEW, see §12) distinguishes these: `'builder'` vs `'tooltip'`.

---

## 8. Quick Save Toast (Idea A)

When the 💾 icon is clicked, no modal appears. Instead:

1. Prompt is saved immediately with auto-generated name
2. A toast slides up from the bottom of the viewport
3. Toast auto-dismisses after 4 seconds
4. User can click "Undo" to reverse the save

### 8.1 Auto-Naming

Format: `"{subject} — {platformName}"` where subject is extracted from:

- Builder saves: `selections.subject?.[0]` or `customValues.subject` or first 30 chars of `positivePrompt`
- Tooltip saves: First 30 characters of `positivePrompt`

If no subject: `"Untitled — {platformName}"`.

Examples:

- "Cyberpunk hacker — Midjourney"
- "Dragon in volcanic cave — Flux"
- "Untitled — DALL·E 3"

Name is editable later in the preview panel.

### 8.2 Toast Design

```
┌──────────────────────────────────────────────────┐
│  ✓  Saved to Library                    [Undo]   │
│     "Cyberpunk hacker — Midjourney"              │
└──────────────────────────────────────────────────┘
```

Position: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`.
Background: `bg-emerald-500/15 ring-1 ring-emerald-500/30`.
Text: `text-emerald-400` for "Saved to Library", `text-white/50` for prompt name (truncated).
Undo button: `text-emerald-400 hover:text-emerald-300 underline`.

Transition: `translate-y-2 opacity-0` → `translate-y-0 opacity-100` (300ms ease-out).
Auto-dismiss: 4 seconds. Pauses on hover.

### 8.3 Undo Behaviour

Clicking "Undo" within the 4-second window:

1. Calls `deletePrompt(id)` on the just-saved prompt
2. Toast changes to "Save undone" (1.5s, then disappears)

---

## 9. Folder System

### 9.1 Data Model

New field on `SavedPrompt`:

```typescript
folder?: string;  // Folder name. undefined = "Unsorted"
```

Folders are implicit — they are derived from the set of unique `folder` values across all prompts. No separate folder storage is needed.

### 9.2 Default Folders

- **"All Prompts"** — shows everything (not a real folder, just removes filter)
- **"Unsorted"** — prompts where `folder` is undefined or empty

### 9.3 User-Created Folders

- Max 20 folders per user
- Max 30 characters per folder name
- Created via "+ New Folder" in left rail
- Renamed via double-click on folder name (inline edit)
- Deleted via right-click or long-press context menu → "Delete Folder" (prompts inside are moved to Unsorted, not deleted)

### 9.4 Moving Prompts to Folders

Two methods:

1. **Preview panel dropdown:** "Move to folder ▼" shows all folders + "Unsorted"
2. **Drag and drop (future):** Drag cards from centre to folder names in left rail. Deferred — not in v1.

---

## 10. Reformat Feature

When a user selects "Reformat for..." in the preview panel, a dropdown shows all 42 platforms grouped by tier:

```
Tier 1 (CLIP)
  ArtGuru, Clipdrop, DreamStudio, ...
Tier 2 (Midjourney)
  BlueWillow, Midjourney
Tier 3 (Natural Language)
  Adobe Firefly, DALL·E 3, Flux, ...
Tier 4 (Plain)
  Canva, Craiyon, ...
```

Selecting a platform:

1. Calls `assemblePrompt()` with the saved prompt's `selections` + `customValues` + new `platformId`
2. Shows the reformatted prompt text in a preview overlay within the preview panel
3. User can then "Copy reformatted" or "Save as new" (creates a new SavedPrompt for the new platform)

**Disabled state:** If `source === 'tooltip'` (no structured data), the button shows disabled with tooltip: "This prompt was saved as text — reformat requires builder data."

---

## 11. Collection Sharing (Idea B)

**Pro Promagen feature hook.** Not gated in v1 — available to all users. Can be gated later.

### 11.1 Export per Folder

The Export button in the left rail exports the currently selected folder (or all prompts if "All Prompts" is selected) as JSON:

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-03-09T12:00:00Z",
  "folder": "Cyberpunk Series",
  "prompts": [ ... ]
}
```

File name: `promagen-{folder-name}-{date}.json` (sanitised).

### 11.2 Import

File picker → JSON → prompts merged into the selected folder (or "Unsorted" if no folder selected). Duplicate detection by `positivePrompt` hash — if an identical prompt text already exists, skip it and report "X duplicates skipped".

---

## 12. Data Model Changes

### 12.1 SavedPrompt Type (Updated)

```typescript
export interface SavedPrompt {
  // ── Existing fields (unchanged) ──
  id: string;
  name: string;
  platformId: string;
  platformName: string;
  positivePrompt: string;
  negativePrompt?: string;
  selections: PromptSelections;
  customValues: Partial<Record<PromptCategory, string>>;
  families: string[];
  mood: 'calm' | 'intense' | 'neutral';
  coherenceScore: number;
  characterCount: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  tags?: string[];

  // ── New fields (v1.1.0) ──
  /** Save origin: 'builder' = full structured data, 'tooltip' = text-only */
  source: 'builder' | 'tooltip';
  /** Folder name. undefined = "Unsorted" */
  folder?: string;
  /** Platform tier (1-4) at time of save */
  tier?: number;
}
```

### 12.2 Storage Version

Bump from `1.0.0` to `1.1.0`. Migration: existing prompts get `source: 'builder'` (all current saves come from the builder) and `folder: undefined`.

---

## 13. Storage Architecture

### 13.1 Current (v1 — stays)

localStorage only. `promagen_saved_prompts` key. Zero cost.

### 13.2 Future (post sign-in)

- **Free users:** localStorage (current, zero cost)
- **Signed-in users:** database (Vercel Postgres). On first sign-in, localStorage prompts sync up to database once, then database is source of truth.
- **Cap:** 500 prompts per user (no TTL — prompts never expire)
- **Cost at scale:** 100K users × 50 prompts × 2KB = 10GB. Within Vercel Postgres Pro ($20/mo, 100GB).

This is a natural Pro feature hook: "Sign in to save prompts across devices."

---

## 14. File Locations

| File                                                     | Purpose                 | Status                            |
| -------------------------------------------------------- | ----------------------- | --------------------------------- |
| `src/app/studio/library/page.tsx`                        | Server component        | Modify (add providers)            |
| `src/components/prompts/library/library-client.tsx`      | Client orchestrator     | **Rewrite** (new 3-rail layout)   |
| `src/components/prompts/library/library-left-rail.tsx`   | Filters + folders       | **New**                           |
| `src/components/prompts/library/library-right-rail.tsx`  | Preview panel           | **New**                           |
| `src/components/prompts/library/saved-prompt-card.tsx`   | Card (compact redesign) | **Rewrite**                       |
| `src/components/prompts/library/prompt-library-grid.tsx` | Grid layout             | Modify (3-col)                    |
| `src/components/prompts/library/library-filters.tsx`     | Filter controls         | **Remove** (moved to left rail)   |
| `src/components/prompts/library/quick-save-toast.tsx`    | Save toast + undo       | **New**                           |
| `src/components/prompts/library/reformat-preview.tsx`    | Reformat overlay        | **New**                           |
| `src/types/saved-prompt.ts`                              | Types                   | Modify (add source, folder, tier) |
| `src/hooks/use-saved-prompts.ts`                         | Hook                    | Modify (migration, folder ops)    |
| `src/components/ribbon/commodity-prompt-tooltip.tsx`     | Commodity tooltip       | Modify (add 💾 icon)              |
| `src/components/home/community-pulse.tsx`                | CP tooltip              | Modify (add 💾 icon)              |
| `src/components/home/prompt-showcase.tsx`                | PotM                    | Modify (add 💾 button)            |

---

## 15. Acceptance Criteria

### 15.1 Layout & Consistency

- [ ] Page uses `HomepageGrid` with `0.9fr | 2.2fr | 0.9fr` columns
- [ ] Engine Bay renders identically to homepage
- [ ] Mission Control renders with 4 buttons: Home | World Context | Studio | Pro
- [ ] All three rails have `rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10`
- [ ] Scrollbar styling matches homepage exactly
- [ ] No `text-slate-500` or `text-slate-600` anywhere
- [ ] All text sizes use `clamp()` with 9px floor
- [ ] Heading gradient matches Scene Starters heading

### 15.2 Left Rail

- [ ] Search bar filters prompts in real-time
- [ ] Platform breakdown shows counts, clicking filters grid
- [ ] Mood breakdown shows counts
- [ ] Folders section shows All, Unsorted, user-created
- [ ] "+ New Folder" creates inline text input
- [ ] Import/Export buttons work with JSON

### 15.3 Centre Grid

- [ ] 1-3 columns responsive
- [ ] Cards show DNA bar, name, platform, preview, score, mood, family, time, folder
- [ ] Clicking card selects it (ring highlight) and populates preview panel
- [ ] Empty state shows helpful message with link to builder
- [ ] Cards are compact (no action buttons — actions in preview panel)

### 15.4 Right Rail

- [ ] Default state shows library statistics with platform breakdown chart
- [ ] Selected state shows full prompt text (not truncated), metadata, actions
- [ ] Copy button with emerald feedback (1.5s)
- [ ] Load button navigates to builder with prompt pre-loaded
- [ ] Reformat dropdown shows 42 platforms grouped by tier
- [ ] Reformat disabled for tooltip-origin saves
- [ ] Move to folder dropdown
- [ ] Delete with inline confirmation
- [ ] Notes editable, saves on blur
- [ ] Tags editable, saves on blur

### 15.5 Save Icon

- [ ] 💾 icon appears on commodity prompt tooltip (next to copy)
- [ ] 💾 icon appears on Community Pulse tooltip (next to copy)
- [ ] 💾 button appears on Prompt of the Moment (next to copy)
- [ ] All save icons fire `useSavedPrompts().savePrompt()` with available metadata
- [ ] Quick save toast appears on save (no modal)
- [ ] Toast auto-dismisses after 4s
- [ ] Undo works within 4s window
- [ ] Auto-naming produces sensible names

### 15.6 Data Integrity

- [ ] Storage version bumped to 1.1.0
- [ ] Migration adds `source: 'builder'` to existing prompts
- [ ] New `folder` field defaults to undefined
- [ ] `source: 'tooltip'` set on tooltip-origin saves
- [ ] Reformat correctly disabled for tooltip-origin saves

---

## 16. Build Order

| Phase | Scope                                                                                                                                   | Estimated Files |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1     | **Type changes + migration.** `saved-prompt.ts` (add source, folder, tier), `use-saved-prompts.ts` (migration logic, folder operations) | 2 files         |
| 2     | **Quick save toast.** `quick-save-toast.tsx` (new). Wire into existing save flow.                                                       | 1 file          |
| 3     | **💾 icon on all surfaces.** Modify `commodity-prompt-tooltip.tsx`, `community-pulse.tsx`, `prompt-showcase.tsx`.                       | 3 files         |
| 4     | **Left rail.** `library-left-rail.tsx` (new). Filters, smart groups, folders, import/export.                                            | 1 file          |
| 5     | **Right rail.** `library-right-rail.tsx` (new). Preview panel, actions, reformat.                                                       | 1-2 files       |
| 6     | **Card redesign.** `saved-prompt-card.tsx` (rewrite). Compact, visual-first, no action buttons.                                         | 1 file          |
| 7     | **Library client rewrite.** `library-client.tsx` (rewrite). Wire left/centre/right rails into HomepageGrid.                             | 1 file          |
| 8     | **Reformat preview.** `reformat-preview.tsx` (new). Platform selector + assemblePrompt() + preview.                                     | 1 file          |
| 9     | **Polish & testing.** Visual parity check. Test all save surfaces. Test import/export.                                                  | 0 new files     |

---

## 17. Edge Cases & Open Questions

### 17.1 Resolved

| Question                                 | Decision                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Exchange rails on library page?          | **Remove.** Replace with library-specific left (filters+folders) and right (preview) rails. Exchange rails serve no purpose on this page. |
| Save modal or quick save?                | **Quick save** (Idea A). No modal. Auto-name. Toast with undo.                                                                            |
| How are prompts organised?               | **Folders** (user-created) + **smart groups** (computed by platform, mood, recency).                                                      |
| Flat list or grid?                       | **Grid** (1-3 columns). Visual-first cards with DNA bar.                                                                                  |
| Where do action buttons go?              | **Right rail preview panel** only. Cards are for browsing, panel is for acting.                                                           |
| Can tooltip-origin saves be reformatted? | **No.** Reformat requires structured selections. Tooltip saves are text-only. Button disabled with tooltip explanation.                   |
| Collection sharing?                      | **Yes** (Idea B). Export per folder as JSON. Import with duplicate detection. Available to all users v1, potential Pro gate later.        |
| Storage: localStorage or database?       | **localStorage v1.** Database for signed-in users post-auth launch. Sync on first sign-in.                                                |

### 17.2 Open (Need Discussion)

| #   | Question                                                                                                            | Options                                                | Recommendation                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Route change?** Current route is `/studio/library`. Should it become `/library` (top-level) or stay under studio? | a) Keep `/studio/library` b) Move to `/library`        | **Keep `/studio/library`** — consistent with existing navigation. Studio sub-page pattern already established.            |
| 2   | **Drag-and-drop to folders?** Would make organising tactile.                                                        | a) Include in v1 b) Defer to v2                        | **Defer.** Get the core right first. Click-based "Move to folder" is sufficient for v1.                                   |
| 3   | **Bulk actions?** Select multiple cards → bulk delete, bulk move to folder.                                         | a) Include in v1 b) Defer                              | **Defer.** Individual actions via preview panel in v1. Bulk actions in v2 if users have 50+ prompts.                      |
| 4   | **Prompt thumbnail/preview image?** Would make the grid more visual.                                                | a) No images (text DNA only) b) AI-generated thumbnail | **No images v1.** Promagen is a prompt tool, not an image gallery. DNA bar + mood + family provides enough visual signal. |
| 5   | **Keyboard navigation?** Arrow keys to move between cards, Enter to select, Delete to delete.                       | a) Include b) Defer                                    | **Include.** Low effort, high accessibility impact. Arrow keys cycle selection, Enter opens preview, Escape deselects.    |

---

## 18. Non-Regression Rules

1. `HomepageGrid` component must not be modified — only pass new content via props
2. Engine Bay and Mission Control must render identically to homepage
3. Existing `useSavedPrompts` hook API must not break — all new methods are additive
4. Builder "Save" button still opens the modal (different flow from 💾 quick save)
5. Import/export JSON format must be backward-compatible with v1.0.0 exports
6. No `text-slate-500` or `text-slate-600` (§6.0.2)
7. No opacity dimming for state (§6.0.3)
8. All text clamp() with ≥9px floor (§6.0.1)
9. All animations in `<style jsx>` not `globals.css` (§6.2)
10. Exchange rails on other pages (homepage, World Context, prompt builder) must not be affected

---

## 19. Changelog

- **9 March 2026 (v1.0.0):** Initial specification. Full redesign of `/studio/library` with 3-rail layout (filters+folders | card grid | preview panel), 💾 save icon on all tooltip surfaces, quick save toast with undo, folder system, reformat feature, collection sharing. Human factors research: Pinterest board model, visual density, smart auto-grouping, frictionless save.

---

## Related Documents

- `code-standard.md` — §6.0-§6.9 styling rules
- `prompt-intelligence.md` — §9.2 page definitions (original library spec)
- `paid_tier.md` — §3 sign-in requirements, §5.1 unlimited prompts
- `homepage.md` — §5 Scene Starters, §6 Community Pulse (left/right rail patterns)
- `unified-prompt-brain.md` — `assemblePrompt()` pipeline (reformat feature)
- `prompt-builder-page.md` — builder save flow, sessionStorage pre-load
