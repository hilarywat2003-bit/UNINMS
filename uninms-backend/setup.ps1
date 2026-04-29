# ═══════════════════════════════════════════════════════════════
#  UniNMS — One-Click Setup for Windows
#  Run this from the uninms-backend folder:
#  .\setup.ps1
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  UniNMS — Local Setup" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# ── Check Docker ─────────────────────────────────────────────────────────────
Write-Host "Step 1/5: Checking Docker..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "  ✓ $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker not found. Please install Docker Desktop from:" -ForegroundColor Red
    Write-Host "    https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# ── Check Node ────────────────────────────────────────────────────────────────
Write-Host "Step 2/5: Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found. Please install from:" -ForegroundColor Red
    Write-Host "    https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# ── Create .env ──────────────────────────────────────────────────────────────
Write-Host "Step 3/5: Setting up environment..." -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  ✓ Created .env from .env.example" -ForegroundColor Green
    Write-Host "  ℹ You can edit .env to add your OpenAI key later" -ForegroundColor Yellow
} else {
    Write-Host "  ⏭ .env already exists — skipping" -ForegroundColor Yellow
}

# ── Start Docker containers ───────────────────────────────────────────────────
Write-Host "Step 4/5: Starting database and Redis..." -ForegroundColor Cyan
docker compose up postgres redis -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to start containers. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

Write-Host "  Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# ── Install, Migrate, Seed ───────────────────────────────────────────────────
Write-Host "Step 5/5: Installing dependencies and setting up database..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ npm install failed" -ForegroundColor Red; exit 1 }

node scripts/migrate.js
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Migration failed" -ForegroundColor Red; exit 1 }

node scripts/seed.js
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Seed failed" -ForegroundColor Red; exit 1 }

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅  Setup complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the API:" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then open:" -ForegroundColor White
Write-Host "    http://localhost:3000/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Login credentials:" -ForegroundColor White
Write-Host "    Email:    admin@uninms.edu.ng" -ForegroundColor Yellow
Write-Host "    Password: Admin@UniNMS2024!" -ForegroundColor Yellow
Write-Host ""
