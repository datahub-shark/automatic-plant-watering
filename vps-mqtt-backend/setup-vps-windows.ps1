# Script cài đặt tự động Tomato IoT MQTT Backend trên VPS Windows (vps-iot)
# Chạy trong PowerShell trên VPS: powershell -ExecutionPolicy Bypass -File .\setup-vps-windows.ps1

$ErrorActionPreference = "Stop"
Write-Host "=== CÀI ĐẶT TOMATO IOT MQTT + FASTAPI BACKEND TRÊN VPS ===" -ForegroundColor Cyan

# 1. Kiểm tra Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Chưa thấy Python. Đang thử cài qua winget..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id Python.Python.3.12 -e --source winget --accept-package-agreements --accept-source-agreements
        Write-Host "[!] Cài Python xong. Hãy mở lại cửa sổ PowerShell mới và chạy lại script này." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Error "Không tìm thấy Python hoặc winget. Hãy tải Python 3.12 từ https://www.python.org/downloads/windows/ (nhớ tích Add python.exe to PATH)."
    }
}

$pyVer = python --version
Write-Host "[OK] Phát hiện: $pyVer" -ForegroundColor Green

# 2. Tạo môi trường ảo .venv và cài thư viện
if (-not (Test-Path ".venv")) {
    Write-Host "[*] Đang tạo môi trường ảo .venv..."
    python -m venv .venv
}

Write-Host "[*] Đang cài đặt thư viện từ requirements.txt..."
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\pip.exe install -r requirements.txt

# 3. Tạo file .env từ .env.example và sinh JWT_SECRET ngẫu nhiên
if (-not (Test-Path ".env")) {
    Write-Host "[*] Đang khởi tạo file .env từ .env.example..."
    $envContent = Get-Content ".env.example" -Raw
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $jwtSecret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    $envContent = $envContent -replace "CHANGE_ME_TO_RANDOM_64_CHAR_HEX", $jwtSecret
    Set-Content -Path ".env" -Value $envContent -Encoding UTF8
    Write-Host "[OK] Đã tạo .env với JWT_SECRET ngẫu nhiên. Hãy mở .env để điền thông tin MQTT_BROKER / CF_DEVICE_TOKEN!" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Đã có file .env sẵn, giữ nguyên cấu hình cũ." -ForegroundColor Green
}

# 4. Tải cloudflared.exe (giúp VPS IP NAT mở cổng HTTPS/WSS công khai miễn phí mà không cần xin mở port)
if (-not (Test-Path "cloudflared.exe")) {
    Write-Host "[*] Đang tải cloudflared-windows-amd64.exe (để tạo HTTPS/WSS tunnel cho VPS NAT)..."
    try {
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
        Write-Host "[OK] Đã tải xong cloudflared.exe" -ForegroundColor Green
    } catch {
        Write-Host "[!] Không tự tải được cloudflared.exe: $($_.Exception.Message). Bạn có thể tải thủ công từ GitHub Cloudflare." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== HOÀN TẤT CÀI ĐẶT ===" -ForegroundColor Green
Write-Host "Bước tiếp theo:"
Write-Host "  1. Mở file .env điền MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD (và CF_DEVICE_TOKEN nếu muốn đồng bộ Cloudflare D1)."
Write-Host "  2. Chạy .\start-backend.bat để bật FastAPI + MQTT (port 10000)."
Write-Host "  3. Chạy .\start-tunnel.bat để lấy địa chỉ https://...trycloudflare.com (dán vào Web HMI)."
