@echo off
setlocal EnableExtensions
cd /d "%~dp0site"
echo === THOI GIAN CUA TOI - WEB ===
echo Mo trinh duyet tai: http://localhost:8000
where py >nul 2>&1
if not errorlevel 1 (
  start "" "http://localhost:8000"
  py -3 -m http.server 8000 --bind 127.0.0.1
  goto :end
)
where python >nul 2>&1
if not errorlevel 1 (
  start "" "http://localhost:8000"
  python -m http.server 8000 --bind 127.0.0.1
  goto :end
)
echo Khong tim thay Python 3. Mo file index.html truc tiep; PWA offline chi hoat dong qua HTTP(S).
start "" "index.html"
:end
pause
