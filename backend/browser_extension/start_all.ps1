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
# Reel audio is now transcribed inside the gateway itself (faster-whisper), and
# the post/account data comes from RapidAPI via backend/data_ingestion.py, so
# there is nothing external to start any more.
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

# This file lives in backend/browser_extension, so the backend is one level
# up. Resolved from the script's own location rather than hardcoded, so it
# works from any clone of the repo.
$Gateway = Join-Path $PSScriptRoot "gateway"
$Backend = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Python  = Join-Path $Backend "venv\Scripts\python.exe"

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
    # If the service ever stops (for example Windows ran out of memory and
    # killed it), it restarts by itself instead of silently staying down.
    # Close the window to stop it for good.
    $Loop = "while (`$true) { $Command; Write-Host 'Service stopped - restarting in 3 seconds (close this window to stop it).' -ForegroundColor Yellow; Start-Sleep 3 }"
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle='TrustLens - $Title'; Set-Location '$WorkDir'; $Loop"
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

# 3. The gateway the extension talks to (port 8100). Also fetches Instagram data
#    through RapidAPI and listens to reel audio (loads the Whisper model).
Start-Service-Window "gateway :8100" $Gateway `
    "& '$Python' -m uvicorn main:app --port 8100"

Write-Host "`nGive them ~30s (the classifier loads a 1 GB model), then check:" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:8100/health`n"
Write-Host "The extension popup shows the same status with a dot per service.`n"
