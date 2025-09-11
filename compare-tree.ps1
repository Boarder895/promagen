<# 
  compare-tree.ps1 — Promagen file presence checker (fixed)
  Run inside your project root (where promagen/, frontend/, wordpress/ live).
  Outputs a human-readable Markdown report in _compare\compare-report.md
#>

param(
  [string]$Root = (Get-Location).Path
)

Write-Host "🔎 Scanning root: $Root" -ForegroundColor Cyan

# --- EXPECTED FILES (from the mega tree) ----------------------
$expected = @(
  "promagen\.env",
  "promagen\package.json",
  "promagen\tsconfig.json",
  "promagen\vercel.json",
  "promagen\prisma\schema.prisma",
  "promagen\src\server.ts",
  "promagen\src\lib\crypto.ts",
  "promagen\src\lib\db.ts",
  "promagen\src\lib\providers.ts",
  "promagen\src\routes\openai.ts",
  "promagen\src\routes\health.ts",
  "promagen\src\routes\models.ts",
  "promagen\src\routes\cron\import.ts",
  "promagen\src\routes\providers\leonardo.ts",
  "promagen\src\routes\providers\stability.ts",
  "promagen\src\routes\providers\deepai.ts",
  "promagen\src\adapters\index.ts",
  "promagen\src\adapters\openai.ts",
  "promagen\src\adapters\leonardo.ts",
  "promagen\src\adapters\stability.ts",
  "promagen\src\adapters\deepai.ts",
  "promagen\src\jobs\collectMetrics.ts",
  "promagen\src\jobs\updateScores.ts",
  "frontend\pages\index.tsx",
  "frontend\pages\api\health.ts",
  "frontend\pages\api\cron\import.ts",
  "frontend\components\Leaderboard.tsx",
  "frontend\components\WorldClocks.tsx",
  "frontend\components\LanguageSwitcher.tsx",
  "frontend\components\ProviderCard.tsx",
  "frontend\components\StockTicker.tsx",
  "frontend\lib\sendChat.ts",
  "frontend\lib\apiClient.ts",
  "frontend\styles\globals.css",
  "wordpress\shortcode-leaderboard.php",
  "wordpress\language-tab.php",
  "wordpress\style-snippets.css",
  "wordpress\embed-script.js",
  "devops\powershell\kill-node.ps1",
  "devops\powershell\set-openai-key.ps1",
  "devops\powershell\test-proxy.ps1",
  "devops\powershell\compare-tree.ps1",
  "devops\dns-instructions.txt",
  "devops\deploy-notes.txt",
  "affiliate\disclosure-snippets.html",
  "docs\provider-expansion.md",
  "docs\scoring-schema.md"
)

# Normalize paths
$expectedAbs = $expected | ForEach-Object { Join-Path $Root $_ }

# Actual files
$actual = Get-ChildItem -Path $Root -Recurse -File | Select-Object -ExpandProperty FullName

# Compare
$missing = $expectedAbs | Where-Object { -not ($actual -contains $_) }
$present = $expectedAbs | Where-Object { $actual -contains $_ }
$extra   = $actual | Where-Object { -not ($expectedAbs -contains $_) }

# Output folder
$outDir = Join-Path $Root "_compare"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$mdPath  = Join-Path $outDir "compare-report.md"

# Markdown summary
$md = @()
$md += "# Promagen Compare Report"
$md += ""
$md += "- ✅ PRESENT: $($present.Count)"
$md += "- ❌ MISSING: $($missing.Count)"
$md += "- ⚠️ EXTRA: $($extra.Count)"
$md += ""
$md += "## Missing"
foreach ($m in $missing) { $md += "❌ `$($m.Replace($Root+'\',''))`" }
$md += ""
$md += "## Extra"
foreach ($x in $extra) { $md += "⚠️ `$($x.Replace($Root+'\',''))`" }
$md += ""
$md += "## Present"
foreach ($p in $present) { $md += "✅ `$($p.Replace($Root+'\',''))`" }

$md -join "`r`n" | Out-File -FilePath $mdPath -Encoding UTF8

Write-Host ""
Write-Host "✅ Done. Report saved to:" -ForegroundColor Green
Write-Host "  $mdPath"
