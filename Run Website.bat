@echo off
cd /d "%~dp0"
echo ============================================
echo Chhath Mahaparv - Abhinav Kumar
echo ============================================
echo Open http://localhost:8000 if not launched automatically.
echo Keep the server window open. Ctrl+C to stop.
where py >nul 2>nul
if %errorlevel%==0 goto pylaunch
where python >nul 2>nul
if %errorlevel%==0 goto pythonlaunch
echo Python 3 is not installed. Install Python 3 first.
pause
exit /b 1
:pylaunch
start "" "http://localhost:8000"
py -3 -m http.server 8000
exit /b
:pythonlaunch
start "" "http://localhost:8000"
python -m http.server 8000
exit /b
