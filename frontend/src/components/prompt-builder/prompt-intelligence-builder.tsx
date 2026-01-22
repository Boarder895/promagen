/**
 * PromptIntelligenceBuilder Component
 * =====================================
 * The complete intelligent prompt builder with 4-tier generation,
 * conflict detection, style suggestions, and market mood integration.
 * 
 * This is the main component that orchestrates all prompt intelligence features.
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

'use client';

import React, { useCallback } from 'react';
import { usePromptIntelligence } from '../../hooks/use-prompt-intelligence';
import { FourTierPromptPreview } from './four-tier-prompt-preview';
import { IntelligencePanel } from './intelligence-panel';
import type {
  PromptCategory,
  PlatformTier,
  StyleSuggestion
} from '../../types/prompt-intelligence';
import { CATEGORY_ORDER, CATEGORY_META, TIER_CONFIGS } from '../../types/prompt-intelligence';

// ============================================================================
// TYPES
// ============================================================================

interface PromptIntelligenceBuilderProps {
  platformId: string;
  platformName?: string;
  isPro?: boolean;
  isLocked?: boolean;
  marketState?: string;
  weather?: {
    temperature?: number;
    humidity?: number;
    conditions?: string;
    city?: string;
  };
  onPromptCopy?: (tier: PlatformTier, prompt: string) => void;
  className?: string;
}

// ============================================================================
// VOCABULARY DATA (would come from vocabulary layer in real implementation)
// ============================================================================

const VOCABULARY_OPTIONS: Record<PromptCategory, string[]> = {
  subject: [
    'portrait of a woman', 'portrait of a man', 'fantasy warrior', 'cyberpunk hacker',
    'mythical dragon', 'ancient samurai', 'ethereal fairy', 'steampunk inventor',
    'space explorer', 'underwater mermaid', 'phoenix rising', 'mechanical owl',
    'forest spirit', 'demon lord', 'angel guardian', 'robot companion',
    'witch brewing potion', 'knight in armor', 'princess in castle', 'pirate captain'
  ],
  action: [
    'standing confidently', 'sitting peacefully', 'running dynamically', 'flying through air',
    'casting magic spell', 'wielding sword', 'reading ancient book', 'meditating deeply',
    'dancing gracefully', 'fighting fiercely', 'exploring ruins', 'climbing mountain',
    'swimming underwater', 'riding horse', 'playing instrument', 'creating art'
  ],
  style: [
    'oil painting', 'digital art', 'watercolor', 'concept art', 'anime style',
    'impressionist', 'art nouveau', 'cyberpunk aesthetic', 'fantasy art', 'photorealistic',
    'studio ghibli', 'ukiyo-e', 'baroque', 'minimalist', 'surrealist',
    'pop art', 'gothic', 'vaporwave', 'steampunk', 'art deco'
  ],
  environment: [
    'enchanted forest', 'cyberpunk city', 'ancient ruins', 'underwater palace',
    'mountain peak', 'space station', 'japanese garden', 'gothic cathedral',
    'desert oasis', 'crystal cave', 'floating islands', 'volcanic landscape',
    'arctic tundra', 'tropical paradise', 'haunted mansion', 'futuristic lab'
  ],
  composition: [
    'rule of thirds', 'centered composition', 'dynamic diagonal', 'golden ratio',
    'symmetrical balance', 'frame within frame', 'leading lines', 'negative space',
    'bird\'s eye view', 'worm\'s eye view', 'dutch angle', 'panoramic wide'
  ],
  camera: [
    '50mm lens', '85mm portrait lens', 'wide angle 24mm', 'telephoto 200mm',
    'macro close-up', 'fisheye lens', 'tilt-shift', 'cinematic anamorphic',
    'low angle shot', 'high angle shot', 'eye level', 'over the shoulder'
  ],
  lighting: [
    'golden hour', 'dramatic lighting', 'soft diffused', 'neon glow',
    'moonlight', 'volumetric rays', 'rim lighting', 'chiaroscuro',
    'studio lighting', 'candlelight', 'bioluminescent', 'aurora borealis',
    'sunset backlight', 'harsh midday sun', 'overcast soft', 'spotlight dramatic'
  ],
  atmosphere: [
    'mysterious', 'serene', 'dramatic', 'ethereal', 'melancholic',
    'energetic', 'mystical', 'peaceful', 'intense', 'dreamy',
    'ominous', 'whimsical', 'romantic', 'epic', 'nostalgic',
    'futuristic', 'ancient', 'magical', 'apocalyptic', 'utopian'
  ],
  colour: [
    'vibrant colors', 'muted tones', 'warm palette', 'cool tones', 'teal and orange',
    'monochromatic', 'pastel colors', 'neon colors', 'earth tones', 'jewel tones',
    'black and white', 'sepia', 'high contrast', 'desaturated', 'color splash'
  ],
  materials: [
    'marble texture', 'chrome reflection', 'velvet fabric', 'weathered wood',
    'crystal surfaces', 'metallic sheen', 'organic textures', 'glass transparency',
    'leather worn', 'silk flowing', 'stone ancient', 'gold ornate',
    'copper patina', 'ice crystal', 'fire ember', 'water ripple'
  ],
  fidelity: [
    'highly detailed', 'masterpiece', '8k resolution', 'intricate details',
    'sharp focus', 'professional quality', 'award winning', 'trending on artstation',
    'photorealistic', 'ultra detailed', 'best quality', 'high resolution',
    'studio quality', 'cinematic quality', 'publication ready', 'museum quality'
  ],
  negative: [
    'blurry', 'low quality', 'bad anatomy', 'watermark', 'signature',
    'ugly', 'deformed', 'mutation', 'extra limbs', 'poorly drawn',
    'disfigured', 'out of frame', 'duplicate', 'cropped', 'worst quality',
    'jpeg artifacts', 'lowres', 'bad hands', 'extra fingers', 'missing fingers'
  ]
};

// ============================================================================
// CATEGORY DROPDOWN COMPONENT
// ============================================================================

interface CategoryDropdownProps {
  category: PromptCategory;
  selections: string[];
  limit: number;
  disabled: boolean;
  conflicts: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

function CategoryDropdown({
  category,
  selections,
  limit,
  disabled,
  conflicts,
  onAdd,
  onRemove
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const meta = CATEGORY_META[category];
  const options = VOCABULARY_OPTIONS[category];
  
  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase()) &&
    !selections.includes(opt)
  );
  
  const hasConflict = conflicts.some(c =>
    selections.some(s => s.toLowerCase().includes(c.toLowerCase()))
  );
  
  return (
    <div className={`relative ${category === 'negative' ? 'col-span-full' : ''}`}>
      {/* Label */}
      <label className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">{meta.icon}</span>
        <span className="text-sm font-medium text-white/80">{meta.label}</span>
        <span className="text-xs text-white/40">
          ({selections.length}/{limit})
        </span>
        {hasConflict && (
          <span className="px-1.5 py-0.5 bg-orange-500/20 rounded text-xs text-orange-400">
            ⚠️ Conflict
          </span>
        )}
      </label>
      
      {/* Selected tags */}
      {selections.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selections.map((sel, i) => (
            <span
              key={i}
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm
                ${conflicts.some(c => sel.toLowerCase().includes(c.toLowerCase()))
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                  : 'bg-white/10 text-white/80'
                }
              `}
            >
              {sel}
              <button
                onClick={() => onRemove(sel)}
                className="hover:text-red-400 transition-colors"
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Dropdown trigger */}
      <div className="relative">
        <input
          type="text"
          placeholder={disabled ? 'Locked' : `Search ${meta.label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          disabled={disabled || selections.length >= limit}
          className={`
            w-full px-4 py-2.5 rounded-xl text-sm
            bg-white/5 border border-white/10
            text-white placeholder-white/40
            focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled ? 'bg-purple-500/10 border-purple-500/30' : ''}
          `}
        />
        
        {/* Dropdown */}
        {isOpen && !disabled && selections.length < limit && (
          <div className="absolute z-50 w-full mt-1 py-2 rounded-xl bg-gray-900 border border-white/20 shadow-xl max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-2 text-sm text-white/40">No options found</p>
            ) : (
              filteredOptions.slice(0, 20).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onAdd(opt);
                    setSearch('');
                    if (selections.length + 1 >= limit) {
                      setIsOpen(false);
                    }
                  }}
                  className={`
                    w-full px-4 py-2 text-left text-sm
                    hover:bg-white/10 transition-colors
                    ${conflicts.includes(opt.toLowerCase())
                      ? 'text-orange-400'
                      : 'text-white/80'
                    }
                  `}
                >
                  {opt}
                  {conflicts.includes(opt.toLowerCase()) && (
                    <span className="ml-2 text-xs text-orange-400">⚠️ conflict</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close dropdown"
        />
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PromptIntelligenceBuilder({
  platformId,
  platformName,
  isPro = false,
  isLocked = false,
  marketState,
  weather,
  onPromptCopy,
  className = ''
}: PromptIntelligenceBuilderProps) {
  // Use the intelligence hook
  const {
    selections,
    tier,
    limits,
    prompts,
    conflicts,
    suggestions,
    platformHints,
    marketMood,
    weatherSuggestions,
    addToSelection,
    removeFromSelection,
    clearAll,
    randomize,
    getCategoryConflicts,
    copyPrompt: _copyPrompt
  } = usePromptIntelligence({
    platformId,
    isPro,
    marketState,
    weather
  });
  
  const tierConfig = TIER_CONFIGS[tier];
  
  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: StyleSuggestion) => {
    // Add to appropriate category based on term
    const term = suggestion.term.toLowerCase();
    if (term.includes('light') || term.includes('glow')) {
      addToSelection('lighting', suggestion.term);
    } else if (term.includes('mood') || term.includes('atmosphere')) {
      addToSelection('atmosphere', suggestion.term);
    } else {
      addToSelection('style', suggestion.term);
    }
  }, [addToSelection]);
  
  // Handle mood term click
  const handleMoodTermClick = useCallback((term: string, category: 'atmosphere' | 'colour' | 'lighting') => {
    addToSelection(category, term);
  }, [addToSelection]);
  
  // Handle copy
  const handleCopy = useCallback((copyTier: PlatformTier, text: string) => {
    onPromptCopy?.(copyTier, text);
  }, [onPromptCopy]);
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🎨</span>
            Intelligent Prompt Builder
          </h2>
          <p className="text-white/60 mt-1">
            Building for <span className="text-white font-medium">{platformName || platformId}</span>
            <span className="mx-2">•</span>
            <span className={`
              px-2 py-0.5 rounded text-xs font-medium
              ${tier === 1 ? 'bg-blue-500/20 text-blue-400' :
                tier === 2 ? 'bg-purple-500/20 text-purple-400' :
                tier === 3 ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-orange-500/20 text-orange-400'
              }
            `}>
              Tier {tier}: {tierConfig.name}
            </span>
            {isPro && (
              <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded text-xs font-medium text-amber-400">
                ✨ Pro
              </span>
            )}
          </p>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={randomize}
            disabled={isLocked}
            className="
              px-4 py-2 rounded-xl font-medium text-sm
              bg-gradient-to-r from-purple-500 to-pink-500
              text-white shadow-lg shadow-purple-500/25
              hover:shadow-purple-500/40 hover:scale-105
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            🎲 Randomise
          </button>
          <button
            onClick={clearAll}
            disabled={isLocked}
            className="
              px-4 py-2 rounded-xl font-medium text-sm
              bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400
              text-black shadow-lg
              hover:scale-105
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            Clear All
          </button>
        </div>
      </div>
      
      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category dropdowns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Categories grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORY_ORDER.map(category => (
              <CategoryDropdown
                key={category}
                category={category}
                selections={selections[category]}
                limit={limits[category]}
                disabled={isLocked}
                conflicts={getCategoryConflicts(category)}
                onAdd={(value) => addToSelection(category, value)}
                onRemove={(value) => removeFromSelection(category, value)}
              />
            ))}
          </div>
          
          {/* 4-Tier Preview */}
          <FourTierPromptPreview
            prompts={prompts}
            currentTier={tier}
            onCopy={handleCopy}
            showNegative={true}
          />
        </div>
        
        {/* Intelligence Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <IntelligencePanel
              conflicts={conflicts}
              suggestions={suggestions}
              platformHints={platformHints}
              marketMood={marketMood}
              weatherSuggestions={weatherSuggestions}
              tier={tier}
              onSuggestionClick={handleSuggestionClick}
              onMoodTermClick={handleMoodTermClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PromptIntelligenceBuilder;
