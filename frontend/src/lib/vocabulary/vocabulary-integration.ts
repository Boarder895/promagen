/**
 * Vocabulary Integration Layer
 * =============================
 * Connects the 5,000+ term vocabulary layer to the prompt builder UI.
 * 
 * This is the bridge between:
 * - vocabulary/prompt-builder/ (3,600 terms)
 * - vocabulary/intelligence/ (conflicts, families, moods)
 * - vocabulary/shared/ (920 building blocks)
 * 
 * And the UI components that use them.
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

import type { PromptCategory, PlatformTier } from '../../types/prompt-intelligence';

// ============================================================================
// VOCABULARY DATA TYPES
// ============================================================================

export interface VocabularyOption {
  value: string;
  label: string;
  subcategory?: string;
  tags?: string[];
  tier1Boost?: number;  // Weight boost for CLIP
  tier2Params?: string; // MJ parameters
  tier3Phrase?: string; // Natural language form
  tier4Simple?: string; // Simplified version
}

export interface SubcategoryGroup {
  id: string;
  label: string;
  description?: string;
  options: VocabularyOption[];
}

export interface CategoryVocabulary {
  id: PromptCategory;
  label: string;
  icon: string;
  description: string;
  totalOptions: number;
  subcategories: SubcategoryGroup[];
  flatOptions: VocabularyOption[];
}

// ============================================================================
// VOCABULARY DATA (from vocabulary layer JSONs)
// In production, this would be imported from @/data/vocabulary
// ============================================================================

const VOCABULARY_DATA: Record<PromptCategory, CategoryVocabulary> = {
  subject: {
    id: 'subject',
    label: 'Subject',
    icon: '👤',
    description: 'The main focus of your image',
    totalOptions: 300,
    subcategories: [
      {
        id: 'people',
        label: 'People & Portraits',
        options: [
          { value: 'portrait of a woman', label: 'Portrait of a Woman', tier1Boost: 1.4, tier3Phrase: 'A beautiful portrait of a woman' },
          { value: 'portrait of a man', label: 'Portrait of a Man', tier1Boost: 1.4, tier3Phrase: 'A striking portrait of a man' },
          { value: 'elderly person', label: 'Elderly Person', tier3Phrase: 'A wise elderly person' },
          { value: 'child portrait', label: 'Child Portrait', tier3Phrase: 'An innocent child portrait' },
          { value: 'couple in love', label: 'Couple in Love', tier3Phrase: 'A romantic couple in love' },
          { value: 'group of friends', label: 'Group of Friends', tier3Phrase: 'A lively group of friends' },
          { value: 'fashion model', label: 'Fashion Model', tier1Boost: 1.3 },
          { value: 'street photographer', label: 'Street Photographer' },
          { value: 'dancer in motion', label: 'Dancer in Motion', tier3Phrase: 'A graceful dancer captured in motion' },
          { value: 'musician playing', label: 'Musician Playing' }
        ]
      },
      {
        id: 'fantasy',
        label: 'Fantasy Characters',
        options: [
          { value: 'fantasy warrior', label: 'Fantasy Warrior', tier1Boost: 1.3, tier3Phrase: 'A mighty fantasy warrior' },
          { value: 'ethereal fairy', label: 'Ethereal Fairy', tier3Phrase: 'An ethereal fairy with delicate wings' },
          { value: 'ancient wizard', label: 'Ancient Wizard', tier3Phrase: 'A powerful ancient wizard' },
          { value: 'elven princess', label: 'Elven Princess', tier3Phrase: 'A beautiful elven princess' },
          { value: 'dark knight', label: 'Dark Knight', tier3Phrase: 'A mysterious dark knight' },
          { value: 'forest spirit', label: 'Forest Spirit', tier3Phrase: 'A mystical forest spirit' },
          { value: 'dragon rider', label: 'Dragon Rider', tier3Phrase: 'A brave dragon rider' },
          { value: 'necromancer', label: 'Necromancer', tier3Phrase: 'A sinister necromancer' },
          { value: 'holy paladin', label: 'Holy Paladin', tier3Phrase: 'A noble holy paladin' },
          { value: 'shapeshifter', label: 'Shapeshifter', tier3Phrase: 'A mysterious shapeshifter' }
        ]
      },
      {
        id: 'scifi',
        label: 'Sci-Fi Characters',
        options: [
          { value: 'cyberpunk hacker', label: 'Cyberpunk Hacker', tier1Boost: 1.3, tier3Phrase: 'A skilled cyberpunk hacker' },
          { value: 'space explorer', label: 'Space Explorer', tier3Phrase: 'An adventurous space explorer' },
          { value: 'android humanoid', label: 'Android Humanoid', tier3Phrase: 'A sophisticated android humanoid' },
          { value: 'mech pilot', label: 'Mech Pilot', tier3Phrase: 'A determined mech pilot' },
          { value: 'alien diplomat', label: 'Alien Diplomat', tier3Phrase: 'An enigmatic alien diplomat' },
          { value: 'bounty hunter', label: 'Bounty Hunter', tier3Phrase: 'A ruthless bounty hunter' },
          { value: 'starship captain', label: 'Starship Captain', tier3Phrase: 'A commanding starship captain' },
          { value: 'gene-modified human', label: 'Gene-Modified Human' },
          { value: 'virtual avatar', label: 'Virtual Avatar', tier3Phrase: 'A digital virtual avatar' },
          { value: 'time traveler', label: 'Time Traveler', tier3Phrase: 'A mysterious time traveler' }
        ]
      },
      {
        id: 'creatures',
        label: 'Creatures & Beasts',
        options: [
          { value: 'mythical dragon', label: 'Mythical Dragon', tier1Boost: 1.4, tier3Phrase: 'A magnificent mythical dragon' },
          { value: 'phoenix rising', label: 'Phoenix Rising', tier3Phrase: 'A majestic phoenix rising from flames' },
          { value: 'unicorn', label: 'Unicorn', tier3Phrase: 'A magical unicorn' },
          { value: 'griffin', label: 'Griffin', tier3Phrase: 'A noble griffin' },
          { value: 'kraken', label: 'Kraken', tier3Phrase: 'A fearsome kraken' },
          { value: 'werewolf', label: 'Werewolf', tier3Phrase: 'A fierce werewolf' },
          { value: 'giant serpent', label: 'Giant Serpent', tier3Phrase: 'A colossal giant serpent' },
          { value: 'mechanical owl', label: 'Mechanical Owl', tier3Phrase: 'An intricate mechanical owl' },
          { value: 'spirit wolf', label: 'Spirit Wolf', tier3Phrase: 'A ghostly spirit wolf' },
          { value: 'ancient golem', label: 'Ancient Golem', tier3Phrase: 'An awakened ancient golem' }
        ]
      },
      {
        id: 'historical',
        label: 'Historical Figures',
        options: [
          { value: 'samurai warrior', label: 'Samurai Warrior', tier1Boost: 1.3, tier3Phrase: 'An honorable samurai warrior' },
          { value: 'viking berserker', label: 'Viking Berserker', tier3Phrase: 'A fierce viking berserker' },
          { value: 'roman gladiator', label: 'Roman Gladiator', tier3Phrase: 'A powerful roman gladiator' },
          { value: 'egyptian pharaoh', label: 'Egyptian Pharaoh', tier3Phrase: 'A regal egyptian pharaoh' },
          { value: 'medieval knight', label: 'Medieval Knight', tier3Phrase: 'A valiant medieval knight' },
          { value: 'ninja assassin', label: 'Ninja Assassin', tier3Phrase: 'A stealthy ninja assassin' },
          { value: 'pirate captain', label: 'Pirate Captain', tier3Phrase: 'A legendary pirate captain' },
          { value: 'greek philosopher', label: 'Greek Philosopher', tier3Phrase: 'A wise greek philosopher' },
          { value: 'renaissance artist', label: 'Renaissance Artist', tier3Phrase: 'A talented renaissance artist' },
          { value: 'victorian inventor', label: 'Victorian Inventor', tier3Phrase: 'A brilliant victorian inventor' }
        ]
      }
    ],
    flatOptions: []
  },
  
  action: {
    id: 'action',
    label: 'Action / Pose',
    icon: '🎬',
    description: 'What the subject is doing',
    totalOptions: 300,
    subcategories: [
      {
        id: 'static',
        label: 'Static Poses',
        options: [
          { value: 'standing confidently', label: 'Standing Confidently', tier3Phrase: 'standing with confidence' },
          { value: 'sitting peacefully', label: 'Sitting Peacefully', tier3Phrase: 'sitting in peaceful repose' },
          { value: 'leaning casually', label: 'Leaning Casually', tier3Phrase: 'leaning with casual elegance' },
          { value: 'kneeling reverently', label: 'Kneeling Reverently', tier3Phrase: 'kneeling in reverence' },
          { value: 'lying relaxed', label: 'Lying Relaxed', tier3Phrase: 'lying in relaxed comfort' },
          { value: 'arms crossed', label: 'Arms Crossed', tier3Phrase: 'with arms crossed' },
          { value: 'hands on hips', label: 'Hands on Hips', tier3Phrase: 'standing with hands on hips' },
          { value: 'looking away', label: 'Looking Away', tier3Phrase: 'gazing into the distance' },
          { value: 'eyes closed', label: 'Eyes Closed', tier3Phrase: 'with eyes peacefully closed' },
          { value: 'contemplating', label: 'Contemplating', tier3Phrase: 'deep in contemplation' }
        ]
      },
      {
        id: 'dynamic',
        label: 'Dynamic Actions',
        options: [
          { value: 'running dynamically', label: 'Running Dynamically', tier3Phrase: 'running with dynamic energy' },
          { value: 'jumping high', label: 'Jumping High', tier3Phrase: 'leaping high into the air' },
          { value: 'flying through air', label: 'Flying Through Air', tier3Phrase: 'soaring through the air' },
          { value: 'spinning gracefully', label: 'Spinning Gracefully', tier3Phrase: 'spinning with graceful motion' },
          { value: 'falling dramatically', label: 'Falling Dramatically', tier3Phrase: 'falling in dramatic descent' },
          { value: 'climbing upward', label: 'Climbing Upward', tier3Phrase: 'climbing steadily upward' },
          { value: 'diving deep', label: 'Diving Deep', tier3Phrase: 'diving into the depths' },
          { value: 'dancing gracefully', label: 'Dancing Gracefully', tier3Phrase: 'dancing with graceful movements' },
          { value: 'fighting fiercely', label: 'Fighting Fiercely', tier3Phrase: 'engaged in fierce combat' },
          { value: 'casting spell', label: 'Casting Spell', tier3Phrase: 'casting a powerful spell' }
        ]
      },
      {
        id: 'emotional',
        label: 'Emotional Expressions',
        options: [
          { value: 'laughing joyfully', label: 'Laughing Joyfully', tier3Phrase: 'laughing with pure joy' },
          { value: 'crying emotionally', label: 'Crying Emotionally', tier3Phrase: 'crying with deep emotion' },
          { value: 'screaming intensely', label: 'Screaming Intensely', tier3Phrase: 'screaming with intensity' },
          { value: 'whispering secretly', label: 'Whispering Secretly', tier3Phrase: 'whispering a secret' },
          { value: 'meditating deeply', label: 'Meditating Deeply', tier3Phrase: 'meditating in deep focus' },
          { value: 'praying solemnly', label: 'Praying Solemnly', tier3Phrase: 'praying with solemnity' },
          { value: 'celebrating victory', label: 'Celebrating Victory', tier3Phrase: 'celebrating a great victory' },
          { value: 'mourning loss', label: 'Mourning Loss', tier3Phrase: 'mourning a profound loss' },
          { value: 'expressing love', label: 'Expressing Love', tier3Phrase: 'expressing deep love' },
          { value: 'showing determination', label: 'Showing Determination', tier3Phrase: 'showing fierce determination' }
        ]
      }
    ],
    flatOptions: []
  },

  style: {
    id: 'style',
    label: 'Style / Rendering',
    icon: '🎨',
    description: 'Art style and rendering approach',
    totalOptions: 300,
    subcategories: [
      {
        id: 'classical',
        label: 'Classical Art',
        options: [
          { value: 'oil painting', label: 'Oil Painting', tier1Boost: 1.3, tier2Params: '--s 750', tier3Phrase: 'rendered as a classical oil painting' },
          { value: 'watercolor', label: 'Watercolor', tier1Boost: 1.2, tier3Phrase: 'painted in delicate watercolors' },
          { value: 'impressionist', label: 'Impressionist', tier1Boost: 1.3, tier3Phrase: 'in the impressionist style' },
          { value: 'baroque', label: 'Baroque', tier3Phrase: 'in dramatic baroque style' },
          { value: 'renaissance', label: 'Renaissance', tier3Phrase: 'in renaissance master style' },
          { value: 'rococo', label: 'Rococo', tier3Phrase: 'in ornate rococo style' },
          { value: 'pre-raphaelite', label: 'Pre-Raphaelite', tier3Phrase: 'in pre-raphaelite style' },
          { value: 'academic art', label: 'Academic Art', tier3Phrase: 'in academic art tradition' },
          { value: 'neoclassical', label: 'Neoclassical', tier3Phrase: 'in neoclassical style' },
          { value: 'romanticism', label: 'Romanticism', tier3Phrase: 'in romantic era style' }
        ]
      },
      {
        id: 'modern',
        label: 'Modern Art',
        options: [
          { value: 'art nouveau', label: 'Art Nouveau', tier1Boost: 1.2, tier3Phrase: 'in flowing art nouveau style' },
          { value: 'art deco', label: 'Art Deco', tier1Boost: 1.2, tier3Phrase: 'in geometric art deco style' },
          { value: 'surrealist', label: 'Surrealist', tier3Phrase: 'in surrealist dreamlike style' },
          { value: 'cubist', label: 'Cubist', tier3Phrase: 'in fragmented cubist style' },
          { value: 'expressionist', label: 'Expressionist', tier3Phrase: 'in bold expressionist style' },
          { value: 'abstract', label: 'Abstract', tier3Phrase: 'in abstract artistic style' },
          { value: 'minimalist', label: 'Minimalist', tier4Simple: 'simple minimal style', tier3Phrase: 'in clean minimalist style' },
          { value: 'pop art', label: 'Pop Art', tier3Phrase: 'in vibrant pop art style' },
          { value: 'bauhaus', label: 'Bauhaus', tier3Phrase: 'in bauhaus design style' },
          { value: 'de stijl', label: 'De Stijl', tier3Phrase: 'in de stijl geometric style' }
        ]
      },
      {
        id: 'digital',
        label: 'Digital Art',
        options: [
          { value: 'digital painting', label: 'Digital Painting', tier1Boost: 1.2, tier3Phrase: 'as a digital painting' },
          { value: 'concept art', label: 'Concept Art', tier1Boost: 1.3, tier2Params: '--s 500', tier3Phrase: 'as professional concept art' },
          { value: '3d render', label: '3D Render', tier1Boost: 1.2, tier3Phrase: 'as a 3D rendered image' },
          { value: 'matte painting', label: 'Matte Painting', tier3Phrase: 'as a cinematic matte painting' },
          { value: 'vector art', label: 'Vector Art', tier3Phrase: 'as clean vector art' },
          { value: 'low poly', label: 'Low Poly', tier3Phrase: 'in low poly 3D style' },
          { value: 'voxel art', label: 'Voxel Art', tier3Phrase: 'in voxel art style' },
          { value: 'pixel art', label: 'Pixel Art', tier4Simple: 'pixel art', tier3Phrase: 'in retro pixel art style' },
          { value: 'glitch art', label: 'Glitch Art', tier3Phrase: 'with glitch art effects' },
          { value: 'procedural', label: 'Procedural', tier3Phrase: 'with procedural generation' }
        ]
      },
      {
        id: 'anime',
        label: 'Anime & Manga',
        options: [
          { value: 'anime style', label: 'Anime Style', tier1Boost: 1.3, tier2Params: '--niji 6', tier3Phrase: 'in anime art style' },
          { value: 'manga style', label: 'Manga Style', tier3Phrase: 'in manga illustration style' },
          { value: 'studio ghibli', label: 'Studio Ghibli', tier1Boost: 1.4, tier3Phrase: 'in Studio Ghibli style' },
          { value: 'makoto shinkai', label: 'Makoto Shinkai', tier1Boost: 1.3, tier3Phrase: 'in Makoto Shinkai style' },
          { value: 'shonen', label: 'Shonen', tier3Phrase: 'in shonen manga style' },
          { value: 'shoujo', label: 'Shoujo', tier3Phrase: 'in shoujo manga style' },
          { value: 'chibi', label: 'Chibi', tier4Simple: 'cute chibi', tier3Phrase: 'in cute chibi style' },
          { value: 'ukiyo-e', label: 'Ukiyo-e', tier3Phrase: 'in traditional ukiyo-e style' },
          { value: 'cyberpunk anime', label: 'Cyberpunk Anime', tier3Phrase: 'in cyberpunk anime style' },
          { value: 'mecha anime', label: 'Mecha Anime', tier3Phrase: 'in mecha anime style' }
        ]
      },
      {
        id: 'aesthetic',
        label: 'Aesthetics',
        options: [
          { value: 'cyberpunk aesthetic', label: 'Cyberpunk', tier1Boost: 1.3, tier3Phrase: 'with cyberpunk aesthetic' },
          { value: 'steampunk', label: 'Steampunk', tier1Boost: 1.2, tier3Phrase: 'with steampunk aesthetic' },
          { value: 'solarpunk', label: 'Solarpunk', tier3Phrase: 'with solarpunk aesthetic' },
          { value: 'dieselpunk', label: 'Dieselpunk', tier3Phrase: 'with dieselpunk aesthetic' },
          { value: 'vaporwave', label: 'Vaporwave', tier3Phrase: 'with vaporwave aesthetic' },
          { value: 'synthwave', label: 'Synthwave', tier3Phrase: 'with synthwave aesthetic' },
          { value: 'dark academia', label: 'Dark Academia', tier3Phrase: 'with dark academia aesthetic' },
          { value: 'cottagecore', label: 'Cottagecore', tier3Phrase: 'with cottagecore aesthetic' },
          { value: 'gothic', label: 'Gothic', tier3Phrase: 'with gothic aesthetic' },
          { value: 'fantasy art', label: 'Fantasy Art', tier1Boost: 1.2, tier3Phrase: 'in fantasy art style' }
        ]
      },
      {
        id: 'photographic',
        label: 'Photographic',
        options: [
          { value: 'photorealistic', label: 'Photorealistic', tier1Boost: 1.4, tier3Phrase: 'with photorealistic quality' },
          { value: 'hyperrealistic', label: 'Hyperrealistic', tier1Boost: 1.4, tier3Phrase: 'with hyperrealistic detail' },
          { value: 'cinematic', label: 'Cinematic', tier1Boost: 1.3, tier2Params: '--ar 21:9', tier3Phrase: 'with cinematic quality' },
          { value: 'film photography', label: 'Film Photography', tier3Phrase: 'shot on film' },
          { value: 'polaroid', label: 'Polaroid', tier3Phrase: 'as a polaroid photograph' },
          { value: 'daguerreotype', label: 'Daguerreotype', tier3Phrase: 'as a vintage daguerreotype' },
          { value: 'infrared', label: 'Infrared', tier3Phrase: 'shot in infrared' },
          { value: 'double exposure', label: 'Double Exposure', tier3Phrase: 'with double exposure effect' },
          { value: 'long exposure', label: 'Long Exposure', tier3Phrase: 'with long exposure effect' },
          { value: 'macro photography', label: 'Macro Photography', tier3Phrase: 'as macro photography' }
        ]
      }
    ],
    flatOptions: []
  },

  environment: {
    id: 'environment',
    label: 'Environment',
    icon: '🌍',
    description: 'Location and setting',
    totalOptions: 300,
    subcategories: [
      {
        id: 'natural',
        label: 'Natural Landscapes',
        options: [
          { value: 'enchanted forest', label: 'Enchanted Forest', tier3Phrase: 'set in an enchanted forest' },
          { value: 'mountain peak', label: 'Mountain Peak', tier3Phrase: 'at a majestic mountain peak' },
          { value: 'ocean shore', label: 'Ocean Shore', tier3Phrase: 'by the ocean shore' },
          { value: 'desert oasis', label: 'Desert Oasis', tier3Phrase: 'at a desert oasis' },
          { value: 'tropical jungle', label: 'Tropical Jungle', tier3Phrase: 'in a tropical jungle' },
          { value: 'arctic tundra', label: 'Arctic Tundra', tier3Phrase: 'across arctic tundra' },
          { value: 'volcanic landscape', label: 'Volcanic Landscape', tier3Phrase: 'amid volcanic landscape' },
          { value: 'crystal cave', label: 'Crystal Cave', tier3Phrase: 'inside a crystal cave' },
          { value: 'floating islands', label: 'Floating Islands', tier3Phrase: 'among floating islands' },
          { value: 'bioluminescent forest', label: 'Bioluminescent Forest', tier3Phrase: 'in a bioluminescent forest' }
        ]
      },
      {
        id: 'urban',
        label: 'Urban Environments',
        options: [
          { value: 'cyberpunk city', label: 'Cyberpunk City', tier1Boost: 1.2, tier3Phrase: 'in a neon-lit cyberpunk city' },
          { value: 'futuristic metropolis', label: 'Futuristic Metropolis', tier3Phrase: 'in a futuristic metropolis' },
          { value: 'medieval town', label: 'Medieval Town', tier3Phrase: 'in a medieval town' },
          { value: 'victorian street', label: 'Victorian Street', tier3Phrase: 'on a victorian street' },
          { value: 'tokyo at night', label: 'Tokyo at Night', tier3Phrase: 'in Tokyo at night' },
          { value: 'new york skyline', label: 'New York Skyline', tier3Phrase: 'with the New York skyline' },
          { value: 'ancient marketplace', label: 'Ancient Marketplace', tier3Phrase: 'in an ancient marketplace' },
          { value: 'neon alleyway', label: 'Neon Alleyway', tier3Phrase: 'in a neon-lit alleyway' },
          { value: 'rooftop garden', label: 'Rooftop Garden', tier3Phrase: 'in a rooftop garden' },
          { value: 'underground bunker', label: 'Underground Bunker', tier3Phrase: 'inside an underground bunker' }
        ]
      },
      {
        id: 'architectural',
        label: 'Architectural',
        options: [
          { value: 'gothic cathedral', label: 'Gothic Cathedral', tier3Phrase: 'inside a gothic cathedral' },
          { value: 'ancient ruins', label: 'Ancient Ruins', tier3Phrase: 'among ancient ruins' },
          { value: 'japanese temple', label: 'Japanese Temple', tier3Phrase: 'at a japanese temple' },
          { value: 'underwater palace', label: 'Underwater Palace', tier3Phrase: 'in an underwater palace' },
          { value: 'space station', label: 'Space Station', tier3Phrase: 'aboard a space station' },
          { value: 'castle throne room', label: 'Castle Throne Room', tier3Phrase: 'in a castle throne room' },
          { value: 'library of babel', label: 'Library of Babel', tier3Phrase: 'in an infinite library' },
          { value: 'grand ballroom', label: 'Grand Ballroom', tier3Phrase: 'in a grand ballroom' },
          { value: 'clockwork tower', label: 'Clockwork Tower', tier3Phrase: 'inside a clockwork tower' },
          { value: 'floating citadel', label: 'Floating Citadel', tier3Phrase: 'in a floating citadel' }
        ]
      }
    ],
    flatOptions: []
  },

  composition: {
    id: 'composition',
    label: 'Composition',
    icon: '📐',
    description: 'Framing and perspective',
    totalOptions: 300,
    subcategories: [
      {
        id: 'classical',
        label: 'Classical Compositions',
        options: [
          { value: 'rule of thirds', label: 'Rule of Thirds', tier2Params: '--ar 3:2' },
          { value: 'golden ratio', label: 'Golden Ratio' },
          { value: 'centered composition', label: 'Centered Composition' },
          { value: 'symmetrical balance', label: 'Symmetrical Balance' },
          { value: 'leading lines', label: 'Leading Lines' },
          { value: 'frame within frame', label: 'Frame Within Frame' },
          { value: 'diagonal composition', label: 'Diagonal Composition' },
          { value: 'triangular composition', label: 'Triangular Composition' },
          { value: 'negative space', label: 'Negative Space' },
          { value: 'fill the frame', label: 'Fill the Frame' }
        ]
      },
      {
        id: 'perspectives',
        label: 'Perspectives',
        options: [
          { value: 'bird\'s eye view', label: 'Bird\'s Eye View', tier3Phrase: 'from a bird\'s eye view' },
          { value: 'worm\'s eye view', label: 'Worm\'s Eye View', tier3Phrase: 'from a low angle looking up' },
          { value: 'dutch angle', label: 'Dutch Angle', tier3Phrase: 'with a tilted dutch angle' },
          { value: 'isometric view', label: 'Isometric View' },
          { value: 'first person view', label: 'First Person View', tier3Phrase: 'from first person perspective' },
          { value: 'over the shoulder', label: 'Over the Shoulder' },
          { value: 'panoramic view', label: 'Panoramic View', tier2Params: '--ar 21:9' },
          { value: 'forced perspective', label: 'Forced Perspective' },
          { value: 'aerial view', label: 'Aerial View', tier3Phrase: 'from an aerial view' },
          { value: 'underwater view', label: 'Underwater View', tier3Phrase: 'from underwater perspective' }
        ]
      }
    ],
    flatOptions: []
  },

  camera: {
    id: 'camera',
    label: 'Camera',
    icon: '📷',
    description: 'Lens and camera settings',
    totalOptions: 300,
    subcategories: [
      {
        id: 'lenses',
        label: 'Lenses',
        options: [
          { value: '50mm lens', label: '50mm Lens', tier3Phrase: 'shot with a 50mm lens' },
          { value: '85mm portrait lens', label: '85mm Portrait', tier3Phrase: 'shot with an 85mm portrait lens' },
          { value: '35mm lens', label: '35mm Lens', tier3Phrase: 'shot with a 35mm lens' },
          { value: '24mm wide angle', label: '24mm Wide Angle', tier3Phrase: 'shot with a 24mm wide angle' },
          { value: '200mm telephoto', label: '200mm Telephoto', tier3Phrase: 'shot with a 200mm telephoto' },
          { value: 'macro lens', label: 'Macro Lens', tier3Phrase: 'shot with a macro lens' },
          { value: 'fisheye lens', label: 'Fisheye Lens', tier3Phrase: 'shot with a fisheye lens' },
          { value: 'tilt-shift lens', label: 'Tilt-Shift Lens', tier3Phrase: 'shot with a tilt-shift lens' },
          { value: 'anamorphic lens', label: 'Anamorphic Lens', tier2Params: '--ar 2.39:1', tier3Phrase: 'shot with an anamorphic lens' },
          { value: 'vintage lens', label: 'Vintage Lens', tier3Phrase: 'shot with a vintage lens' }
        ]
      },
      {
        id: 'settings',
        label: 'Camera Settings',
        options: [
          { value: 'shallow depth of field', label: 'Shallow DOF', tier1Boost: 1.1, tier3Phrase: 'with shallow depth of field' },
          { value: 'deep focus', label: 'Deep Focus', tier3Phrase: 'with everything in sharp focus' },
          { value: 'bokeh background', label: 'Bokeh Background', tier1Boost: 1.2, tier3Phrase: 'with beautiful bokeh' },
          { value: 'motion blur', label: 'Motion Blur', tier3Phrase: 'with motion blur effect' },
          { value: 'high speed capture', label: 'High Speed Capture', tier3Phrase: 'captured at high speed' },
          { value: 'long exposure', label: 'Long Exposure', tier3Phrase: 'with long exposure trails' },
          { value: 'HDR photography', label: 'HDR Photography', tier3Phrase: 'in HDR' },
          { value: 'low light', label: 'Low Light', tier3Phrase: 'shot in low light' },
          { value: 'flash photography', label: 'Flash Photography', tier3Phrase: 'with flash photography' },
          { value: 'natural light only', label: 'Natural Light Only', tier3Phrase: 'using only natural light' }
        ]
      }
    ],
    flatOptions: []
  },

  lighting: {
    id: 'lighting',
    label: 'Lighting',
    icon: '💡',
    description: 'Light sources and quality',
    totalOptions: 300,
    subcategories: [
      {
        id: 'natural',
        label: 'Natural Lighting',
        options: [
          { value: 'golden hour', label: 'Golden Hour', tier1Boost: 1.3, tier3Phrase: 'bathed in golden hour light' },
          { value: 'blue hour', label: 'Blue Hour', tier3Phrase: 'during the blue hour' },
          { value: 'midday sun', label: 'Midday Sun', tier3Phrase: 'under bright midday sun' },
          { value: 'overcast soft', label: 'Overcast Soft', tier3Phrase: 'under soft overcast light' },
          { value: 'dappled sunlight', label: 'Dappled Sunlight', tier3Phrase: 'with dappled sunlight' },
          { value: 'sunrise', label: 'Sunrise', tier3Phrase: 'at sunrise' },
          { value: 'sunset', label: 'Sunset', tier3Phrase: 'at sunset' },
          { value: 'moonlight', label: 'Moonlight', tier3Phrase: 'illuminated by moonlight' },
          { value: 'starlight', label: 'Starlight', tier3Phrase: 'under starlight' },
          { value: 'northern lights', label: 'Northern Lights', tier3Phrase: 'beneath the northern lights' }
        ]
      },
      {
        id: 'artificial',
        label: 'Artificial Lighting',
        options: [
          { value: 'neon glow', label: 'Neon Glow', tier1Boost: 1.2, tier3Phrase: 'glowing with neon light' },
          { value: 'candlelight', label: 'Candlelight', tier3Phrase: 'by candlelight' },
          { value: 'studio lighting', label: 'Studio Lighting', tier3Phrase: 'with professional studio lighting' },
          { value: 'spotlight', label: 'Spotlight', tier3Phrase: 'under a dramatic spotlight' },
          { value: 'bioluminescent', label: 'Bioluminescent', tier3Phrase: 'with bioluminescent glow' },
          { value: 'holographic', label: 'Holographic', tier3Phrase: 'with holographic lighting' },
          { value: 'blacklight UV', label: 'Blacklight UV', tier3Phrase: 'under UV blacklight' },
          { value: 'LED strips', label: 'LED Strips', tier3Phrase: 'with colorful LED strips' },
          { value: 'fire light', label: 'Fire Light', tier3Phrase: 'by firelight' },
          { value: 'laser light', label: 'Laser Light', tier3Phrase: 'with laser light effects' }
        ]
      },
      {
        id: 'dramatic',
        label: 'Dramatic Lighting',
        options: [
          { value: 'dramatic lighting', label: 'Dramatic Lighting', tier1Boost: 1.2, tier3Phrase: 'with dramatic lighting' },
          { value: 'chiaroscuro', label: 'Chiaroscuro', tier3Phrase: 'with chiaroscuro contrast' },
          { value: 'rim lighting', label: 'Rim Lighting', tier3Phrase: 'with rim lighting' },
          { value: 'backlighting', label: 'Backlighting', tier3Phrase: 'with strong backlighting' },
          { value: 'volumetric rays', label: 'Volumetric Rays', tier1Boost: 1.2, tier3Phrase: 'with volumetric light rays' },
          { value: 'god rays', label: 'God Rays', tier3Phrase: 'with god rays streaming down' },
          { value: 'silhouette lighting', label: 'Silhouette Lighting', tier3Phrase: 'creating a silhouette' },
          { value: 'split lighting', label: 'Split Lighting', tier3Phrase: 'with dramatic split lighting' },
          { value: 'contre-jour', label: 'Contre-Jour', tier3Phrase: 'shot contre-jour' },
          { value: 'low key', label: 'Low Key', tier3Phrase: 'with low key lighting' }
        ]
      }
    ],
    flatOptions: []
  },

  atmosphere: {
    id: 'atmosphere',
    label: 'Atmosphere',
    icon: '🌫️',
    description: 'Mood and environmental effects',
    totalOptions: 300,
    subcategories: [
      {
        id: 'moods',
        label: 'Moods',
        options: [
          { value: 'mysterious', label: 'Mysterious', tier3Phrase: 'with a mysterious atmosphere' },
          { value: 'serene', label: 'Serene', tier3Phrase: 'with a serene atmosphere' },
          { value: 'dramatic', label: 'Dramatic', tier3Phrase: 'with dramatic atmosphere' },
          { value: 'ethereal', label: 'Ethereal', tier3Phrase: 'with an ethereal quality' },
          { value: 'melancholic', label: 'Melancholic', tier3Phrase: 'with melancholic mood' },
          { value: 'energetic', label: 'Energetic', tier3Phrase: 'with energetic atmosphere' },
          { value: 'mystical', label: 'Mystical', tier3Phrase: 'with mystical atmosphere' },
          { value: 'ominous', label: 'Ominous', tier3Phrase: 'with ominous atmosphere' },
          { value: 'whimsical', label: 'Whimsical', tier3Phrase: 'with whimsical charm' },
          { value: 'romantic', label: 'Romantic', tier3Phrase: 'with romantic atmosphere' }
        ]
      },
      {
        id: 'effects',
        label: 'Environmental Effects',
        options: [
          { value: 'fog', label: 'Fog', tier1Boost: 1.1, tier3Phrase: 'shrouded in fog' },
          { value: 'mist', label: 'Mist', tier3Phrase: 'with gentle mist' },
          { value: 'rain', label: 'Rain', tier3Phrase: 'with rain falling' },
          { value: 'snow', label: 'Snow', tier3Phrase: 'with falling snow' },
          { value: 'dust particles', label: 'Dust Particles', tier3Phrase: 'with dust particles in the air' },
          { value: 'smoke', label: 'Smoke', tier3Phrase: 'with swirling smoke' },
          { value: 'sparks', label: 'Sparks', tier3Phrase: 'with flying sparks' },
          { value: 'cherry blossoms', label: 'Cherry Blossoms', tier3Phrase: 'with cherry blossom petals' },
          { value: 'fireflies', label: 'Fireflies', tier3Phrase: 'with glowing fireflies' },
          { value: 'aurora', label: 'Aurora', tier3Phrase: 'beneath the aurora' }
        ]
      }
    ],
    flatOptions: []
  },

  colour: {
    id: 'colour',
    label: 'Colour / Grade',
    icon: '🎭',
    description: 'Color palette and grading',
    totalOptions: 300,
    subcategories: [
      {
        id: 'palettes',
        label: 'Color Palettes',
        options: [
          { value: 'vibrant colors', label: 'Vibrant Colors', tier3Phrase: 'with vibrant colors' },
          { value: 'muted tones', label: 'Muted Tones', tier3Phrase: 'with muted tones' },
          { value: 'warm palette', label: 'Warm Palette', tier3Phrase: 'with a warm color palette' },
          { value: 'cool tones', label: 'Cool Tones', tier3Phrase: 'with cool tones' },
          { value: 'pastel colors', label: 'Pastel Colors', tier3Phrase: 'in soft pastel colors' },
          { value: 'neon colors', label: 'Neon Colors', tier3Phrase: 'with neon colors' },
          { value: 'earth tones', label: 'Earth Tones', tier3Phrase: 'in natural earth tones' },
          { value: 'jewel tones', label: 'Jewel Tones', tier3Phrase: 'in rich jewel tones' },
          { value: 'monochromatic', label: 'Monochromatic', tier3Phrase: 'in monochromatic tones' },
          { value: 'black and white', label: 'Black and White', tier4Simple: 'black and white', tier3Phrase: 'in black and white' }
        ]
      },
      {
        id: 'grading',
        label: 'Color Grading',
        options: [
          { value: 'teal and orange', label: 'Teal and Orange', tier1Boost: 1.1, tier3Phrase: 'with teal and orange color grading' },
          { value: 'cinematic grade', label: 'Cinematic Grade', tier3Phrase: 'with cinematic color grading' },
          { value: 'vintage grade', label: 'Vintage Grade', tier3Phrase: 'with vintage color grading' },
          { value: 'desaturated', label: 'Desaturated', tier3Phrase: 'with desaturated colors' },
          { value: 'high contrast', label: 'High Contrast', tier3Phrase: 'with high contrast' },
          { value: 'sepia', label: 'Sepia', tier3Phrase: 'in sepia tones' },
          { value: 'cross processed', label: 'Cross Processed', tier3Phrase: 'with cross-processed colors' },
          { value: 'bleach bypass', label: 'Bleach Bypass', tier3Phrase: 'with bleach bypass effect' },
          { value: 'technicolor', label: 'Technicolor', tier3Phrase: 'in technicolor style' },
          { value: 'split toning', label: 'Split Toning', tier3Phrase: 'with split toning' }
        ]
      }
    ],
    flatOptions: []
  },

  materials: {
    id: 'materials',
    label: 'Materials',
    icon: '🧱',
    description: 'Textures and surfaces',
    totalOptions: 300,
    subcategories: [
      {
        id: 'natural',
        label: 'Natural Materials',
        options: [
          { value: 'marble texture', label: 'Marble Texture', tier3Phrase: 'with marble textures' },
          { value: 'weathered wood', label: 'Weathered Wood', tier3Phrase: 'with weathered wood textures' },
          { value: 'rough stone', label: 'Rough Stone', tier3Phrase: 'with rough stone surfaces' },
          { value: 'organic textures', label: 'Organic Textures', tier3Phrase: 'with organic natural textures' },
          { value: 'crystal surfaces', label: 'Crystal Surfaces', tier3Phrase: 'with crystalline surfaces' },
          { value: 'moss covered', label: 'Moss Covered', tier3Phrase: 'covered in moss' },
          { value: 'ice crystal', label: 'Ice Crystal', tier3Phrase: 'with ice crystal textures' },
          { value: 'sand texture', label: 'Sand Texture', tier3Phrase: 'with sand textures' },
          { value: 'bark texture', label: 'Bark Texture', tier3Phrase: 'with bark textures' },
          { value: 'coral reef', label: 'Coral Reef', tier3Phrase: 'with coral reef textures' }
        ]
      },
      {
        id: 'metallic',
        label: 'Metallic',
        options: [
          { value: 'chrome reflection', label: 'Chrome Reflection', tier1Boost: 1.1, tier3Phrase: 'with chrome reflections' },
          { value: 'gold ornate', label: 'Gold Ornate', tier3Phrase: 'with ornate gold details' },
          { value: 'copper patina', label: 'Copper Patina', tier3Phrase: 'with copper patina' },
          { value: 'brushed steel', label: 'Brushed Steel', tier3Phrase: 'with brushed steel surfaces' },
          { value: 'bronze finish', label: 'Bronze Finish', tier3Phrase: 'with bronze finish' },
          { value: 'rusted metal', label: 'Rusted Metal', tier3Phrase: 'with rusted metal textures' },
          { value: 'silver filigree', label: 'Silver Filigree', tier3Phrase: 'with silver filigree' },
          { value: 'iridescent metal', label: 'Iridescent Metal', tier3Phrase: 'with iridescent metal surfaces' },
          { value: 'hammered metal', label: 'Hammered Metal', tier3Phrase: 'with hammered metal texture' },
          { value: 'polished brass', label: 'Polished Brass', tier3Phrase: 'with polished brass' }
        ]
      },
      {
        id: 'fabrics',
        label: 'Fabrics',
        options: [
          { value: 'velvet fabric', label: 'Velvet Fabric', tier3Phrase: 'with rich velvet textures' },
          { value: 'silk flowing', label: 'Silk Flowing', tier3Phrase: 'with flowing silk' },
          { value: 'leather worn', label: 'Leather Worn', tier3Phrase: 'with worn leather textures' },
          { value: 'lace delicate', label: 'Lace Delicate', tier3Phrase: 'with delicate lace' },
          { value: 'embroidered', label: 'Embroidered', tier3Phrase: 'with embroidered details' },
          { value: 'knitted wool', label: 'Knitted Wool', tier3Phrase: 'with knitted wool textures' },
          { value: 'burlap rough', label: 'Burlap Rough', tier3Phrase: 'with rough burlap' },
          { value: 'sequined', label: 'Sequined', tier3Phrase: 'with sequined surfaces' },
          { value: 'feathered', label: 'Feathered', tier3Phrase: 'with feathered textures' },
          { value: 'fur texture', label: 'Fur Texture', tier3Phrase: 'with fur textures' }
        ]
      }
    ],
    flatOptions: []
  },

  fidelity: {
    id: 'fidelity',
    label: 'Fidelity',
    icon: '✨',
    description: 'Quality and detail boosters',
    totalOptions: 300,
    subcategories: [
      {
        id: 'quality',
        label: 'Quality Boosters',
        options: [
          { value: 'masterpiece', label: 'Masterpiece', tier1Boost: 1.3 },
          { value: 'best quality', label: 'Best Quality', tier1Boost: 1.3 },
          { value: 'highly detailed', label: 'Highly Detailed', tier1Boost: 1.2 },
          { value: 'ultra detailed', label: 'Ultra Detailed', tier1Boost: 1.3 },
          { value: 'intricate details', label: 'Intricate Details', tier1Boost: 1.2 },
          { value: 'sharp focus', label: 'Sharp Focus', tier1Boost: 1.1 },
          { value: 'professional', label: 'Professional', tier1Boost: 1.1 },
          { value: 'award winning', label: 'Award Winning', tier1Boost: 1.2 },
          { value: 'trending on artstation', label: 'Trending on ArtStation', tier1Boost: 1.2 },
          { value: 'featured on behance', label: 'Featured on Behance', tier1Boost: 1.1 }
        ]
      },
      {
        id: 'resolution',
        label: 'Resolution',
        options: [
          { value: '4k resolution', label: '4K Resolution', tier1Boost: 1.1 },
          { value: '8k resolution', label: '8K Resolution', tier1Boost: 1.2 },
          { value: 'ultra HD', label: 'Ultra HD', tier1Boost: 1.1 },
          { value: 'high resolution', label: 'High Resolution', tier1Boost: 1.1 },
          { value: 'crisp details', label: 'Crisp Details', tier1Boost: 1.1 },
          { value: 'print quality', label: 'Print Quality' },
          { value: 'wallpaper quality', label: 'Wallpaper Quality' },
          { value: 'publication ready', label: 'Publication Ready' },
          { value: 'gallery quality', label: 'Gallery Quality' },
          { value: 'museum quality', label: 'Museum Quality', tier1Boost: 1.2 }
        ]
      },
      {
        id: 'rendering',
        label: 'Rendering Quality',
        options: [
          { value: 'octane render', label: 'Octane Render', tier1Boost: 1.2 },
          { value: 'unreal engine', label: 'Unreal Engine', tier1Boost: 1.2 },
          { value: 'ray tracing', label: 'Ray Tracing', tier1Boost: 1.1 },
          { value: 'global illumination', label: 'Global Illumination' },
          { value: 'subsurface scattering', label: 'Subsurface Scattering' },
          { value: 'physically based rendering', label: 'PBR' },
          { value: 'photogrammetry', label: 'Photogrammetry' },
          { value: 'HDRI lighting', label: 'HDRI Lighting' },
          { value: 'ambient occlusion', label: 'Ambient Occlusion' },
          { value: 'path tracing', label: 'Path Tracing' }
        ]
      }
    ],
    flatOptions: []
  },

  negative: {
    id: 'negative',
    label: 'Constraints',
    icon: '🚫',
    description: 'Elements to avoid',
    totalOptions: 1000,
    subcategories: [
      {
        id: 'quality',
        label: 'Quality Issues',
        options: [
          { value: 'blurry', label: 'Blurry' },
          { value: 'low quality', label: 'Low Quality' },
          { value: 'low resolution', label: 'Low Resolution' },
          { value: 'jpeg artifacts', label: 'JPEG Artifacts' },
          { value: 'pixelated', label: 'Pixelated' },
          { value: 'grainy', label: 'Grainy' },
          { value: 'noisy', label: 'Noisy' },
          { value: 'overexposed', label: 'Overexposed' },
          { value: 'underexposed', label: 'Underexposed' },
          { value: 'out of focus', label: 'Out of Focus' }
        ]
      },
      {
        id: 'anatomy',
        label: 'Anatomy Issues',
        options: [
          { value: 'bad anatomy', label: 'Bad Anatomy' },
          { value: 'deformed', label: 'Deformed' },
          { value: 'disfigured', label: 'Disfigured' },
          { value: 'mutation', label: 'Mutation' },
          { value: 'extra limbs', label: 'Extra Limbs' },
          { value: 'missing limbs', label: 'Missing Limbs' },
          { value: 'bad hands', label: 'Bad Hands' },
          { value: 'extra fingers', label: 'Extra Fingers' },
          { value: 'missing fingers', label: 'Missing Fingers' },
          { value: 'fused fingers', label: 'Fused Fingers' }
        ]
      },
      {
        id: 'composition',
        label: 'Composition Issues',
        options: [
          { value: 'cropped', label: 'Cropped' },
          { value: 'out of frame', label: 'Out of Frame' },
          { value: 'duplicate', label: 'Duplicate' },
          { value: 'cloned face', label: 'Cloned Face' },
          { value: 'bad composition', label: 'Bad Composition' },
          { value: 'poorly drawn', label: 'Poorly Drawn' },
          { value: 'amateur', label: 'Amateur' },
          { value: 'ugly', label: 'Ugly' },
          { value: 'worst quality', label: 'Worst Quality' },
          { value: 'gross proportions', label: 'Gross Proportions' }
        ]
      },
      {
        id: 'unwanted',
        label: 'Unwanted Elements',
        options: [
          { value: 'watermark', label: 'Watermark' },
          { value: 'signature', label: 'Signature' },
          { value: 'text', label: 'Text' },
          { value: 'logo', label: 'Logo' },
          { value: 'username', label: 'Username' },
          { value: 'border', label: 'Border' },
          { value: 'frame', label: 'Frame' },
          { value: 'collage', label: 'Collage' },
          { value: 'split image', label: 'Split Image' },
          { value: 'multiple views', label: 'Multiple Views' }
        ]
      }
    ],
    flatOptions: []
  }
};

// Flatten options for each category
Object.values(VOCABULARY_DATA).forEach(cat => {
  cat.flatOptions = cat.subcategories.flatMap(sub => sub.options);
});

// ============================================================================
// VOCABULARY ACCESS FUNCTIONS
// ============================================================================

/**
 * Get all options for a category
 */
export function getCategoryOptions(category: PromptCategory): VocabularyOption[] {
  return VOCABULARY_DATA[category]?.flatOptions || [];
}

/**
 * Get subcategories for a category
 */
export function getCategorySubcategories(category: PromptCategory): SubcategoryGroup[] {
  return VOCABULARY_DATA[category]?.subcategories || [];
}

/**
 * Get category metadata
 */
export function getCategoryInfo(category: PromptCategory): CategoryVocabulary | undefined {
  return VOCABULARY_DATA[category];
}

/**
 * Search options within a category
 */
export function searchCategoryOptions(category: PromptCategory, query: string): VocabularyOption[] {
  const options = getCategoryOptions(category);
  const q = query.toLowerCase();
  return options.filter(opt =>
    opt.value.toLowerCase().includes(q) ||
    opt.label.toLowerCase().includes(q) ||
    opt.subcategory?.toLowerCase().includes(q) ||
    opt.tags?.some(t => t.toLowerCase().includes(q))
  );
}

/**
 * Get random options for randomize feature
 */
export function getRandomOptions(category: PromptCategory, count: number): VocabularyOption[] {
  const options = getCategoryOptions(category);
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get tier-optimized value for an option
 */
export function getTierOptimizedValue(option: VocabularyOption, tier: PlatformTier): string {
  switch (tier) {
    case 1: // CLIP - use weights
      return option.tier1Boost ? `(${option.value}:${option.tier1Boost})` : option.value;
    case 2: // Midjourney - use params
      return option.tier2Params ? `${option.value} ${option.tier2Params}` : option.value;
    case 3: // Natural - use phrases
      return option.tier3Phrase || option.value;
    case 4: // Plain - use simplified
      return option.tier4Simple || option.value;
    default:
      return option.value;
  }
}

/**
 * Get all vocabulary statistics
 */
export function getVocabularyStats(): {
  totalCategories: number;
  totalOptions: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
} {
  const categories = Object.values(VOCABULARY_DATA);
  const breakdown = categories.map(cat => ({
    category: cat.label,
    count: cat.flatOptions.length
  }));
  
  return {
    totalCategories: categories.length,
    totalOptions: breakdown.reduce((sum, c) => sum + c.count, 0),
    categoryBreakdown: breakdown
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { VOCABULARY_DATA };
