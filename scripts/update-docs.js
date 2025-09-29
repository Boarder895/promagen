import fs from 'node:fs';

const files = ['docs/developers.md','docs/users.md','docs/build-plan.md'];
const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD

for (const file of files) {
  let md = fs.readFileSync(file, 'utf8');

  // bump Edition date (first occurrence)
  md = md.replace(/(\*\*Edition:\s*)\d{4}-\d{2}-\d{2}(\*\*)/, `$1${today}$2`);

  // ensure dual-option phrasing exists once
  if (/Users Book/.test(md) || /Developers Book/.test(md)) {
    if (!md.includes('Run in Promagen ⚡') || !md.includes('Copy & Open ✂️')) {
      md = md.replace(/## 4\) Create & Run a Prompt[\s\S]*?(?=## |\Z)/m, (sec) =>
        sec + '\n- Buttons: **Run in Promagen ⚡** and **Copy & Open ✂️** are always shown.\n'
      );
    }
  }

  fs.writeFileSync(file, md, 'utf8');
}
console.log('Docs updated:', files.join(', '));
