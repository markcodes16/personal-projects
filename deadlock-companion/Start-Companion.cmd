@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 setup_and_run.py
  if errorlevel 1 pause
  exit /b
)
where python >nul 2>nul
if not errorlevel 1 (
  python setup_and_run.py
  if errorlevel 1 pause
  exit /b
)
echo Python is needed for this first desktop release.
echo Install Python 3.11 or newer from python.org with the launcher and Tcl/Tk enabled.
start "" "https://www.python.org/downloads/windows/"
pause
