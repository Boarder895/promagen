/**
 * Sentinel HTML Extraction (Hardened)
 *
 * Robust extractors for title, meta description, canonical, H1,
 * JSON-LD schema types, and FAQ count. These replace the inline
 * regex extractors in crawler.ts.
 *
 * Improvements over v1 regex approach:
 *   - Handles attribute reordering (content before name, href before rel)
 *   - Handles multi-line tags (attributes split across lines)
 *   - Handles single and double quotes, plus unquoted attributes
 *   - Handles self-closing and non-self-closing meta/link tags
 *   - Handles multiple JSON-LD blocks (some pages have several)
 *   - Strips HTML entities from extracted text
 *
 * All functions are pure (no side effects, no imports) for easy testing.
 *
 * Authority: sentinel.md v1.2.0 §3.1
 * Existing features preserved: Yes
 */

// =============================================================================
// TITLE
// =============================================================================

/**
 * Extract <title> tag content.
 * Handles multi-line title tags and nested whitespace.
 */
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  const cleaned = decodeEntities(match[1]).trim();
  return cleaned || null;
}

// =============================================================================
// META DESCRIPTION
// =============================================================================

/**
 * Extract <meta name="description" content="..."> value.
 *
 * Handles:
 *   - name before content, or content before name
 *   - Single quotes, double quotes, or no quotes on attribute values
 *   - Self-closing (/>) or not (>)
 *   - Multi-line tags (attributes on different lines)
 */
export function extractMetaDescription(html: string): string | null {
  // Find all meta tags (generous match including multi-line)
  const metaRegex = /<meta\s([\s\S]*?)(?:\/?>)/gi;
  let metaMatch: RegExpExecArray | null;

  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attrs = metaMatch[1] ?? '';

    // Check if this is a description meta tag
    if (!hasAttribute(attrs, 'name', 'description')) continue;

    // Extract content value
    const content = getAttributeValue(attrs, 'content');
    if (content !== null) {
      const cleaned = decodeEntities(content).trim();
      return cleaned || null;
    }
  }

  return null;
}

// =============================================================================
// CANONICAL
// =============================================================================

/**
 * Extract <link rel="canonical" href="..."> value.
 *
 * Same robustness as meta description: handles attribute reordering,
 * quoting styles, multi-line tags.
 */
export function extractCanonical(html: string): string | null {
  const linkRegex = /<link\s([\s\S]*?)(?:\/?>)/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const attrs = linkMatch[1] ?? '';

    if (!hasAttribute(attrs, 'rel', 'canonical')) continue;

    const href = getAttributeValue(attrs, 'href');
    if (href !== null) {
      return href.trim() || null;
    }
  }

  return null;
}

// =============================================================================
// H1
// =============================================================================

/**
 * Extract the first <h1> tag content, stripping inner HTML.
 */
export function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match?.[1]) return null;
  // Strip inner tags
  const text = match[1].replace(/<[^>]+>/g, '');
  const cleaned = decodeEntities(text).trim();
  return cleaned || null;
}

// =============================================================================
// JSON-LD SCHEMA TYPES
// =============================================================================

/**
 * Extract all @type values from JSON-LD script blocks.
 * Returns deduplicated, sorted array.
 *
 * Handles:
 *   - Multiple JSON-LD blocks on the same page
 *   - Arrays of types (e.g. @type: ["Article", "WebPage"])
 *   - Nested objects with their own @type
 *   - Malformed JSON (gracefully skipped)
 */
export function extractSchemaTypes(html: string): string[] {
  const types = new Set<string>();
  const blockRegex =
    /<script\s[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const jsonText = blockMatch[1]?.trim();
    if (!jsonText) continue;

    try {
      const parsed: unknown = JSON.parse(jsonText);
      collectTypes(parsed, types);
    } catch {
      // Malformed JSON-LD — skip silently
    }
  }

  return Array.from(types).sort();
}

/**
 * Count FAQ entries from FAQPage JSON-LD schema.
 */
export function extractFaqCount(html: string): number {
  let count = 0;
  const blockRegex =
    /<script\s[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const jsonText = blockMatch[1]?.trim();
    if (!jsonText) continue;

    try {
      const parsed: unknown = JSON.parse(jsonText);
      count += countFaqEntries(parsed);
    } catch {
      // skip
    }
  }

  return count;
}

// =============================================================================
// WORD COUNT
// =============================================================================

/**
 * Count visible words in the page (strip scripts, styles, tags, entities).
 */
export function extractWordCount(html: string): number {
  let text = html;
  // Remove script and style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode entities
  text = decodeEntities(text);
  // Split on whitespace and count non-empty tokens
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// =============================================================================
// SSOT VERSION
// =============================================================================

/**
 * Extract SSOT version from page content.
 */
export function extractSsotVersion(html: string): string | null {
  const match = html.match(/platform-config\.json\s*\(SSOT\s+v?([\d.]+)\)/i);
  return match?.[1] ?? null;
}

// =============================================================================
// LAST VERIFIED
// =============================================================================

/**
 * Extract "Last verified" date from authority profiles.
 */
export function extractLastVerified(html: string): string | null {
  const match = html.match(
    /last\s+verified[:\s]+(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i,
  );
  return match?.[1]?.trim() ?? null;
}

// =============================================================================
// ATTRIBUTE HELPERS (robust parsing)
// =============================================================================

/**
 * Check if an attribute string contains a specific name=value pair.
 * Handles single quotes, double quotes, and case-insensitive matching.
 */
function hasAttribute(attrs: string, name: string, value: string): boolean {
  // Match name="value", name='value', or name=value (no quotes)
  const pattern = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))`,
    'i',
  );
  const match = attrs.match(pattern);
  if (!match) return false;

  const found = (match[1] ?? match[2] ?? match[3] ?? '').toLowerCase();
  return found === value.toLowerCase();
}

/**
 * Extract the value of a named attribute from an attribute string.
 * Returns null if the attribute is not found.
 */
function getAttributeValue(attrs: string, name: string): string | null {
  const pattern = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))`,
    'i',
  );
  const match = attrs.match(pattern);
  if (!match) return null;

  return match[1] ?? match[2] ?? match[3] ?? null;
}

// =============================================================================
// JSON-LD HELPERS
// =============================================================================

function collectTypes(obj: unknown, types: Set<string>): void {
  if (Array.isArray(obj)) {
    for (const item of obj) collectTypes(item, types);
    return;
  }
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (typeof record['@type'] === 'string') {
      types.add(record['@type']);
    } else if (Array.isArray(record['@type'])) {
      for (const t of record['@type']) {
        if (typeof t === 'string') types.add(t);
      }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        collectTypes(value, types);
      }
    }
  }
}

function countFaqEntries(obj: unknown): number {
  if (Array.isArray(obj)) {
    return obj.reduce((sum: number, item: unknown) => sum + countFaqEntries(item), 0);
  }
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (record['@type'] === 'FAQPage' && Array.isArray(record['mainEntity'])) {
      return record['mainEntity'].length;
    }
    let nested = 0;
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') nested += countFaqEntries(value);
    }
    return nested;
  }
  return 0;
}

// =============================================================================
// ENTITY DECODING
// =============================================================================

/**
 * Decode common HTML entities to plain text.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&hellip;/gi, '\u2026')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&ldquo;/gi, '\u201C')
    .replace(/&rdquo;/gi, '\u201D')
    .replace(/&bull;/gi, '\u2022')
    .replace(/&copy;/gi, '\u00A9')
    .replace(/&reg;/gi, '\u00AE')
    .replace(/&trade;/gi, '\u2122')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}
