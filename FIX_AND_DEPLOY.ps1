# ============================================================
# REPAIHUB - Fix & Deploy (one shot)
# Run this from PowerShell inside C:\Users\bbitm\OneDrive\Desktop\AI\repaihub\app
# ============================================================

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Step 1/6  Kill broken node_modules + stale git" -ForegroundColor Cyan
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
if (Test-Path .git)          { Remove-Item -Recurse -Force .git }
if (Test-Path dist.zip)      { Remove-Item -Force dist.zip }
if (Test-Path dist-deploy.zip) { Remove-Item -Force dist-deploy.zip }
if (Test-Path dist-fresh.zip)  { Remove-Item -Force dist-fresh.zip }

Write-Host "Step 2/6  Install dependencies (real versions)" -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "Step 3/6  Build production bundle" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host "Step 4/6  Fresh git init on 'main' + remote" -ForegroundColor Cyan
git init -b main
git remote add origin https://github.com/bbitmoney21-oss/repaihub.git

Write-Host "Step 5/6  Stage + commit" -ForegroundColor Cyan
git add .
git commit -m "Fix package.json versions; working Vite+React+TS build"

Write-Host "Step 6/6  Force-push to replace stale remote" -ForegroundColor Cyan
git push -u --force origin main

Write-Host ""
Write-Host "DONE. Now check:" -ForegroundColor Green
Write-Host "  1. https://github.com/bbitmoney21-oss/repaihub/actions - the deploy workflow should run"
Write-Host "  2. https://repaihub.com - should update within 1-2 minutes"
Write-Host ""
Write-Host "If the Actions tab shows red: open the failed run, read the log,"
Write-Host "and the most likely cause is missing NETLIFY_TOKEN / NETLIFY_SITE_ID secrets."
