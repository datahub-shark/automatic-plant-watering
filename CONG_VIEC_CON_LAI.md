# Công việc còn lại — hệ thống tưới cà chua 3 hàng

Cập nhật: **11/11/2026**. Tài liệu này dùng để triển khai backend thuộc tài khoản Cloudflare của chủ dự án, sao lưu sang Google Drive, rồi mới kết nối STM32 và A7670C. Đánh dấu `[x]` chỉ khi có bằng chứng kiểm tra thực tế.

## 1. Trạng thái đã xác nhận

- [x] Source ở GitHub: `datahub-shark/automatic-plant-watering`, nhánh `main`.
- [x] GitHub Pages tại <https://datahub-shark.github.io/automatic-plant-watering/> chạy dashboard **dữ liệu mẫu**. Trang này chưa đọc D1 mới.
- [x] D1 `automatic-plant-watering` trong tài khoản Cloudflare của chủ dự án, ID `849fcdec-f331-437f-81bf-5ff46bbc005d`, vùng APAC. Đã nạp 5 bảng (`devices`, `telemetry`, `events`, `configs`, `commands`) và 2 index để xuất dữ liệu.
- [x] Worker tại <https://automatic-plant-watering-api.datahub-shark.workers.dev/api/v1/health>. Endpoint `health` trả HTTP 200. API quản trị từ chối yêu cầu thiếu token.
- [x] Source Worker kiểm tra TypeScript, build thử và ghi/đọc telemetry trên **D1 cục bộ**. Đây chưa phải phép thử ghi vào D1 cloud hay truyền qua 4G.
- [ ] Chưa tạo `DEVICE_TOKEN`, `ADMIN_TOKEN`, `BACKUP_TOKEN` trong Cloudflare Secrets. Các API dữ liệu đang khóa.
- [ ] Chưa xuất dữ liệu sang Google Drive; chưa có Apps Script hoặc trigger chạy trong tài khoản Google của chủ dự án.
- [ ] Chưa có STM32, modem và cảm biến lắp đặt/kiểm thử.

## 2. Việc cần làm theo thứ tự

### A. Kích hoạt và kiểm tra API trên Cloudflare

- [ ] Tạo ba giá trị token ngẫu nhiên, **khác nhau**, đủ dài. Nhập trực tiếp bằng ba lệnh dưới đây từ thư mục `backend-site`. Wrangler hỏi giá trị trong terminal; không ghi token vào GitHub, ảnh chụp, tài liệu hay tin nhắn.

  ```powershell
  npx wrangler secret put DEVICE_TOKEN --config cloudflare-worker/wrangler.jsonc
  npx wrangler secret put ADMIN_TOKEN --config cloudflare-worker/wrangler.jsonc
  npx wrangler secret put BACKUP_TOKEN --config cloudflare-worker/wrangler.jsonc
  ```

- [ ] Dùng dữ liệu **giả** gửi một bản telemetry đến `POST /api/v1/telemetry` với `Authorization: Bearer <DEVICE_TOKEN>`. Kiểm tra trả HTTP 202 và D1 có đúng một bản ghi. Gửi lại cùng `device_id` + `seq`, kiểm tra không sinh bản ghi trùng.
- [ ] Kiểm tra `GET /api/v1/admin/latest?device_id=stm32_01` bằng `ADMIN_TOKEN`; kiểm tra endpoint quản trị từ chối `DEVICE_TOKEN`.
- [ ] Kiểm tra sự kiện `POST /api/v1/events`, đọc cấu hình, hàng đợi lệnh và ACK. Dùng lệnh giả, không gắn với bơm thật.
- [ ] Ghi lại URL Worker và trạng thái kiểm thử, **không** ghi token. Xóa hoặc đánh dấu dữ liệu giả trước khi dùng báo cáo vận hành.

**Điều kiện hoàn tất A:** API cloud ghi/đọc D1 được; phân quyền thiết bị, quản trị và sao lưu đúng; dữ liệu gửi lại không bị trùng.

### B. Đưa dashboard từ dữ liệu mẫu sang dữ liệu thật

- [ ] Chọn cách đăng nhập quản trị cho trang GitHub Pages. **Không đặt `ADMIN_TOKEN` trong JavaScript, GitHub Pages hoặc `localStorage`**: người mở trang có thể lấy token đó. Cần cơ chế đăng nhập có phiên an toàn ở backend trước khi bật nút tưới/cấu hình từ trình duyệt.
- [ ] Cập nhật frontend gọi Worker mới qua API quản trị đã xác thực. Cấu hình CORS chỉ cho origin GitHub Pages sau khi cơ chế đăng nhập được thiết kế và kiểm tra.
- [ ] Trên dashboard, hiện rõ `chưa có thiết bị` khi D1 trống; không trộn dữ liệu mẫu với dữ liệu thực. Chỉ cho gửi lệnh khi thiết bị vừa báo trạng thái, bồn còn nước, và người dùng đã đăng nhập.
- [ ] Kiểm tra trên URL GitHub Pages: biểu đồ, nhật ký, cấu hình, responsive và trạng thái mất mạng.

**Điều kiện hoàn tất B:** trang GitHub Pages hiển thị dữ liệu từ D1 cloud, còn thao tác điều khiển yêu cầu xác thực và không làm lộ khóa quản trị.

### C. Sao lưu Google Drive nhiều năm

- [ ] Trong tài khoản Google của chủ dự án, tạo thư mục riêng để lưu bản sao. Tạo Google Apps Script từ file [`cloudflare-worker/drive-backup.gs`](cloudflare-worker/drive-backup.gs).
- [ ] Trong **Script Properties** đặt `API_BASE` là `https://automatic-plant-watering-api.datahub-shark.workers.dev`, `FOLDER_ID` là ID thư mục, `BACKUP_TOKEN` là giá trị đã nhập vào Cloudflare Secret. Không chia sẻ quyền chỉnh sửa Apps Script cho người không cần truy cập dữ liệu.
- [ ] Đặt múi giờ `Asia/Ho_Chi_Minh`; chạy thủ công `backupDay('YYYY-MM-DD')` cho một ngày đã kết thúc. Kiểm tra hai file `.jsonl.gz` (telemetry, events), giải nén và so số bản ghi với D1.
- [ ] Tạo trigger chạy `backupYesterday` mỗi ngày khoảng **08:00 giờ Việt Nam**. File được chia theo **ngày UTC nhận tại server** để bản tin STM32 gửi bù vẫn được lưu.
- [ ] Thêm kiểm tra tự động số bản ghi, cảnh báo khi trigger thất bại hoặc Drive hết dung lượng, và thử khôi phục dữ liệu từ một file. Script hiện mới kiểm tra kích thước file vừa tạo, **chưa đủ cơ sở để tự động xóa dữ liệu D1**.
- [ ] Theo dõi dung lượng D1 và Drive hằng tháng. Chỉ đặt chính sách xóa dữ liệu D1 cũ sau khi sao lưu và khôi phục đã được kiểm tra độc lập.

**Điều kiện hoàn tất C:** file sao lưu tạo tự động mỗi ngày, đọc lại được, có cảnh báo lỗi và một lần thử khôi phục thành công.

### D. Chuẩn bị và tích hợp phần cứng

- [ ] Chốt model STM32, sơ đồ chân, điện áp nguồn/logic, modem A7670C, cảm biến và relay theo phần cứng thực tế. Không dùng pinout ESP32 cũ cho STM32.
- [ ] Viết firmware điều khiển 3 hàng, VPD, lưu cấu hình và tổng nước, bộ đếm xung, lịch RTC, các lỗi an toàn. Bơm/van phải an toàn khi mất mạng, mất nước, mất cảm biến hoặc reset.
- [ ] Nạp `DEVICE_TOKEN` vào thiết bị bằng quy trình riêng, không đưa vào repo. Thiết bị dùng HTTPS đến Worker; `seq` và `event_id` bền vững để gửi bù không tạo bản ghi trùng.
- [ ] Kiểm thử trên bàn với tải giả: cảm biến, relay, phao, lưu lượng, mất 4G, khởi động lại, gửi bù, cấu hình mới và ACK lệnh. Sau đó mới thử bơm/van thật với giám sát tại chỗ.
- [ ] Đo độ trễ 4G/API thực tế và chỉnh chu kỳ gửi telemetry/lấy lệnh theo kết quả; không giả định độ trễ chỉ từ kiểm thử cục bộ.

**Điều kiện hoàn tất D:** có log và kết quả kiểm thử trên phần cứng thật; mọi tình huống lỗi đều đưa bơm/van về trạng thái an toàn.

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
