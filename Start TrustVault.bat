@echo off
title TrustVault - Full Stack Portal (Node.js + Express + MongoDB + React)
cd /d "%~dp0"

echo Freeing ports 5000 and 5173 if previously occupied...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

rem Open the website once the servers start
start "" cmd /c "ping 127.0.0.1 -n 4 >nul & start http://localhost:5173"

echo ========================================================
echo   TrustVault - Digital Identity & Document Verification
echo   Full Stack: Node.js + Express.js + MongoDB + React
echo ========================================================
echo.
echo [1/2] Backend API running at http://localhost:5000/api
echo [2/2] Frontend Portal running at http://localhost:5173
echo.
echo Keep this window open. Press Ctrl+C or close to stop.
echo.

call npm run dev
pause
