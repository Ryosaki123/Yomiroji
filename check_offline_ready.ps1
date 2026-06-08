# check_offline_ready.ps1 — verify this bundle can run with NO internet.
# Run on the CONNECTED machine before copying to the air-gapped PC.

$ErrorActionPreference = "Continue"
$App = Split-Path -Parent $MyInvocation.MyCommand.Path
$Offline = Join-Path (Split-Path -Parent $App) "IrodoriTTS-offline"

$fail = 0
function Check($label, $cond, $hint) {
    if ($cond) { Write-Host ("  [OK]   " + $label) -ForegroundColor Green }
    else { Write-Host ("  [MISS] " + $label) -ForegroundColor Red; if ($hint) { Write-Host ("         -> " + $hint) -ForegroundColor Yellow }; $script:fail++ }
}

Write-Host "Checking air-gap readiness..." -ForegroundColor Cyan
Write-Host "App:     $App"
Write-Host "Offline: $Offline`n"

# 1) The Irodori offline distribution (wheels + models)
Check "IrodoriTTS-offline folder" (Test-Path $Offline) "Place IrodoriTTS-offline next to PodcastwithIrodoriTTS"
$wheels = @(Get-ChildItem -Path (Join-Path $Offline "wheelhouse") -Filter *.whl -ErrorAction SilentlyContinue)
Check "wheelhouse has wheels ($($wheels.Count))" ($wheels.Count -gt 50) "Missing pip wheels for offline install"
Check "torch (CUDA) wheel" ([bool]($wheels | Where-Object { $_.Name -like "torch-*" })) $null
Check "fastapi + uvicorn wheels" ([bool]($wheels | Where-Object { $_.Name -like "fastapi-*" }) -and [bool]($wheels | Where-Object { $_.Name -like "uvicorn-*" })) $null
Check "requirements-offline.txt" (Test-Path (Join-Path $Offline "requirements-offline.txt")) $null
foreach ($m in "base", "voicedesign", "codec", "tokenizers") {
    Check "models\$m" (Test-Path (Join-Path $Offline "models\$m")) "Model files missing"
}

# 2) Frontend assets vendored (the only online step for this app)
foreach ($f in "react.production.min.js", "react-dom.production.min.js", "babel.min.js", "fonts.css") {
    Check "web\vendor\$f" (Test-Path (Join-Path $App "web\vendor\$f")) "Run .\vendor_fetch.ps1 once while online"
}
Check "web\index.html" (Test-Path (Join-Path $App "web\index.html")) $null
Check "server\main.py" (Test-Path (Join-Path $App "server\main.py")) $null

Write-Host ""
if ($fail -eq 0) { Write-Host "READY: this bundle can be copied and run fully offline." -ForegroundColor Green }
else { Write-Host "$fail item(s) missing — fix the above before going air-gapped." -ForegroundColor Red; exit 1 }
