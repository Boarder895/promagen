// src/lib/weather/moon-phase.ts
// ============================================================================
// MOON PHASE CALCULATOR — Pure Maths, No API
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Extracted from weather-prompt-generator.ts (4,311-line monolith)
// - Contains: getMoonPhase, moon phase data, MoonPhaseInfo type
//
// Existing features preserved: Yes
// ============================================================================

import { SYNODIC_MONTH, REFERENCE_NEW_MOON_DAYS } from './prompt-types';

export interface MoonPhaseInfo {
  readonly name: string;
  readonly emoji: string;
  readonly promptPhrase: string;
  readonly dayInCycle: number;
}

const MOON_PHASES: {
  maxDay: number;
  name: string;
  emoji: string;
  phrases: string[];
}[] = [
  {
    maxDay: 1.85,
    name: 'New Moon',
    emoji: '🌑',
    phrases: [
      'new moon darkness with starlit sky',
      'moonless night deep velvet darkness',
      'new moon shadow absolute night stillness',
      'pitch dark new moon starfield clarity',
      'inky black moonless canopy',
    ],
  },
  {
    maxDay: 7.38,
    name: 'Waxing Crescent',
    emoji: '🌒',
    phrases: [
      'waxing crescent thin silver sliver',
      'delicate crescent moon low arc',
      'young moon faint crescent glow',
      'slender waxing crescent silver edge',
      'emerging crescent moonlight whisper',
    ],
  },
  {
    maxDay: 11.07,
    name: 'First Quarter',
    emoji: '🌓',
    phrases: [
      'half moon sharp light divide',
      'first quarter moon crisp shadow line',
      'half-lit moon geometric precision',
      'quarter moon balanced light and dark',
      'first quarter moon clean bisected glow',
    ],
  },
  {
    maxDay: 14.76,
    name: 'Waxing Gibbous',
    emoji: '🌔',
    phrases: [
      'near-full moon bright luminous glow',
      'waxing gibbous generous moonlight',
      'almost full moon radiant silver wash',
      'swelling gibbous moon brilliant presence',
      'bright waxing gibbous moon flooding light',
    ],
  },
  {
    maxDay: 16.61,
    name: 'Full Moon',
    emoji: '🌕',
    phrases: [
      'full moon silver flood illumination',
      'brilliant full moon casting sharp shadows',
      'magnificent full moon total lunar glow',
      'resplendent full moon night turned silver',
      'blazing full moon dramatic moonlit scene',
    ],
  },
  {
    maxDay: 22.14,
    name: 'Waning Gibbous',
    emoji: '🌖',
    phrases: [
      'waning gibbous soft fading moonlight',
      'post-full moon gentle silver retreat',
      'waning gibbous mellow lunar glow',
      'dimming gibbous moon amber-tinged light',
      'retreating gibbous moon warm silver wash',
    ],
  },
  {
    maxDay: 25.83,
    name: 'Last Quarter',
    emoji: '🌗',
    phrases: [
      'half moon fading light receding',
      'last quarter moon stark shadow divide',
      'waning half moon muted silver glow',
      'third quarter moon geometric dimness',
      'last quarter balanced darkness and light',
    ],
  },
  {
    maxDay: SYNODIC_MONTH,
    name: 'Waning Crescent',
    emoji: '🌘',
    phrases: [
      'thin waning crescent moon vanishing arc',
      'dying crescent moon final silver breath',
      'fading crescent sliver barely visible',
      'old moon waning crescent ghostly trace',
      'disappearing crescent moon pre-dawn whisper',
    ],
  },
];

export function getMoonPhase(date?: Date): MoonPhaseInfo {
  const now = date ?? new Date();
  const nowDays = now.getTime() / 86_400_000;
  const daysSinceRef = nowDays - REFERENCE_NEW_MOON_DAYS;
  const dayInCycle = ((daysSinceRef % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;

  for (const phase of MOON_PHASES) {
    if (dayInCycle < phase.maxDay) {
      const dayOfYear = Math.floor(daysSinceRef);
      const idx = Math.abs(dayOfYear) % phase.phrases.length;
      return {
        name: phase.name,
        emoji: phase.emoji,
        promptPhrase: phase.phrases[idx]!,
        dayInCycle,
      };
    }
  }

  const last = MOON_PHASES[MOON_PHASES.length - 1]!;
  return { name: last.name, emoji: last.emoji, promptPhrase: last.phrases[0]!, dayInCycle };
}
