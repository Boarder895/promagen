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
 */
function getOrCreateSessionId(): string {
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
 */
function sendTrackEvent(
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

  return {
    trackPromptBuilderOpen,
    trackPromptSubmit,
    trackSocialClick,
    sessionId: sessionIdRef.current || getSessionId(),
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default useIndexRatingEvents;
