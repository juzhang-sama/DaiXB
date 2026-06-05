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
set "DEV_SERVER_PORT=5175"
set "ELECTRON_RENDERER_URL=http://localhost:%DEV_SERVER_PORT%"
start "" cmd /c "npx vite --host ::1 --port %DEV_SERVER_PORT% --strictPort"

echo [3/3] Waiting for Vite, then launching Electron...
npx wait-on %ELECTRON_RENDERER_URL% && npx electron .
