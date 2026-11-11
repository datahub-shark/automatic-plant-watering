@echo off
cd /d "%~dp0"
if not exist "cloudflared.exe" (
  echo [!] Khong thay cloudflared.exe. Hay chay setup-vps-windows.ps1 hoac tai tu GitHub Cloudflare!
  pause
  exit /b 1
)
echo [*] Dang mo Cloudflare Quick Tunnel (HTTPS + WSS) cho localhost:10000...
echo [*] Copy link https://....trycloudflare.com in ra ben duoi va dan vao Web HMI (hoac cau hinh Named Tunnel cho ten mien co dinh)!
cloudflared.exe tunnel --url http://localhost:10000
pause
