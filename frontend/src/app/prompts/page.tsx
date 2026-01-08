// src/app/prompts/page.tsx
// ============================================================================
// PROMPTS INDEX PAGE
// ============================================================================
// Hub for all prompt-related features: Library, Explore, Learn.
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompts — Promagen',
  description: 'Build, save, and explore AI image prompts with intelligent suggestions.',
};

// ============================================================================
// PAGE SECTIONS
// ============================================================================

const sections = [
  {
    href: '/prompts/library',
    title: 'Your Library',
    description: 'Save, organise, and reload your favourite prompts.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    available: true,
  },
  {
    href: '/prompts/explore',
    title: 'Explore Styles',
    description: 'Discover style families and find inspiration for your next prompt.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    available: true,
  },
  {
    href: '/prompts/learn',
    title: 'Learn Prompting',
    description: 'Master the art of prompt engineering with guides and examples.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    available: true,
  },
  {
    href: '/prompts/playground',
    title: 'Playground',
    description: 'Test and experiment with prompts in real-time.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    available: true,
  },
];

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function PromptsIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            href="/"
            className="text-xs text-white/40 hover:text-white/60 transition-colors mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-semibold mb-2">
            <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
              Prompts
            </span>
          </h1>
          <p className="text-white/50 max-w-xl">
            Build intelligent prompts with real-time suggestions, save your favourites, 
            and learn the art of prompt engineering.
          </p>
        </div>
      </header>

      {/* Sections Grid */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section) => {
            const CardContent = (
              <div
                className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-500 ${
                  section.available
                    ? 'cursor-pointer hover:ring-white/20'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {/* Glow effect on hover */}
                {section.available && (
                  <div
                    className="absolute inset-0 transition-opacity duration-500 opacity-0 group-hover:opacity-100 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at 50% 0%, ${section.glow} 0%, transparent 70%)`,
                    }}
                  />
                )}

                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.gradient} flex items-center justify-center mb-4 transition-all duration-300 ${
                      section.available ? 'group-hover:scale-110' : ''
                    }`}
                    style={{
                      opacity: section.available ? 1 : 0.5,
                    }}
                  >
                    {section.icon}
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    {section.title}
                    {!section.available && (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-white/40 uppercase">
                        Coming Soon
                      </span>
                    )}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-white/50">
                    {section.description}
                  </p>

                  {/* Arrow */}
                  {section.available && (
                    <div className="mt-4 text-white/30 group-hover:text-white/60 transition-colors">
                      <span className="text-sm">Explore →</span>
                    </div>
                  )}
                </div>
              </div>
            );

            return section.available ? (
              <Link key={section.href} href={section.href}>
                {CardContent}
              </Link>
            ) : (
              <div key={section.href}>{CardContent}</div>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <h3 className="text-sm font-medium text-white/40 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/providers"
              className="px-4 py-2 text-sm rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
            >
              Go to Prompt Builder
            </Link>
            <Link
              href="/prompts/library"
              className="px-4 py-2 text-sm rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
            >
              View Saved Prompts
            </Link>
            <Link
              href="/settings/prompt-intelligence"
              className="px-4 py-2 text-sm rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
            >
              ⚙️ Intelligence Settings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}




