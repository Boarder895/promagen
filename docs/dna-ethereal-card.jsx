import React, { useState } from 'react';

const families = [
  {
    id: 'cyberpunk',
    displayName: 'Cyberpunk',
    description: 'Neon-lit dystopian urban futures',
    mood: 'intense',
    memberCount: 9,
    suggestedColours: ['neon pink', 'electric blue', 'magenta', 'cyan'],
    gradient: 'from-pink-500 via-purple-500 to-cyan-500',
    glowColor: 'rgba(236, 72, 153, 0.15)',
    accentColor: 'text-pink-400',
  },
  {
    id: 'retro',
    displayName: 'Retro / Vintage',
    description: 'Nostalgic, classic, historical aesthetics',
    mood: 'calm',
    memberCount: 13,
    suggestedColours: ['sepia', 'warm tones', 'muted', 'cream'],
    gradient: 'from-amber-500 via-orange-400 to-yellow-500',
    glowColor: 'rgba(245, 158, 11, 0.15)',
    accentColor: 'text-amber-400',
  },
  {
    id: 'dark-moody',
    displayName: 'Dark & Moody',
    description: 'Dramatic, atmospheric, intense imagery',
    mood: 'intense',
    memberCount: 11,
    suggestedColours: ['desaturated', 'cold', 'high contrast', 'muted'],
    gradient: 'from-slate-400 via-slate-500 to-slate-600',
    glowColor: 'rgba(148, 163, 184, 0.12)',
    accentColor: 'text-slate-300',
  },
  {
    id: 'organic',
    displayName: 'Organic / Natural',
    description: 'Nature-inspired, soft, living elements',
    mood: 'calm',
    memberCount: 14,
    suggestedColours: ['earth tones', 'green', 'warm brown', 'moss'],
    gradient: 'from-emerald-500 via-green-500 to-lime-500',
    glowColor: 'rgba(16, 185, 129, 0.15)',
    accentColor: 'text-emerald-400',
  },
  {
    id: 'ethereal',
    displayName: 'Ethereal / Dreamy',
    description: 'Soft, magical, otherworldly atmospheres',
    mood: 'calm',
    memberCount: 10,
    suggestedColours: ['pastel', 'soft pink', 'lavender', 'pearl'],
    gradient: 'from-violet-400 via-fuchsia-400 to-pink-400',
    glowColor: 'rgba(167, 139, 250, 0.2)',
    accentColor: 'text-violet-400',
  },
  {
    id: 'sci-fi',
    displayName: 'Science Fiction',
    description: 'Futuristic, technological, speculative worlds',
    mood: 'intense',
    memberCount: 13,
    suggestedColours: ['chrome', 'holographic', 'electric', 'metallic'],
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glowColor: 'rgba(99, 102, 241, 0.15)',
    accentColor: 'text-blue-400',
  },
];

// DNA Helix + Ethereal Glow Hybrid Card
const DNAEtherealCard = ({ family, isHovered, onHover, onLeave }) => {
  // Generate DNA bar pattern - varies by family for visual interest
  const dnaPattern = [...Array(10)].map((_, i) => {
    const base = Math.sin(i * 0.7 + families.indexOf(family) * 0.5);
    return 0.25 + (base * 0.35 + 0.35);
  });

  return (
    <div
      className="group relative overflow-hidden rounded-2xl transition-all duration-500 ease-out cursor-pointer"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        background: 'rgba(15, 23, 42, 0.7)',
        boxShadow: isHovered
          ? `0 0 60px 10px ${family.glowColor}, inset 0 0 30px 5px ${family.glowColor}`
          : '0 0 0 0 transparent',
        border: `1px solid ${isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {/* Ethereal glow overlay - appears on hover */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${family.glowColor} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
        }}
      />

      {/* Secondary inner glow */}
      <div
        className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${family.glowColor} 0%, transparent 60%)`,
          opacity: isHovered ? 0.5 : 0,
        }}
      />

      <div className="relative z-10 p-5">
        {/* DNA Helix Bar */}
        <div className="flex gap-1 mb-4">
          {dnaPattern.map((opacity, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full bg-gradient-to-r ${family.gradient} transition-all duration-500`}
              style={{
                opacity: isHovered ? Math.min(opacity + 0.3, 1) : opacity * 0.6,
                transform: isHovered ? 'scaleY(1.2)' : 'scaleY(1)',
                filter: isHovered ? `drop-shadow(0 0 4px ${family.glowColor})` : 'none',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <h3
          className="text-lg font-semibold text-white mb-1 transition-all duration-300"
          style={{
            textShadow: isHovered ? `0 0 20px ${family.glowColor}` : 'none',
          }}
        >
          {family.displayName}
        </h3>
        <p className="text-sm text-white/50 mb-4 transition-colors duration-300 group-hover:text-white/70">
          {family.description}
        </p>

        {/* Colour labels */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {family.suggestedColours.map((colour, i) => (
            <span
              key={i}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all duration-300 ${family.accentColor}`}
              style={{
                background: isHovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${
                  isHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'
                }`,
              }}
            >
              {colour}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full bg-gradient-to-r ${family.gradient} transition-all duration-300`}
              style={{
                boxShadow: isHovered ? `0 0 8px 2px ${family.glowColor}` : 'none',
              }}
            />
            <span className="text-xs text-white/40 transition-colors duration-300 group-hover:text-white/60">
              {family.memberCount} options
            </span>
          </div>
          <button
            className={`text-xs ${family.accentColor} transition-all duration-300`}
            style={{
              textShadow: isHovered ? `0 0 10px ${family.glowColor}` : 'none',
            }}
          >
            Open in Builder →
          </button>
        </div>
      </div>
    </div>
  );
};

export default function DNAEtherealShowcase() {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">DNA Helix + Ethereal Glow</h1>
          <p className="text-sm text-white/50 mb-1">
            Hover over cards to see the ethereal lighting effect
          </p>
          <p className="text-xs text-white/30">
            Combines DNA coherence bar with soft, magical glow on interaction
          </p>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {families.map((family) => (
            <DNAEtherealCard
              key={family.id}
              family={family}
              isHovered={hoveredId === family.id}
              onHover={() => setHoveredId(family.id)}
              onLeave={() => setHoveredId(null)}
            />
          ))}
        </div>

        {/* Design Notes */}
        <div className="mt-8 p-5 rounded-2xl bg-white/5 ring-1 ring-white/10">
          <h2 className="text-sm font-semibold text-white mb-3">Design Features</h2>
          <ul className="text-sm text-white/60 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>
                <strong className="text-white/80">DNA Helix Bar:</strong> Unique wave pattern per
                family, intensifies on hover
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>
                <strong className="text-white/80">Ethereal Glow:</strong> Radial gradient bloom from
                top and bottom edges
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>
                <strong className="text-white/80">Box Shadow Aura:</strong> Outer glow matches
                family colour palette
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>
                <strong className="text-white/80">Text Glow:</strong> Title and accent elements gain
                subtle luminance
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>
                <strong className="text-white/80">Promagen Theme:</strong> Uses slate-950/70,
                ring-white/10, rounded-2xl
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
