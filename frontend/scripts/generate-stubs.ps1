# scripts/generate-stubs.ps1
# Create minimal, compiling stubs for files inside placeholder_quarantine/,
# writing them back to their original locations without overwriting any file
# that already exists (UI primitives you fixed earlier are left alone).

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Get-Location
$quar = Join-Path $root "placeholder_quarantine"
if (-not (Test-Path $quar)) {
  Write-Error "placeholder_quarantine not found. Run check-placeholders.ps1 -fix first."
  exit 1
}

function Write-File($path, $content) {
  $dir = Split-Path $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Encoding utf8 -NoNewline -Path $path -Value $content
}

Get-ChildItem -Recurse -File $quar | ForEach-Object {
  $origRel = $_.FullName.Substring($quar.Length + 1)           # path relative to quarantine root
  $origAbs = Join-Path $root $origRel

  # Don't clobber files you've already fixed
  if (Test-Path $origAbs) { return }

  $rp = $origRel -replace '\\','/'
  $ext = $_.Extension.ToLowerInvariant()

  $stub = ""
  if ($ext -eq ".tsx") {
    # Component or page
    $name = [System.IO.Path]::GetFileNameWithoutExtension($origAbs)
    $safe = ($name -replace '[^A-Za-z0-9_]','_')
    if ($rp -match '^app/.+/(page|layout)\.tsx$') {
      $stub = @"
// AUTO-STUB for $rp — original placeholder in placeholder_quarantine/$rp
export default function Page() {
  return <main className=\"p-6\"><h1>$name</h1><p>TODO: implement page</p></main>;
}
"@
    } elseif ($rp -match '^app/.+/route\.ts$') {
      # Shouldn't usually be TSX, but protect just in case
      $stub = @"
// AUTO-STUB for $rp
export default function $safe() { return null; }
"@
    } else {
      $stub = @"
// AUTO-STUB for $rp — original placeholder in placeholder_quarantine/$rp
import * as React from 'react';
export default function $safe(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props ?? {};
  return <div {...rest} className={className}>TODO: $safe</div>;
}
"@
    }
  } elseif ($ext -eq ".ts") {
    if ($rp -match '^app/.+/route\.ts$') {
      $stub = @"
// AUTO-STUB for $rp — original placeholder in placeholder_quarantine/$rp
import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ ok: true }); }
// export async function POST(req: Request) { return NextResponse.json({ ok: true }); }
"@
    } else {
      $name = [System.IO.Path]::GetFileNameWithoutExtension($origAbs)
      $safe = ($name -replace '[^A-Za-z0-9_]','_')
      $stub = @"
// AUTO-STUB for $rp — original placeholder in placeholder_quarantine/$rp
export function $safe() {
  throw new Error('TODO: implement $safe');
}
export default $safe;
"@
    }
  } elseif ($ext -eq ".json") {
    $stub = "{ }"
  } elseif ($ext -eq ".md") {
    $stub = "# TODO\n\nSource placeholder kept at `placeholder_quarantine/$rp`.\n"
  } else {
    $stub = "// AUTO-STUB for $rp\nexport {};\n"
  }

  Write-Host "✳  Stub: $origRel"
  Write-File $origAbs $stub
}

Write-Host "`n✅ Stubs created for all quarantined files that didn't already exist."
