// tools/acceptance/smoke.mjs
// Node 18+/22+ (global fetch). Cross-platform smoke that proves A & B.
// Usage (repo root):
//   BASE_URL=https://promagen.com WWW_URL=https://www.promagen.com node tools/acceptance/smoke.mjs
// Exit code 0 on pass; 1 on failure. Human messages included.

import { readFile } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL ?? "https://promagen.com";
const WWW_URL  = process.env.WWW_URL  ?? "https://www.promagen.com";

function fail(msg) { console.error("✖", msg); process.exitCode = 1; }
function pass(msg) { console.log("✔", msg); }

// Small helper to fetch as text and as HEAD
async function get(url) {
  const res = await fetch(url, { redirect: "manual" });
  return { res, text: await res.text() };
}
async function head(url) {
  return fetch(url, { method: "HEAD", redirect: "manual" });
}

// Very light HTML scrapes
function pickMeta(html, nameOrProperty) {
  const rx = new RegExp(
    `<meta\\s+(?:name|property)=["']${nameOrProperty}["']\\s+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(rx);
  return m ? m[1].trim() : null;
}
function pickLinkRel(html, rel) {
  const rx = new RegExp(`<link\\s+rel=["']${rel}["']\\s+href=["']([^"']+)["']`, "i");
  const m = html.match(rx);
  return m ? m[1].trim() : null;
}

// ---- A) Metadata & sharing on homepage ----
const { res: homeRes, text: homeHtml } = await get(BASE_URL);
if (homeRes.status !== 200) fail(`Homepage status expected 200, got ${homeRes.status}`);
else pass(`Homepage returns 200`);

const titleRx = /<title>([^<]+)<\/title>/i;
const title = (homeHtml.match(titleRx)?.[1] ?? "").trim();
if (!title || title.length < 8) fail("Missing/short <title>.");
else pass(`Title present (“${title.slice(0, 60)}…”)`);

const description = pickMeta(homeHtml, "description");
if (!description || description.length < 40) fail("Missing/short meta description.");
else pass("Meta description present");

const ogTitle = pickMeta(homeHtml, "og:title");
const ogDesc  = pickMeta(homeHtml, "og:description");
const ogImage = pickMeta(homeHtml, "og:image");
if (!ogTitle || !ogDesc || !ogImage) fail("Open Graph (title/description/image) incomplete.");
else pass("Open Graph (title/description/image) present");

const twCard  = pickMeta(homeHtml, "twitter:card");
const twTitle = pickMeta(homeHtml, "twitter:title");
const twDesc  = pickMeta(homeHtml, "twitter:description");
const twImage = pickMeta(homeHtml, "twitter:image");
if (!twCard || !twTitle || !twDesc || !twImage) fail("Twitter/X card incomplete.");
else pass("Twitter/X card present");

const canonical = pickLinkRel(homeHtml, "canonical");
if (!canonical || !canonical.startsWith("https://")) fail("Canonical URL missing/invalid.");
else pass(`Canonical present → ${canonical}`);

// ---- robots & sitemap (env-sensitive rules) ----
const robotsRes = await fetch(new URL("/robots.txt", BASE_URL));
const robots = await robotsRes.text();
if (!robots.includes("User-agent: *")) fail("robots.txt missing global rule.");
if (BASE_URL.includes("vercel.app")) {
  // preview should discourage indexing
  if (!/Disallow:\s*\/\s*/i.test(robots)) fail("Preview robots.txt should disallow '/'.");
  else pass("Preview robots.txt blocks indexing");
} else {
  if (/Disallow:\s*\/\s*/i.test(robots)) fail("Production robots.txt should allow indexing.");
  else pass("Production robots.txt allows indexing");
}

const sitemapRes = await fetch(new URL("/sitemap.xml", BASE_URL));
if (sitemapRes.status !== 200) fail(`sitemap.xml missing (${sitemapRes.status})`);
else {
  const xml = await sitemapRes.text();
  if (!xml.includes(`<loc>${BASE_URL}/</loc>`)) fail("sitemap.xml doesn’t include homepage.");
  else pass("sitemap.xml includes homepage");
}

// ---- B) WWW → apex 308 redirect ----
const wwwHead = await head(WWW_URL);
if (wwwHead.status !== 308) fail(`WWW expected 308, got ${wwwHead.status}`);
else {
  const loc = wwwHead.headers.get("location") ?? "";
  if (!loc.startsWith(BASE_URL)) fail(`WWW 308 location wrong → ${loc}`);
  else pass("WWW redirects to apex with 308 & correct Location");
}

if (process.exitCode === 1) {
  console.error("\nOne or more checks failed.");
  process.exit(1);
} else {
  console.log("\nAll smoke checks passed.");
}
