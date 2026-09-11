@echo off
cd /d "%~dp0"
if exist "release-public\Flowline-win32-x64\Flowline.exe" (
  start "" "release-public\Flowline-win32-x64\Flowline.exe"
) else if exist "release-v2\Flowline-win32-x64\Flowline.exe" (
  start "" "release-v2\Flowline-win32-x64\Flowline.exe"
) else if exist "release\Flowline-win32-x64\Flowline.exe" (
  start "" "release\Flowline-win32-x64\Flowline.exe"
) else (
  echo Please run npm install and npm run package first.
  pause
)
