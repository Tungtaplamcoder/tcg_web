<# 
.SYNOPSIS
    Database Restore Script for TCG E-Commerce Platform (PowerShell)
    
.DESCRIPTION
    Restores a PostgreSQL database from a backup file created by backup.ps1.
    Works on Windows with PostgreSQL client tools installed.
    
.USAGE
    .\scripts\restore.ps1 -BackupFile <string> [-Force]
    
.EXAMPLE
    .\scripts\restore.ps1 -BackupFile ".\backups\tcg_db_20240115_120000.sql"
    .\scripts\restore.ps1 -BackupFile "tcg_db_20240115_120000.sql" -Force
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [switch]$Force
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

# Resolve backup file path
if (-not (Test-Path $BackupFile)) {
    $altPath = Join-Path ".\backups" $BackupFile
    if (Test-Path $altPath) {
        $BackupFile = $altPath
    } else {
        Write-ErrorAndExit "Backup file not found: $BackupFile"
    }
}
$BackupFile = Resolve-Path $BackupFile

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

Write-Colored "========================================" $Blue
Write-Colored "  Database Restore" $Blue
Write-Colored "========================================" $Blue
Write-Colored "Database: $dbName" $Green
Write-Colored "Host:     $dbHost:$dbPort" $Green
Write-Colored "User:     $dbUser" $Green
Write-Colored "Backup:   $BackupFile" $Green
Write-Colored "========================================" $Blue

# Confirmation prompt unless -Force is used
if (-not $Force) {
    Write-Colored "⚠ WARNING: This will OVERWRITE the database '$dbName'!" $Yellow
    Write-Colored "⚠ All existing data will be LOST!" $Yellow
    Write-Colored ""
    $confirm = Read-Host "Are you sure you want to continue? (type 'yes' to confirm)"
    if ($confirm -ne "yes") {
        Write-Colored "Restore cancelled." $Red
        exit 0
    }
}

# Set PGPASSWORD
$env:PGPASSWORD = $dbPass

# Check if pg_restore/psql exists
$pgRestore = "pg_restore"
$psql = "psql"
if (-not (Get-Command $pgRestore -ErrorAction SilentlyContinue)) {
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\pg_restore.exe"
    )
    foreach ($path in $pgPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $pgRestore = $resolved.Path
            break
        }
    }
}
if (-not (Get-Command $psql -ErrorAction SilentlyContinue)) {
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe"
    )
    foreach ($path in $pgPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $psql = $resolved.Path
            break
        }
    }
}

# Detect file format
$fileType = (cmd /c "file `"$BackupFile`"" 2>$null) ?? ""
if (-not $fileType) {
    # Fallback: check extension and first few bytes
    $firstBytes = Get-Content $BackupFile -TotalCount 5 -Raw
    if ($firstBytes -match '^PGDMP') {
        $fileType = "PostgreSQL custom database dump"
    } elseif ($firstBytes -match '^--') {
        $fileType = "ASCII text"
    }
}

Write-Colored "Restoring database..." $Blue

$exitCode = 0
if ($fileType -match "PostgreSQL custom database dump") {
    # Custom format
    $args = @(
        "--host=$dbHost",
        "--port=$dbPort",
        "--username=$dbUser",
        "--dbname=$dbName",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--verbose",
        $BackupFile
    )
    try {
        & $pgRestore @args
        $exitCode = $LASTEXITCODE
    } catch {
        Write-ErrorAndExit "pg_restore failed: $_"
    }
} elseif ($fileType -match "ASCII text|UTF-8") {
    # Plain SQL format
    $args = @(
        "--host=$dbHost",
        "--port=$dbPort",
        "--username=$dbUser",
        "--dbname=$dbName",
        "--file=$BackupFile",
        "--quiet"
    )
    try {
        & $psql @args
        $exitCode = $LASTEXITCODE
    } catch {
        Write-ErrorAndExit "psql failed: $_"
    }
} else {
    Write-ErrorAndExit "Unknown backup file format. Expected PostgreSQL custom dump or SQL file."
}

if ($exitCode -eq 0) {
    Write-Colored "✓ Database restored successfully!" $Green
} else {
    Write-ErrorAndExit "Restore failed with exit code $exitCode"
}

Write-Colored "========================================" $Blue