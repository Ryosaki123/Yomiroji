@echo off
rem Runs vendor_fetch.ps1 in PowerShell (one-time fetch of the frontend libs/fonts).
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vendor_fetch.ps1" %*
echo.
pause
