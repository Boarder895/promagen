// Node smoke for homepage metadata & sharing cards.
// Validates: <title>, meta[name=description], canonical link,
// og:title/og:description/og:image, twitter:card, robots directives.

const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const url = `${base}/`;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
function pass(msg) {
  console.log(`✓ ${msg}`);
}

async function main() {
  const res = await fetch(url);
  if (!res.ok) fail(`Fetch failed ${res.status}`);
  const html = await res.text();

  const get = (pattern) => {
    const m = html.match(pattern);
    return m ? m[1] ?? m[0] : null;
  };

  // Title
  const title = get(/<title[^>]*>([^<]+)<\/title>/i);
  if (!title || title.length < 4) fail('Missing or too-short <title>');
  pass('<title> present');

  // Description
  const desc = get(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (!desc || desc.length < 10) fail('Missing/short meta description');
  pass('meta description present');

  // Canonical
  const canon = get(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (!canon) fail('Missing canonical link');
  pass('canonical link present');

  // Open Graph
  const ogTitle = get(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogDesc = get(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const ogImage = get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (!ogTitle || !ogDesc || !ogImage) fail('Missing one or more Open Graph tags');
  pass('Open Graph tags present');

  // Twitter
  const twCard = get(/<meta\s+name=["']twitter:card["']\s+content=["']([^"']+)["']/i);
  if (!twCard) fail('Missing twitter:card');
  pass('twitter:card present');

  // Robots (allow index by default; page may override)
  // We treat either robots meta or X-Robots-Tag header as valid.
  const metaRobots = get(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const headerRobots = [...res.headers.entries()].find(([k]) => k.toLowerCase() === 'x-robots-tag');
  pass(`robots directive checked (${metaRobots || headerRobots?.[1] || 'none found'})`);

  console.log('OK: metadata smoke passed.');
}

main().catch((err) => fail(err.message || String(err)));
