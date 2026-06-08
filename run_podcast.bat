@echo off
setlocal
rem Podcast Maker (Irodori TTS) — fully local launcher.

set "ROOT=%~dp0"
set "OFFLINE=%ROOT%..\IrodoriTTS-offline"
set "PYTHON=%OFFLINE%\.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo ERROR: Missing venv at "%PYTHON%".
  echo Run IrodoriTTS-offline\run_setup_offline.bat first.
  pause
  exit /b 1
)

set "IRODORI_TTS_MODELS_DIR=%OFFLINE%\models"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "HF_HOME=%ROOT%hf-home-disabled"
set "PYTHONPATH=%OFFLINE%\irodori-src;%ROOT%"

cd /d "%ROOT%"
echo Starting Podcast Maker: http://127.0.0.1:7864
"%PYTHON%" -m uvicorn server.main:app --host 127.0.0.1 --port 7864

echo.
echo Podcast Maker stopped.
pause
