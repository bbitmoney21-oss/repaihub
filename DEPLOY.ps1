# ============================================================
# REPAIHUB — Build & Deploy to Netlify (repaihub.com)
#   Right-click this file -> "Run with PowerShell"
#   OR open PowerShell in this folder and type: .\DEPLOY.ps1
# ============================================================

$TOKEN   = "nfp_BqvHYMGpVRDzYqw2VovUGKrBc2hp4WNh2cc2"
# jazzy-crostata-07699e — the site that serves repaihub.com
$SITE_ID = "7216742d-6113-47c4-8502-359aeaa26d42"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  REPAIHUB — Build & Deploy to repaihub.com" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build ─────────────────────────────────────────
Write-Host "Step 1: Building app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Fix errors above and re-run." -ForegroundColor Red
    pause; exit 1
}
Write-Host "Build succeeded." -ForegroundColor Green
Write-Host ""

# ── Step 2: Zip dist ──────────────────────────────────────
Write-Host "Step 2: Zipping dist folder..." -ForegroundColor Yellow
$ZIP = Join-Path $PSScriptRoot "dist.zip"
if (Test-Path $ZIP) { Remove-Item $ZIP -Force }
Compress-Archive -Path "dist\*" -DestinationPath $ZIP
Write-Host "Zip created: $ZIP" -ForegroundColor Green
Write-Host ""

# ── Step 3: Deploy ────────────────────────────────────────
Write-Host "Step 3: Deploying to https://repaihub.com ..." -ForegroundColor Yellow

try {
    $headers  = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/zip" }
    $zipBytes = [System.IO.File]::ReadAllBytes($ZIP)
    $result   = Invoke-RestMethod `
        -Uri "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys" `
        -Method POST -Headers $headers -Body $zipBytes

    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "  State : $($result.state)" -ForegroundColor Green
    Write-Host "  URL   : https://repaihub.com" -ForegroundColor Green
    Write-Host "  ID    : $($result.id)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Live at: https://repaihub.com" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Deploy failed: $_" -ForegroundColor Red
}

Write-Host ""
pause
