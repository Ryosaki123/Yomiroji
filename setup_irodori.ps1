# setup_irodori.ps1 — one-shot setup of the Irodori-TTS engine that Yomiroji needs.
# Creates a sibling ..\IrodoriTTS-offline\ with the patched source, a venv, and the
# (MIT-licensed) model weights downloaded from Hugging Face. Needs internet + Python
# 3.12.x + git. For a GPU build you also need an NVIDIA driver (CUDA 12.8).
#
# If any step fails, see the "Manual setup" section in README.md — the steps below
# are exactly what this script automates.

$ErrorActionPreference = "Stop"
$App = Split-Path -Parent $MyInvocation.MyCommand.Path
$Offline = Join-Path (Split-Path -Parent $App) "IrodoriTTS-offline"
$Commit = "d2af4193ea172b4214433e72f24f3b0f13d2c1bd"
$Repo = "https://github.com/Aratako/Irodori-TTS.git"
$Patch = Join-Path $App "setup\offline-local-patches.patch"
$Req = Join-Path $App "setup\requirements.txt"

function Need($cmd, $hint) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found. $hint" }
}
Need git "Install Git."
Need python "Install Python 3.12.x and add it to PATH."
$pyv = (& python -c "import sys;print('.'.join(map(str,sys.version_info[:2])))").Trim()
if ($pyv -ne "3.12") { Write-Host "WARNING: Python $pyv detected; this engine targets 3.12.x." -ForegroundColor Yellow }

New-Item -ItemType Directory -Force -Path $Offline | Out-Null
Set-Location $Offline

# 1) source: clone upstream (MIT), pin commit, apply offline patch
if (-not (Test-Path "irodori-src\.git")) {
    Write-Host "[1/4] Cloning Aratako/Irodori-TTS ..." -ForegroundColor Cyan
    git clone $Repo irodori-src
}
Set-Location (Join-Path $Offline "irodori-src")
git fetch --depth 1 origin $Commit 2>$null
git checkout $Commit
Write-Host "[1/4] Applying offline patch ..." -ForegroundColor Cyan
git apply --whitespace=nowarn $Patch
Set-Location $Offline

# 2) venv
Write-Host "[2/4] Creating venv ..." -ForegroundColor Cyan
if (-not (Test-Path ".venv\Scripts\python.exe")) { & python -m venv .venv }
$VPy = Join-Path $Offline ".venv\Scripts\python.exe"

# 3) dependencies (online). Torch is pulled from the CUDA 12.8 wheel index.
Write-Host "[3/4] Installing dependencies (this downloads PyTorch — large) ..." -ForegroundColor Cyan
& $VPy -m pip install --upgrade pip
& $VPy -m pip install --extra-index-url https://download.pytorch.org/whl/cu128 -r $Req
& $VPy -m pip install --no-deps -e (Join-Path $Offline "irodori-src")

# 4) models (MIT) from Hugging Face -> models\<...>
Write-Host "[4/4] Downloading models from Hugging Face ..." -ForegroundColor Cyan
$HF = Join-Path $Offline ".venv\Scripts\huggingface-cli.exe"
& $HF download Aratako/Irodori-TTS-500M-v3 model.safetensors --local-dir (Join-Path $Offline "models\base")
& $HF download Aratako/Irodori-TTS-500M-v2-VoiceDesign model.safetensors --local-dir (Join-Path $Offline "models\voicedesign")
& $HF download Aratako/Semantic-DACVAE-Japanese-32dim weights.pth --local-dir (Join-Path $Offline "models\codec")
& $HF download llm-jp/llm-jp-3-150m config.json generation_config.json special_tokens_map.json tokenizer.json tokenizer_config.json --local-dir (Join-Path $Offline "models\tokenizers\llm-jp__llm-jp-3-150m")

Write-Host "`nDone. Engine ready at $Offline" -ForegroundColor Green
Write-Host "Now run Yomiroji:  .\run_podcast.bat   (from $App)"
