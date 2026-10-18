<#
.SYNOPSIS
    Convenience wrapper for invoking REA (Reverse Engineer Anything) in Antigravity.
.DESCRIPTION
    Forwards any REA command to npx -y rea-agents@latest with robust error handling.
.EXAMPLE
    .\rea-cli.ps1 inspect-artifact "Lens Setup 2026.6.231104-latest.exe" --json
    .\rea-cli.ps1 inspect-electron-fuses "Lens Setup 2026.6.231104-latest.exe"
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$ArgsList
)

$ErrorActionPreference = "Stop"

try {
    # Ensure npx is available
    $npx = Get-Command "npx" -ErrorAction SilentlyContinue
    if (-not $npx) {
        Write-Error "npx could not be found. Please ensure Node.js and npm are on your PATH."
        exit 1
    }

    & npx -y rea-agents@latest @ArgsList
}
catch {
    Write-Error "Failed to execute REA command: $_"
    exit 1
}
