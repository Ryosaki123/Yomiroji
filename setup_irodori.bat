@echo off
rem Runs setup_irodori.ps1 in PowerShell (cmd can't run .ps1 directly, and the
rem default execution policy may block it). Double-click this, or run it from cmd.
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_irodori.ps1" %*
echo.
echo (setup finished — review any messages above)
pause
