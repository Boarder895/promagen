// Simple Markdown loader with recursive <!-- include: path.md --> support.
// Paths are relative to the docs root. Works in Next.js server components.

import fs from "node:fs";
import path from "node:path";

const DOCS_ROOT = path.join(process.cwd(), "docs");

// Read a markdown file by slug (e.g. "build-plan") and expand <!-- include: ... --> directives.
export function loadMarkdownBySlug(slug: string): string {
  const file = path.join(DOCS_ROOT, `${slug}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`Markdown not found: ${file}`);
  }
  const md = fs.readFileSync(file, "utf8");
  return expandIncludes(md, DOCS_ROOT, new Set());
}

// Expand <!-- include: relative/or/absolute.md --> recursively.
// Protects against cycles and missing files by inserting a clear stub.
function expandIncludes(source: string, baseDir: string, seen: Set<string>): string {
  const includeRE = /<!--\s*include:\s*([^\s]+)\s*-->/g;

  return source.replace(includeRE, (_m, rawPath) => {
    const incPath = rawPath.replace(/^["']|["']$/g, "");
    const abs = path.isAbsolute(incPath) ? incPath : path.join(baseDir, incPath);
    const norm = path.normalize(abs);

    if (seen.has(norm)) {
      return `\n> **Include skipped (cycle):** \`${incPath}\`\n`;
    }
    if (!fs.existsSync(norm)) {
      return `\n> **Include missing:** \`${incPath}\`\n`;
    }
    seen.add(norm);
    const content = fs.readFileSync(norm, "utf8");
    const expanded = expandIncludes(content, path.dirname(norm), seen);
    seen.delete(norm);
    return expanded;
  });
}

// List available *.md docs under /docs for the index page.
export function listDocs(): { slug: string; file: string; title: string }[] {
  if (!fs.existsSync(DOCS_ROOT)) return [];
  const files = fs.readdirSync(DOCS_ROOT).filter(f => f.endsWith(".md"));

  return files
    .map(file => {
      const slug = file.replace(/\.md$/, "");
      const title = slug
        .split("-")
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
      return { slug, file, title };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}


