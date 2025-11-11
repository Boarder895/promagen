import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';
import budgets from './budgets.json' assert { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../.lighthouse');
await mkdir(outDir, { recursive: true });

const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });

const opts = {
  logLevel: 'error',
  output: 'json',
  onlyCategories: ['performance','accessibility','seo','best-practices'],
  port: chrome.port,
  budgets
};

const { lhr, report } = await lighthouse(url, opts);
await writeFile(resolve(outDir, 'home.report.json'), report, 'utf8');

const get = (k) => lhr.categories[k]?.score ?? 0;
if (get('accessibility') < 1.0) throw new Error('Lighthouse: Accessibility must be 1.00');
if (get('seo') < 0.95) throw new Error('Lighthouse: SEO must be ≥ 0.95');
if (get('best-practices') < 0.95) throw new Error('Lighthouse: Best Practices must be ≥ 0.95');
if (get('performance') < 0.90) throw new Error('Lighthouse: Performance must be ≥ 0.90');

await chrome.kill();
