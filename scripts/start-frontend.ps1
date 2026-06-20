$ErrorActionPreference = 'Continue'

# Add Node.js to PATH
$env:Path += ";C:\Program Files\nodejs"

# Navigate to frontend directory
$frontendDir = Join-Path $PSScriptRoot '..\frontend'
Push-Location $frontendDir

# Install dependencies if needed
if (!(Test-Path 'node_modules')) {
    Write-Host "Installing frontend dependencies..."
    npm install
}

# Start the frontend
Write-Host "Starting frontend..."
npm start

Pop-Location
