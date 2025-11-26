/* 
  scripts/generate-country-commodities-map.cjs

  Usage (PowerShell, from frontend folder):
    node .\scripts\generate-country-commodities-map.cjs
*/

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'commodities');

const CSV_PATH = path.join(DATA_DIR, 'country-commodities.map.csv');
const JSON_PATH = path.join(DATA_DIR, 'country-commodities.map.json');

function parseCsvLine(line) {
  // Very simple CSV split – safe because we have no commas inside fields.
  return line.split(',').map((cell) => cell.trim());
}

function buildEntryFromRow(headers, row) {
  const cells = parseCsvLine(row);
  if (cells.length === 0 || !cells[0]) {
    return null;
  }

  const [
    country,
    energy_1,
    energy_2,
    energy_3,
    agri_1,
    agri_2,
    agri_3,
    metals_1,
    metals_2,
    metals_3,
  ] = cells;

  const clean = (v) => (v && v.length ? v : null);

  return {
    country, // e.g. "🇦🇺 Australia"
    energy: [clean(energy_1), clean(energy_2), clean(energy_3)].filter(Boolean),
    agriculture: [clean(agri_1), clean(agri_2), clean(agri_3)].filter(Boolean),
    metals: [clean(metals_1), clean(metals_2), clean(metals_3)].filter(Boolean),
  };
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at: ${CSV_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    console.error('CSV file is empty.');
    process.exit(1);
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);
  const dataLines = lines.slice(1);

  const entries = [];
  for (const line of dataLines) {
    const entry = buildEntryFromRow(headers, line);
    if (entry) {
      entries.push(entry);
    }
  }

  const json = JSON.stringify(entries, null, 2);
  fs.writeFileSync(JSON_PATH, json, 'utf8');

  console.log(`Generated ${entries.length} country commodity map entries → ${JSON_PATH}`);
}

main();
