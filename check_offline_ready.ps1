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
$Wheelhouse = Join-Path $Offline "wheelhouse"
$wheels = @(Get-ChildItem -Path $Wheelhouse -Filter *.whl -ErrorAction SilentlyContinue)
Check "wheelhouse has wheels ($($wheels.Count))" ($wheels.Count -gt 50) "Missing pip wheels for offline install"
Check "torch (CUDA) wheel" ([bool]($wheels | Where-Object { $_.Name -like "torch-*" })) $null
Check "aiofiles wheel" ([bool]($wheels | Where-Object { $_.Name -like "aiofiles*" })) $null
Check "websockets wheel" ([bool]($wheels | Where-Object { $_.Name -like "websockets*" })) $null
Check "dacvae wheel" ([bool]($wheels | Where-Object { $_.Name -like "dacvae*" })) $null
Check "silentcipher wheel" ([bool]($wheels | Where-Object { $_.Name -like "silentcipher*" })) $null
Check "torchaudio wheel" ([bool]($wheels | Where-Object { $_.Name -like "torchaudio*" })) $null
Check "fastapi wheel" ([bool]($wheels | Where-Object { $_.Name -like "fastapi-*" })) $null
Check "uvicorn wheel" ([bool]($wheels | Where-Object { $_.Name -like "uvicorn-*" })) $null
Check "starlette wheel" ([bool]($wheels | Where-Object { $_.Name -like "starlette-*" })) $null
Check "python_multipart wheel" ([bool]($wheels | Where-Object { $_.Name -like "python_multipart*" })) $null
Check "pydantic wheel" ([bool]($wheels | Where-Object { $_.Name -like "pydantic-*" })) $null
Check "requirements-offline.txt" (Test-Path (Join-Path $Offline "requirements-offline.txt")) $null
Check "tokenizers file" (Test-Path (Join-Path $Offline "models\tokenizers\llm-jp__llm-jp-3-150m\tokenizer.json")) "Tokenizer model missing"
Check "run_setup_offline.bat exists" (Test-Path (Join-Path $Offline "run_setup_offline.bat")) $null
Check "irodori-src exists" (Test-Path (Join-Path $Offline "irodori-src")) "Source code missing"
foreach ($m in "base", "voicedesign", "codec", "tokenizers") {
    Check "models\$m" (Test-Path (Join-Path $Offline "models\$m")) "Model files missing"
}

# 2) Frontend assets vendored (the only online step for this app)
foreach ($f in "react.production.min.js", "react-dom.production.min.js", "babel.min.js", "fonts.css") {
    Check "web\vendor\$f" (Test-Path (Join-Path $App "web\vendor\$f")) "Run .\vendor_fetch.ps1 once while online"
}
# fonts.css must contain NO remote URLs — even a single https:// triggers outbound calls on the air-gapped PC.
$fontsCssPath = Join-Path $App "web\vendor\fonts.css"
if (Test-Path $fontsCssPath) {
    $fontsCssContent = Get-Content $fontsCssPath -Raw
    $remoteCount = ([System.Text.RegularExpressions.Regex]::Matches($fontsCssContent, "https?://")).Count
    Check "fonts.css has no remote URLs ($remoteCount found)" ($remoteCount -eq 0) "Re-run .\vendor_fetch.ps1 while online to download fonts locally (fonts.css must reference only local paths)"
} else {
    # File-missing case is already caught above; skip the content check to avoid double-counting.
}
Check "web\index.html" (Test-Path (Join-Path $App "web\index.html")) $null
Check "server\main.py" (Test-Path (Join-Path $App "server\main.py")) $null
Check "setup\requirements-server.txt" (Test-Path (Join-Path $App "setup\requirements-server.txt")) "Server requirements file missing"

# 3) Authoritative dry-run resolve test
$VenvPython = Join-Path $Offline ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    Write-Host "`nRunning pip dry-run resolve (this is authoritative)..."
    $OfflineReq = Join-Path $Offline "requirements-offline.txt"
    $ServerReq = Join-Path $App "setup\requirements-server.txt"
    & $VenvPython -m pip install --dry-run --ignore-installed --no-index --find-links $Wheelhouse -r $OfflineReq -r $ServerReq >$null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Check "pip dry-run resolve (full offline test)" $true $null
    } else {
        Check "pip dry-run resolve (full offline test)" $false "Missing wheels or dependency conflict - see setup logs"
    }
} else {
    Write-Host "`nWARNING: venv python not found at $VenvPython - skipping dry-run test"
    Write-Host "This test will run automatically during actual offline setup."
}

Write-Host ""
if ($fail -eq 0) { Write-Host "READY: this bundle can be copied and run fully offline." -ForegroundColor Green }
else { Write-Host "$fail item(s) missing — fix the above before going air-gapped." -ForegroundColor Red; exit 1 }
