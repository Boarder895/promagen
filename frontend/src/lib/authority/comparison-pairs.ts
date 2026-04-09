// src/lib/authority/comparison-pairs.ts
// ============================================================================
// COMPARISON PAIRS — EDITORIAL DATA FOR PRE-RENDERED PAIR PAGES
// ============================================================================
// Defines the 8 highest-volume "X vs Y" pairs with editorial content that
// is NOT derivable from platform-config.json. Platform facts (tier, limits,
// negative support) are fetched from the SSOT at render time; this module
// supplies the editorial layer: key differences, workflow guidance, and FAQ.
//
// RULES:
//   - Slugs are URL-safe and match the spec exactly
//   - Platform IDs validated against SSOT at module load (build-time guard)
//   - Key differences: 40–60 words, factual, citation-ready
//   - Zero subjective superlatives ("amazing", "incredible")
//   - Zero presentation coupling (no CSS, no colours)
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 3
// ============================================================================

import { getAuthorityPlatformIds } from './platform-data';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ComparisonPair {
  /** URL slug, e.g. "midjourney-vs-dalle" */
  slug: string;
  /** Platform A id (matches platform-config.json) */
  platformAId: string;
  /** Platform B id (matches platform-config.json) */
  platformBId: string;
  /** Factual, citation-ready summary — 40–60 words */
  keyDifference: string;
  /** Decision-grade one-liner: "Choose A when X. Choose B when Y." */
  chooseWhen: string;
  /** Practical guidance for choosing between them */
  workflowGuidance: string;
  /** FAQ entries for schema.org FAQPage */
  faq: { question: string; answer: string }[];
}

// ─── Editorial data ────────────────────────────────────────────────────────

export const COMPARISON_PAIRS: ComparisonPair[] = [
  {
    slug: 'midjourney-vs-dalle',
    platformAId: 'midjourney',
    platformBId: 'openai',
    keyDifference:
      'Midjourney (Tier 2) uses keyword-based prompts with :: weighting and --no flags for negative prompts. DALL\u00b7E 3 (Tier 3) reads natural language sentences and has no negative prompt support. The same creative intent requires fundamentally different prompt formats for each platform.',
    chooseWhen:
      'Choose Midjourney when you need precise keyword weighting and atmospheric stylisation. Choose DALL\u00b7E 3 when you want conversational prompts with strong multi-part instruction following.',
    workflowGuidance:
      'Choose Midjourney for stylised compositions where precise control over weighting and exclusions matters. Choose DALL\u00b7E 3 when you want to describe scenes conversationally without learning special syntax. Promagen formats your selections into the correct structure for whichever platform you pick.',
    faq: [
      {
        question: 'Which is better, Midjourney or DALL-E?',
        answer: 'They excel at different things. Midjourney produces outstanding atmospheric and cinematic compositions using keyword-weighted prompts. DALL\u00b7E 3 handles conversational descriptions and follows complex multi-part instructions well. The best choice depends on your prompt style and creative goals.',
      },
      {
        question: 'Can I use the same prompts for Midjourney and DALL-E?',
        answer: 'Not effectively. Midjourney uses keyword weighting (::) and --no flags that DALL\u00b7E 3 ignores. DALL\u00b7E 3 reads natural sentences that Midjourney interprets less precisely. Writing in the correct format for each platform produces significantly better results.',
      },
    ],
  },
  {
    slug: 'midjourney-vs-flux',
    platformAId: 'midjourney',
    platformBId: 'flux',
    keyDifference:
      'Midjourney (Tier 2) accepts keyword-weighted prompts with :: syntax and inline --no negatives. Flux (Tier 3) uses natural language sentences and does not support negative prompts at all. Midjourney has a 1,000-character limit; Flux allows up to 1,250 characters.',
    chooseWhen:
      'Choose Midjourney when you need keyword weighting control and negative prompt exclusions. Choose Flux when you want natural language descriptions with longer prompt capacity.',
    workflowGuidance:
      'Choose Midjourney for atmospheric, stylised outputs where precise keyword weighting matters. Choose Flux for photorealistic results where natural language descriptions and longer prompts are an advantage. Promagen automatically formats your creative intent for either platform.',
    faq: [
      {
        question: 'What is the main difference between Midjourney and Flux?',
        answer: 'The core difference is prompt architecture. Midjourney reads keyword-weighted prompts with :: syntax and supports negative prompts via --no. Flux reads natural language sentences, supports longer prompts (1,250 chars), and has no negative prompt mechanism.',
      },
      {
        question: 'Does Flux support negative prompts like Midjourney?',
        answer: 'No. Flux does not support negative prompts in any form. Midjourney uses --no flags for exclusions. For Flux, rephrase exclusions as positive instructions \u2014 or use Promagen, which converts negative selections into positive reinforcement automatically.',
      },
    ],
  },
  {
    slug: 'flux-vs-stable-diffusion',
    platformAId: 'flux',
    platformBId: 'stability',
    keyDifference:
      'Flux (Tier 3) uses natural language sentences with no weight syntax or negative prompt support. Stable Diffusion (Tier 1) uses CLIP-tokenised weighted keywords like (term:1.3) with a separate negative prompt field. They represent two fundamentally different approaches to prompt processing.',
    chooseWhen:
      'Choose Flux when you want natural sentence understanding and longer prompts. Choose Stable Diffusion when you need fine-grained keyword weighting and dedicated negative prompts.',
    workflowGuidance:
      'Choose Flux for its natural sentence understanding and longer prompt capacity (1,250 chars). Choose Stable Diffusion for fine-grained control through keyword weighting and dedicated negative prompts. Promagen writes prompts in the correct format for either architecture.',
    faq: [
      {
        question: 'Which is better, Flux or Stable Diffusion?',
        answer: 'They serve different workflows. Flux reads natural sentences and excels at following conversational descriptions. Stable Diffusion gives precise control through keyword weighting (term:1.3) and separate negative prompts. Neither is universally better \u2014 the right choice depends on how much control you need.',
      },
      {
        question: 'Can Flux use weighted keywords like Stable Diffusion?',
        answer: 'No. Flux uses a different text encoder that reads natural language, not CLIP-tokenised keywords. Weight syntax like (term:1.3) is ignored by Flux. Promagen detects the platform type and writes prompts in the correct format automatically.',
      },
    ],
  },
  {
    slug: 'leonardo-vs-ideogram',
    platformAId: 'leonardo',
    platformBId: 'ideogram',
    keyDifference:
      'Leonardo AI (Tier 1) uses CLIP-based weighted keywords with :: syntax and a separate negative prompt field. Ideogram (Tier 3) reads natural language sentences and also has a separate negative prompt field. Both support 1,000-character prompts, but process them through entirely different architectures.',
    chooseWhen:
      'Choose Leonardo when you need CLIP keyword weighting for precise control. Choose Ideogram when you want natural language prompts, especially with text rendering in images.',
    workflowGuidance:
      'Choose Leonardo for detailed control through keyword weighting and CLIP-compatible syntax. Choose Ideogram for natural sentence prompts, especially when text rendering within images matters. Both support negative prompts, so exclusion workflows are similar. Promagen handles the format conversion.',
    faq: [
      {
        question: 'What is the difference between Leonardo AI and Ideogram?',
        answer: 'The main difference is prompt format. Leonardo uses CLIP-based weighted keywords (term::1.3) while Ideogram reads natural language sentences. Both have 1,000-character limits and separate negative prompt fields. Ideogram is particularly strong at rendering text within images.',
      },
      {
        question: 'Do Leonardo and Ideogram both support negative prompts?',
        answer: 'Yes. Both platforms have a separate negative prompt field. The difference is in the main prompt: Leonardo expects weighted keywords, Ideogram expects natural sentences. Promagen writes both formats from the same creative selections.',
      },
    ],
  },
  {
    slug: 'dalle-vs-adobe-firefly',
    platformAId: 'openai',
    platformBId: 'adobe-firefly',
    keyDifference:
      'DALL\u00b7E 3 and Adobe Firefly are both Tier 3 natural language platforms with no negative prompt support. DALL\u00b7E 3 has strong multi-part instruction following via ChatGPT integration. Firefly is trained on licensed content for commercial safety and integrates with Adobe Creative Cloud.',
    chooseWhen:
      'Choose DALL\u00b7E 3 when you need strong instruction following and ChatGPT integration. Choose Adobe Firefly when you need commercially safe outputs and Creative Cloud workflow.',
    workflowGuidance:
      'Choose DALL\u00b7E 3 for strong multi-part instruction following and integration with ChatGPT. Choose Adobe Firefly for commercially safe outputs (trained on licensed content) and integration with the Adobe Creative Cloud ecosystem. Promagen formats prompts correctly for both.',
    faq: [
      {
        question: 'Which is better, DALL-E or Adobe Firefly?',
        answer: 'They target different needs. DALL\u00b7E 3 excels at following complex multi-part instructions and integrates with ChatGPT. Adobe Firefly is trained on licensed content for commercial safety and integrates with Photoshop, Illustrator, and other Adobe tools. Choose based on your workflow.',
      },
      {
        question: 'Does Adobe Firefly support negative prompts?',
        answer: 'Not anymore. Adobe Firefly previously had an "Exclude Image" field under Advanced Settings but explicitly removed it. Neither DALL\u00b7E 3 nor Firefly currently supports negative prompts. Promagen converts exclusion requests into positive reinforcement for both platforms.',
      },
    ],
  },
  {
    slug: 'midjourney-vs-leonardo',
    platformAId: 'midjourney',
    platformBId: 'leonardo',
    keyDifference:
      'Midjourney (Tier 2) uses keyword prompts with :: weighting and --no inline negatives. Leonardo AI (Tier 1) uses CLIP-tokenised (term:1.3) weighting with a separate negative prompt field. Both accept 1,000-character prompts but use different weight syntax and negative prompt mechanisms.',
    chooseWhen:
      'Choose Midjourney when you want atmospheric stylisation through Discord. Choose Leonardo when you need CLIP weighting, a separate negative prompt field, and a web-based UI.',
    workflowGuidance:
      'Choose Midjourney for atmospheric, stylised compositions with Discord-based workflow. Choose Leonardo for fine-grained CLIP weighting, a dedicated negative prompt field, and a web-based UI with multiple model options. Promagen writes the correct syntax for either platform.',
    faq: [
      {
        question: 'What is the difference between Midjourney and Leonardo AI?',
        answer: 'Both use weighted keywords, but with different syntax. Midjourney uses :: weighting and --no for negatives (inline). Leonardo uses (term:1.3) CLIP weighting and a separate negative prompt field. Midjourney is Discord-based; Leonardo has a web UI with multiple model choices.',
      },
      {
        question: 'Can I use Midjourney prompts in Leonardo AI?',
        answer: 'Not directly. Midjourney :: weighting and --no flags are not understood by Leonardo. Leonardo uses (term:1.3) parenthetical weighting and a separate negative field. Promagen converts your creative intent into the correct syntax for either platform.',
      },
    ],
  },
  {
    slug: 'ideogram-vs-midjourney',
    platformAId: 'ideogram',
    platformBId: 'midjourney',
    keyDifference:
      'Ideogram (Tier 3) reads natural language sentences and has a separate negative prompt field. Midjourney (Tier 2) uses keyword-weighted prompts with :: syntax and --no inline negatives. Ideogram is web-based; Midjourney operates through Discord. They represent different prompt philosophies.',
    chooseWhen:
      'Choose Ideogram when you want natural language prompts and strong text-in-image rendering. Choose Midjourney when you need precise keyword weighting for stylised atmospheric outputs.',
    workflowGuidance:
      'Choose Ideogram for natural sentence prompting, text-in-image rendering, and a web-based workflow. Choose Midjourney for stylised atmospheric outputs with precise keyword weighting. Both have 1,000-character limits. Promagen formats your selections for either platform automatically.',
    faq: [
      {
        question: 'Should I use Ideogram or Midjourney?',
        answer: 'It depends on your priorities. Ideogram excels at natural language understanding and rendering text within images, with a web-based interface. Midjourney produces outstanding stylised and atmospheric compositions through Discord, with precise keyword weighting control.',
      },
      {
        question: 'Does Ideogram have better text rendering than Midjourney?',
        answer: 'Ideogram is generally stronger at rendering legible text within generated images. Midjourney has improved text handling in recent versions but is primarily optimised for visual composition and atmosphere rather than typographic accuracy.',
      },
    ],
  },
  {
    slug: 'canva-vs-adobe-firefly',
    platformAId: 'canva',
    platformBId: 'adobe-firefly',
    keyDifference:
      'Canva Magic Media and Adobe Firefly are both Tier 3 natural language platforms with no negative prompt support. Canva has a shorter sweet spot (40 chars) and 500-character limit, designed for quick generation within Canva\'s design tool. Firefly allows longer prompts (1,000 chars) and integrates with Adobe Creative Cloud.',
    chooseWhen:
      'Choose Canva when you want quick generation inside an all-in-one design tool. Choose Adobe Firefly when you need detailed prompts and professional Creative Cloud integration.',
    workflowGuidance:
      'Choose Canva Magic Media for quick image generation integrated with Canva\'s design, presentation, and social media tools. Choose Adobe Firefly for longer, more detailed prompts and integration with professional Creative Cloud applications like Photoshop and Illustrator.',
    faq: [
      {
        question: 'Which is better for design, Canva or Adobe Firefly?',
        answer: 'They target different audiences. Canva Magic Media is optimised for quick generation within Canva\'s accessible design tool \u2014 ideal for social media, presentations, and marketing materials. Adobe Firefly integrates with professional Creative Cloud apps for detailed design work.',
      },
      {
        question: 'Do Canva and Adobe Firefly support negative prompts?',
        answer: 'Neither platform supports negative prompts. Canva has a simplified prompt interface designed for accessibility. Adobe Firefly previously had an "Exclude Image" field but removed it. For both platforms, rephrase exclusions as positive instructions \u2014 Promagen handles this conversion automatically.',
      },
    ],
  },
];

// ─── Build-time validation ─────────────────────────────────────────────────
// Runs at module load. If a platform ID in the editorial data does not exist
// in the SSOT, the build fails fast with a clear error instead of silently
// rendering a broken page.

const validIds = new Set(getAuthorityPlatformIds());

for (const pair of COMPARISON_PAIRS) {
  if (!validIds.has(pair.platformAId)) {
    throw new Error(
      `[comparison-pairs] platformAId "${pair.platformAId}" in slug "${pair.slug}" does not exist in platform-config.json`,
    );
  }
  if (!validIds.has(pair.platformBId)) {
    throw new Error(
      `[comparison-pairs] platformBId "${pair.platformBId}" in slug "${pair.slug}" does not exist in platform-config.json`,
    );
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/** All valid comparison slugs (for generateStaticParams + sitemap) */
export function getComparisonSlugs(): string[] {
  return COMPARISON_PAIRS.map((p) => p.slug);
}

/** Look up a pair by slug — returns undefined if not found */
export function getComparisonPairBySlug(slug: string): ComparisonPair | undefined {
  return COMPARISON_PAIRS.find((p) => p.slug === slug);
}

/** Other comparison pages involving either platform in this pair */
export function getRelatedComparisons(currentSlug: string): ComparisonPair[] {
  const current = COMPARISON_PAIRS.find((p) => p.slug === currentSlug);
  if (!current) return [];
  return COMPARISON_PAIRS.filter(
    (p) =>
      p.slug !== currentSlug &&
      (p.platformAId === current.platformAId ||
        p.platformAId === current.platformBId ||
        p.platformBId === current.platformAId ||
        p.platformBId === current.platformBId),
  );
}

/** Map of reversed slugs → canonical slugs (for Next.js redirects config) */
export function getReverseSlugs(): { reversed: string; canonical: string }[] {
  return COMPARISON_PAIRS.map((p) => {
    const [partA, , partB] = p.slug.split('-vs-').length === 2
      ? [p.slug.split('-vs-')[0], 'vs', p.slug.split('-vs-')[1]]
      : [p.slug, '', ''];
    const reversed = partB ? `${partB}-vs-${partA}` : '';
    return { reversed, canonical: p.slug };
  }).filter((r) => r.reversed && r.reversed !== r.canonical);
}
