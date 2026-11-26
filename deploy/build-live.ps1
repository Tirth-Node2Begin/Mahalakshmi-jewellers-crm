<#
    Assembles live/ - the folder that is uploaded to the subdomain's document
    root. The Next.js export's CONTENTS sit at the root with the PHP backend
    beside them, so the frontend calls /api/* same-origin (DEPLOY.md).

    Run from anywhere:  powershell -File deploy\build-live.ps1
                        powershell -File deploy\build-live.ps1 -SkipBuild

    ASCII only, deliberately: Windows PowerShell 5.1 reads a .ps1 without a BOM
    as ANSI, so a stray em dash or box-drawing character is a parse error.

    Three rules this script exists to enforce, each learned the hard way:

      1. ONE .env. The live .env holds real production secrets and is kept
         across rebuilds; the .example template is NEVER copied in beside it,
         or the next person edits the wrong file.
      2. No archive inside live/. .htaccess does not block .zip, so a bundle
         zipped into its own folder is a public download of the backend source
         and the .env. Zip live/ from OUTSIDE it, or not at all.
      3. Stop `npm run dev` first - a production build overwrites the dev
         server's .next/ and every dev route then 404s.
#>
[CmdletBinding()]
param(
    # Reuse an existing frontend/out/ instead of running the build again.
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$live = Join-Path $root 'live'
$out = Join-Path $root 'frontend\out'
$backend = @('api', 'src', 'database', 'cli')

# --- 1. build -------------------------------------------------------------
if (-not $SkipBuild) {
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
        throw 'A dev server is listening on :3000. Stop it first - the build would overwrite its .next/ and every dev route would 404.'
    }
    Write-Host 'Building the frontend...' -ForegroundColor Cyan
    Push-Location (Join-Path $root 'frontend')
    try {
        if (Test-Path 'out') { Remove-Item 'out' -Recurse -Force }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
}
if (-not (Test-Path $out)) { throw "No export at $out - run without -SkipBuild." }

# --- 2. keep the filled-in production .env across the rebuild -------------
$keptEnv = $null
$liveEnv = Join-Path $live '.env'
if (Test-Path $liveEnv) {
    $keptEnv = Join-Path ([System.IO.Path]::GetTempPath()) "crm-live-env-$PID"
    Copy-Item $liveEnv $keptEnv -Force
    Write-Host 'Keeping the existing live/.env.' -ForegroundColor DarkGray
}

# --- 3. rebuild the folder ------------------------------------------------
if (Test-Path $live) { Get-ChildItem $live -Force | Remove-Item -Recurse -Force }
else { New-Item -ItemType Directory -Path $live | Out-Null }

Get-ChildItem $out -Force | Copy-Item -Destination $live -Recurse -Force
foreach ($dir in $backend) { Copy-Item (Join-Path $root $dir) -Destination $live -Recurse -Force }
Copy-Item (Join-Path $root 'deploy\.htaccess') (Join-Path $live '.htaccess') -Force

if ($keptEnv) {
    Copy-Item $keptEnv $liveEnv -Force
    Remove-Item $keptEnv -Force
} else {
    # first run on this machine: seed from the template, then fill it in
    Copy-Item (Join-Path $root '.env.production.example') $liveEnv -Force
    Write-Warning 'live/.env was created from the template - fill in every CHANGE_ME before uploading.'
}

# --- 4. report + guard rails ----------------------------------------------
$files = Get-ChildItem $live -Recurse -Force -File
Write-Host ''
Write-Host ("live/  {0} files, {1:N1} MB" -f $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB)) -ForegroundColor Green

$envCount = (Get-ChildItem $live -Force -File | Where-Object { $_.Name -like '.env*' }).Count
if ($envCount -ne 1) { Write-Warning "Expected exactly one .env in live/, found $envCount." }

$archives = Get-ChildItem $live -Recurse -Force -File -Include *.zip, *.tar, *.gz
if ($archives) {
    $names = ($archives | ForEach-Object { $_.Name }) -join ', '
    Write-Warning "Archive(s) inside live/ ($names) - .htaccess does not block these, so they are a public download of the backend and the .env."
}

$placeholders = Select-String -Path $liveEnv -Pattern 'CHANGE_ME' | Where-Object { $_.Line -notmatch '^\s*#' }
if ($placeholders) {
    $keys = ($placeholders | ForEach-Object { ($_.Line -split '=', 2)[0] }) -join ', '
    Write-Warning "live/.env still has CHANGE_ME: $keys"
}

Write-Host 'Upload the CONTENTS of live/ into the document root.' -ForegroundColor Cyan
