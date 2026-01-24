@echo off
REM ========================================
REM Bagrut Content Seeder - One-Click Start
REM ========================================

echo.
echo ========================================
echo   Bagrut Content Seeder
echo   Starting background seeding...
echo ========================================
echo.

cd /d "%~dp0..\.."

REM Create logs directory if not exists
if not exist "logs" mkdir logs

REM Set timestamp for log file
for /f %%a in ('powershell -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set timestamp=%%a
set logfile=logs\bagrut_seeding_%timestamp%.log

echo Log file: %logfile%
echo.
echo The seeder will run in this window.
echo Progress is saved automatically - you can close and resume later.
echo Press Ctrl+C to stop gracefully.
echo.
echo ========================================
echo.

REM Run the seeder
call npx ts-node src/scripts/comprehensiveBagrutSeeder.ts >> "%logfile%" 2>&1

echo.
echo ========================================
if %ERRORLEVEL% EQU 0 (
    echo   Seeding completed successfully!
) else (
    echo   Seeding stopped. Run again to resume.
)
echo ========================================
echo.
echo Log saved to: %logfile%
echo Progress saved to: src\scripts\bagrut_seeding_progress.json
echo.
pause
