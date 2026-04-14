// src/lib/call-2-harness/mechanical-scorer/coverage-rules.ts
// ============================================================================
// Call 2 Quality Harness — Input Element Coverage Rules (v1.2)
// ============================================================================
// Tests whether user-provided visual elements survive in tier outputs.
// Cluster: content_fidelity_loss
//
// v1.2: Tightened coverage matching for Batch 2.
//       - Added wider conversion/paraphrase equivalents for canonical scenes
//       - Applies fuzzy matching to equivalents, not just exact substrings
//       - Reduces false negatives where GPT preserves the visual but changes the phrasing
//
// v1.1: Added conversion equivalents map so coverage checker recognises
//       photography jargon that was correctly converted by
//       convertPhotographyJargonTierAware() in harmony-post-processing.ts.
//       Without this, converted terms register as "missing" — a false negative
//       that inflates BORDERLINE counts on technical scenes like Trafalgar Sq.
//
// v1.0: Basic substring + stem matching. Scenes must have `expected_elements`
// annotated in scenes.json — scenes without annotations skip these rules.
//
// Thresholds (per ChatGPT analysis, 12 Apr 2026):
//   T3: fail below 80% coverage
//   T4: fail below 75% coverage
//   T1: fail below 65% coverage (deferred — T1 has known P14 fragmentation)
//
// Authority: chatgpt-p14-and-coverage-brief.md §6
// ============================================================================

import type { RuleDefinition } from './types';

const CONVERSION_EQUIVALENTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['deep focus', ['sharp from foreground to distance', 'sharp front to back', 'sharp throughout', 'everything in focus', 'full depth', 'full-scene clarity', 'front-to-back clarity', 'clear from foreground to distance', 'the whole square stays clear', 'the whole square stays sharp', 'sharp from near to far', 'everything sharp from near to far', 'everything sharp from front to back', 'distance stays clear', 'distance stays sharp']],
  ['shallow depth of field', ['the subject stays crisp while the background falls softly away', 'soft background', 'blurred background', 'bokeh', 'very blurry background', 'softly blurred background']],
  ['moderate depth of field', ['the focal point is clear with gentle softening beyond it', 'gentle background softening', 'moderate background softening with a sense of depth', 'moderate background softening', 'slightly blurred background', 'softening beyond the focal point']],
  ['sharp focus', ['edges and textures resolve clearly', 'clear detail', 'crisp detail', 'sharp detail', 'very sharp', 'clean sharp detail', 'clear sharp detail']],
  ['background in sharp focus', ['sharp from foreground to distance', 'sharp front to back', 'distant detail remains clearly legible', 'clear distance detail', 'edges and textures resolve clearly', 'clear detail', 'everything in focus', 'background clarity', 'full depth', 'everything sharp from near to far', 'everything sharp from front to back', 'facades stay sharp', 'the facades stay sharp', 'distance stays sharp', 'background stays clear', 'background stays sharp']],
  ['keeping the background crisp', ['distant detail remains clearly legible', 'clear distance detail', 'background stays crisp']],
  ['24mm lens', ['an expansive wide-angle view pulling the whole scene in', 'wide-angle view taking in the whole scene', 'wide-angle view', 'expansive wide-angle', '24mm view']],
  ['35mm lens', ['a natural wide view with honest spatial proportions', 'a natural wide view', 'natural wide view', 'wide-angle', 'wide angle', 'moderate wide-angle', 'spatial realism', '35mm view', 'natural 35mm view', 'through a 35mm view', 'through a wide natural frame']],
  ['50mm lens', ['a natural human-eye perspective', 'natural perspective like your own eyes see it', 'natural perspective', 'human-eye perspective', '50mm view']],
  ['85mm lens', ['a tighter compressed view that isolates the subject', 'a tighter compressed view', 'tighter compressed view', 'compressed perspective', 'portrait lens', 'zoomed-in portrait view that isolates the subject', 'zoomed-in portrait view', '85mm view']],
  ['f/1.2', ['extremely shallow focus with dreamlike separation from the background', 'extremely shallow focus with dreamlike separation', 'dreamlike separation', 'very blurry background with the subject standing out sharply', 'very blurry background']],
  ['f/1.4', ['soft background separation melting detail behind the subject', 'soft background separation', 'background separation', 'wide aperture', 'shallow focus', 'bokeh', 'very blurry background with the subject standing out sharply', 'very blurry background', 'soft distance', 'softly blurred distance']],
  ['f/1.8', ['gentle background softening', 'softly blurred background', 'soft blurry background']],
  ['f/2.8', ['moderate background softening with a sense of depth', 'moderate background softening', 'slightly blurred background']],
  ['Leica SL2-S', ['rendered with clinical sharpness, natural colour and fine micro-contrast', 'clinical sharpness', 'natural colour', 'micro-contrast', 'very sharp with natural lifelike colours', 'natural lifelike colours', 'pristine detail', 'tonal richness', 'rich tonal depth', 'through a wide natural frame with clinical sharpness and rich tonal depth', 'leica-like clarity', 'premium clarity']],
  ['Canon EOS R5', ['captured with warm natural colour and smooth skin-like rendering', 'warm natural colour', 'sharp with warm natural colours']],
  ['Nikon Z7', ['rendered with neutral precision and strong tonal range', 'neutral precision', 'sharp with smooth even tones']],
  ['Sony A7R IV', ['with saturated vivid colour and razor-fine detail', 'vivid colour', 'bright vivid colours with very fine detail']],
  ['Hasselblad', ['with medium-format depth, vast tonal range and quiet naturalistic colour', 'medium-format depth', 'extraordinarily detailed with rich subtle tones', 'vast tonal range']],
  ['ISO 100', ['clean grain-free detail with smooth shadow transitions', 'clean grain-free detail', 'clean smooth image with no grain', 'smooth clean image']],
  ['ISO 3200', ['visible grain lending a raw documentary texture', 'slightly grainy with a film-like feel', 'grainy film-like texture', 'documentary texture']],
  ['balanced colors', ['balanced colours', 'color balance', 'colour balance', 'natural color', 'natural colour', 'even color', 'even colour', 'harmonious tones', 'balanced tones', 'balanced palette', 'balanced colour palette']],
  ['balanced colours', ['balanced colors', 'color balance', 'colour balance', 'natural color', 'natural colour', 'even color', 'even colour', 'harmonious tones', 'balanced tones', 'balanced palette', 'balanced color palette']],
  ['pavement-to-facade depth', ['ground to building', 'street to facade', 'pavement to facade', 'foreground to background', 'street-level depth', 'full depth', 'spatial depth', 'sharp depth from rain-slicked stone to distant facades', 'from stone to', 'from pavement to', 'from ground to', 'from the pavement to the facades']],
  ['diffused air', ['softly diffused', 'diffused light', 'soft air', 'hazy air', 'thick air', 'atmospheric haze', 'misty air', 'humid air', 'soft atmosphere', 'diffused atmosphere', 'soft haze', 'softened by humid air']],
  ['humid summer night', ['humid night', 'humid evening', 'summer night', 'summer evening', 'warm night', 'warm humid', 'thick night air', 'heavy summer air', 'muggy', 'humid summer', 'muggy summer night', 'humid evening air']],
  ['wide open square', ['open square', 'wide square', 'expansive square', 'broad square', 'open plaza', 'wide plaza', 'the square stretches', 'square opens', 'the wide square']],
  ['south-westerly breeze', ['light breeze', 'breeze stirring', 'a light breeze stirring', 'dust skittering', 'dust blows', 'gentle breeze', 'breeze', 'wind stirring', 'wind moves the dust', 'dust skitters in a breeze', 'southwesterly breeze']],
  ['warm streetlamps', ['warm lamps', 'warm streetlamps', 'warm lamp glow', 'amber streetlamps', 'amber lamps']],
  ['cool streetlamps', ['cool lamps', 'cool streetlamps', 'cool lamp glow', 'cold streetlamps', 'blue-white streetlamps']],
  ['wet pavement', ['wet stone', 'wet ground', 'rain-slick pavement', 'slick pavement', 'wet paving']],
  ['feeding', ['tossing', 'offering', 'scattering crumbs', 'throwing bread', 'holding out', 'crumbs', 'bread', 'breadcrumbs']],
  ['breadcrumbs', ['bread crumbs', 'crumbs', 'scattered crumbs', 'throwing bread']],
  ['scattered birds', ['birds', 'pigeons', 'flock', 'flutter', 'fluttering', 'pigeons scatter', 'birds scatter', 'birds take flight', 'pigeons flock']],
  ['cobblestones', ['cobbled', 'stone ground', 'paving stones', 'paved', 'flagstones', 'stone path', 'stone paving']],
  ['city square', ['square', 'public square', 'open square', 'civic square']],
  ['pale stone paving', ['stone paving', 'pale paving', 'pale stone', 'stone ground', 'paving stones']],
  ['cool morning light', ['morning light', 'cool light', 'early light', 'soft early light', 'cool dawn light']],
  ['chrome', ['metallic', 'gleaming metal', 'polished metal', 'metal trim', 'bumper', 'gleaming', 'shining metal']],
  ['open road', ['highway', 'road stretching', 'endless road', 'empty road', 'long road', 'road ahead', 'road disappearing', 'straight road']],
  ['warm sky', ['golden sky', 'amber sky', 'sunset sky', 'orange sky', 'warm-toned sky', 'glowing sky', 'warm horizon', 'sunset glow']],
  ['Route 66 diner', ['route 66', 'roadside diner', 'diner', 'route 66 stop']],
  ['desert horizon', ['desert', 'flat horizon', 'horizon', 'desert backdrop']],
  ['heat haze', ['haze', 'hot haze', 'shimmering heat', 'heat shimmer']],
  ['neon signs', ['neon', 'neon glow', 'neon light', 'electric signs', 'glowing signs', 'illuminated signs', 'bright signage']],
  ['cloud bands', ['clouds', 'cloud formations', 'cloud layers', 'swirling clouds', 'cloud patterns', 'atmospheric bands']],
  ['sun glare', ['sunlight', 'glare', 'lens flare', 'sun flash', 'bright flash', 'light flash', 'blinding light']],
  ['visor', ['helmet visor', 'face shield', 'reflective visor', 'helmet', 'faceplate']],
  ['white highlights', ['highlights', 'bright highlights', 'hard light', 'bright white', 'white light', 'catching light', 'lit edges']],
  ['dust motes', ['dust', 'floating dust', 'particles', 'motes', 'dust particles', 'specks of dust']],
  ['shaft of light', ['beam of light', 'light beam', 'shaft of sunlight', 'ray of light', 'light ray', 'sunbeam', 'column of light', 'light streaming', 'light cutting', 'light falling']],
  ['golden light', ['gold light', 'warm light', 'dying golden light', 'golden glow']],
  ['crumbling pews', ['pews', 'broken pews', 'old pews', 'decayed pews', 'wooden pews', 'rotting pews', 'ruined pews']],
  ['collapsed stonework', ['broken stonework', 'fallen stonework', 'ruined stonework', 'collapsed masonry']],
  ['shattered rose windows', ['rose windows', 'shattered windows', 'broken stained glass', 'stained glass']],
  ['cracked marble floor', ['cracked marble', 'marble floor', 'cracked floor', 'marble tiles']],
  ['morning light', ['dawn light', 'early light', 'first light', 'soft morning', 'daybreak', 'morning sun']],
  ['robes', ['robe', 'saffron robe', 'orange robe', 'monk robe', 'flowing robe', 'cloth', 'garment']],
  ['lotus position', ['cross-legged', 'cross legged', 'seated in lotus', 'meditative pose']],
  ['moss-dark walls', ['moss-dark wall', 'dark walls', 'mossy walls', 'weathered walls', 'stone walls']],
  ['purple-and-copper sky', ['purple sky', 'copper sky', 'purple and copper', 'warm-toned sky', 'dusky sky', 'twilight sky', 'violet sky', 'mauve sky']],
  ['fishing village', ['village', 'distant village', 'harbour village', 'cliffside village']],
  ['orange windows', ['warm windows', 'glowing windows', 'orange-lit windows', 'lit windows']],
  ['dark cliffs', ['cliffs', 'black cliffs', 'shadowed cliffs', 'dark rock face']],
  ['Pont des Arts', ['paris bridge', 'bridge in paris', 'footbridge', 'pedestrian bridge']],
  ['river', ['seine', 'water', 'dark river', 'river below']],
  ['warm city lights', ['warm lights', 'city lights', 'warm streetlights', 'glowing embankment lights']],
  ['breeze-lifted coat', ['coat edge lifts', 'coat lifts in the breeze', 'coat caught by the breeze', 'breeze lifts the coat']],
  ['rippling reflections', ['reflections ripple', 'water reflections', 'ripples under the bridge', 'rippled reflections']],
  ['stacked novels', ['stacked books', 'book stacks', 'piles of novels', 'novels']],
  ['wooden shelves', ['worn wooden shelves', 'wood shelves', 'shelves', 'timber shelves']],
  ['steaming mug', ['steaming cup', 'mug', 'hot drink', 'warm mug']],
  ['fish', ['small fish', 'schools of fish', 'shoals of fish', 'fish flicker']],
  ['blue depth', ['blue water', 'deep blue', 'blue ocean depth', 'blue underwater depth']],
  ['reds', ['red coral', 'red tones', 'saturated reds']],
  ['golds', ['gold coral', 'gold tones', 'saturated golds']],
  ['turquoise', ['turquoise water', 'turquoise coral', 'blue-green']],
]);

function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  if (w.endsWith('es') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 3) w = w.slice(0, -1);
  return w;
}

function phraseSurvives(phrase: string, output: string): boolean {
  const lowerOutput = output.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();

  if (lowerOutput.includes(lowerPhrase)) return true;

  const dehyphenated = lowerPhrase.replace(/-/g, ' ');
  if (lowerOutput.includes(dehyphenated)) return true;

  const rehyphenated = lowerPhrase.replace(/\s+/g, '-');
  if (lowerOutput.includes(rehyphenated)) return true;

  const phraseWords = lowerPhrase.split(/[\s-]+/).filter((w) => w.length > 2).map(stem);
  if (phraseWords.length === 0) return false;

  const outputStems = lowerOutput.split(/[\s,.:;!?()"']+/).filter(Boolean).map(stem);
  return phraseWords.every((pw) => outputStems.some((os) => os === pw || os.includes(pw) || pw.includes(os)));
}

function elementSurvives(element: string, output: string): boolean {
  if (phraseSurvives(element, output)) return true;

  const equivalents = CONVERSION_EQUIVALENTS.get(element) ?? CONVERSION_EQUIVALENTS.get(element.toLowerCase());
  if (!equivalents) return false;

  return equivalents.some((equiv) => phraseSurvives(equiv, output));
}

function checkCoverage(expectedElements: readonly string[], tierOutput: string): { covered: number; total: number; missing: string[]; coverageRate: number } {
  const missing: string[] = [];
  for (const el of expectedElements) {
    if (!elementSurvives(el, tierOutput)) missing.push(el);
  }

  const covered = expectedElements.length - missing.length;
  const coverageRate = expectedElements.length > 0 ? covered / expectedElements.length : 1;
  return { covered, total: expectedElements.length, missing, coverageRate };
}

export const COVERAGE_RULES: readonly RuleDefinition[] = Object.freeze([
  {
    id: 'T3.input_element_coverage',
    tier: 3,
    cluster: 'content_fidelity_loss',
    description: 'T3 must preserve ≥80% of user-provided visual elements. Skips scenes without expected_elements annotation.',
    check(bundle, ctx) {
      if (!ctx.expectedElements || ctx.expectedElements.length === 0) return { passed: true };
      const result = checkCoverage(ctx.expectedElements, bundle.tier3.positive);
      if (result.coverageRate < 0.8) {
        return {
          passed: false,
          details: `T3 element coverage ${Math.round(result.coverageRate * 100)}% (${result.covered}/${result.total}). Missing: ${result.missing.join(', ')}`,
        };
      }
      return {
        passed: true,
        details: result.missing.length > 0 ? `T3 coverage ${Math.round(result.coverageRate * 100)}% — missing: ${result.missing.join(', ')}` : undefined,
      };
    },
  },
  {
    id: 'T4.input_element_coverage',
    tier: 4,
    cluster: 'content_fidelity_loss',
    description: 'T4 must preserve ≥75% of user-provided visual elements. Skips scenes without expected_elements annotation.',
    check(bundle, ctx) {
      if (!ctx.expectedElements || ctx.expectedElements.length === 0) return { passed: true };
      const result = checkCoverage(ctx.expectedElements, bundle.tier4.positive);
      if (result.coverageRate < 0.75) {
        return {
          passed: false,
          details: `T4 element coverage ${Math.round(result.coverageRate * 100)}% (${result.covered}/${result.total}). Missing: ${result.missing.join(', ')}`,
        };
      }
      return {
        passed: true,
        details: result.missing.length > 0 ? `T4 coverage ${Math.round(result.coverageRate * 100)}% — missing: ${result.missing.join(', ')}` : undefined,
      };
    },
  },
]);
