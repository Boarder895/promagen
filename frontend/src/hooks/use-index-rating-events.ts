/**
 * Index Rating Event Tracking Hook
 * 
 * Client-side hook for tracking user engagement events
 * that contribute to the Index Rating system.
 * 
 * @example
 * ```tsx
 * const { trackPromptBuilderOpen, trackPromptSubmit, trackSocialClick } = useIndexRatingEvents();
 * 
 * // Track page view
 * useEffect(() => {
 *   trackPromptBuilderOpen('midjourney');
 * }, []);
 * 
 * // Track copy button click
 * <button onClick={() => trackPromptSubmit('midjourney')}>Copy</button>
 * 
 * // Track social click
 * <a onClick={() => trackSocialClick('midjourney', 'discord')}>Discord</a>
 * ```
 * 
 * @see docs/authority/index-rating.md
 */

'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { IndexRatingEventType } from '@/types/index-rating';

// =============================================================================
// TYPES
// =============================================================================

type TrackEventFn = (providerId: string, src?: string) => void;
type TrackSocialClickFn = (providerId: string, platform: string) => void;

type UseIndexRatingEventsReturn = {
  /** Track prompt builder page open */
  trackPromptBuilderOpen: TrackEventFn;
  /** Track prompt copy/submit */
  trackPromptSubmit: TrackEventFn;
  /** Track social icon click */
  trackSocialClick: TrackSocialClickFn;
  /** Track image quality vote */
  trackVote: TrackEventFn;
  /** Track Prompt Lab provider selection */
  trackLabSelect: TrackEventFn;
  /** Track Prompt Lab generate */
  trackLabGenerate: TrackEventFn;
  /** Track Prompt Lab tier copy */
  trackLabCopy: TrackEventFn;
  /** Track Prompt Lab optimise (Call 3) */
  trackLabOptimise: TrackEventFn;
  /** Track prompt save to library */
  trackPromptSave: TrackEventFn;
  /** Track prompt reformat to different platform */
  trackPromptReformat: TrackEventFn;
  /** Session ID for this browser session */
  sessionId: string;
};

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/** Character set for ID generation */
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a simple random ID without external deps
 */
function generateId(length: number = 16): string {
  let result = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      // Non-null assertion safe: array length matches loop bounds
      const byte = array[i]!;
      result += ID_CHARS.charAt(byte % ID_CHARS.length);
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
    }
  }
  return result;
}

/**
 * Get or create a session ID.
 * Stored in sessionStorage to persist across page loads but not browser sessions.
 * Exported for lightweight components using sendTrackEvent directly.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return generateId(16);
  }
  
  const STORAGE_KEY = 'promagen_session_id';
  
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
    
    const newId = generateId(16);
    sessionStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch {
    // sessionStorage not available (private browsing, etc.)
    return generateId(16);
  }
}

// =============================================================================
// API CALL
// =============================================================================

/**
 * Send tracking event to API.
 * Fire and forget - don't await or block UI.
 * Exported for use in lightweight components that don't mount the full hook.
 */
export function sendTrackEvent(
  providerId: string,
  eventType: IndexRatingEventType,
  src: string | undefined,
  sessionId: string
): void {
  try {
    // Don't await - fire and forget
    fetch('/api/events/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId,
        eventType,
        src,
        sessionId,
      }),
      // Use keepalive for reliability during page unload
      keepalive: true,
    }).catch(() => {
      // Silently ignore errors - tracking is best effort
    });
  } catch {
    // Silently ignore - tracking is best effort
  }
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for tracking Index Rating events.
 * 
 * Events are sent fire-and-forget to avoid blocking UI.
 * Tracking failures are silently ignored.
 */
export function useIndexRatingEvents(): UseIndexRatingEventsReturn {
  // Get or create session ID
  const sessionIdRef = useRef<string>('');
  
  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  // Get session ID (fallback for SSR)
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = getOrCreateSessionId();
    }
    return sessionIdRef.current;
  }, []);

  // Track prompt builder open (page load)
  const trackPromptBuilderOpen = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_builder_open',
      src || 'provider_detail_page',
      getSessionId()
    );
  }, [getSessionId]);

  // Track prompt submit (copy button click)
  const trackPromptSubmit = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_submit',
      src || 'prompt_builder_copy',
      getSessionId()
    );
  }, [getSessionId]);

  // Track social click
  const trackSocialClick = useCallback<TrackSocialClickFn>((providerId, platform) => {
    sendTrackEvent(
      providerId,
      'social_click',
      `support_column_${platform}`,
      getSessionId()
    );
  }, [getSessionId]);

  // Track image quality vote
  const trackVote = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'vote',
      src || 'image_quality_vote',
      getSessionId()
    );
  }, [getSessionId]);

  // Track Prompt Lab provider selection
  const trackLabSelect = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_lab_select',
      src || 'prompt_lab_rail',
      getSessionId()
    );
  }, [getSessionId]);

  // Track Prompt Lab generate
  const trackLabGenerate = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_lab_generate',
      src || 'prompt_lab_generate',
      getSessionId()
    );
  }, [getSessionId]);

  // Track Prompt Lab tier copy
  const trackLabCopy = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_lab_copy',
      src || 'prompt_lab_tier_copy',
      getSessionId()
    );
  }, [getSessionId]);

  // Track Prompt Lab optimise (Call 3)
  const trackLabOptimise = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_lab_optimise',
      src || 'prompt_lab_call3',
      getSessionId()
    );
  }, [getSessionId]);

  // Track prompt save to library
  const trackPromptSave = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_save',
      src || 'save_icon',
      getSessionId()
    );
  }, [getSessionId]);

  // Track prompt reformat to different platform
  const trackPromptReformat = useCallback<TrackEventFn>((providerId, src) => {
    sendTrackEvent(
      providerId,
      'prompt_reformat',
      src || 'reformat_preview',
      getSessionId()
    );
  }, [getSessionId]);

  return {
    trackPromptBuilderOpen,
    trackPromptSubmit,
    trackSocialClick,
    trackVote,
    trackLabSelect,
    trackLabGenerate,
    trackLabCopy,
    trackLabOptimise,
    trackPromptSave,
    trackPromptReformat,
    sessionId: sessionIdRef.current || getSessionId(),
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default useIndexRatingEvents;
