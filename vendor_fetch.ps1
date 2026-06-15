# vendor_fetch.ps1 — one-time download of frontend libs + Latin fonts into
# web/vendor/, so the app runs 100% offline afterwards (no CDN at runtime).
# Re-run only if web/vendor/ is missing. Requires network access for this run.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Vendor = Join-Path $Root "web\vendor"
$Fonts = Join-Path $Vendor "fonts"
New-Item -ItemType Directory -Force -Path $Fonts | Out-Null

$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"

function Get-File($url, $dest) {
    Write-Host "  fetch $url"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -Headers @{ "User-Agent" = $UA }
}

Write-Host "Fetching React / ReactDOM / Babel..."
Get-File "https://unpkg.com/react@18.3.1/umd/react.production.min.js" (Join-Path $Vendor "react.production.min.js")
Get-File "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" (Join-Path $Vendor "react-dom.production.min.js")
Get-File "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" (Join-Path $Vendor "babel.min.js")

Write-Host "Fetching Latin display fonts (CJK falls back to system fonts)..."
$cssUrl = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..600&family=Space+Grotesk:wght@400..700&family=Space+Mono:wght@400;700&display=swap"
$css = (Invoke-WebRequest -Uri $cssUrl -UseBasicParsing -Headers @{ "User-Agent" = $UA }).Content
# Match both woff2 and ttf — Google's response format depends on the User-Agent.
$urls = [System.Text.RegularExpressions.Regex]::Matches($css, "https?://[^)]+\.(woff2|ttf)") | ForEach-Object { $_.Value } | Select-Object -Unique
$i = 0
foreach ($u in $urls) {
    # Preserve the original extension so the CSS format() hint stays correct.
    $ext = if ($u -match '\.woff2$') { 'woff2' } else { 'ttf' }
    $fn = "f$i.$ext"
    Get-File $u (Join-Path $Fonts $fn)
    $css = $css.Replace($u, "fonts/$fn")
    $i++
}
Set-Content -Path (Join-Path $Vendor "fonts.css") -Value $css -Encoding UTF8
$check = Get-Content (Join-Path $Vendor "fonts.css") -Raw
if ($check -match "https?://") { throw "fonts.css still contains a remote URL after vendoring - aborting (air-gap unsafe)." }
Write-Host "Done. Vendored $i fonts + 3 libs into $Vendor"
