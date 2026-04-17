# ============================================================
# REPAIHUB — Push source code to GitHub
# ============================================================
# Right-click this file -> "Run with PowerShell"
# OR open PowerShell in this folder and type: .\PUSH_GITHUB.ps1
#
# Prerequisites: Git installed (https://git-scm.com/download/win)
# GitHub repo: bbitmoney21-oss/repaihub
# ============================================================

$APP_DIR  = $PSScriptRoot
$REPO_URL = "https://github.com/bbitmoney21-oss/repaihub.git"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  REPAIHUB — GitHub Push" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $APP_DIR

# ── Init git if not already done ──────────────────────────
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
    Write-Host "Git repo initialized." -ForegroundColor Green
} else {
    Write-Host "Git repo already exists — adding new changes." -ForegroundColor Yellow
}

# ── Stage all tracked files ───────────────────────────────
git add -A
git status

# ── Commit ────────────────────────────────────────────────
Write-Host ""
$msg = Read-Host "Commit message (press Enter for default)"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "chore: update REPAIHUB source" }
git commit -m $msg 2>&1

# ── Set remote ────────────────────────────────────────────
$remotes = git remote 2>&1
if ($remotes -notcontains "origin") {
    git remote add origin $REPO_URL
    Write-Host "Remote 'origin' added." -ForegroundColor Green
}

# ── Push ──────────────────────────────────────────────────
Write-Host ""
Write-Host "Pushing to $REPO_URL ..." -ForegroundColor Yellow
Write-Host "(You may be prompted for GitHub credentials)" -ForegroundColor Gray
Write-Host ""
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! Source is on GitHub." -ForegroundColor Green
    Write-Host "  Repo : $REPO_URL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: connect Netlify CI/CD" -ForegroundColor Cyan
    Write-Host "  1. Go to https://app.netlify.com/sites/jazzy-crostata-07699e/settings/deploys" -ForegroundColor White
    Write-Host "  2. Click 'Link site to Git' -> GitHub -> bbitmoney21-oss/repaihub" -ForegroundColor White
    Write-Host "  3. Build command : npm run build" -ForegroundColor White
    Write-Host "  4. Publish dir   : dist" -ForegroundColor White
    Write-Host "  5. Branch deploys: set main to 'Deploy previews' (not auto-publish)" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Push failed — check credentials or branch name." -ForegroundColor Red
}

Write-Host ""
pause
