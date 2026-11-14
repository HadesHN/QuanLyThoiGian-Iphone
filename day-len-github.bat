@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
  echo Chua cai Git: https://git-scm.com/downloads/win
  pause
  exit /b 1
)
if not exist ".github\workflows\deploy-pages.yml" (
  echo Khong tim thay file GitHub Pages workflow.
  pause
  exit /b 1
)
echo.
echo *** PUSH WEB IPHONE LEN GITHUB ***
echo Hay tao repository RONG tren https://github.com/new truoc khi chay.
set /p "REPO_URL=Nhap URL repository (https://github.com/USER/REPO.git): "
if "%REPO_URL%"=="" goto :failed
if not exist ".git" git init
if errorlevel 1 goto :failed
git add .
if errorlevel 1 goto :failed
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Publish Thoi Gian Cua Toi web for iPhone"
  if errorlevel 1 goto :failed
)
git branch -M main
if errorlevel 1 goto :failed
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)
if errorlevel 1 goto :failed
git push -u origin main
if errorlevel 1 goto :failed
echo.
echo Da push. Vao GitHub Settings - Pages - Source: GitHub Actions.
pause
exit /b 0
:failed
echo PUSH CHUA THANH CONG. Kiem tra URL repo, Git config name/email va quyen truy cap.
pause
exit /b 1
