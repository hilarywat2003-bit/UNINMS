# ═══════════════════════════════════════════════════════════════
#  UniNMS Web — One-Click Setup for Windows
#  Run from the uninms-web folder:  .\setup.ps1
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  UniNMS Web — Local Setup" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Check Node
Write-Host "Step 1/3: Checking Node.js..." -ForegroundColor Cyan
try {
    $v = node --version 2>&1
    Write-Host "  ✓ $v" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found." -ForegroundColor Red; exit 1
}

# Create .env.local
Write-Host "Step 2/3: Creating environment file..." -ForegroundColor Cyan
if (-not (Test-Path ".env.local")) {
    "NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1" | Out-File -Encoding utf8 ".env.local"
    Write-Host "  ✓ Created .env.local" -ForegroundColor Green
} else {
    Write-Host "  ⏭ .env.local already exists" -ForegroundColor Yellow
}

# Install dependencies
Write-Host "Step 3/3: Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ npm install failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅  Setup complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Make sure the API is running first:" -ForegroundColor White
Write-Host "    (in uninms-backend)  npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then start the frontend:" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Open: http://localhost:3001" -ForegroundColor Yellow
Write-Host ""
