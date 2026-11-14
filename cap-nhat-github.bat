@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
  echo Vui long cai Git: https://git-scm.com/downloads/win
  pause
  exit /b 1
)
if not exist ".git" (
  echo Chua thay thu muc .git tai day.
  echo Neu la repo moi, dung day-len-github.bat.
  echo Neu repo da co, hay clone repo va sao chep TOAN BO file trong ZIP vao repo do.
  pause
  exit /b 1
)
echo === CAP NHAT THOI GIAN CUA TOI: WEB + IPHONE + APK ===
git status --short
git add -A
if errorlevel 1 goto :fail
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update GOTINO Web iPhone Android v1.3.1"
  if errorlevel 1 goto :fail
) else (
  echo Khong co thay doi can commit.
)
git push
if errorlevel 1 goto :fail
echo.
echo Da push. Theo doi 2 workflow Web va APK o tab Actions tren GitHub.
pause
exit /b 0
:fail
echo Cap nhat chua thanh cong. Kiem tra Git va quyen truy cap.
pause
exit /b 1
