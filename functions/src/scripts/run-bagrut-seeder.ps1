# Comprehensive Bagrut Seeder Runner (PowerShell)
# סקריפט להרצת מערכת האכלוס בצורה יציבה

param(
    [switch]$Resume,
    [switch]$DryRun,
    [string]$Subject
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Comprehensive Bagrut Content Seeder"
Write-Host "  מערכת אכלוס תוכן בגרויות"
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Check for GEMINI_API_KEY
if (-not $env:GEMINI_API_KEY -and -not $DryRun) {
    Write-Host "Error: GEMINI_API_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Set it with: `$env:GEMINI_API_KEY='your-api-key'"
    Write-Host "Or run with -DryRun to test without API"
    exit 1
}

# Change to functions directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..\..")

# Log file
$LogDir = "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}
$LogFile = Join-Path $LogDir "bagrut_seeding_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

Write-Host "Starting seeder at $(Get-Date)" -ForegroundColor Green
Write-Host "Logging to: $LogFile" -ForegroundColor Yellow
Write-Host ""

# Build arguments
$Args = @()
if ($Resume) {
    $Args += "--resume"
    Write-Host "Mode: RESUME (continuing from last progress)" -ForegroundColor Blue
}
elseif ($DryRun) {
    $Args += "--dry-run"
    Write-Host "Mode: DRY RUN (no actual changes)" -ForegroundColor Blue
}
elseif ($Subject) {
    $Args += "--subject=$Subject"
    Write-Host "Mode: Single subject ($Subject)" -ForegroundColor Blue
}
else {
    Write-Host "Mode: FULL SEEDING" -ForegroundColor Blue
}

Write-Host ""
Write-Host "Press Ctrl+C to stop at any time (progress is saved)" -ForegroundColor Yellow
Write-Host ""

# Run the seeder
$ArgsString = $Args -join " "
$Command = "npx ts-node src/scripts/comprehensiveBagrutSeeder.ts $ArgsString"

Write-Host "Running: $Command" -ForegroundColor Cyan
Write-Host ""

# Execute and log
Invoke-Expression $Command 2>&1 | Tee-Object -FilePath $LogFile

$ExitCode = $LASTEXITCODE

Write-Host ""
if ($ExitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Seeding completed successfully!"
    Write-Host "========================================" -ForegroundColor Green
}
else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Seeding finished with errors (exit code: $ExitCode)"
    Write-Host "  Check log file: $LogFile"
    Write-Host "  Run with -Resume to continue"
    Write-Host "========================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "Log saved to: $LogFile"
Write-Host "Progress saved to: src/scripts/bagrut_seeding_progress.json"
