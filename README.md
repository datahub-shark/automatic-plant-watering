# Backend tưới cà chua ba hàng

> Bản Sites hiện tại vẫn hoạt động riêng. Worker cho D1 trong tài khoản Cloudflare của chủ dự án đã được triển khai; xem [`cloudflare-worker/README.md`](cloudflare-worker/README.md). Các việc còn lại được theo dõi trong [`CONG_VIEC_CON_LAI.md`](CONG_VIEC_CON_LAI.md).

Webapp và backend HTTPS trên Sites/Cloudflare Worker, dữ liệu lưu trong D1. Chưa phụ thuộc vào bo STM32 hoặc modem A7670C; có thể kiểm tra hợp đồng API và bố cục bằng dữ liệu mẫu trước khi đấu phần cứng. Site mặc định riêng tư.

## Giao diện

Trang `/` có tổng quan ba hàng tưới, biểu đồ độ ẩm, nhật ký sự kiện và biểu mẫu cấu hình. Người quản trị đăng nhập bằng quyền Sites. Chế độ **Dữ liệu thực** chỉ hiển thị bản tin từ backend. Chế độ **Xem mẫu** có nhãn rõ ràng, không ghi dữ liệu hay gửi lệnh. Nút tưới thủ công chỉ bật khi thiết bị đã gửi telemetry trong vòng hai phút và bồn báo còn nước.

## Xác thực

- Người quản trị truy cập Site bằng tài khoản được cấp quyền; các endpoint `/admin/*` yêu cầu header danh tính do Sites cấp, không tự tin vào header do trình duyệt gửi.
- Thiết bị STM32 gọi API qua HTTPS với `OAI-Sites-Authorization: Bearer <service-token>` do Sites cấp cho Site này. Không lưu token trong mã nguồn, ảnh chụp hoặc log. Chỉ phát token cho thiết bị khi phần cứng và quy trình nạp an toàn đã sẵn sàng.
- Bản đầu tiên dùng một service token chung trong phạm vi Site riêng tư. Khi mở nhiều thiết bị/người dùng, cần tách quyền theo thiết bị và thay token theo vòng đời.

## Endpoint v1

`GET /api/v1/health` trả tình trạng API.

`POST /api/v1/telemetry` nhận mẫu đo. `seq` là số thứ tự tăng bền vững theo thiết bị; gửi lại cùng `device_id` và `seq` không tạo bản ghi trùng. Giờ đo dùng ISO 8601 có múi giờ; máy chủ lưu thêm giờ nhận riêng.

```json
{
  "device_id":"stm32_01", "seq":42, "recorded_at":"2026-11-11T08:00:00+07:00",
  "soil_pct":[35,37,40,42], "temp_c":31.2, "rh_pct":68,
  "vpd_kpa":1.45,
  "rows":[{"id":1,"daily_l":1.2,"valve":false},{"id":2,"daily_l":2.1,"valve":true},{"id":3,"daily_l":1.8,"valve":false}],
  "tank_ok":true, "pump_on":true
}
```

`POST /api/v1/events` nhận sự kiện. `event_id` do firmware tạo và giữ nguyên khi gửi bù để chống trùng.

```json
{"device_id":"stm32_01","event_id":"evt-00042","recorded_at":"2026-11-11T08:02:00+07:00","row":2,"type":"target_volume","liters":2.1,"details":{}}
```

`GET /api/v1/config?device_id=stm32_01` trả `{version, config}`. Firmware chỉ ghi NVS/Flash khi version mới và xác thực cấu hình tại thiết bị. Cấu hình mặc định là ví dụ, phải hiệu chuẩn trước khi tưới.

`GET /api/v1/commands?device_id=stm32_01` trả tối đa 16 lệnh pending. Thiết bị xử lý lệnh rồi gọi `POST /api/v1/commands/ack?device_id=stm32_01` với `{"id":123}`. Lệnh có thể được trả lại cho đến khi nhận ACK; firmware cần nhớ ID đã thực hiện để không tưới lặp.

Endpoint quản trị: `PUT /api/v1/admin/config?device_id=...` (toàn bộ đối tượng config), `POST /api/v1/admin/commands?device_id=...` với `{"action":"start","row":2}` (`stop`, `clear_fault`), `GET /api/v1/admin/devices`, `GET /api/v1/admin/latest?device_id=...`, `GET /api/v1/admin/history?device_id=...`, `GET /api/v1/admin/events?device_id=...`.

## Phát triển cục bộ

```text
node <Sites-plugin>/scripts/install-dependencies.mjs
npm run db:generate
node <Sites-plugin>/scripts/build-site.mjs
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_supreme_dark_beast.sql
npm start -- --port 8788
python -X utf8 scripts/smoke_backend.py
```

Migrations trong `drizzle/` chỉ chứa schema. Kiểm thử cục bộ không chứng minh STM32, A7670C hoặc đường truyền LTE hoạt động.
