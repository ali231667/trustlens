# One command to start everything: activates the virtual environment,
# then starts the backend server (which loads the database and all AI
# models automatically on startup).
#
# Run from the backend folder:  .\start.ps1
# Or from anywhere:              powershell -File backend\start.ps1

& "$PSScriptRoot\venv\Scripts\Activate.ps1"
uvicorn main:app --reload
