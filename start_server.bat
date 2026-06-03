@echo off
echo ========================================
echo   LoanIntelligence Parser Starting...
echo ========================================

cd /d "%~dp0"

echo [1/3] Compiling TypeScript...
call npx tsc -p tsconfig.main.json
if errorlevel 1 (
    echo TypeScript compilation failed!
    pause
    exit /b 1
)

echo [2/3] Starting Vite dev server...
start "" cmd /c "npx vite --host 127.0.0.1 --port 5173"

echo [3/3] Waiting for Vite, then launching Electron...
npx wait-on http://localhost:5173 && npx electron .

