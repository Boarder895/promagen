// src/components/providers/provider-page-tracker.tsx
//
// Client-side wrapper that tracks prompt_builder_open event on page load.
// Used by the provider detail page to track when users open the prompt builder.
//
// Updated: 27 Jan 2026 - Created for Index Rating event tracking
// Authority: docs/authority/index-rating.md

'use client';

import { useEffect } from 'react';
import { useIndexRatingEvents } from '@/hooks/use-index-rating-events';

type ProviderPageTrackerProps = {
  providerId: string;
  children: React.ReactNode;
};

/**
 * Client component that wraps provider page content and tracks page view.
 * Fires prompt_builder_open event on mount.
 */
export function ProviderPageTracker({ providerId, children }: ProviderPageTrackerProps) {
  const { trackPromptBuilderOpen } = useIndexRatingEvents();

  // Track page view on mount
  useEffect(() => {
    if (providerId) {
      trackPromptBuilderOpen(providerId);
    }
  }, [providerId, trackPromptBuilderOpen]);

  return <>{children}</>;
}

export default ProviderPageTracker;
