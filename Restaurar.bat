@echo off
chcp 65001 >nul
title Antigravity PT-BR - Restaurar original
call "%~dp0src\executar.bat" restaurar %*
echo.
pause
