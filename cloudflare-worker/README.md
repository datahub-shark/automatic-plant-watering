# Worker độc lập cho hệ thống tưới

Worker này dùng D1 `automatic-plant-watering` trong tài khoản Cloudflare của chủ dự án. GitHub Pages hiện chỉ hiển thị dữ liệu mẫu; backend Sites cũ vẫn là môi trường riêng, không tự chuyển dữ liệu sang D1 mới.

## Triển khai từ thư mục `backend-site`

1. `npx wrangler login` trên máy của chủ tài khoản Cloudflare. Không gửi token đăng nhập cho người khác.
2. Kiểm tra `cloudflare-worker/wrangler.jsonc`: `account_id`, `database_name`, `database_id` phải đúng database vừa tạo.
3. Nạp schema một lần vào D1 mới:
   `npx wrangler d1 execute automatic-plant-watering --remote --config cloudflare-worker/wrangler.jsonc --file drizzle/0000_supreme_dark_beast.sql`
   Thêm index cho tác vụ sao lưu:
   `npx wrangler d1 execute automatic-plant-watering --remote --config cloudflare-worker/wrangler.jsonc --file cloudflare-worker/001_backup_indexes.sql`
4. Triển khai: `npm run worker:deploy`.
5. Tạo ba secret, mỗi lệnh sẽ hỏi giá trị trực tiếp trong terminal:
   `npx wrangler secret put DEVICE_TOKEN --config cloudflare-worker/wrangler.jsonc`
   `npx wrangler secret put ADMIN_TOKEN --config cloudflare-worker/wrangler.jsonc`
   `npx wrangler secret put BACKUP_TOKEN --config cloudflare-worker/wrangler.jsonc`
   Dùng ba giá trị ngẫu nhiên **khác nhau**, không ghi vào source, GitHub hoặc ảnh chụp.
6. Kiểm tra `https://automatic-plant-watering-api.<workers-subdomain>.workers.dev/api/v1/health` trả `status: ok`.

Các endpoint ghi telemetry/sự kiện đòi `Authorization: Bearer <DEVICE_TOKEN>`. Các endpoint `admin/*` đòi `ADMIN_TOKEN`. Endpoint `backup/*` đòi `BACKUP_TOKEN`. Endpoint health công khai chỉ xác nhận Worker chạy, không chứng minh database đã được nạp bảng; kiểm tra tiếp bằng API có xác thực.

## Sao lưu Google Drive

Tạo thư mục Drive thuộc tài khoản của chủ dữ liệu, tạo Apps Script mới và dán `drive-backup.gs`. Trong **Project Settings → Script Properties**, đặt:

- `API_BASE`: URL Worker, không có `/api/v1`.
- `BACKUP_TOKEN`: cùng giá trị với secret của Worker.
- `FOLDER_ID`: ID của thư mục Drive.

Đặt múi giờ project `Asia/Ho_Chi_Minh`. Chạy thử `backupDay('YYYY-MM-DD')` cho một ngày đã kết thúc; xác nhận hai file `tomato-telemetry-*.jsonl.gz` và `tomato-events-*.jsonl.gz` xuất hiện trong Drive và đọc được. Sau đó tạo **time-driven trigger** cho `backupYesterday` mỗi ngày lúc khoảng 08:00 giờ Việt Nam. File được phân theo **ngày UTC nhận tại server**; `recorded_at` vẫn giữ giờ đo của thiết bị. Bản tin đến muộn sẽ nằm trong file của ngày nhận, không bị bỏ sót vì ngày đo cũ.

Không xóa dữ liệu D1 theo tuổi cho đến khi đã kiểm tra tự động số bản ghi và khả năng đọc lại các bản sao trong Drive. Hiện script chỉ kiểm tra kích thước file vừa tạo; chưa có cơ chế xác nhận độc lập để cho phép xóa dữ liệu D1.
