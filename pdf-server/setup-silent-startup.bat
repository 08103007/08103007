@echo off
title Setup PMC PDF Server Startup
color 0B
echo.
echo  ================================================
echo    Thiet lap PDF Server (Chay ngam & Link web)
echo  ================================================
echo.

:: Paths
set "CURRENT_DIR=%~dp0"
set "VBS_FILE=%CURRENT_DIR%silent_start.vbs"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_VBS=%STARTUP_DIR%\PMC_PDF_Server.vbs"

echo  [*] Tao file khoi dong an...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run chr^(34^) ^& "%CURRENT_DIR%start.bat" ^& chr^(34^) ^& " --silent", 0
echo Set WshShell = Nothing
) > "%VBS_FILE%"

echo  [*] Dang ky chay cung Windows...
copy /y "%VBS_FILE%" "%SHORTCUT_VBS%" >nul

echo  [*] Dang ky Giao thuc lien ket Web (pmc-pdf-server://)...
reg add "HKCU\Software\Classes\pmc-pdf-server" /f /ve /d "URL:PMC PDF Server Protocol" >nul
reg add "HKCU\Software\Classes\pmc-pdf-server" /f /v "URL Protocol" /d "" >nul
reg add "HKCU\Software\Classes\pmc-pdf-server\shell" /f >nul
reg add "HKCU\Software\Classes\pmc-pdf-server\shell\open" /f >nul
reg add "HKCU\Software\Classes\pmc-pdf-server\shell\open\command" /f /ve /d "\"%CURRENT_DIR%start.bat\" --silent" >nul

echo.
echo  [OK] Thiet lap hoan tat!
echo  - PDF Server se tu dong chay ngam khi mo may tinh.
echo  - Ban co the Bat/Tat server truc tiep tu webapp.
echo.
pause
