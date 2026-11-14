@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tao-apk-windows.ps1"
if errorlevel 1 (
    echo.
    echo BUILD FAILED. Please read the error above.
) else (
    echo.
    echo Build succeeded. Check ThoiGianCuaToi-debug.apk.
)
pause
