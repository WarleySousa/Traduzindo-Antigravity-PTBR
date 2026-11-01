@echo off
chcp 65001 >nul
title Antigravity PT-BR - Instalar
call "%~dp0src\executar.bat" instalar %*
echo.
pause
