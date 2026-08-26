<# 
.SYNOPSIS
    Database Backup Script for TCG E-Commerce Platform (PowerShell)
    
.DESCRIPTION
    Creates a timestamped PostgreSQL database backup using pg_dump.
    Works on Windows with PostgreSQL client tools installed.
    
.USAGE
    .\scripts\backup.ps1 [-BackupName <string>] [-BackupDir <string>]
    
.EXAMPLE
    .\scripts\backup.ps1
    .\scripts\backup.ps1 -BackupName "pre-migration"
    .\scripts\backup.ps1 -BackupDir "C:\backups"
#>

param(
    [string]$BackupName = "",
    [string]$BackupDir = ""
)

# Colors for output
$Red = [ConsoleColor]::Red
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Blue = [ConsoleColor]::Cyan
$Default = [ConsoleColor]::Gray

function Write-Colored($message, $color) {
    Write-Host $message -ForegroundColor $color
}

function Write-ErrorAndExit($message) {
    Write-Colored "Error: $message" $Red
    exit 1
}

# Load environment variables from .env
$envPath = if (Test-Path ".env") { ".env" } elseif (Test-Path "../.env") { "../.env" } else { "" }
if (-not $envPath) {
    Write-ErrorAndExit ".env file not found"
}

$envContent = Get-Content $envPath -Raw
$envContent -split "`n" | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove surrounding quotes if present
        if ($value -match '^"(.*)"$') { $value = $matches[1] }
        if ($value -match "^'(.*)'$") { $value = $matches[1] }
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Check DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-ErrorAndExit "DATABASE_URL not set in .env"
}

# Parse DATABASE_URL
$url = $env:DATABASE_URL
$url = $url -replace '^postgresql://', ''
$url = $url -replace '^postgres://', ''

if ($url -match '@') {
    $authPart, $hostPart = $url -split '@', 2
    $dbUser, $dbPass = $authPart -split ':', 2
} else {
    $dbUser = $env:PGUSER ?? 'postgres'
    $dbPass = $env:PGPASSWORD ?? ''
    $hostPart = $url
}

$dbHost = $hostPart -split ':', 2 | Select-Object -First 1
$portDb = $hostPart -split ':', 2 | Select-Object -Last 1
$dbPort = $portDb -split '/', 2 | Select-Object -First 1
$dbName = $portDb -split '/', 2 | Select-Object -Last 1
$dbName = $dbName -split '\?', 2 | Select-Object -First 1

$dbHost = if ($dbHost) { $dbHost } else { 'localhost' }
$dbPort = if ($dbPort) { $dbPort } else { '5432' }
$dbUser = if ($dbUser) { $dbUser } else { 'postgres' }
$dbName = if ($dbName) { $dbName } else { 'tcg_db' }

# Backup directory
if (-not $BackupDir) { $BackupDir = if (Test-Path ".\backups") { ".\backups" } else { ".\backups" } }
$BackupDir = Resolve-Path $BackupDir -ErrorAction SilentlyContinue
if (-not $BackupDir) {
    New-Item -ItemType Directory -Path ".\backups" -Force | Out-Null
    $BackupDir = Resolve-Path ".\backups"
}

# Timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Backup filename
if ($BackupName) {
    $backupFile = Join-Path $BackupDir "${BackupName}_${timestamp}.sql"
} else {
    $backupFile = Join-Path $BackupDir "${dbName}_${timestamp}.sql"
}

Write-Colored "========================================" $Blue
Write-Colored "  Database Backup Started" $Blue
Write-Colored "========================================" $Blue
Write-Colored "Database: $dbName" $Green
Write-Colored "Host:     $dbHost:$dbPort" $Green
Write-Colored "User:     $dbUser" $Green
Write-Colored "Output:   $backupFile" $Green
Write-Colored "========================================" $Blue

# Set PGPASSWORD
$env:PGPASSWORD = $dbPass

# Check if pg_dump exists
$pgDump = "pg_dump"
if (-not (Get-Command $pgDump -ErrorAction SilentlyContinue)) {
    # Try common PostgreSQL installation paths
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\pg_dump.exe"
    )
    foreach ($path in $pgPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $pgDump = $resolved.Path
            break
        }
    }
}

# Run pg_dump
$args = @(
    "--host=$dbHost",
    "--port=$dbPort",
    "--username=$dbUser",
    "--dbname=$dbName",
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--format=custom",
    "--verbose",
    "--file=$backupFile"
)

Write-Colored "Running pg_dump..." $Yellow
$exitCode = 0
try {
    & $pgDump @args
    $exitCode = $LASTEXITCODE
} catch {
    Write-ErrorAndExit "pg_dump failed: $_"
}

if ($exitCode -eq 0) {
    $fileSize = (Get-Item $backupFile).Length
    $fileSizeMB = "{0:N2}" -f ($fileSize / 1MB)
    
    Write-Colored "✓ Backup completed successfully!" $Green
    Write-Colored "File: $backupFile ($fileSizeMB MB)" $Green
    Write-Colored "========================================" $Blue
    
    # Create latest symlink (copy on Windows)
    $latestLink = Join-Path $BackupDir "latest_${dbName}.sql"
    Copy-Item $backupFile $latestLink -Force
    Write-Colored "Latest copy: $latestLink" $Green
} else {
    Write-ErrorAndExit "pg_dump failed with exit code $exitCode"
}