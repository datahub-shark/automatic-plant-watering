@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [!] Chua thay moi truong .venv. Hay chay setup-vps-windows.ps1 truoc!
  pause
  exit /b 1
)
echo [*] Dang khoi dong Tomato MQTT + FastAPI Backend tren cong 10000...
".venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 10000
pause
