// src/components/prompt-intelligence/conflict-warning.tsx
// ============================================================================
// CONFLICT WARNING COMPONENT
// ============================================================================
// Visual indicator for prompt conflicts.
// ============================================================================

'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetectedConflict } from '@/lib/prompt-intelligence/types';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

export interface ConflictWarningProps {
  /** Detected conflicts */
  conflicts: DetectedConflict[];
  
  /** Whether there are hard conflicts */
  hasHardConflicts?: boolean;
  
  /** Custom class name */
  className?: string;
  
  /** Display variant */
  variant?: 'badge' | 'icon' | 'inline';
  
  /** Whether to show only hard conflicts */
  hardOnly?: boolean;
  
  /** Maximum conflicts to show in tooltip */
  maxTooltip?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildTooltipText(
  conflicts: DetectedConflict[],
  maxTooltip: number
): string {
  const hardCount = conflicts.filter(c => c.severity === 'hard').length;
  const softCount = conflicts.filter(c => c.severity === 'soft').length;
  
  const parts: string[] = [];
  
  if (hardCount > 0) {
    parts.push(`${hardCount} hard conflict${hardCount > 1 ? 's' : ''}`);
  }
  if (softCount > 0) {
    parts.push(`${softCount} soft conflict${softCount > 1 ? 's' : ''}`);
  }
  
  const tooltipConflicts = conflicts.slice(0, maxTooltip);
  const details = tooltipConflicts.map(c => `${c.terms.join(' ↔ ')}: ${c.reason}`).join('; ');
  
  const remaining = conflicts.length - maxTooltip;
  const moreText = remaining > 0 ? ` (+${remaining} more)` : '';
  
  return `${parts.join(', ')}. ${details}${moreText}`;
}

// ============================================================================
// Component
// ============================================================================

export function ConflictWarning({
  conflicts,
  hasHardConflicts = false,
  className,
  variant = 'badge',
  hardOnly = false,
  maxTooltip = 3,
}: ConflictWarningProps) {
  // Filter conflicts if needed
  const displayConflicts = hardOnly
    ? conflicts.filter(c => c.severity === 'hard')
    : conflicts;
  
  if (displayConflicts.length === 0) {
    return null;
  }
  
  const tooltipText = buildTooltipText(displayConflicts, maxTooltip);
  
  // Icon variant
  if (variant === 'icon') {
    return (
      <Tooltip text={tooltipText}>
        <div className={cn('cursor-help', className)}>
          {hasHardConflicts ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      </Tooltip>
    );
  }
  
  // Inline variant
  if (variant === 'inline') {
    return (
      <Tooltip text={tooltipText}>
        <div
          className={cn(
            'flex items-center gap-1 text-xs cursor-help',
            hasHardConflicts ? 'text-red-500' : 'text-amber-500',
            className
          )}
        >
          {hasHardConflicts ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Info className="h-3 w-3" />
          )}
          <span>
            {displayConflicts.length} conflict{displayConflicts.length > 1 ? 's' : ''}
          </span>
        </div>
      </Tooltip>
    );
  }
  
  // Badge variant (default)
  return (
    <Tooltip text={tooltipText}>
      <Badge
        variant={hasHardConflicts ? 'destructive' : 'outline'}
        className={cn(
          'cursor-help gap-1',
          !hasHardConflicts && 'border-amber-500/50 text-amber-500',
          className
        )}
      >
        {hasHardConflicts ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <AlertCircle className="h-3 w-3" />
        )}
        {displayConflicts.length}
      </Badge>
    </Tooltip>
  );
}

export default ConflictWarning;
