// src/components/prompt-intelligence/dna-bar.tsx
// ============================================================================
// DNA BAR COMPONENT
// ============================================================================
// Visual representation of prompt category fill status with educational tooltips.
// ============================================================================

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PromptDNA, CategoryFillStatus, CategoryCoherenceStatus } from '@/lib/prompt-intelligence/types';
import type { PromptCategory } from '@/types/prompt-builder';
import { Tooltip } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface DNABarProps {
  /** Prompt DNA data */
  dna: PromptDNA | null;
  
  /** Custom class name */
  className?: string;
  
  /** Whether to show tooltips */
  showTooltips?: boolean;
  
  /** Whether to show coherence score */
  showCoherence?: boolean;
  
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_ORDER: PromptCategory[] = [
  'style',
  'lighting',
  'colour',
  'atmosphere',
  'environment',
  'action',
  'composition',
  'camera',
  'materials',
  'fidelity',
];

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  subject: 'Subject',
  style: 'Style',
  lighting: 'Lighting',
  colour: 'Colour',
  atmosphere: 'Atmosphere',
  environment: 'Environment',
  action: 'Action',
  composition: 'Composition',
  camera: 'Camera',
  materials: 'Materials',
  fidelity: 'Fidelity',
  negative: 'Negative',
};

/** Educational descriptions for each category */
const CATEGORY_DESCRIPTIONS: Record<PromptCategory, string> = {
  subject: 'The main focus of your image',
  style: 'Artistic style like cyberpunk, watercolor, or photorealistic',
  lighting: 'How light falls on your scene (dramatic, soft, neon)',
  colour: 'Color palette and tones (warm, cold, monochrome)',
  atmosphere: 'The mood and feeling (mysterious, serene, intense)',
  environment: 'The setting and background elements',
  action: 'Movement, poses, and dynamic elements',
  composition: 'How elements are arranged (centered, rule of thirds)',
  camera: 'Camera angle and lens effects (wide angle, macro)',
  materials: 'Textures and surfaces (metallic, organic, glass)',
  fidelity: 'Detail level and quality (8K, highly detailed)',
  negative: 'What to avoid in the image',
};

/** Tips for each category when empty */
const CATEGORY_TIPS: Record<PromptCategory, string> = {
  subject: 'Add a subject to start building your prompt',
  style: 'Try adding a style like "cyberpunk" or "oil painting"',
  lighting: 'Consider lighting like "golden hour" or "dramatic shadows"',
  colour: 'Add colors like "teal and orange" or "muted pastels"',
  atmosphere: 'Set the mood with "mysterious fog" or "ethereal glow"',
  environment: 'Place your subject in a setting like "futuristic city"',
  action: 'Add movement with "running" or "floating gracefully"',
  composition: 'Try "centered composition" or "rule of thirds"',
  camera: 'Consider "close-up portrait" or "wide angle shot"',
  materials: 'Add textures like "chrome" or "weathered stone"',
  fidelity: 'Boost quality with "highly detailed" or "8K resolution"',
  negative: 'Add things to avoid like "blurry" or "deformed"',
};

const SIZE_STYLES = {
  sm: { height: 'h-1.5', width: 'w-3', gap: 'gap-0.5' },
  md: { height: 'h-2', width: 'w-4', gap: 'gap-1' },
  lg: { height: 'h-3', width: 'w-5', gap: 'gap-1' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getSegmentColor(
  fill: CategoryFillStatus,
  coherence: CategoryCoherenceStatus
): string {
  if (fill === 'empty') {
    return 'bg-muted/50';
  }
  
  switch (coherence) {
    case 'conflict':
      return 'bg-red-500';
    case 'coherent':
      return 'bg-emerald-500';
    case 'neutral':
    default:
      return 'bg-sky-500';
  }
}

function getCoherenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function getCoherenceLabel(score: number): string {
  if (score >= 80) return 'Excellent coherence';
  if (score >= 60) return 'Good coherence';
  return 'Low coherence';
}

/**
 * Build educational tooltip for a DNA segment
 */
function buildSegmentTooltip(
  category: PromptCategory,
  fill: CategoryFillStatus,
  coherence: CategoryCoherenceStatus
): string {
  const label = CATEGORY_LABELS[category];
  const description = CATEGORY_DESCRIPTIONS[category];
  const lines: string[] = [];
  
  // Status line
  if (fill === 'filled') {
    lines.push(`✓ ${label}: Active`);
    
    // Coherence feedback
    if (coherence === 'coherent') {
      lines.push('💚 Harmonizes with other selections');
    } else if (coherence === 'conflict') {
      lines.push('⚠️ May conflict with other selections');
    }
  } else {
    lines.push(`○ ${label}: Empty`);
    lines.push(`💡 ${CATEGORY_TIPS[category]}`);
  }
  
  // Description
  lines.push(`📖 ${description}`);
  
  return lines.join('\n');
}

// ============================================================================
// Component
// ============================================================================

export function DNABar({
  dna,
  className,
  showTooltips = true,
  showCoherence = true,
  size = 'md',
}: DNABarProps) {
  // Build segments
  const segments = useMemo(() => {
    if (!dna) {
      return CATEGORY_ORDER.map(cat => ({
        category: cat,
        fill: 'empty' as CategoryFillStatus,
        coherence: 'neutral' as CategoryCoherenceStatus,
        label: CATEGORY_LABELS[cat],
      }));
    }
    
    return CATEGORY_ORDER.map(cat => ({
      category: cat,
      fill: dna.categoryFill[cat] ?? 'empty',
      coherence: dna.categoryCoherence[cat] ?? 'neutral',
      label: CATEGORY_LABELS[cat],
    }));
  }, [dna]);
  
  const sizeStyle = SIZE_STYLES[size];
  const coherenceScore = dna?.coherenceScore ?? 0;
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* DNA Segments */}
      <div className={cn('flex items-center', sizeStyle.gap)}>
        {segments.map((segment) => {
          const color = getSegmentColor(segment.fill, segment.coherence);
          const tooltipText = buildSegmentTooltip(
            segment.category,
            segment.fill,
            segment.coherence
          );
          
          const segmentEl = (
            <div
              key={segment.category}
              className={cn(
                'rounded-sm transition-all duration-200',
                sizeStyle.height,
                sizeStyle.width,
                color,
                segment.fill === 'filled' && 'ring-1 ring-white/20'
              )}
            />
          );
          
          if (showTooltips) {
            return (
              <Tooltip key={segment.category} text={tooltipText}>
                {segmentEl}
              </Tooltip>
            );
          }
          
          return segmentEl;
        })}
      </div>
      
      {/* Coherence Score with educational tooltip */}
      {showCoherence && dna && (
        <Tooltip text={`${getCoherenceLabel(coherenceScore)}\n\n💡 Higher coherence = selections work well together\nTip: Pick terms from the same style family`}>
          <span
            className={cn(
              'text-xs font-medium tabular-nums cursor-help',
              getCoherenceColor(coherenceScore)
            )}
          >
            {coherenceScore}%
          </span>
        </Tooltip>
      )}
    </div>
  );
}

export default DNABar;
