# Công việc còn lại — hệ thống tưới cà chua 3 hàng

Cập nhật: **11/11/2026**. Tài liệu này dùng để triển khai backend thuộc tài khoản Cloudflare của chủ dự án, sao lưu sang Google Drive, rồi mới kết nối STM32 và A7670C. Đánh dấu `[x]` chỉ khi có bằng chứng kiểm tra thực tế.

## 1. Trạng thái đã xác nhận

- [x] Source ở GitHub: `datahub-shark/automatic-plant-watering`, nhánh `main`.
- [x] GitHub Pages tại <https://datahub-shark.github.io/automatic-plant-watering/> chạy dashboard **dữ liệu mẫu**. Trang này chưa đọc D1 mới.
- [x] D1 `automatic-plant-watering` trong tài khoản Cloudflare của chủ dự án, ID `849fcdec-f331-437f-81bf-5ff46bbc005d`, vùng APAC. Đã nạp 5 bảng (`devices`, `telemetry`, `events`, `configs`, `commands`) và 2 index để xuất dữ liệu.
- [x] Worker tại <https://automatic-plant-watering-api.datahub-shark.workers.dev/api/v1/health>. Endpoint `health` trả HTTP 200. API quản trị từ chối yêu cầu thiếu token.
- [x] Source Worker kiểm tra TypeScript, build thử và ghi/đọc telemetry trên **D1 cục bộ**. Đây chưa phải phép thử ghi vào D1 cloud hay truyền qua 4G.
- [x] Đã tạo `DEVICE_TOKEN`, `ADMIN_TOKEN`, `BACKUP_TOKEN` trong Cloudflare Secrets. Các API dữ liệu đã mở và được xác thực đầy đủ.
- [x] Đã hoàn thành nâng cấp toàn diện HMI 2.0: Sửa lỗi báo động giả bồn cạn, hàng đợi lệnh TTL 10 phút, widget so sánh tiết kiệm nước, xuất file CSV định dạng UTF-8, khôi phục bảng hiệu chuẩn cảm biến ADC và phao an toàn.
- [x] Đã hoàn thành di chuyển firmware (`src/main.cpp`) sang Cloudflare Worker HTTPS REST API, loại bỏ hoàn toàn HiveMQ MQTT và Apps Script webhook cũ; biên dịch thành công 100% với PlatformIO cho ESP32-S3.
- [ ] Chưa xuất dữ liệu sang Google Drive; chưa cấu hình trigger Apps Script trong tài khoản Google của chủ dự án (Mã nguồn sẵn sàng tại `cloudflare-worker/drive-backup.gs`).
- [ ] Đấu nối thực tế tại nhà màng và nạp firmware lên kit ESP32-S3 + modem A7672X.

## 2. Việc cần làm theo thứ tự

### A. Kích hoạt và kiểm tra API trên Cloudflare

- [x] Tạo ba giá trị token ngẫu nhiên, **khác nhau**, đủ dài (256-bit). Đã nạp thành công vào Cloudflare Secrets qua Wrangler.
- [x] Dùng dữ liệu **giả** gửi telemetry đến `POST /api/v1/telemetry` với `Authorization: Bearer <DEVICE_TOKEN>`. Đã xác nhận trả HTTP 202 và D1 ghi đúng một bản ghi. Gửi lại cùng `device_id` + `seq`, xác nhận cơ chế chống trùng hoạt động (D1 không tăng bản ghi).
- [x] Kiểm tra `GET /api/v1/admin/latest?device_id=stm32_test` bằng `ADMIN_TOKEN` thành công; kiểm tra endpoint quản trị từ chối `DEVICE_TOKEN` (HTTP 403) đúng chuẩn RBAC.
- [x] Kiểm tra sự kiện `POST /api/v1/events` (chống trùng theo event_id), đọc/ghi cấu hình, hàng đợi lệnh và ACK (`commands/ack`). Lệnh chuyển trạng thái `acked` và hàng đợi được dọn sạch.
- [x] Ghi lại URL Worker (`https://automatic-plant-watering-api.datahub-shark.workers.dev`) và trạng thái kiểm thử 10/10 bước đều PASS. Đã dọn sạch các bản ghi dữ liệu test khỏi D1 cloud.

**Điều kiện hoàn tất A:** ĐÃ ĐẠT (API cloud ghi/đọc D1 hoạt động chuẩn xác; phân quyền thiết bị, quản trị và sao lưu đúng; cơ chế chống ghi trùng hoạt động hoàn hảo).

### B. Đưa dashboard từ dữ liệu mẫu sang dữ liệu thật & Giao diện HMI High-Performance

- [x] Chọn cách đăng nhập quản trị an toàn cho trang GitHub Pages: Người dùng nhập `ADMIN_TOKEN` trực tiếp qua modal đăng nhập, chỉ lưu tạm trong `sessionStorage` của tab trình duyệt. Tuyệt đối không nhúng token vào JavaScript bundle hay git repository.
- [x] Cập nhật frontend gọi trực tiếp Cloudflare Worker API (`https://automatic-plant-watering-api.datahub-shark.workers.dev/api/v1`). Cấu hình CORS chuẩn cho Worker cho phép origin GitHub Pages và preflight OPTIONS request.
- [x] Nâng cấp toàn diện giao diện web app theo tiêu chuẩn **Siemens & chilli mind HMI Design Workbook** và yêu cầu của dự án:
  - Tách biệt rõ ràng 2 chế độ: **Chế độ Tập sự & Huấn luyện (Mô phỏng an toàn cho công nhân mới)** và **Chế độ Vận hành Thực tế (Dữ liệu D1)**.
  - Tích hợp **Sơ đồ Công nghệ Thủy lực P&ID trực quan (12 chậu cà chua)** với hiệu ứng dòng chảy động khi van mở và bơm chạy.
  - Tích hợp **Trung tâm Cảnh báo & Hướng dẫn Khắc phục Sự cố tại chỗ (SOP Alarms)** bằng tiếng Việt dễ hiểu cho công nhân mới (Bồn cạn, Mất dòng chảy, Nghi rò rỉ van, Hết thời gian tối đa).
  - Tích hợp **Sổ tay Công nhân Vận hành (SOP Checklist)**: Quy trình chuẩn 3 bước đầu ca - trong ca - cuối ca.
  - Bổ sung nút **DỪNG KHẨN CẤP (E-STOP)** trên thanh tiêu đề và Hộp thoại Xác nhận thao tác an toàn trước khi mở van.
  - Bổ sung Tab **Module Mở rộng Tương lai (Future Expansion)**: Dự phòng sẵn cho Châm phân tự động EC/pH, Camera AI nhận diện lá, Mở rộng Hàng 4 & 5.
- [x] Đã build thành công bản phân phối và đẩy lên nhánh `gh-pages` tại <https://datahub-shark.github.io/automatic-plant-watering/>.

**Điều kiện hoàn tất B:** ĐÃ ĐẠT (Giao diện trực quan, thân thiện cho công nhân mới, hỗ trợ kết nối D1 Cloudflare có xác thực an toàn và kiểm thử đầy đủ).

### C. Sao lưu Google Drive nhiều năm

- [ ] Trong tài khoản Google của chủ dự án, tạo thư mục riêng để lưu bản sao. Tạo Google Apps Script từ file [`cloudflare-worker/drive-backup.gs`](cloudflare-worker/drive-backup.gs).
- [ ] Trong **Script Properties** đặt `API_BASE` là `https://automatic-plant-watering-api.datahub-shark.workers.dev`, `FOLDER_ID` là ID thư mục, `BACKUP_TOKEN` là giá trị đã nhập vào Cloudflare Secret. Không chia sẻ quyền chỉnh sửa Apps Script cho người không cần truy cập dữ liệu.
- [ ] Đặt múi giờ `Asia/Ho_Chi_Minh`; chạy thủ công `backupDay('YYYY-MM-DD')` cho một ngày đã kết thúc. Kiểm tra hai file `.jsonl.gz` (telemetry, events), giải nén và so số bản ghi với D1.
- [ ] Tạo trigger chạy `backupYesterday` mỗi ngày khoảng **08:00 giờ Việt Nam**. File được chia theo **ngày UTC nhận tại server** để bản tin STM32 gửi bù vẫn được lưu.
- [ ] Thêm kiểm tra tự động số bản ghi, cảnh báo khi trigger thất bại hoặc Drive hết dung lượng, và thử khôi phục dữ liệu từ một file. Script hiện mới kiểm tra kích thước file vừa tạo, **chưa đủ cơ sở để tự động xóa dữ liệu D1**.
- [ ] Theo dõi dung lượng D1 và Drive hằng tháng. Chỉ đặt chính sách xóa dữ liệu D1 cũ sau khi sao lưu và khôi phục đã được kiểm tra độc lập.

**Điều kiện hoàn tất C:** file sao lưu tạo tự động mỗi ngày, đọc lại được, có cảnh báo lỗi và một lần thử khôi phục thành công.

### D. Chuẩn bị và tích hợp phần cứng

- [x] Đã hoàn thành viết và tối ưu hóa mã nguồn Firmware ESP32-S3 (`src/main.cpp`) theo kiến trúc FreeRTOS 2 nhân đa nhiệm:
  - Core 1: Vòng lặp điều khiển chính xác 200ms (đọc RTC DS3231, SHT31, ADC độ ẩm 4 chậu, đếm xung YF-S201, đóng mở van/bơm theo thứ tự an toàn, kiểm tra phao bồn và rò rỉ).
  - Core 0: Vòng lặp truyền thông mạng 4G LTE qua HTTPS REST Client TLS 443 kết nối trực tiếp Cloudflare Worker API.
  - Bộ đếm tuần tự `seq` và mã sự kiện `evt_id` được lưu trong NVS (`Preferences`), đảm bảo tính đơn điệu và chống ghi trùng lặp (Idempotency).
  - Tự động kéo lệnh (`/commands`) và gửi ACK (`/commands/ack`) sau mỗi 8 giây; tự động kiểm tra cấu hình mới (`/config`) sau mỗi 60 giây.
  - Lưu trữ đệm ngoại tuyến LittleFS (`/offline_logs.jsonl`) tự động phát lại nguyên vẹn khi có sóng 4G trở lại.
- [x] Cấu hình file bí mật `include/secrets.example.h` và `include/secrets.h` an toàn, đã đưa vào `.gitignore`.
- [x] Biên dịch kiểm tra thành công 100% với PlatformIO Core trên môi trường `esp32s3` (RAM: 6.8%, Flash: 11.9%).
- [ ] Nạp firmware thực tế lên board mạch ESP32-S3 + modem A7672X qua cáp USB và kiểm thử tải giả tại phòng lab trước khi đấu nối nhà màng.
- [ ] Đo độ trễ thực tế của mạng 4G khi lắp đặt tại nhà màng thực tế (Học viện Nông nghiệp Việt Nam).

**Điều kiện hoàn tất D:** Firmware đã sẵn sàng và biên dịch thành công; chỉ còn bước nạp thực tế lên phần cứng tại hiện trường.

## 3. Ranh giới quan trọng

- Bản Sites cũ và D1 trong tài khoản Cloudflare của bạn là **hai môi trường riêng**. Không tự chuyển dữ liệu từ Sites sang D1 mới.
- `health` HTTP 200 chỉ xác nhận Worker trả lời, không chứng minh toàn bộ luồng ghi dữ liệu, dashboard hoặc sao lưu đã hoạt động.
- Google Drive là nơi **sao lưu dài hạn**; đường nhận bản tin và điều khiển không chờ Drive để tránh tăng độ trễ.
- Không bật điều khiển từ trang tĩnh bằng một `ADMIN_TOKEN` cố định trong trình duyệt. Cần cơ chế đăng nhập phù hợp trước khi chuyển dashboard sang dữ liệu thật.

## 4. Tệp liên quan

- Cấu hình triển khai: [`cloudflare-worker/wrangler.jsonc`](cloudflare-worker/wrangler.jsonc)
- API Worker: [`cloudflare-worker/src/api.ts`](cloudflare-worker/src/api.ts)
- Mẫu sao lưu Drive: [`cloudflare-worker/drive-backup.gs`](cloudflare-worker/drive-backup.gs)
- Hướng dẫn triển khai chi tiết: [`cloudflare-worker/README.md`](cloudflare-worker/README.md)
