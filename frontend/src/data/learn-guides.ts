// src/data/learn-guides.ts
// ============================================================================
// LEARN GUIDES DATA
// ============================================================================
// Educational content for the /prompts/learn page.
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

import type { LearnGuide, QuickTip } from '@/types/learn-content';

export const LEARN_GUIDES: LearnGuide[] = [
  {
    id: 'prompt-fundamentals',
    title: 'Prompt Engineering Fundamentals',
    description: 'Master the core principles of writing effective AI image prompts.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 8,
    tags: ['basics', 'structure', 'keywords'],
    related: ['style-modifiers', 'composition-guide'],
    sections: [
      {
        title: 'What Makes a Good Prompt?',
        content: `A well-crafted prompt communicates your vision clearly and specifically. The best prompts combine a clear subject, descriptive style elements, and technical parameters in a structured way.`,
        tips: [
          'Start with your main subject',
          'Add style and mood descriptors',
          'Include technical details last',
          'Be specific but not overly wordy',
        ],
      },
      {
        title: 'The Anatomy of a Prompt',
        content: `Most effective prompts follow a pattern: **Subject** + **Action/Context** + **Style** + **Environment** + **Technical Parameters**. This structure helps AI models understand exactly what you want.`,
        example: {
          prompt: 'A cyberpunk hacker, typing on holographic keyboard, neon-lit, rain-soaked alley, cinematic lighting, 8K, detailed',
          explanation: 'Subject (hacker) → Action (typing) → Style (cyberpunk, neon-lit) → Environment (alley, rain) → Technical (8K, detailed)',
        },
      },
      {
        title: 'Word Order Matters',
        content: `Most AI models weight words at the beginning of prompts more heavily. Put your most important elements first. The subject should typically come before style modifiers.`,
        tips: [
          'Front-load important keywords',
          'Place style after subject',
          'Put technical specs at the end',
        ],
      },
    ],
  },
  {
    id: 'style-modifiers',
    title: 'Mastering Style Modifiers',
    description: 'Learn how to use style keywords to transform your images.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 6,
    tags: ['style', 'aesthetics', 'mood'],
    related: ['prompt-fundamentals', 'colour-theory'],
    sections: [
      {
        title: 'Style Families',
        content: `Style modifiers fall into distinct families that work well together. Combining terms from the same family creates coherent aesthetics. Mixing conflicting families can produce muddy results.`,
        tips: [
          'Cyberpunk pairs with: neon, rain, urban, tech',
          'Fantasy pairs with: magical, ethereal, mystical',
          'Retro pairs with: vintage, film grain, warm tones',
        ],
      },
      {
        title: 'Artistic Styles',
        content: `Reference specific art movements or mediums to guide the visual style. Terms like "oil painting", "watercolour", "digital art", or "photograph" dramatically change the output.`,
        example: {
          prompt: 'Mountain landscape, oil painting style, impressionist brushstrokes, golden hour',
          explanation: 'The "oil painting" and "impressionist" terms shift from photorealistic to painterly output.',
        },
      },
    ],
  },
  {
    id: 'lighting-guide',
    title: 'Lighting & Atmosphere',
    description: 'Transform your images with professional lighting techniques.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 7,
    tags: ['lighting', 'mood', 'atmosphere', 'professional'],
    related: ['colour-theory', 'composition-guide'],
    sections: [
      {
        title: 'Key Lighting Terms',
        content: `Lighting dramatically affects mood. Learn these essential lighting terms to control the feel of your images.`,
        tips: [
          'Golden hour: warm, soft, romantic',
          'Blue hour: cool, moody, cinematic',
          'Rim lighting: dramatic silhouettes',
          'Soft diffused: gentle, flattering',
          'Hard shadows: dramatic, harsh',
        ],
      },
      {
        title: 'Cinematic Lighting',
        content: `For dramatic, movie-like images, combine lighting terms with atmosphere descriptors. Think about how Hollywood lights scenes.`,
        example: {
          prompt: 'Portrait of a detective, noir lighting, volumetric fog, single light source, dramatic shadows',
          explanation: 'Multiple lighting terms stack to create a specific cinematic atmosphere.',
        },
      },
      {
        title: 'Natural vs Artificial',
        content: `Specify whether light is natural or artificial. "Neon glow" is very different from "sunlight". Mixing can create interesting contrasts.`,
      },
    ],
  },
  {
    id: 'colour-theory',
    title: 'Colour in AI Prompts',
    description: 'Use colour deliberately to enhance mood and visual impact.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 5,
    tags: ['colour', 'palette', 'mood'],
    related: ['lighting-guide', 'style-modifiers'],
    sections: [
      {
        title: 'Colour Psychology',
        content: `Colours evoke specific emotions. Use them intentionally to reinforce your image's mood.`,
        tips: [
          'Warm colours (red, orange, yellow): energy, passion, warmth',
          'Cool colours (blue, green, purple): calm, mystery, depth',
          'Desaturated: moody, vintage, melancholic',
          'High saturation: vibrant, energetic, modern',
        ],
      },
      {
        title: 'Colour Palettes',
        content: `Specify colour relationships for cohesive images. Terms like "monochromatic", "complementary colours", or specific palettes guide the AI.`,
        example: {
          prompt: 'Abstract art, teal and orange colour palette, complementary colours, vibrant',
          explanation: 'Explicitly naming colours creates a controlled, intentional palette.',
        },
      },
    ],
  },
  {
    id: 'composition-guide',
    title: 'Composition & Framing',
    description: 'Control how your images are composed and framed.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 6,
    tags: ['composition', 'framing', 'camera', 'professional'],
    related: ['lighting-guide', 'prompt-fundamentals'],
    sections: [
      {
        title: 'Camera Angles',
        content: `Specify camera position to dramatically change the feel of an image. Low angles make subjects powerful, high angles make them vulnerable.`,
        tips: [
          'Low angle: powerful, heroic, imposing',
          'High angle: vulnerable, small, overview',
          'Eye level: neutral, relatable',
          'Dutch angle: tension, unease',
          'Bird\'s eye: overview, patterns',
        ],
      },
      {
        title: 'Shot Types',
        content: `Film terminology helps AI understand framing. Use close-up, medium shot, wide shot, etc.`,
        example: {
          prompt: 'Extreme close-up of an eye, macro photography, reflections, detailed iris',
          explanation: '"Extreme close-up" and "macro" both reinforce tight framing.',
        },
      },
      {
        title: 'Aspect Ratios',
        content: `Different aspect ratios suit different subjects. Portraits often work better in vertical formats, landscapes in wide formats. Most platforms let you specify ratios.`,
      },
    ],
  },
  {
    id: 'negative-prompts',
    title: 'Using Negative Prompts',
    description: 'Learn when and how to use negative prompts effectively.',
    category: 'platform-specific',
    difficulty: 'intermediate',
    readTime: 5,
    tags: ['negative', 'exclusion', 'refinement'],
    related: ['prompt-fundamentals', 'midjourney-guide'],
    sections: [
      {
        title: 'What Are Negative Prompts?',
        content: `Negative prompts tell the AI what to avoid. They're powerful for removing common issues like extra limbs, blurry areas, or unwanted elements.`,
        tips: [
          'Use for common issues: "blurry, low quality, distorted"',
          'Remove unwanted elements: "text, watermark, frame"',
          'Fix anatomical issues: "extra fingers, deformed"',
        ],
      },
      {
        title: 'Platform Differences',
        content: `Different platforms handle negatives differently. Midjourney uses --no, Stable Diffusion has a separate field, and DALL-E doesn't support them directly.`,
        example: {
          prompt: 'Portrait, beautiful, detailed --no blurry, distorted, low quality',
          explanation: 'Midjourney-style negative prompt using --no syntax.',
        },
      },
    ],
  },
  {
    id: 'midjourney-guide',
    title: 'Midjourney Specifics',
    description: 'Platform-specific tips for Midjourney users.',
    category: 'platform-specific',
    difficulty: 'intermediate',
    readTime: 7,
    tags: ['midjourney', 'platform', 'parameters'],
    related: ['negative-prompts', 'style-modifiers'],
    sections: [
      {
        title: 'Midjourney Parameters',
        content: `Midjourney has unique parameters that control generation. Understanding these unlocks more precise control.`,
        tips: [
          '--ar: Aspect ratio (--ar 16:9, --ar 9:16)',
          '--v: Version (--v 6 for latest)',
          '--style: Style presets',
          '--no: Negative prompt',
          '--s: Stylization strength (0-1000)',
        ],
      },
      {
        title: 'Style Reference',
        content: `Midjourney v6 introduced --sref for style references. You can provide image URLs to guide the aesthetic style of outputs.`,
      },
    ],
  },
  {
    id: 'stable-diffusion-guide',
    title: 'Stable Diffusion Tips',
    description: 'Get the most out of Stable Diffusion models.',
    category: 'platform-specific',
    difficulty: 'advanced',
    readTime: 8,
    tags: ['stable-diffusion', 'platform', 'technical'],
    related: ['negative-prompts', 'prompt-fundamentals'],
    sections: [
      {
        title: 'Prompt Weighting',
        content: `Stable Diffusion supports prompt weighting with parentheses. (keyword:1.5) increases weight, (keyword:0.5) decreases it.`,
        example: {
          prompt: 'A (beautiful:1.3) woman with (blue eyes:1.2), portrait',
          explanation: 'Parentheses with numbers emphasize or de-emphasize terms.',
        },
      },
      {
        title: 'Model Differences',
        content: `Different SD checkpoints have different strengths. SDXL excels at photorealism, while anime models are trained on specific styles. Choose your model based on your goal.`,
      },
    ],
  },
];

export const QUICK_TIPS: QuickTip[] = [
  {
    id: 'tip-1',
    title: 'Front-load Keywords',
    content: 'Put your most important words at the start of the prompt. AI models typically weight early words more heavily.',
    category: 'fundamentals',
  },
  {
    id: 'tip-2',
    title: 'Be Specific',
    content: '"Beautiful landscape" is vague. "Snow-capped mountains at golden hour, reflected in a still lake" is specific.',
    category: 'fundamentals',
  },
  {
    id: 'tip-3',
    title: 'Use Artist References',
    content: 'Referencing artists can guide style. "In the style of Studio Ghibli" or "Monet-inspired" communicates aesthetics quickly.',
    category: 'style',
  },
  {
    id: 'tip-4',
    title: 'Stack Quality Terms',
    content: 'Terms like "8K, highly detailed, professional, masterpiece" can boost output quality on most platforms.',
    category: 'technical',
  },
  {
    id: 'tip-5',
    title: 'Avoid Contradictions',
    content: 'Don\'t combine conflicting styles. "Minimalist, highly detailed, cluttered" sends mixed signals.',
    category: 'fundamentals',
  },
  {
    id: 'tip-6',
    title: 'Test Variations',
    content: 'Generate multiple versions with slight variations. Small changes can produce dramatically different results.',
    category: 'workflow',
  },
];

/**
 * Get all guides
 */
export function getLearnGuides(): LearnGuide[] {
  return LEARN_GUIDES;
}

/**
 * Get a guide by ID
 */
export function getGuideById(id: string): LearnGuide | undefined {
  return LEARN_GUIDES.find((g) => g.id === id);
}

/**
 * Get quick tips
 */
export function getQuickTips(): QuickTip[] {
  return QUICK_TIPS;
}

/**
 * Get guides by category
 */
export function getGuidesByCategory(category: LearnGuide['category']): LearnGuide[] {
  return LEARN_GUIDES.filter((g) => g.category === category);
}

/**
 * Get guides by difficulty
 */
export function getGuidesByDifficulty(difficulty: LearnGuide['difficulty']): LearnGuide[] {
  return LEARN_GUIDES.filter((g) => g.difficulty === difficulty);
}
