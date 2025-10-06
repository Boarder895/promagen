/* Cross-platform prebuild wrapper:
   - On Windows: run the existing PowerShell step.
   - On Linux/macOS (Vercel): skip gracefully. */
const { spawnSync } = require('node:child_process');

if (process.platform === 'win32') {
  const res = spawnSync(
    'pwsh',
    ['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts\\enforce-imports.ps1'],
    { stdio: 'inherit', shell: true }
  );
  process.exit(res.status ?? 0);
} else {
  console.log('prebuild: skipping Windows-only PowerShell step on non-Windows CI');
}
