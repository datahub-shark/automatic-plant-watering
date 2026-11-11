# Hướng Dẫn Triển Khai Nhánh Song Song MQTT Trên VPS (`vps-iot`)

Tài liệu này dành riêng cho cấu hình VPS mà bạn đang thuê (`vps-iot` — gói **`VPS 4-4 IP NAT`**, đăng nhập RDP `remote.io.vn:12925`, user `Administrator`).

---

## ⚠️ Lưu Ý Rất Quan Trọng Về Gói `VPS 4-4 IP NAT`

1. **Không có IP Public riêng (NAT Port Sharing):**
   - Địa chỉ `remote.io.vn:12925` chỉ đang mở cổng chuyển tiếp cho **Remote Desktop (RDP)**.
   - Các cổng mặc định như `1883` (MQTT), `80`/`443` (HTTP/HTTPS), `10000` (FastAPI) **chưa tự động mở ra Internet** trên IP `remote.io.vn`.
2. **Bảo trì & Không sao lưu (theo thông báo trên trang quản lý `vps.info.vn`):**
   - Hệ thống VPS có lịch bảo trì sáng **14/11/2026 (07:00 – 10:00)** và gói giá rẻ không kèm backup.
   - Nhờ kiến trúc **chạy song song MQTT + Cloudflare D1**, mọi gói tin gửi qua MQTT lên VPS sẽ được tự động sao chép đồng bộ sang **Cloudflare D1 & Google Drive**, và nếu VPS tạm dừng/bảo trì thì ESP32 tự chuyển hướng gửi thẳng sang Cloudflare HTTPS!

---

## Cách Kết Nối Phù Hợp Nhất Cho `VPS 4-4 IP NAT`

### 1. Chiều Web HMI ↔ FastAPI WebSocket (`port 10000`): Dùng Cloudflare Tunnel (Không cần xin mở port NAT!)
- Ngay trong thư mục `vps-mqtt-backend`, file `setup-vps-windows.ps1` sẽ tải sẵn `cloudflared.exe`.
- Khi chạy `start-tunnel.bat`, VPS sẽ tạo kết nối ra ngoài tới Cloudflare và cấp ngay một địa chỉ **`https://....trycloudflare.com`** (kèm WebSocket **`wss://.../ws/sensor_data`**).
- Bạn chỉ cần copy link đó dán vào mục **Cài đặt VPS Realtime URL** trên Web HMI (GitHub Pages HTTPS yêu cầu `https://` / `wss://` mới cho phép kết nối).
- *Mẹo dùng lâu dài:* Nếu có tên miền riêng trên Cloudflare Zero Trust, dùng Named Tunnel để giữ cố định vĩnh viễn 1 tên miền (ví dụ `https://api-mqtt.yourdomain.com`).

### 2. Chiều ESP32 (4G) ↔ MQTT Broker ↔ FastAPI trên VPS
Vì VPS dùng **IP NAT** (chỉ mở sẵn cổng RDP `12925`), bạn có **2 cách**:

- **Cách A — Dùng ngay lập tức sau 3 phút (Khuyên dùng):**
  1. Tạo 1 MQTT Broker TLS miễn phí trên **HiveMQ Cloud Serverless** (hoặc **EMQX Cloud Serverless** — cổng `8883` TLS, miễn phí 100 thiết bị & 10GB/tháng).
  2. Điền thông tin Broker (`MQTT_BROKER`, `MQTT_PORT=8883`, `MQTT_USERNAME`, `MQTT_PASSWORD`) vào cả:
     - File `.env` của `vps-mqtt-backend` trên VPS.
     - File `firmware/include/secrets.h` của ESP32.
  3. Lúc này **cả ESP32 ngoài vườn và FastAPI trên `vps-iot` đều tự chủ động kết nối ra ngoài (Outbound)** tới cổng 8883 — hoàn toàn vượt qua giới hạn **IP NAT** mà không cần xin nhà cung cấp mở port!

- **Cách B — Chạy Eclipse Mosquitto làm Broker ngay bên trong `vps-iot`:**
  1. Tải & cài Eclipse Mosquitto cho Windows vào `C:\mosquitto`, dùng file mẫu `mosquitto/mosquitto.conf` (nhớ tạo user/password bằng `mosquitto_passwd`).
  2. Để ESP32 ngoài mạng 4G chọc được vào cổng `1883` trên VPS NAT này, bạn cần:
     - Liên hệ bộ phận hỗ trợ của `vps.info.vn` (qua kênh Telegram hỗ trợ trên panel) xin cấp thêm **1 cổng NAT** (ví dụ `remote.io.vn:XXXXX -> 127.0.0.1:1883`), **HOẶC** dùng dịch vụ TCP Tunnel tĩnh như **Playit.gg / FRP**.

---

## Các Bước Cài Đặt Trên VPS Windows (`remote.io.vn:12925`)

1. Mở **Remote Desktop Connection (`mstsc`)** trên máy tính Windows của bạn $\rightarrow$ nhập `remote.io.vn:12925`, user `Administrator` và mật khẩu trên trang quản lý VPS.
2. Trên VPS, tải nhánh `mqtt-parallel` từ GitHub:
   ```powershell
   git clone -b mqtt-parallel https://github.com/datahub-shark/automatic-plant-watering.git C:\tomato-mqtt
   cd C:\tomato-mqtt\vps-mqtt-backend
   ```
   *(Hoặc copy toàn bộ thư mục `vps-mqtt-backend` lên VPS nếu chưa cài Git).*
3. Mở **PowerShell** tại thư mục `vps-mqtt-backend` và chạy:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup-vps-windows.ps1
   ```
4. Mở file `.env` bằng Notepad:
   - Điền `MQTT_BROKER`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`.
   - Điền `CF_DEVICE_TOKEN` (token thiết bị Cloudflare của bạn) để VPS tự đồng bộ song song mọi bản tin MQTT lên Cloudflare D1.
   - Đổi `ADMIN_INITIAL_PASSWORD` thành mật khẩu bạn muốn.
5. Chạy 2 file:
   - Double-click **`start-backend.bat`** $\rightarrow$ Mở FastAPI (`http://localhost:10000`, Swagger `/docs`, Schema `/docs/table`).
   - Double-click **`start-tunnel.bat`** $\rightarrow$ Lấy URL `https://....trycloudflare.com` để kết nối từ Web HMI!

> **Chạy ngầm 24/24:** Sau khi test OK, tạo 2 tác vụ trong **Windows Task Scheduler** (Trigger: *At startup*, *Run whether user is logged on or not*) trỏ tới `start-backend.bat` và `start-tunnel.bat` để máy chủ tự bật lại sau mỗi lần VPS reboot hoặc bảo trì.

---

## Triển Khai Bằng Docker / Docker Compose (Đóng gói All-in-One: Web HMI + FastAPI + MQTT)

Thư mục gốc của nhánh `mqtt-parallel` có sẵn `Dockerfile` đa tầng (multi-stage): tự động build Web HMI (`build:vps`), nhúng thẳng vào `static/` của FastAPI (cổng `10000`), nên mở thẳng địa chỉ VPS là vào ngay giao diện điều khiển **cùng nguồn (same-origin)** mà không cần GitHub Pages!

### 1. Chạy nhanh trên máy có Docker (hoặc VPS Ubuntu Linux)
```bash
git clone -b mqtt-parallel https://github.com/datahub-shark/automatic-plant-watering.git tomato-mqtt
cd tomato-mqtt
cp vps-mqtt-backend/.env.example vps-mqtt-backend/.env
# Mở vps-mqtt-backend/.env sửa MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD, CF_DEVICE_TOKEN, JWT_SECRET

# Chỉ chạy Web HMI + FastAPI + MQTT Client (nối tới HiveMQ Cloud TLS 8883):
docker compose up -d --build

# Chạy kèm Eclipse Mosquitto nội bộ + Cloudflare Tunnel:
docker compose --profile local-mqtt --profile tunnel up -d --build
```

### 2. Xuất file `.tar.gz` đã build sẵn để đẩy thẳng lên VPS
Nếu bạn build sẵn image ở máy cá nhân và muốn copy sang VPS mà không cần build lại trên VPS:
```bash
docker save tomato-iot-mqtt:latest | gzip > tomato-iot-mqtt.tar.gz
# Copy sang VPS rồi nạp lại:
docker load < tomato-iot-mqtt.tar.gz
docker compose up -d --no-build
```

> **Lưu ý nếu dùng Docker trên `VPS 4-4 IP NAT` Windows:** Các gói VPS Windows giá rẻ thường không bật nested virtualization (Hyper-V/WSL2) để chạy container Linux. Nếu không cài được Docker Desktop trên Windows VPS, hãy bấm **Reinstall sang Ubuntu Linux** trên panel `vps.info.vn` (để chạy Docker native cực nhẹ), hoặc giữ Windows chạy trực tiếp Python theo các bước ở mục trên.

