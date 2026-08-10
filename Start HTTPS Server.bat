@echo off
cd /d "%~dp0"
title Rak'ah Counter - HTTPS Server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-https-server.ps1"
if errorlevel 1 pause
