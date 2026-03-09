// src/lib/speech.ts
// ============================================================================
// SPEECH SYNTHESIS — British Female Voice (Cross-Browser)
// ============================================================================
//
// Provides a consistent British female voice across Chrome, Safari (macOS +
// iOS), Firefox, and Edge. The Web Speech API exposes different voice names
// on every browser/OS combination. This module maintains a priority list
// that covers all major platforms and always prefers female en-GB voices.
//
// Voice priority (female en-GB first, then female en-*, then any en-GB):
//
//   Chrome Desktop:    "Google UK English Female"
//   Safari macOS 15+:  "Martha" (en-GB)
//   Safari macOS:      "Kate" (en-GB)
//   Safari iOS 17+:    "Martha" (en-GB)
//   Safari iOS:        "Serena" (en-GB) — available on all iOS versions
//   Edge Windows:      "Microsoft Hazel Desktop" (en-GB)
//   Edge Windows:      "Microsoft Susan" (en-GB)
//   Firefox:           Uses OS voices — picks up Kate/Martha/Hazel above
//   Android Chrome:    "English United Kingdom" (female en-GB on most devices)
//
// Fallback chain:
//   1. Named priority list (female British voices)
//   2. Any voice with lang exactly "en-GB" that contains a female keyword
//   3. Any voice with lang exactly "en-GB"
//   4. Any voice with lang starting "en-GB"
//   5. Never falls through to en-US — returns null instead
//      (browser default is better than a jarring American male voice)
//
// API:
//   speakText(text, callbacks?) — speak with British female voice
//   stopSpeaking()             — cancel current utterance
//   isSpeechSupported()        — feature detection
//
// Authority: docs/authority/exchange-card-weather.md (tooltip TTS)
// Existing features preserved: Yes.
// ============================================================================

/**
 * British female voice priority list.
 * Ordered from most desirable to least. Covers Chrome, Safari (macOS + iOS),
 * Edge, Firefox. Each entry is checked as a substring of voice.name.
 */
const PREFERRED_VOICES = [
  // Chrome (desktop + Android)
  'Google UK English Female',
  // Safari macOS Sequoia+ / iOS 17+
  'Martha',
  // Safari macOS (all versions)
  'Kate',
  // Windows Edge
  'Microsoft Hazel',
  'Microsoft Susan',
  // Safari iOS (all versions — reliable en-GB female)
  'Serena',
  // Safari macOS additional
  'Stephanie',
  'Fiona',
] as const;

/**
 * Keywords that indicate a female voice (case-insensitive substring check).
 * Used when filtering unnamed en-GB voices on less common platforms.
 */
const FEMALE_KEYWORDS = [
  'female', 'woman', 'fiona', 'kate', 'martha', 'serena', 'stephanie',
  'hazel', 'susan', 'alice', 'emily', 'amy',
] as const;

/**
 * Pick the best available British English female voice.
 *
 * Strategy:
 *   1. Named priority list (best quality, known female)
 *   2. Any en-GB voice with a female keyword in its name
 *   3. Any en-GB voice at all (unknown gender, but at least British)
 *   4. null — let the browser use its default rather than risk a male US voice
 */
function pickBritishFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Pass 1: Named priority list — first match wins
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) return match;
  }

  // Pass 2: Any en-GB voice with a female keyword
  const enGbVoices = voices.filter(
    (v) => v.lang === 'en-GB' || v.lang.startsWith('en-GB'),
  );

  for (const voice of enGbVoices) {
    const lowerName = voice.name.toLowerCase();
    if (FEMALE_KEYWORDS.some((kw) => lowerName.includes(kw))) {
      return voice;
    }
  }

  // Pass 3: Any en-GB voice (gender unknown, but accent is correct)
  if (enGbVoices.length > 0) return enGbVoices[0]!;

  // Pass 4: null — do NOT fall through to en-US.
  // Returning null means the utterance uses the browser default voice,
  // which is typically the user's system language voice. This is better
  // than explicitly selecting an American male voice.
  return null;
}

/**
 * Check whether the Web Speech API is available.
 * Returns false in SSR, workers, or browsers without speechSynthesis.
 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Cancel any currently speaking utterance.
 */
export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak the given text using the best available British English female voice.
 *
 * Handles the Chrome quirk where `getVoices()` returns empty on first call
 * and requires waiting for the `voiceschanged` event. Also handles Safari iOS
 * which can take 200-500ms to populate the voice list on first page load.
 *
 * @param text      - The text to speak
 * @param callbacks - Optional lifecycle callbacks
 * @param callbacks.onStart - Called when speech begins
 * @param callbacks.onEnd   - Called when speech finishes (natural or error)
 */
export function speakText(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
  },
): void {
  if (!isSpeechSupported()) return;

  // Safari iOS bug: calling speak() without a prior user gesture cancel
  // can cause silent playback. Cancel first to clear any stale state.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.lang = 'en-GB';

  const setVoiceAndSpeak = () => {
    const voice = pickBritishFemaleVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onend = () => callbacks?.onEnd?.();
    utterance.onerror = () => callbacks?.onEnd?.();

    callbacks?.onStart?.();
    window.speechSynthesis.speak(utterance);

    // Safari iOS bug: speechSynthesis can pause after ~15s. This keepalive
    // resumes it. Clears automatically when speech ends.
    const keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAlive);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10_000);

    utterance.onend = () => {
      clearInterval(keepAlive);
      callbacks?.onEnd?.();
    };
    utterance.onerror = () => {
      clearInterval(keepAlive);
      callbacks?.onEnd?.();
    };
  };

  // Voices may load async (Chrome + Safari iOS) — handle both cases
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    setVoiceAndSpeak();
  } else {
    // Wait for voices to load. Safari iOS can be slow (200-500ms).
    window.speechSynthesis.onvoiceschanged = () => {
      setVoiceAndSpeak();
      window.speechSynthesis.onvoiceschanged = null;
    };

    // Safety timeout: if voiceschanged never fires (rare edge case),
    // speak with browser default after 1 second rather than hanging.
    setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        window.speechSynthesis.onvoiceschanged = null;
        setVoiceAndSpeak();
      }
    }, 1_000);
  }
}
