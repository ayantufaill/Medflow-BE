$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed or is not available in PATH.'
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is not running. Start Docker Desktop and run this script again.'
}

if (-not (Test-Path '.env.docker')) {
    throw 'Missing .env.docker in the backend folder.'
}

Write-Host 'Building and starting MedFlow backend...' -ForegroundColor Cyan
docker compose up --build -d

Write-Host 'Waiting for the API health check...' -ForegroundColor Cyan
$healthy = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:5001/health' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $healthy) {
    Write-Host 'The API did not become healthy. Recent logs:' -ForegroundColor Yellow
    docker compose logs --tail=80 api
    exit 1
}

Write-Host ''
Write-Host 'MedFlow backend is running.' -ForegroundColor Green
Write-Host 'API:     http://localhost:5001'
Write-Host 'Health:  http://localhost:5001/health'
Write-Host 'Swagger: http://localhost:5001/api-docs/'
Write-Host ''
Write-Host 'Logs:    docker compose logs -f api'
Write-Host 'Stop:    docker compose down'