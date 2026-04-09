// src/lib/authority/use-case-recommendations.ts
// ============================================================================
// USE-CASE RECOMMENDATIONS — EDITORIAL DATA FOR RECOMMENDATION PAGES
// ============================================================================
// Defines the 4 initial use-case pages with editorial content: direct answers,
// recommended platforms with reasoning, prompt format considerations, and FAQ.
// Platform facts (tier, limits) are fetched from the SSOT at render time.
//
// RULES:
//   - Slugs are URL-safe and match the spec
//   - Platform IDs validated against SSOT at module load
//   - Direct answers: 40–60 words, citation-ready
//   - Recommendations explain WHY based on tier + capabilities, not just rank
//   - Zero subjective superlatives, zero presentation coupling
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 6
// ============================================================================

import { getAuthorityPlatformIds } from './platform-data';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PlatformRecommendation {
  platformId: string;
  reasoning: string;
}

export interface UseCaseRecommendation {
  slug: string;
  title: string;
  /** Display name for headings, e.g. "Photorealism" */
  displayName: string;
  /** Citation-ready direct answer, 40–60 words */
  directAnswer: string;
  /** Recommended platforms with reasoning */
  recommendations: PlatformRecommendation[];
  /** Prompt format considerations for this use case */
  formatConsiderations: string;
  /** FAQ entries */
  faq: { question: string; answer: string }[];
}

// ─── Editorial data ────────────────────────────────────────────────────────

export const USE_CASE_RECOMMENDATIONS: UseCaseRecommendation[] = [
  {
    slug: 'photorealism',
    title: 'Best AI Image Generator for Photorealism',
    displayName: 'Photorealism',
    directAnswer:
      'For photorealistic AI images, Flux, DALL\u00b7E 3, and Stable Diffusion consistently produce the most convincing results. Flux excels at natural language photorealism with longer prompts. DALL\u00b7E 3 follows complex multi-part instructions well. Stable Diffusion offers fine-grained control through CLIP weighting and separate negative prompts.',
    recommendations: [
      { platformId: 'flux', reasoning: 'Tier 3 natural language with 1,250-character limit. Excels at photorealistic output from conversational descriptions. No negative prompt support, but strong instruction following compensates.' },
      { platformId: 'openai', reasoning: 'Tier 3 natural language with strong multi-part instruction following via ChatGPT integration. Handles complex scene descriptions with multiple subjects and specific attributes.' },
      { platformId: 'stability', reasoning: 'Tier 1 CLIP-based with separate negative prompt field. Offers the most precise control through keyword weighting — ideal when you need exact material textures, lighting setups, or photographic parameters.' },
      { platformId: 'leonardo', reasoning: 'Tier 1 CLIP-based with multiple model options. Good balance of control and quality for photorealistic work, with a web-based UI and separate negative prompts.' },
      { platformId: 'google-imagen', reasoning: 'Tier 3 natural language, trained with a focus on photorealism. Strong at generating realistic textures and lighting, though with no negative prompt support.' },
    ],
    formatConsiderations:
      'Photorealism benefits from detailed descriptions of lighting, materials, and camera settings. On Tier 1 platforms (Stable Diffusion, Leonardo), use weighted keywords like (sharp focus:1.3), (natural lighting:1.2) with negative prompts for quality control. On Tier 3 platforms (Flux, DALL\u00b7E 3), write detailed natural sentences describing the scene, lighting conditions, and camera perspective.',
    faq: [
      { question: 'What is the best AI image generator for photorealistic images?', answer: 'Flux, DALL\u00b7E 3, and Stable Diffusion are the strongest choices for photorealism. The best pick depends on your workflow: Flux for natural language ease, DALL\u00b7E 3 for complex instructions, Stable Diffusion for fine-grained control through weighted keywords and negative prompts.' },
      { question: 'Do I need negative prompts for photorealistic AI images?', answer: 'They help significantly on platforms that support them. Adding "blurry, low quality, artifacts" as negatives on Stable Diffusion or Leonardo improves output quality. For platforms without negative prompts (Flux, DALL\u00b7E 3), emphasise quality in your main prompt instead.' },
    ],
  },
  {
    slug: 'illustration',
    title: 'Best AI Image Generator for Illustration',
    displayName: 'Illustration',
    directAnswer:
      'For AI-generated illustrations, Midjourney, NovelAI, and Ideogram produce the strongest stylised results. Midjourney excels at atmospheric, cinematic compositions. NovelAI specialises in anime and character illustration. Ideogram handles text-in-image rendering for posters and editorial illustration.',
    recommendations: [
      { platformId: 'midjourney', reasoning: 'Tier 2 keyword-weighted prompts with outstanding atmospheric and stylised output. The :: weighting system gives precise control over style blending and composition emphasis.' },
      { platformId: 'novelai', reasoning: 'Tier 1 CLIP-based, purpose-built for anime and character illustration. Separate negative prompt field and deep understanding of illustration-specific terminology and styles.' },
      { platformId: 'ideogram', reasoning: 'Tier 3 natural language with strong text-in-image rendering. Ideal for editorial illustration, posters, and designs where legible text must be integrated into the artwork.' },
      { platformId: 'leonardo', reasoning: 'Tier 1 CLIP-based with multiple model options including illustration-focused models. Good control through keyword weighting and separate negative prompts.' },
      { platformId: 'recraft', reasoning: 'Tier 3 natural language with vector output capability and strong text rendering. Suited for design-oriented illustration work and brand assets.' },
    ],
    formatConsiderations:
      'Illustration benefits from style-specific vocabulary. On Midjourney (Tier 2), use style references with :: weighting: "watercolour illustration::1.3 children\'s book style::1.2". On Tier 1 platforms, weight artistic terms: (digital painting:1.3), (flat colour:1.2). On Tier 3 platforms, describe the artistic style conversationally: "A watercolour illustration in the style of a children\'s book."',
    faq: [
      { question: 'What is the best AI art generator for illustrations?', answer: 'Midjourney is the strongest general-purpose illustration tool, with exceptional atmospheric and stylised output. NovelAI specialises in anime and character art. Ideogram excels at illustration with integrated text. The best choice depends on your illustration style and whether you need text rendering.' },
      { question: 'Can AI generate vector illustrations?', answer: 'Recraft can output vector format directly. Most other AI generators output raster images that would need manual vectorisation. For vector-ready illustration work, Recraft is currently the strongest option among the 40 platforms Promagen tracks.' },
    ],
  },
  {
    slug: 'product-mockups',
    title: 'Best AI Image Generator for Product Mockups',
    displayName: 'Product Mockups',
    directAnswer:
      'For AI-generated product mockups, DALL\u00b7E 3, Adobe Firefly, and Flux produce the most commercially usable results. DALL\u00b7E 3 follows detailed product specifications well. Adobe Firefly is trained on licensed content for commercial safety. Flux handles natural language product descriptions with strong photorealistic output.',
    recommendations: [
      { platformId: 'openai', reasoning: 'Tier 3 natural language with strong multi-part instruction following. Excels at rendering specific product configurations, packaging designs, and lifestyle context shots from detailed text descriptions.' },
      { platformId: 'adobe-firefly', reasoning: 'Tier 3 natural language, trained on licensed content. The safest choice for commercial product imagery — no copyright risk from training data. Integrates with Photoshop for post-processing.' },
      { platformId: 'flux', reasoning: 'Tier 3 natural language with strong photorealistic output. Good at rendering product materials, surfaces, and studio lighting from conversational descriptions.' },
      { platformId: 'stability', reasoning: 'Tier 1 CLIP-based with precise control over materials and lighting through keyword weighting. Separate negative prompts help exclude unwanted artifacts in product shots.' },
      { platformId: 'canva', reasoning: 'Tier 3 plain language with built-in design tools. Good for quick product mockups within marketing materials, presentations, and social media content.' },
    ],
    formatConsiderations:
      'Product mockups need precise material and lighting descriptions. On Tier 3 platforms, describe the product, material, lighting setup, and background in natural sentences. On Tier 1 platforms, weight key attributes: (brushed aluminium:1.3), (studio lighting:1.2), (product photography:1.4). Use negative prompts to exclude "watermark, text overlay, low quality" where supported.',
    faq: [
      { question: 'What is the best AI image generator for product photos?', answer: 'DALL\u00b7E 3 and Adobe Firefly are the strongest choices. DALL\u00b7E 3 follows detailed product specifications well. Adobe Firefly is the safest for commercial use because it is trained on licensed content. For maximum control over materials and lighting, Stable Diffusion with CLIP weighting is the most precise.' },
      { question: 'Is AI-generated product imagery commercially safe?', answer: 'Adobe Firefly is specifically trained on licensed content for commercial safety. Other platforms have varying IP positions. For commercial product mockups where legal safety matters, Adobe Firefly is the most defensible choice. Always check each platform\'s terms of service for commercial use rights.' },
    ],
  },
  {
    slug: 'concept-art',
    title: 'Best AI Image Generator for Concept Art',
    displayName: 'Concept Art',
    directAnswer:
      'For concept art, Midjourney, Leonardo AI, and Stable Diffusion produce the strongest results. Midjourney excels at atmospheric compositions and cinematic concepts. Leonardo offers multiple model choices with CLIP control for iterative concepting. Stable Diffusion provides the deepest customisation through keyword weighting and negative prompts.',
    recommendations: [
      { platformId: 'midjourney', reasoning: 'Tier 2 keyword-weighted prompts with industry-leading atmospheric and cinematic output. The :: weighting system excels at style blending and mood control — core requirements for concept art exploration.' },
      { platformId: 'leonardo', reasoning: 'Tier 1 CLIP-based with multiple model options and fast iteration. Good for rapid concept exploration with fine-grained control through keyword weighting and a web-based UI.' },
      { platformId: 'stability', reasoning: 'Tier 1 CLIP-based with the deepest customisation through open-source models, LoRAs, and ControlNet. Ideal for studios with technical capacity to fine-tune for specific art directions.' },
      { platformId: 'flux', reasoning: 'Tier 3 natural language with strong compositional understanding. Good for concept artists who prefer describing scenes conversationally rather than learning weight syntax.' },
      { platformId: 'playground', reasoning: 'Tier 3 natural language with design-tool focus and iteration features. Good for rapid concept exploration with an accessible web-based interface.' },
    ],
    formatConsiderations:
      'Concept art benefits from style and mood vocabulary. On Midjourney (Tier 2), combine atmosphere with composition: "epic fantasy landscape::1.3 volumetric lighting::1.2 concept art::1.4 --ar 16:9". On Tier 1 platforms, weight artistic direction: (cinematic composition:1.3), (dramatic lighting:1.4). On Tier 3 platforms, describe the scene\'s mood and atmosphere conversationally with specific art direction references.',
    faq: [
      { question: 'What is the best AI image generator for concept art?', answer: 'Midjourney is widely regarded as the strongest for concept art because of its exceptional atmospheric and cinematic output. Leonardo AI offers faster iteration with CLIP control. Stable Diffusion provides the deepest customisation for studios with technical capacity. The best choice depends on whether you prioritise aesthetics, speed, or customisation.' },
      { question: 'Can AI replace concept artists?', answer: 'AI image generators are tools for concept exploration, not replacements for concept artists. They excel at rapid ideation and mood exploration but lack the intentional design thinking, narrative coherence, and iterative refinement that professional concept artists provide. Most studios use AI as one tool in a broader concepting workflow.' },
    ],
  },
];

// ─── Build-time validation ─────────────────────────────────────────────────

const validIds = new Set(getAuthorityPlatformIds());

for (const uc of USE_CASE_RECOMMENDATIONS) {
  for (const rec of uc.recommendations) {
    if (!validIds.has(rec.platformId)) {
      throw new Error(
        `[use-case-recommendations] platformId "${rec.platformId}" in use case "${uc.slug}" does not exist in platform-config.json`,
      );
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/** All valid use-case slugs (for generateStaticParams + sitemap) */
export function getUseCaseSlugs(): string[] {
  return USE_CASE_RECOMMENDATIONS.map((uc) => uc.slug);
}

/** Look up a use case by slug */
export function getUseCaseBySlug(slug: string): UseCaseRecommendation | undefined {
  return USE_CASE_RECOMMENDATIONS.find((uc) => uc.slug === slug);
}

/** All use cases except the current one (for cross-links) */
export function getRelatedUseCases(currentSlug: string): UseCaseRecommendation[] {
  return USE_CASE_RECOMMENDATIONS.filter((uc) => uc.slug !== currentSlug);
}
