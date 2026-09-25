# ---------------------------------------------------------------------------
# Starts the TrustLens browser-extension services, each in its own window so
# you can see its logs and stop it individually.
#
#   Ctrl+C in a window stops that service. Closing this window does not stop them.
#
# Run:  powershell -ExecutionPolicy Bypass -File start_all.ps1
#
# WHAT CHANGED FROM THE ORIGINAL
# ------------------------------
# This used to point at three separate projects sitting elsewhere on one
# machine (D:\trustlens_post_checker, D:\trustlens-fake-follower-detection,
# D:\video-to-text transcriber). Two of those were never in this repository, so
# the extension could not actually run for anyone else.
#
# The classifier and account model are now served from this repo, by wrappers
# around the very same models the TrustLens website uses. Nothing to install
# separately, and the extension cannot disagree with the website because there
# is only one of each model.
#
# The transcriber is still external and still optional — Module 12 has not been
# integrated yet. The gateway degrades honestly without it: a reel's spoken
# audio is reported as "not checked" rather than being assumed innocent.
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

# This file lives in backend/browser_extension, so the backend is one level
# up. Resolved from the script's own location rather than hardcoded, so it
# works from any clone of the repo.
$Gateway = Join-Path $PSScriptRoot "gateway"
$Backend = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Python  = Join-Path $Backend "venv\Scripts\python.exe"

# Optional, external, not part of this repo. Leave as-is if you do not have it.
$Transcriber = "D:\video-to-text transcriber"

if (-not (Test-Path $Python)) {
    Write-Host "Could not find the backend venv at $Python" -ForegroundColor Red
    Write-Host "Create it first, or fix the path at the top of this script."
    exit 1
}

function Start-Service-Window($Title, $WorkDir, $Command) {
    if (-not (Test-Path $WorkDir)) {
        Write-Host "  SKIP  $Title  - not found at $WorkDir" -ForegroundColor Yellow
        return
    }
    Write-Host "  start $Title" -ForegroundColor Green
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle='TrustLens - $Title'; Set-Location '$WorkDir'; $Command"
    )
}

Write-Host "`nStarting TrustLens extension services...`n" -ForegroundColor Cyan

# 1. Post checker (port 8001) - wraps the site's own XLM-RoBERTa misinformation
#    classifier and adds the rule-based red-flag scan. Loads a ~1 GB model.
Start-Service-Window "classifier :8001" $Gateway `
    "& '$Python' -m uvicorn post_checker_api:app --port 8001"

# 2. Account model (port 8002) - wraps the site's own Random Forest.
Start-Service-Window "account model :8002" $Gateway `
    "& '$Python' -m uvicorn follower_api:app --port 8002"

# 3. The gateway the extension talks to (port 8100).
Start-Service-Window "gateway :8100" $Gateway `
    "& '$Python' -m uvicorn main:app --port 8100"

# 4. Optional transcriber (port 8000), external to this repo. Skipped silently
#    if you do not have it - reels then report speech as "not checked".
Start-Service-Window "transcriber :8000 (optional)" $Transcriber `
    ".\.venv\Scripts\python.exe run.py"

Write-Host "`nGive them ~30s (the classifier loads a 1 GB model), then check:" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:8100/health`n"
Write-Host "The extension popup shows the same status with a dot per service.`n"
Write-Host "NOTE: the main TrustLens website also uses port 8000. If you run" -ForegroundColor Yellow
Write-Host "both, do not also start the optional transcriber - they collide.`n" -ForegroundColor Yellow
