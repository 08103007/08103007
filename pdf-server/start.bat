@echo off
title PMC PDF Server
color 0A
echo.
echo  =============================================
echo    PMC PDF Server - Puppeteer local service
echo  =============================================
echo.

:: Auto-detect local scratch Node.js if global node is not found
node --version >nul 2>&1
if %errorlevel% equ 0 goto node_ok
if not exist "C:\Users\thinh\.gemini\antigravity\scratch\node-v20.11.0-win-x64\node.exe" goto node_check

echo  [*] Da tim thay Node.js. Dang lien ket...
set "PATH=C:\Users\thinh\.gemini\antigravity\scratch\node-v20.11.0-win-x64;%PATH%"

:node_check
node --version >nul 2>&1
if %errorlevel% equ 0 goto node_ok

color 0C
echo  [LOI] Khong tim thay Node.js!
echo  Vui long cai dat Node.js tu: https://nodejs.org
echo.
pause
exit /b 1

:node_ok

:: Install dependencies if node_modules doesn't exist
if exist "node_modules" goto start_server

echo  [*] Dang cai dat dependencies...
echo      Qua trinh nay mat khoang 1-3 phut.
echo.
call npm install
if %errorlevel% equ 0 goto install_ok

color 0C
echo  [LOI] npm install that bai!
pause
exit /b 1

:install_ok
echo.
echo  [OK] Cai dat xong!
echo.

:start_server
if "%1"=="--silent" goto run_node
if "%1"=="--minimized" goto run_node

:: Auto-hide window and minimize to System Tray if double-clicked
if exist "%~dp0silent_start.vbs" (
  cscript //nologo "%~dp0silent_start.vbs"
  exit /b 0
)

:run_node
echo  [*] Dang khoi dong PDF Server (Thu nho System Tray Icon)...
node server.js
pause
