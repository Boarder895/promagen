// src/data/learn-guides.ts
// ============================================================================
// LEARN GUIDES DATA
// ============================================================================
// Educational content for the /studio/learn page.
// 12 guides mapping 1:1 with Prompt Builder categories:
// 1. Prompt Engineering Fundamentals (overview)
// 2. Crafting Your Subject (Subject)
// 3. Action, Pose & Movement (Action / Pose)
// 4. Mastering Style Modifiers (Style / Rendering)
// 5. Environments & Settings (Environment)
// 6. Composition & Framing (Composition / Framing)
// 7. Camera & Lens Techniques (Camera)
// 8. Lighting & Atmosphere (Lighting + Atmosphere)
// 9. Colour in AI Prompts (Colour / Grade)
// 10. Materials, Textures & Surfaces (Materials / Texture)
// 11. Fidelity & Quality Boosters (Fidelity)
// 12. Using Negative Prompts (Constraints / Negative)
// ============================================================================

import type { LearnGuide, QuickTip } from '@/types/learn-content';

export const LEARN_GUIDES: LearnGuide[] = [
  // ========================================================================
  // 1. PROMPT ENGINEERING FUNDAMENTALS (Overview)
  // ========================================================================
  {
    id: 'prompt-fundamentals',
    title: 'Prompt Engineering Fundamentals',
    description: 'Master the core principles of writing effective AI image prompts.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 8,
    tags: ['basics', 'structure', 'keywords', 'overview'],
    related: ['crafting-subject', 'style-modifiers'],
    promptBuilderCategory: null, // Overview guide
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

  // ========================================================================
  // 2. CRAFTING YOUR SUBJECT (Subject category)
  // ========================================================================
  {
    id: 'crafting-subject',
    title: 'Crafting Your Subject',
    description: 'Define the core identity of your image with powerful subject prompts.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 6,
    tags: ['subject', 'identity', 'focus', 'character'],
    related: ['prompt-fundamentals', 'action-pose'],
    promptBuilderCategory: 'subject',
    sections: [
      {
        title: 'The Core Identity',
        content: `Your subject is the foundation of your prompt. It answers the question "What is this image of?" Be specific about who or what your subject is.`,
        tips: [
          'One main subject per prompt for clarity',
          'Add defining characteristics: age, gender, species',
          'Include distinguishing features: clothing, accessories',
          'Specify the subject\'s emotional state if relevant',
        ],
      },
      {
        title: 'Subject Specificity',
        content: `"A woman" is vague. "A 30-year-old Japanese businesswoman in a tailored navy suit" tells the AI exactly what to generate. The more specific, the more control you have.`,
        example: {
          prompt: 'An elderly wizard with a long silver beard, wearing weathered purple robes, holding a gnarled oak staff',
          explanation: 'Age (elderly) + Type (wizard) + Features (silver beard) + Clothing (purple robes) + Props (oak staff)',
        },
      },
      {
        title: 'Subject Types',
        content: `Subjects can be people, animals, objects, creatures, or abstract concepts. Each type benefits from different descriptors.`,
        tips: [
          'People: age, ethnicity, profession, clothing, expression',
          'Animals: species, breed, size, color, behavior',
          'Objects: material, condition, era, purpose',
          'Creatures: hybrid descriptions, scale, fantastical features',
        ],
      },
    ],
  },

  // ========================================================================
  // 3. ACTION, POSE & MOVEMENT (Action / Pose category)
  // ========================================================================
  {
    id: 'action-pose',
    title: 'Action, Pose & Movement',
    description: 'Bring your subjects to life with dynamic poses and actions.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 5,
    tags: ['action', 'pose', 'movement', 'dynamic'],
    related: ['crafting-subject', 'composition-framing'],
    promptBuilderCategory: 'action',
    sections: [
      {
        title: 'Static vs Dynamic',
        content: `Decide if your subject is still or in motion. "Standing" is static. "Leaping through the air" is dynamic. Dynamic poses create energy and interest.`,
        tips: [
          'Use action verbs: running, jumping, dancing, flying',
          'Describe body position: crouching, stretching, twisting',
          'Include motion blur hints for speed: "wind in hair"',
          'Combine with camera techniques for dramatic effect',
        ],
      },
      {
        title: 'Pose Language',
        content: `Poses communicate emotion and intention. A "confident stance with hands on hips" tells a different story than "hunched over with head bowed."`,
        example: {
          prompt: 'A samurai mid-sword-strike, katana arcing through the air, body twisted in a powerful lunge',
          explanation: 'Action (sword-strike) + Motion detail (arcing) + Body position (twisted lunge)',
        },
      },
      {
        title: 'Reference Points',
        content: `Reference familiar poses from art, photography, or film. "Contrapposto pose," "action movie hero landing," or "ballet arabesque" give the AI clear visual targets.`,
      },
    ],
  },

  // ========================================================================
  // 4. MASTERING STYLE MODIFIERS (Style / Rendering category)
  // ========================================================================
  {
    id: 'style-modifiers',
    title: 'Mastering Style Modifiers',
    description: 'Learn how to use style keywords to transform your images.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 6,
    tags: ['style', 'aesthetics', 'mood', 'rendering'],
    related: ['prompt-fundamentals', 'colour-theory'],
    promptBuilderCategory: 'style',
    sections: [
      {
        title: 'Style Families',
        content: `Style modifiers fall into distinct families that work well together. Combining terms from the same family creates coherent aesthetics. Mixing conflicting families can produce muddy results.`,
        tips: [
          'Cyberpunk pairs with: neon, rain, urban, tech',
          'Fantasy pairs with: magical, ethereal, mystical',
          'Retro pairs with: vintage, film grain, warm tones',
          'Minimal pairs with: clean, simple, geometric',
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
      {
        title: 'Rendering Approaches',
        content: `Modern AI platforms understand rendering terminology: photorealistic, hyperrealistic, stylized, cartoon, anime, 3D render, vector art, pixel art. Mix rendering with artistic style for unique results.`,
      },
    ],
  },

  // ========================================================================
  // 5. ENVIRONMENTS & SETTINGS (Environment category)
  // ========================================================================
  {
    id: 'environments-settings',
    title: 'Environments & Settings',
    description: 'Create immersive worlds and backgrounds for your subjects.',
    category: 'fundamentals',
    difficulty: 'beginner',
    readTime: 5,
    tags: ['environment', 'setting', 'background', 'world'],
    related: ['composition-framing', 'lighting-atmosphere'],
    promptBuilderCategory: 'environment',
    sections: [
      {
        title: 'World Building',
        content: `Your environment sets the stage. It provides context, establishes mood, and grounds your subject in a believable space. One focused environment works better than a cluttered scene.`,
        tips: [
          'Choose one primary location: forest, city, space',
          'Add environmental details: weather, time of day',
          'Include scale references: distant mountains, nearby objects',
          'Consider the story the environment tells',
        ],
      },
      {
        title: 'Indoor vs Outdoor',
        content: `Indoor and outdoor environments have different requirements. Indoors: describe the room type, furniture, lighting sources. Outdoors: describe landscape features, sky, horizon.`,
        example: {
          prompt: 'A cozy Victorian library, floor-to-ceiling bookshelves, crackling fireplace, leather armchairs, warm lamplight through dusty windows',
          explanation: 'Room type (library) + Era (Victorian) + Furniture + Light sources + Atmospheric details',
        },
      },
      {
        title: 'Fantasy & Sci-Fi Settings',
        content: `For non-real environments, combine familiar elements with fantastical ones. "A floating crystal palace above purple clouds" uses real concepts (palace, clouds) with impossible attributes (floating, purple).`,
      },
    ],
  },

  // ========================================================================
  // 6. COMPOSITION & FRAMING (Composition / Framing category)
  // ========================================================================
  {
    id: 'composition-framing',
    title: 'Composition & Framing',
    description: 'Control how your images are composed and framed.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 6,
    tags: ['composition', 'framing', 'layout', 'professional'],
    related: ['camera-lens', 'lighting-atmosphere'],
    promptBuilderCategory: 'composition',
    sections: [
      {
        title: 'Compositional Rules',
        content: `Classic composition rules translate well to AI prompts. Reference "rule of thirds," "golden ratio," "centered composition," or "symmetrical layout" for predictable results.`,
        tips: [
          'Rule of thirds: subject placed off-center',
          'Centered: subject dominates the frame',
          'Leading lines: paths that draw the eye',
          'Frame within frame: using elements to border the subject',
        ],
      },
      {
        title: 'Shot Types',
        content: `Film terminology helps AI understand framing. Use close-up, medium shot, wide shot, extreme close-up, establishing shot.`,
        example: {
          prompt: 'Extreme close-up of an eye, macro photography, reflections visible, detailed iris patterns',
          explanation: '"Extreme close-up" and "macro" both reinforce tight framing.',
        },
      },
      {
        title: 'Aspect Ratios',
        content: `Different aspect ratios suit different subjects. Portraits often work better in vertical formats (9:16), landscapes in wide formats (16:9, 21:9). Square (1:1) works for centered subjects.`,
      },
    ],
  },

  // ========================================================================
  // 7. CAMERA & LENS TECHNIQUES (Camera category)
  // ========================================================================
  {
    id: 'camera-lens',
    title: 'Camera & Lens Techniques',
    description: 'Use photography terminology for professional-looking results.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 6,
    tags: ['camera', 'lens', 'photography', 'angle'],
    related: ['composition-framing', 'lighting-atmosphere'],
    promptBuilderCategory: 'camera',
    sections: [
      {
        title: 'Camera Angles',
        content: `Camera angle dramatically affects the emotional impact. Low angles make subjects powerful, high angles make them vulnerable.`,
        tips: [
          'Low angle: powerful, heroic, imposing',
          'High angle: vulnerable, small, overview',
          'Eye level: neutral, relatable',
          'Dutch angle: tension, unease',
          'Bird\'s eye: overview, patterns',
        ],
      },
      {
        title: 'Lens Effects',
        content: `Different lenses create different looks. Wide-angle (14mm, 24mm) distorts and exaggerates. Telephoto (85mm, 200mm) compresses and flatters. Macro captures extreme detail.`,
        example: {
          prompt: 'Portrait, shot on 85mm f/1.4 lens, shallow depth of field, creamy bokeh background',
          explanation: 'Lens (85mm) + Aperture (f/1.4) + Resulting effects (shallow DOF, bokeh)',
        },
      },
      {
        title: 'Photography Terms',
        content: `AI models understand: depth of field, bokeh, motion blur, long exposure, tilt-shift, panoramic, fish-eye, anamorphic. Use these for specific optical effects.`,
      },
    ],
  },

  // ========================================================================
  // 8. LIGHTING & ATMOSPHERE (Lighting + Atmosphere categories)
  // ========================================================================
  {
    id: 'lighting-atmosphere',
    title: 'Lighting & Atmosphere',
    description: 'Transform your images with professional lighting techniques.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 7,
    tags: ['lighting', 'mood', 'atmosphere', 'professional'],
    related: ['colour-theory', 'composition-framing'],
    promptBuilderCategory: 'lighting',
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
        title: 'Atmospheric Effects',
        content: `Atmosphere adds depth and mood: fog, mist, haze, smoke, dust particles, rain, snow. These interact with light to create visual interest.`,
        tips: [
          'Volumetric lighting: visible light rays through atmosphere',
          'God rays: dramatic light beams through clouds/windows',
          'Lens flare: adds cinematic realism',
          'Particle effects: dust, sparks, embers for texture',
        ],
      },
    ],
  },

  // ========================================================================
  // 9. COLOUR IN AI PROMPTS (Colour / Grade category)
  // ========================================================================
  {
    id: 'colour-theory',
    title: 'Colour in AI Prompts',
    description: 'Use colour deliberately to enhance mood and visual impact.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 5,
    tags: ['colour', 'palette', 'mood', 'grade'],
    related: ['lighting-atmosphere', 'style-modifiers'],
    promptBuilderCategory: 'colour',
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
      {
        title: 'Colour Grading',
        content: `Reference film color grades: "Blade Runner orange and teal," "Matrix green tint," "Wes Anderson pastels." These shorthand references communicate complex color schemes.`,
      },
    ],
  },

  // ========================================================================
  // 10. MATERIALS, TEXTURES & SURFACES (Materials / Texture category)
  // ========================================================================
  {
    id: 'materials-textures',
    title: 'Materials, Textures & Surfaces',
    description: 'Add tactile realism with material and texture descriptions.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 5,
    tags: ['materials', 'texture', 'surface', 'realism'],
    related: ['style-modifiers', 'fidelity-quality'],
    promptBuilderCategory: 'materials',
    sections: [
      {
        title: 'Material Properties',
        content: `Materials define how surfaces look and interact with light. Specify whether something is matte, glossy, metallic, transparent, rough, or smooth.`,
        tips: [
          'Metals: brushed steel, polished chrome, weathered bronze',
          'Fabrics: silk, velvet, denim, leather, wool',
          'Natural: wood grain, marble, granite, skin texture',
          'Synthetics: plastic, rubber, glass, acrylic',
        ],
      },
      {
        title: 'Texture Descriptors',
        content: `Textures add visual interest and realism. Describe surface qualities: cracked, worn, pristine, weathered, aged, new, rough, smooth.`,
        example: {
          prompt: 'Ancient leather-bound book, cracked spine, gold leaf lettering, yellowed pages, dust particles',
          explanation: 'Material (leather) + Age (ancient) + Texture details (cracked, yellowed) + Atmosphere (dust)',
        },
      },
      {
        title: 'Surface Interactions',
        content: `Consider how materials interact with light: reflective surfaces show environment, translucent materials glow, matte surfaces absorb light. These details add photorealism.`,
      },
    ],
  },

  // ========================================================================
  // 11. FIDELITY & QUALITY BOOSTERS (Fidelity category)
  // ========================================================================
  {
    id: 'fidelity-quality',
    title: 'Fidelity & Quality Boosters',
    description: 'Maximize image quality with the right technical terms.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 5,
    tags: ['quality', 'fidelity', 'resolution', 'detail'],
    related: ['prompt-fundamentals', 'materials-textures'],
    promptBuilderCategory: 'fidelity',
    sections: [
      {
        title: 'Quality Keywords',
        content: `Certain keywords signal to AI models that you want high-quality output. Stack these at the end of prompts for best results.`,
        tips: [
          'Resolution: 8K, 4K, high resolution, ultra HD',
          'Detail: highly detailed, intricate, sharp focus',
          'Quality: masterpiece, best quality, professional',
          'Rendering: photorealistic, hyperrealistic, cinematic',
        ],
      },
      {
        title: 'Platform-Specific Boosters',
        content: `Different platforms respond to different quality terms. CLIP-based models love "masterpiece, best quality." Natural language platforms prefer "professional photograph, detailed."`,
        example: {
          prompt: 'Portrait of a woman, masterpiece, best quality, highly detailed, sharp focus, 8K resolution',
          explanation: 'Quality terms stacked at the end reinforce the request for high fidelity.',
        },
      },
      {
        title: 'When Less Is More',
        content: `For some platforms (especially natural language ones), excessive quality keywords can backfire. If results look overprocessed, reduce quality boosters and focus on description.`,
      },
    ],
  },

  // ========================================================================
  // 12. USING NEGATIVE PROMPTS (Constraints / Negative category)
  // ========================================================================
  {
    id: 'negative-prompts',
    title: 'Using Negative Prompts',
    description: 'Learn when and how to use negative prompts effectively.',
    category: 'advanced',
    difficulty: 'intermediate',
    readTime: 5,
    tags: ['negative', 'exclusion', 'refinement', 'constraints'],
    related: ['prompt-fundamentals', 'fidelity-quality'],
    promptBuilderCategory: 'negative',
    sections: [
      {
        title: 'What Are Negative Prompts?',
        content: `Negative prompts tell the AI what to avoid. They're powerful for removing common issues like extra limbs, blurry areas, or unwanted elements.`,
        tips: [
          'Use for common issues: "blurry, low quality, distorted"',
          'Remove unwanted elements: "text, watermark, frame"',
          'Fix anatomical issues: "extra fingers, deformed"',
          'Exclude styles: "cartoon, anime" if you want realism',
        ],
      },
      {
        title: 'Platform Differences',
        content: `Different platforms handle negatives differently. This is tier-dependent:`,
        tips: [
          'Tier 1 (CLIP): Separate negative prompt field',
          'Tier 2 (Midjourney): Use --no flag inline',
          'Tier 3 (Natural): Use "without" or exclusions',
          'Tier 4 (Plain): Limited support, focus on positive',
        ],
      },
      {
        title: 'Negative Strategy',
        content: `Start without negatives. Only add them when you see specific issues in outputs. Over-using negatives can confuse the model.`,
        example: {
          prompt: 'Portrait, beautiful, detailed',
          explanation: 'Positive prompt focuses on what you want. Add negatives only if outputs have issues.',
        },
      },
    ],
  },
];

// ============================================================================
// QUICK TIPS
// ============================================================================

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

/**
 * Get guide by Prompt Builder category
 */
export function getGuideByPromptBuilderCategory(category: string): LearnGuide | undefined {
  return LEARN_GUIDES.find((g) => g.promptBuilderCategory === category);
}
