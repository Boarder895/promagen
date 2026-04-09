/**
 * Sentinel Extraction Hardening Tests
 *
 * Edge-case tests for the hardened HTML extractors.
 * Tests attribute reordering, multi-line tags, quoting styles,
 * malformed markup, and entity decoding.
 *
 * Run: pnpm run test:util
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractTitle,
  extractMetaDescription,
  extractCanonical,
  extractH1,
  extractSchemaTypes,
  extractFaqCount,
  extractWordCount,
  extractSsotVersion,
  extractLastVerified,
} from '@/lib/sentinel/extraction';

// =============================================================================
// TITLE
// =============================================================================

describe('extractTitle', () => {
  it('extracts basic title', () => {
    expect(extractTitle('<title>Hello World</title>')).toBe('Hello World');
  });

  it('handles multi-line title', () => {
    expect(extractTitle('<title>\n  Hello\n  World\n</title>')).toBe('Hello\n  World');
  });

  it('returns null for missing title', () => {
    expect(extractTitle('<head></head>')).toBeNull();
  });

  it('returns null for empty title', () => {
    expect(extractTitle('<title></title>')).toBeNull();
  });

  it('decodes HTML entities', () => {
    expect(extractTitle('<title>Promagen &mdash; AI Tools</title>')).toBe('Promagen — AI Tools');
  });

  it('handles title with attributes', () => {
    expect(extractTitle('<title lang="en">Hello</title>')).toBe('Hello');
  });
});

// =============================================================================
// META DESCRIPTION
// =============================================================================

describe('extractMetaDescription', () => {
  it('extracts standard meta description', () => {
    const html = '<meta name="description" content="Test description">';
    expect(extractMetaDescription(html)).toBe('Test description');
  });

  it('handles content before name (attribute reordering)', () => {
    const html = '<meta content="Reordered desc" name="description">';
    expect(extractMetaDescription(html)).toBe('Reordered desc');
  });

  it('handles single quotes', () => {
    const html = "<meta name='description' content='Single quoted'>";
    expect(extractMetaDescription(html)).toBe('Single quoted');
  });

  it('handles self-closing tag', () => {
    const html = '<meta name="description" content="Self closing" />';
    expect(extractMetaDescription(html)).toBe('Self closing');
  });

  it('handles multi-line tag', () => {
    const html = `<meta
      name="description"
      content="Multi line tag"
    >`;
    expect(extractMetaDescription(html)).toBe('Multi line tag');
  });

  it('returns null when no description meta exists', () => {
    const html = '<meta name="viewport" content="width=device-width">';
    expect(extractMetaDescription(html)).toBeNull();
  });

  it('returns null for empty content', () => {
    const html = '<meta name="description" content="">';
    expect(extractMetaDescription(html)).toBeNull();
  });

  it('ignores og:description (not the same thing)', () => {
    const html = '<meta property="og:description" content="OG desc">';
    expect(extractMetaDescription(html)).toBeNull();
  });

  it('decodes entities in content', () => {
    const html = '<meta name="description" content="AI &amp; ML tools">';
    expect(extractMetaDescription(html)).toBe('AI & ML tools');
  });
});

// =============================================================================
// CANONICAL
// =============================================================================

describe('extractCanonical', () => {
  it('extracts standard canonical', () => {
    const html = '<link rel="canonical" href="https://promagen.com/platforms">';
    expect(extractCanonical(html)).toBe('https://promagen.com/platforms');
  });

  it('handles href before rel (attribute reordering)', () => {
    const html = '<link href="https://promagen.com/" rel="canonical">';
    expect(extractCanonical(html)).toBe('https://promagen.com/');
  });

  it('handles self-closing with space', () => {
    const html = '<link rel="canonical" href="https://promagen.com" />';
    expect(extractCanonical(html)).toBe('https://promagen.com');
  });

  it('returns null when no canonical exists', () => {
    const html = '<link rel="stylesheet" href="/styles.css">';
    expect(extractCanonical(html)).toBeNull();
  });

  it('handles multi-line link tag', () => {
    const html = `<link
      rel="canonical"
      href="https://promagen.com/guides"
    />`;
    expect(extractCanonical(html)).toBe('https://promagen.com/guides');
  });
});

// =============================================================================
// H1
// =============================================================================

describe('extractH1', () => {
  it('extracts plain H1', () => {
    expect(extractH1('<h1>Hello</h1>')).toBe('Hello');
  });

  it('strips inner HTML tags', () => {
    expect(extractH1('<h1>Hello <span class="x">World</span></h1>')).toBe('Hello World');
  });

  it('handles H1 with class attribute', () => {
    expect(extractH1('<h1 class="title">Styled</h1>')).toBe('Styled');
  });

  it('returns null for empty H1', () => {
    expect(extractH1('<h1></h1>')).toBeNull();
  });

  it('returns null when no H1', () => {
    expect(extractH1('<h2>Not H1</h2>')).toBeNull();
  });

  it('decodes entities', () => {
    expect(extractH1('<h1>Promagen &amp; Friends</h1>')).toBe('Promagen & Friends');
  });
});

// =============================================================================
// SCHEMA TYPES
// =============================================================================

describe('extractSchemaTypes', () => {
  it('extracts single type', () => {
    const html = '<script type="application/ld+json">{"@type":"WebPage"}</script>';
    expect(extractSchemaTypes(html)).toEqual(['WebPage']);
  });

  it('extracts multiple types from one block', () => {
    const html = '<script type="application/ld+json">{"@type":["Article","WebPage"]}</script>';
    expect(extractSchemaTypes(html)).toEqual(['Article', 'WebPage']);
  });

  it('extracts from multiple JSON-LD blocks', () => {
    const html =
      '<script type="application/ld+json">{"@type":"WebPage"}</script>' +
      '<script type="application/ld+json">{"@type":"FAQPage"}</script>';
    expect(extractSchemaTypes(html)).toEqual(['FAQPage', 'WebPage']);
  });

  it('extracts nested types', () => {
    const html = '<script type="application/ld+json">{"@type":"WebPage","author":{"@type":"Person"}}</script>';
    expect(extractSchemaTypes(html)).toEqual(['Person', 'WebPage']);
  });

  it('handles malformed JSON gracefully', () => {
    const html = '<script type="application/ld+json">{broken json</script>';
    expect(extractSchemaTypes(html)).toEqual([]);
  });

  it('returns empty for no JSON-LD', () => {
    expect(extractSchemaTypes('<script>console.log("hi")</script>')).toEqual([]);
  });

  it('deduplicates types', () => {
    const html =
      '<script type="application/ld+json">{"@type":"WebPage"}</script>' +
      '<script type="application/ld+json">{"@type":"WebPage"}</script>';
    expect(extractSchemaTypes(html)).toEqual(['WebPage']);
  });
});

// =============================================================================
// FAQ COUNT
// =============================================================================

describe('extractFaqCount', () => {
  it('counts FAQ entries', () => {
    const html = `<script type="application/ld+json">{
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "Q1"},
        {"@type": "Question", "name": "Q2"},
        {"@type": "Question", "name": "Q3"}
      ]
    }</script>`;
    expect(extractFaqCount(html)).toBe(3);
  });

  it('returns 0 when no FAQPage', () => {
    const html = '<script type="application/ld+json">{"@type":"WebPage"}</script>';
    expect(extractFaqCount(html)).toBe(0);
  });

  it('returns 0 for no JSON-LD', () => {
    expect(extractFaqCount('<p>No schema here</p>')).toBe(0);
  });
});

// =============================================================================
// WORD COUNT
// =============================================================================

describe('extractWordCount', () => {
  it('counts visible words', () => {
    expect(extractWordCount('<p>Hello world</p>')).toBe(2);
  });

  it('excludes script content', () => {
    expect(extractWordCount('<p>Hello</p><script>var x = 1;</script>')).toBe(1);
  });

  it('excludes style content', () => {
    expect(extractWordCount('<p>Hello</p><style>.x{color:red}</style>')).toBe(1);
  });

  it('handles entities', () => {
    const count = extractWordCount('<p>Hello &amp; world</p>');
    expect(count).toBe(3); // Hello, &, world
  });
});

// =============================================================================
// SSOT VERSION
// =============================================================================

describe('extractSsotVersion', () => {
  it('extracts version string', () => {
    const html = '<p>Data derived from platform-config.json (SSOT v1.2.0)</p>';
    expect(extractSsotVersion(html)).toBe('1.2.0');
  });

  it('handles without v prefix', () => {
    const html = '<p>platform-config.json (SSOT 2.0.0)</p>';
    expect(extractSsotVersion(html)).toBe('2.0.0');
  });

  it('returns null when not present', () => {
    expect(extractSsotVersion('<p>No version here</p>')).toBeNull();
  });
});

// =============================================================================
// LAST VERIFIED
// =============================================================================

describe('extractLastVerified', () => {
  it('extracts ISO date', () => {
    const html = '<p>Last verified: 2026-04-01</p>';
    expect(extractLastVerified(html)).toBe('2026-04-01');
  });

  it('extracts human-readable date', () => {
    const html = '<p>Last verified April 1, 2026</p>';
    expect(extractLastVerified(html)).toBe('April 1, 2026');
  });

  it('returns null when not present', () => {
    expect(extractLastVerified('<p>No date</p>')).toBeNull();
  });
});
