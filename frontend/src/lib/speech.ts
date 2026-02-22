// src/lib/speech.ts
// ============================================================================
// SPEECH SYNTHESIS — British Female Voice with Priority Fallback
// ============================================================================
// Extracted from homepage-grid.tsx so both the hero description speaker AND
// the provider weather emoji tooltip speaker use the same voice selection.
//
// Voice priority:
//   1. Google UK English Female (Chrome)
//   2. Martha (macOS Sequoia+)
//   3. Kate (macOS)
//   4. Microsoft Hazel (Windows Edge)
//   5. Microsoft Susan (Windows)
//   6. Serena (macOS)
//   7. Daniel (macOS — male, but British)
//   8. Any en-GB voice
//   9. Any en-* voice
//
// API:
//   speakText(text, callbacks?) — speak with British voice
//   stopSpeaking()             — cancel current utterance
//   isSpeechSupported()        — feature detection
//
// Authority: docs/authority/exchange-card-weather.md (tooltip TTS)
// Existing features preserved: Yes (extracted, not modified)
// ============================================================================

/**
 * British female voice priority list.
 * Ordered from most desirable to least.
 */
const PREFERRED_VOICES = [
  'Google UK English Female',
  'Martha',
  'Kate',
  'Microsoft Hazel',
  'Microsoft Susan',
  'Serena',
  'Daniel',
] as const;

/**
 * Pick the best available British English voice.
 * Falls back through priority list → any en-GB → any en-* → null.
 */
function pickBritishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();

  // Priority list — first match wins
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) return match;
  }

  // Fallback: any en-GB voice
  const gbVoice = voices.find((v) => v.lang.startsWith('en-GB'));
  if (gbVoice) return gbVoice;

  // Last resort: any English voice
  return voices.find((v) => v.lang.startsWith('en')) || null;
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
 * Speak the given text using the best available British English voice.
 *
 * Handles the Chrome quirk where `getVoices()` returns empty on first call
 * and requires waiting for the `voiceschanged` event.
 *
 * @param text      - The text to speak
 * @param callbacks - Optional lifecycle callbacks
 * @param callbacks.onStart - Called when speech begins
 * @param callbacks.onEnd   - Called when speech finishes (natural or error)
 *
 * @example
 * ```tsx
 * const [speaking, setSpeaking] = useState(false);
 *
 * const handleSpeak = () => {
 *   if (speaking) { stopSpeaking(); setSpeaking(false); return; }
 *   speakText(tooltipText, {
 *     onStart: () => setSpeaking(true),
 *     onEnd:   () => setSpeaking(false),
 *   });
 * };
 * ```
 */
export function speakText(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
  },
): void {
  if (!isSpeechSupported()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const setVoiceAndSpeak = () => {
    const voice = pickBritishVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => callbacks?.onEnd?.();
    utterance.onerror = () => callbacks?.onEnd?.();

    callbacks?.onStart?.();
    window.speechSynthesis.speak(utterance);
  };

  // Voices may load async (Chrome) — handle both cases
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    setVoiceAndSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      setVoiceAndSpeak();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }
}
