// src/components/prompt-intelligence/health-badge.tsx
// ============================================================================
// HEALTH BADGE COMPONENT
// ============================================================================
// Visual indicator for overall prompt health/quality.
// ============================================================================

'use client';

import { Heart, HeartPulse, HeartCrack, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface HealthBadgeProps {
  /** Health score (0-100) */
  score: number;
  
  /** Whether there are conflicts */
  hasConflicts?: boolean;
  
  /** Whether there are hard conflicts */
  hasHardConflicts?: boolean;
  
  /** Custom class name */
  className?: string;
  
  /** Display variant */
  variant?: 'badge' | 'icon' | 'score';
  
  /** Whether to show the numeric score */
  showScore?: boolean;
  
  /** Icon style */
  iconStyle?: 'heart' | 'shield';
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHealthLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function getHealthColor(level: ReturnType<typeof getHealthLevel>): string {
  switch (level) {
    case 'excellent':
      return 'text-emerald-500';
    case 'good':
      return 'text-sky-500';
    case 'fair':
      return 'text-amber-500';
    case 'poor':
      return 'text-red-500';
  }
}

function getHealthBadgeVariant(level: ReturnType<typeof getHealthLevel>): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (level) {
    case 'excellent':
      return 'default';
    case 'good':
      return 'secondary';
    case 'fair':
      return 'outline';
    case 'poor':
      return 'destructive';
  }
}

function getHealthLabel(level: ReturnType<typeof getHealthLevel>): string {
  switch (level) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Needs Work';
  }
}

function getHealthDescription(level: ReturnType<typeof getHealthLevel>): string {
  switch (level) {
    case 'excellent':
      return 'Your prompt is well-structured with coherent choices.';
    case 'good':
      return 'Your prompt has good structure. Minor improvements possible.';
    case 'fair':
      return 'Consider adding more detail or resolving conflicts.';
    case 'poor':
      return 'Add a subject and more options to improve quality.';
  }
}

function buildTooltipText(
  score: number,
  level: ReturnType<typeof getHealthLevel>,
  hasConflicts: boolean,
  hasHardConflicts: boolean
): string {
  const label = getHealthLabel(level);
  const desc = getHealthDescription(level);
  const conflictNote = hasConflicts
    ? ` ⚠ Has ${hasHardConflicts ? 'hard' : 'soft'} conflicts.`
    : '';
  
  return `Prompt Health: ${label} (${score}%)${conflictNote} ${desc}`;
}

// ============================================================================
// Component
// ============================================================================

export function HealthBadge({
  score,
  hasConflicts = false,
  hasHardConflicts = false,
  className,
  variant = 'badge',
  showScore = true,
  iconStyle = 'heart',
}: HealthBadgeProps) {
  const level = getHealthLevel(score);
  const color = getHealthColor(level);
  const label = getHealthLabel(level);
  const tooltipText = buildTooltipText(score, level, hasConflicts, hasHardConflicts);
  
  // Select icon based on style and health level
  const getIcon = () => {
    if (iconStyle === 'shield') {
      if (hasHardConflicts) return ShieldAlert;
      if (level === 'excellent' || level === 'good') return ShieldCheck;
      return Shield;
    }
    
    if (hasHardConflicts) return HeartCrack;
    if (level === 'excellent') return HeartPulse;
    return Heart;
  };
  
  const Icon = getIcon();
  
  // Icon variant
  if (variant === 'icon') {
    return (
      <Tooltip text={tooltipText}>
        <div className={cn('cursor-help', className)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </Tooltip>
    );
  }
  
  // Score variant
  if (variant === 'score') {
    return (
      <Tooltip text={tooltipText}>
        <div className={cn('flex items-center gap-1 cursor-help', color, className)}>
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium tabular-nums">{score}%</span>
        </div>
      </Tooltip>
    );
  }
  
  // Badge variant (default)
  return (
    <Tooltip text={tooltipText}>
      <Badge
        variant={getHealthBadgeVariant(level)}
        className={cn('gap-1 cursor-help', className)}
      >
        <Icon className="h-3 w-3" />
        {showScore ? `${score}%` : label}
      </Badge>
    </Tooltip>
  );
}

export default HealthBadge;
