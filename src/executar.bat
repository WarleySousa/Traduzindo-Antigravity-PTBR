@echo off
rem Roda src\ptbr.cjs usando o próprio Antigravity.exe como Node.js (ELECTRON_RUN_AS_NODE),
rem então não é preciso instalar o Node. Parâmetros: <instalar|restaurar|status> [pasta do Antigravity]
setlocal
set "PASTA=%~2"
if "%PASTA%"=="" set "PASTA=%LOCALAPPDATA%\Programs\antigravity"
if not exist "%PASTA%\Antigravity.exe" (
  echo Não encontrei o Antigravity em "%PASTA%".
  echo Arraste a pasta de instalação do Antigravity sobre este atalho, ou informe-a como parâmetro.
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=1
"%PASTA%\Antigravity.exe" "%~dp0ptbr.cjs" %1 "%PASTA%"
exit /b %ERRORLEVEL%
