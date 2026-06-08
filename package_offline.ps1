# package_offline.ps1 — bundle the whole 012_IrodoriTTS tree into ONE zip for
# air-gapped transfer, excluding the non-portable / regenerated parts
# (.venv, caches, .git, generated audio). Run on the CONNECTED machine.
#
#   .\package_offline.ps1                       # zip next to the project folder
#   .\package_offline.ps1 -Destination E:\x.zip # zip straight onto a USB drive
#   .\package_offline.ps1 -ListOnly             # just preview what would be included
#
# Rebuild the .venv on the target with IrodoriTTS-offline\run_setup_offline.bat.

param(
    [string]$Destination,
    [switch]$ListOnly
)

$ErrorActionPreference = "Stop"
$App = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $App                 # ...\012_IrodoriTTS
$Parent = Split-Path -Parent $Root
$RootName = Split-Path -Leaf $Root

if (-not $Destination) { $Destination = Join-Path $Parent "IrodoriTTS-Podcast-airgap.zip" }

# directory NAMES to skip anywhere in the tree
$excludeDirNames = @(".venv", "__pycache__", ".git", "node_modules",
    ".pytest_cache", ".mypy_cache", "hf-home-disabled")
# directories (relative to Root) to skip — generated audio only; the voice library is kept
$excludeRel = @("PodcastwithIrodoriTTS\data\outputs", "PodcastwithIrodoriTTS\data\previews")

Write-Host "Collecting files from $Root ..." -ForegroundColor Cyan
$files = New-Object System.Collections.Generic.List[string]
$bytes = [long]0
$stack = New-Object System.Collections.Stack
$stack.Push($Root)
while ($stack.Count) {
    $dir = $stack.Pop()
    foreach ($sub in [System.IO.Directory]::EnumerateDirectories($dir)) {
        $leaf = Split-Path $sub -Leaf
        if ($excludeDirNames -contains $leaf) { continue }
        $rel = $sub.Substring($Root.Length).TrimStart('\')
        if ($excludeRel -contains $rel) { continue }
        $stack.Push($sub)
    }
    foreach ($f in [System.IO.Directory]::EnumerateFiles($dir)) {
        $leaf = Split-Path $f -Leaf
        if ($leaf -like "*.log" -or $leaf -like "*.pyc") { continue }
        if ($f -ieq $Destination) { continue }
        $files.Add($f)
        $bytes += (Get-Item -LiteralPath $f).Length
    }
}

$gb = [math]::Round($bytes / 1GB, 2)
Write-Host ("Files: {0}   Uncompressed size: {1} GB" -f $files.Count, $gb) -ForegroundColor Green

if ($ListOnly) {
    Write-Host "`n-ListOnly: nothing written. Excluded dir names: $($excludeDirNames -join ', ')"
    Write-Host "Excluded paths: $($excludeRel -join '; ')"
    return
}

Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
if (Test-Path $Destination) { Remove-Item $Destination -Force }
Write-Host "Writing $Destination (store/no-compression — fast; content is already compressed) ..." -ForegroundColor Cyan

$zip = [System.IO.Compression.ZipFile]::Open($Destination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $i = 0; $n = $files.Count
    foreach ($f in $files) {
        # entry path is relative to the parent so the zip contains a top-level "<RootName>\..."
        $entry = ($f.Substring($Parent.Length).TrimStart('\')) -replace '\\', '/'
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $f, $entry, [System.IO.Compression.CompressionLevel]::NoCompression) | Out-Null
        $i++
        if ($i % 100 -eq 0 -or $i -eq $n) {
            Write-Progress -Activity "Packaging $RootName" -Status "$i / $n files" -PercentComplete ([int]($i * 100 / $n))
        }
    }
}
finally { $zip.Dispose() }
Write-Progress -Activity "Packaging $RootName" -Completed

$zipGb = [math]::Round((Get-Item -LiteralPath $Destination).Length / 1GB, 2)
Write-Host "`nDONE: $Destination  ($zipGb GB)" -ForegroundColor Green
Write-Host "On the air-gapped PC: extract it, install Python 3.12.6, then run"
Write-Host "  $RootName\IrodoriTTS-offline\run_setup_offline.bat"
Write-Host "  $RootName\PodcastwithIrodoriTTS\run_podcast.bat"
