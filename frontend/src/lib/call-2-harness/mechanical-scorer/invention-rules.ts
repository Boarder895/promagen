// src/lib/call-2-harness/mechanical-scorer/invention-rules.ts
// ============================================================================
// Call 2 Quality Harness — Invention & Semantic Drift Rules (Phase B)
// ============================================================================
// Conservative mechanical rules for Aim 5. These rules only fire on clear,
// high-signal cases so they do not swamp the scorer with false positives.
// Where the scene truth is incomplete, rules bias towards PASS rather than
// guessing. Gold-review and later judged scoring can handle the ambiguous
// edge cases.
//
// Rule coverage:
//   T3.no_new_object_invention
//   T4.no_new_object_invention
//   T3.no_new_setting_invention
//   T4.no_new_setting_invention
//   T3.no_new_style_invention
//   T4.no_new_style_invention
//   T3.verb_fidelity_guard
//   T4.verb_fidelity_guard
//   T3.mood_fidelity_guard
//   T4.mood_fidelity_guard
//   T3.specific_meaning_preserved
//   T4.specific_meaning_preserved
//
// Authority: api-call-2-v2_1_0.md Aim 5
// Existing features preserved: Yes.
// ============================================================================

import type {
  RuleCheckOutput,
  RuleContext,
  RuleDefinition,
  TierBundle,
} from "./types";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "that",
  "this",
  "these",
  "those",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "from",
  "with",
  "into",
  "onto",
  "over",
  "under",
  "through",
  "across",
  "between",
  "among",
  "near",
  "beside",
  "behind",
  "beyond",
  "within",
  "without",
  "while",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "its",
  "their",
  "his",
  "her",
  "them",
  "they",
  "he",
  "she",
  "you",
  "your",
  "our",
  "we",
  "i",
  "me",
  "my",
  "one",
  "two",
  "three",
  "four",
  "five",
  "still",
  "very",
  "more",
  "most",
  "less",
  "least",
  "full",
  "clear",
  "clean",
  "sharp",
  "defined",
  "bright",
  "dark",
  "cold",
  "warm",
  "cool",
  "soft",
  "hard",
  "neutral",
  "strong",
  "restrained",
  "plain",
  "natural",
  "realism",
  "realistic",
  "photorealistic",
  "detailed",
  "detail",
  "cinematic",
  "composition",
  "scene",
  "image",
  "view",
  "frame",
  "foreground",
  "background",
  "distance",
  "readable",
  "visible",
  "vivid",
  "balanced",
  "professional",
]);

const STYLE_CUES = [
  "cinematic",
  "painterly",
  "surreal",
  "fantasy",
  "dreamlike",
  "ethereal",
  "moody",
  "noir",
  "heroic",
  "glamour",
  "glamorous",
  "epic",
  "stylised",
  "stylized",
  "illustrative",
  "watercolour",
  "watercolor",
  "oil painting",
  "anime",
  "comic-book",
  "comic book",
  "retro-futurist",
  "cyberpunk",
  "romanticised",
  "romanticized",
] as const;

const SETTING_TERMS = [
  "city",
  "street",
  "forest",
  "desert",
  "beach",
  "mountain",
  "ocean",
  "sea",
  "harbour",
  "harbor",
  "warehouse",
  "cathedral",
  "station",
  "platform",
  "bridge",
  "market",
  "workshop",
  "factory",
  "plant",
  "reef",
  "cosmodrome",
  "square",
  "bookshop",
  "alley",
  "village",
  "shore",
  "cliff",
  "mine",
  "forge",
  "studio",
  "hangar",
  "airport",
  "farm",
  "field",
  "jungle",
  "meadow",
  "castle",
  "palace",
  "office",
  "classroom",
  "hospital",
  "laboratory",
] as const;

const MOOD_TERMS = [
  "joyful",
  "playful",
  "solemn",
  "grim",
  "bleak",
  "eerie",
  "tense",
  "calm",
  "peaceful",
  "wistful",
  "melancholic",
  "ominous",
  "menacing",
  "romantic",
  "heroic",
  "serene",
  "hopeful",
  "desperate",
  "hostile",
  "sacred",
  "defiant",
] as const;

const OBJECT_TERMS = [
  "rocket",
  "dog",
  "cat",
  "bird",
  "pigeon",
  "pigeons",
  "horse",
  "helmet",
  "sword",
  "umbrella",
  "car",
  "tram",
  "train",
  "boat",
  "ship",
  "helicopter",
  "aircraft",
  "crane",
  "tractor",
  "rifle",
  "gun",
  "book",
  "lamp",
  "lantern",
  "chair",
  "table",
  "tower",
  "lighthouse",
  "signal",
  "lever",
  "anvil",
  "cello",
  "violin",
  "camera",
  "flowers",
  "tree",
  "window",
  "doorway",
] as const;

const SALIENT_VERBS = [
  "stand",
  "standing",
  "stands",
  "sit",
  "sitting",
  "sits",
  "walk",
  "walking",
  "walks",
  "run",
  "running",
  "runs",
  "ride",
  "riding",
  "rides",
  "pedal",
  "pedalling",
  "pedals",
  "drive",
  "driving",
  "drives",
  "glide",
  "gliding",
  "glides",
  "float",
  "floating",
  "floats",
  "step",
  "stepping",
  "steps",
  "hold",
  "holding",
  "holds",
  "reach",
  "reaching",
  "reaches",
  "feed",
  "feeding",
  "feeds",
  "rescue",
  "rescuing",
  "rescues",
  "burn",
  "burning",
  "burns",
  "hammer",
  "hammering",
  "hammers",
  "pour",
  "pouring",
  "pours",
  "squeeze",
  "squeezing",
  "squeezes",
  "tumble",
  "tumbling",
  "tumbles",
  "flow",
  "flowing",
  "flows",
  "separate",
  "separating",
  "separates",
  "whip",
  "whipping",
  "whips",
  "sweep",
  "sweeping",
  "sweeps",
  "reflect",
  "reflecting",
  "reflects",
] as const;

const GENERIC_COLOUR_UMBRELLA = new Set([
  "colourful",
  "colorful",
  "colours",
  "colors",
]);

const SPECIFIC_COLOUR_WORDS = [
  "purple",
  "violet",
  "crimson",
  "copper",
  "gold",
  "golden",
  "silver",
  "orange",
  "magenta",
  "cyan",
  "blue",
  "red",
  "green",
  "yellow",
] as const;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function words(text: string): string[] {
  return normalise(text)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function stem(word: string): string {
  let next = normalise(word);
  if (next.endsWith("ing") && next.length > 5) next = next.slice(0, -3);
  else if (next.endsWith("ed") && next.length > 4) next = next.slice(0, -2);
  else if (next.endsWith("es") && next.length > 4) next = next.slice(0, -2);
  else if (next.endsWith("s") && next.length > 3) next = next.slice(0, -1);
  return next;
}

function tierText(bundle: TierBundle, tier: 3 | 4): string {
  return tier === 3 ? bundle.tier3.positive : bundle.tier4.positive;
}

function approvedTexts(ctx: RuleContext): readonly string[] {
  return [
    ctx.input,
    ...(ctx.expectedElements ?? []),
    ...(ctx.primarySubject ? [ctx.primarySubject] : []),
    ...(ctx.criticalAnchors ?? []),
    ...(ctx.secondaryAnchors ?? []),
  ];
}

function buildApprovedLexicon(ctx: RuleContext): Set<string> {
  const out = new Set<string>();
  for (const text of approvedTexts(ctx)) {
    for (const word of words(text)) {
      if (word.length <= 2 || STOPWORDS.has(word)) continue;
      out.add(stem(word));
    }
  }
  return out;
}

function phrasePresent(text: string, phrase: string): boolean {
  const haystack = normalise(text);
  const needle = normalise(phrase);
  if (!needle) return false;
  return haystack.includes(needle);
}

function ok(
  details?: string,
  evidence?: Readonly<Record<string, unknown>>,
): RuleCheckOutput {
  return {
    passed: true,
    ...(details ? { details } : {}),
    ...(evidence ? { evidence } : {}),
  };
}

function fail(
  details: string,
  reviewHint: string,
  evidence?: Readonly<Record<string, unknown>>,
): RuleCheckOutput {
  return {
    passed: false,
    details,
    reviewHint,
    ...(evidence ? { evidence } : {}),
  };
}

function findForbiddenHits(text: string, ctx: RuleContext): string[] {
  const hits: string[] = [];
  for (const phrase of ctx.forbiddenPositiveInventions ?? []) {
    if (phrasePresent(text, phrase)) hits.push(phrase);
  }
  return hits;
}

function findUnexpectedFromList(
  text: string,
  ctx: RuleContext,
  terms: readonly string[],
): string[] {
  const approved = buildApprovedLexicon(ctx);
  const outputWords = new Set(words(text).map(stem));
  const hits: string[] = [];

  for (const term of terms) {
    const termStem = stem(term);
    if (outputWords.has(termStem) && !approved.has(termStem)) {
      hits.push(term);
    }
  }

  return hits;
}

function findUnexpectedStyleCues(text: string, ctx: RuleContext): string[] {
  const source = normalise(approvedTexts(ctx).join(" "));
  const output = normalise(text);
  const hits: string[] = [];

  for (const cue of STYLE_CUES) {
    const normalisedCue = normalise(cue);
    if (output.includes(normalisedCue) && !source.includes(normalisedCue)) {
      hits.push(cue);
    }
  }

  return hits;
}

function findSourceVerbs(ctx: RuleContext): string[] {
  const sourceWords = new Set(words(approvedTexts(ctx).join(" ")).map(stem));
  return SALIENT_VERBS.filter((verb) => sourceWords.has(stem(verb)));
}

function findOutputVerbs(text: string): Set<string> {
  return new Set(words(text).map(stem));
}

function significantSpecificAnchors(ctx: RuleContext): readonly string[] {
  const anchors = [
    ...(ctx.criticalAnchors ?? []),
    ...(ctx.secondaryAnchors ?? []),
  ];
  return anchors.filter((anchor) => {
    const anchorWords = words(anchor);
    if (anchorWords.length >= 3) return true;
    if (
      anchorWords.some((word) =>
        SPECIFIC_COLOUR_WORDS.includes(
          word as (typeof SPECIFIC_COLOUR_WORDS)[number],
        ),
      )
    ) {
      return true;
    }
    if (anchor.includes("-")) return true;
    return false;
  });
}

function specificAnchorLost(anchor: string, text: string): boolean {
  const normalisedText = normalise(text);
  const normalisedAnchor = normalise(anchor);

  if (normalisedText.includes(normalisedAnchor)) return false;

  const anchorWords = words(anchor);
  const specificColourCount = anchorWords.filter((word) =>
    SPECIFIC_COLOUR_WORDS.includes(
      word as (typeof SPECIFIC_COLOUR_WORDS)[number],
    ),
  ).length;

  const outputWords = words(text);
  const outputSpecificColours = outputWords.filter((word) =>
    SPECIFIC_COLOUR_WORDS.includes(
      word as (typeof SPECIFIC_COLOUR_WORDS)[number],
    ),
  );
  const hasGenericColourUmbrella = outputWords.some((word) =>
    GENERIC_COLOUR_UMBRELLA.has(word),
  );

  if (specificColourCount >= 2 && hasGenericColourUmbrella) {
    return true;
  }
  if (specificColourCount >= 1 && outputSpecificColours.length === 0) {
    return true;
  }

  const anchorStemSet = new Set(
    anchorWords.map(stem).filter((word) => !STOPWORDS.has(word)),
  );
  if (anchorStemSet.size === 0) return false;

  const outputStemSet = new Set(outputWords.map(stem));
  let matchCount = 0;

  for (const token of anchorStemSet) {
    if (outputStemSet.has(token)) matchCount += 1;
  }

  return matchCount < Math.min(anchorStemSet.size, 2);
}

function makeObjectRule(tier: 3 | 4): RuleDefinition {
  return {
    id: `T${tier}.no_new_object_invention`,
    tier,
    cluster: "content_fidelity_loss",
    description:
      "Do not introduce clear new positive objects not present in the approved input.",
    check(bundle, ctx) {
      const text = tierText(bundle, tier);
      const forbiddenHits = findForbiddenHits(text, ctx);
      const objectHits = findUnexpectedFromList(text, ctx, OBJECT_TERMS);
      const offenders = [...new Set([...forbiddenHits, ...objectHits])];

      if (offenders.length === 0) return ok();

      return fail(
        `Possible invented objects: ${offenders.slice(0, 4).join(", ")}`,
        "Check whether the output introduced a concrete object not approved by the user.",
        { offenders, tier },
      );
    },
  };
}

function makeSettingRule(tier: 3 | 4): RuleDefinition {
  return {
    id: `T${tier}.no_new_setting_invention`,
    tier,
    cluster: "content_fidelity_loss",
    description:
      "Do not introduce a new setting or location not present in the approved input.",
    check(bundle, ctx) {
      const text = tierText(bundle, tier);
      const offenders = findUnexpectedFromList(text, ctx, SETTING_TERMS);

      if (offenders.length === 0) return ok();

      return fail(
        `Possible invented setting cues: ${offenders.slice(0, 4).join(", ")}`,
        "Check whether the output relocated the scene or added a new place cue.",
        { offenders, tier },
      );
    },
  };
}

function makeStyleRule(tier: 3 | 4): RuleDefinition {
  return {
    id: `T${tier}.no_new_style_invention`,
    tier,
    cluster: "value_add_filler",
    description:
      "Do not add new style or composition cues that were not approved in the input.",
    check(bundle, ctx) {
      const text = tierText(bundle, tier);
      const offenders = findUnexpectedStyleCues(text, ctx);

      if (offenders.length === 0) return ok();

      return fail(
        `Possible invented style cues: ${offenders.slice(0, 4).join(", ")}`,
        "Check whether the tier added a new style or mood label that the user did not provide.",
        { offenders, tier },
      );
    },
  };
}

function makeVerbRule(tier: 3 | 4): RuleDefinition {
  return {
    id: `T${tier}.verb_fidelity_guard`,
    tier,
    cluster: "content_fidelity_loss",
    description: "Key user actions should survive in recognisable verb form.",
    check(bundle, ctx) {
      const sourceVerbs = findSourceVerbs(ctx);
      if (sourceVerbs.length === 0) return ok();

      const outputVerbs = findOutputVerbs(tierText(bundle, tier));
      const missing = sourceVerbs.filter(
        (verb) => !outputVerbs.has(stem(verb)),
      );

      if (missing.length === 0) return ok();

      if (sourceVerbs.length === 1) {
        return fail(
          `Primary action not recognisable: missing ${missing[0]}`,
          "Check whether the main action was weakened or lost during compression.",
          { sourceVerbs, outputVerbs: [...outputVerbs], tier },
        );
      }

      if (missing.length >= Math.ceil(sourceVerbs.length / 2)) {
        return fail(
          `Multiple source actions missing: ${missing.slice(0, 4).join(", ")}`,
          "Check whether the output preserved the user’s action chain.",
          { sourceVerbs, outputVerbs: [...outputVerbs], tier },
        );
      }

      return ok();
    },
  };
}

function makeMoodRule(tier: 3 | 4): RuleDefinition {
  return {
    id: `T${tier}.mood_fidelity_guard`,
    tier,
    cluster: "content_fidelity_loss",
    description:
      "Do not replace the approved emotional tone with a conflicting one.",
    check(bundle, ctx) {
      const source = normalise(approvedTexts(ctx).join(" "));
      const output = normalise(tierText(bundle, tier));

      const sourceMood = MOOD_TERMS.filter((term) => source.includes(term));
      if (sourceMood.length === 0) return ok();

      const outputMood = MOOD_TERMS.filter((term) => output.includes(term));
      if (outputMood.length === 0) return ok();

      const missing = sourceMood.filter((term) => !outputMood.includes(term));
      const invented = outputMood.filter((term) => !sourceMood.includes(term));

      if (missing.length === 0 && invented.length === 0) return ok();

      return fail(
        `Mood drift detected: missing ${missing.join(", ") || "none"} | invented ${invented.join(", ") || "none"}`,
        "Check whether the emotional tone stayed aligned to the approved input.",
        { sourceMood, outputMood, tier },
      );
    },
  };
}

function makeSpecificMeaningRule(tier: 3 | 4): RuleDefinition {
  return {
    id: `T${tier}.specific_meaning_preserved`,
    tier,
    cluster: "content_fidelity_loss",
    description:
      "Specific multi-word anchors should not collapse into vague umbrella wording.",
    check(bundle, ctx) {
      const anchors = significantSpecificAnchors(ctx);
      if (anchors.length === 0) return ok();

      const text = tierText(bundle, tier);
      const lost = anchors.filter((anchor) => specificAnchorLost(anchor, text));

      if (lost.length === 0) return ok();

      return fail(
        `Specific anchors weakened or lost: ${lost.slice(0, 3).join(" | ")}`,
        "Check whether a specific phrase was flattened into generic wording.",
        { lost, tier },
      );
    },
  };
}

export const INVENTION_RULES: readonly RuleDefinition[] = Object.freeze([
  makeObjectRule(3),
  makeObjectRule(4),
  makeSettingRule(3),
  makeSettingRule(4),
  makeStyleRule(3),
  makeStyleRule(4),
  makeVerbRule(3),
  makeVerbRule(4),
  makeMoodRule(3),
  makeMoodRule(4),
  makeSpecificMeaningRule(3),
  makeSpecificMeaningRule(4),
]);
