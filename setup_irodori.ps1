# setup_irodori.ps1 — one-shot setup of the Irodori-TTS engine that Yomiroji needs.
# Creates a sibling ..\IrodoriTTS-offline\ with the patched source, a venv, and the
# (MIT-licensed) model weights from Hugging Face. Needs internet + Python 3.12.x
# (3.11 may work) + git. A GPU build also needs an NVIDIA driver (CUDA 12.8).
#
# Run via setup_irodori.bat (double-click), or in PowerShell. Re-runnable.
# If it fails, the README "Manual engine setup" section lists the same steps.

$ErrorActionPreference = "Stop"
$App     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Offline = Join-Path (Split-Path -Parent $App) "IrodoriTTS-offline"
$Src     = Join-Path $Offline "irodori-src"
$Commit  = "d2af4193ea172b4214433e72f24f3b0f13d2c1bd"
$Repo    = "https://github.com/Aratako/Irodori-TTS.git"
$Patch   = Join-Path $App "setup\offline-local-patches.patch"
$Req     = Join-Path $App "setup\requirements.txt"

# Run a native command so its stderr (git/pip print progress there) does NOT abort
# the script; fail only on a non-zero exit code.
function Run {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Args, [Parameter(Mandatory)][string]$What)
    Write-Host ("  > {0} {1}" -f (Split-Path $Exe -Leaf), ($Args -join ' ')) -ForegroundColor DarkGray
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & $Exe @Args 2>&1 | Out-Host
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) { throw "$What failed (exit $code). See the messages above." }
}
function Need($cmd, $hint) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found. $hint" } }

Need git    "Install Git for Windows."
Need python "Install Python 3.12.x and tick 'Add python.exe to PATH'."
try {
    $pyout = (& python --version 2>&1 | Out-String).Trim()
    if ($pyout -match '(\d+)\.(\d+)' -and -not ($Matches[1] -eq '3' -and $Matches[2] -eq '12')) {
        Write-Host "WARNING: $pyout detected; this engine targets Python 3.12.x (3.11 may still work)." -ForegroundColor Yellow
    }
} catch { Write-Host "WARNING: could not determine Python version (continuing)." -ForegroundColor Yellow }

New-Item -ItemType Directory -Force -Path $Offline | Out-Null

# 1) source: clone upstream (MIT), pin commit, apply offline patch (idempotent)
Write-Host "[1/4] Source: clone + pin + patch" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $Src ".git"))) {
    Push-Location $Offline; Run git @('clone', $Repo, 'irodori-src') 'git clone'; Pop-Location
}
Push-Location $Src
Run git @('checkout', '-q', $Commit) 'git checkout'
Run git @('reset', '--hard', '-q', $Commit) 'git reset'   # clean slate so re-runs work
Run git @('clean', '-fdq') 'git clean'
Run git @('apply', '--whitespace=nowarn', $Patch) 'git apply (offline patch)'
Pop-Location

# 2) venv
Write-Host "[2/4] Python venv" -ForegroundColor Cyan
$VPy = Join-Path $Offline ".venv\Scripts\python.exe"
if (-not (Test-Path $VPy)) { Run python @('-m', 'venv', (Join-Path $Offline '.venv')) 'venv create' }

# 3) dependencies (online). Torch comes from the CUDA 12.8 wheel index.
Write-Host "[3/4] Dependencies (downloads PyTorch — large, several minutes)" -ForegroundColor Cyan
Run $VPy @('-m', 'pip', 'install', '--upgrade', 'pip') 'pip upgrade'
Run $VPy @('-m', 'pip', 'install', '--extra-index-url', 'https://download.pytorch.org/whl/cu128', '-r', $Req) 'pip install requirements'
Run $VPy @('-m', 'pip', 'install', '--no-deps', '-e', $Src) 'pip install irodori-src'

# 4) models (MIT) from Hugging Face -> models\<...>  (via Python; version-proof)
Write-Host "[4/4] Models from Hugging Face (several GB)" -ForegroundColor Cyan
$dl = @"
from huggingface_hub import hf_hub_download
base = r'''$Offline'''
import os
jobs = [
 ('Aratako/Irodori-TTS-500M-v3','model.safetensors','models/base'),
 ('Aratako/Irodori-TTS-500M-v2-VoiceDesign','model.safetensors','models/voicedesign'),
 ('Aratako/Semantic-DACVAE-Japanese-32dim','weights.pth','models/codec'),
]
tok = ('llm-jp/llm-jp-3-150m',
       ['config.json','generation_config.json','special_tokens_map.json','tokenizer.json','tokenizer_config.json'],
       'models/tokenizers/llm-jp__llm-jp-3-150m')
def fetch(repo, fname, rel):
    dest = os.path.join(base, rel)
    os.makedirs(dest, exist_ok=True)
    hf_hub_download(repo_id=repo, filename=fname, local_dir=dest)
    print('  ok', repo, fname)
for r,f,d in jobs: fetch(r,f,d)
for f in tok[1]: fetch(tok[0], f, tok[2])
print('models done')
"@
$dlFile = Join-Path $Offline "_download_models.py"
Set-Content -Path $dlFile -Value $dl -Encoding UTF8
try { Run $VPy @($dlFile) 'download models' } finally { Remove-Item $dlFile -Force -ErrorAction SilentlyContinue }

Write-Host "`nDONE. Engine ready at $Offline" -ForegroundColor Green
Write-Host "Next:  vendor_fetch.bat   then   run_podcast.bat   (open http://127.0.0.1:7864)"
