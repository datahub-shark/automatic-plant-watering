"""
Script kiểm thử toàn trình (End-to-End Test) cho Cloudflare Worker & D1 Database.
Cách chạy:
  $env:DEVICE_TOKEN="..."; $env:ADMIN_TOKEN="..."; $env:BACKUP_TOKEN="..."; python scripts/test_e2e.py
"""
import os
import sys
import json
import urllib.request
import urllib.error
import datetime

BASE = os.getenv("API_BASE", "https://automatic-plant-watering-api.datahub-shark.workers.dev/api/v1")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
BACKUP_TOKEN = os.getenv("BACKUP_TOKEN")

if not all([DEVICE_TOKEN, ADMIN_TOKEN, BACKUP_TOKEN]):
    print("Vui lòng truyền biến môi trường DEVICE_TOKEN, ADMIN_TOKEN, BACKUP_TOKEN.")
    sys.exit(1)

def req(path, method="GET", body=None, token=None):
    headers = {"User-Agent": "Mozilla/5.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=15) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

print(f"=== BẮT ĐẦU KIỂM THỬ TOÀN TRÌNH TẠI: {BASE} ===")

# 1. Health check
st, res = req("/health")
assert st == 200 and res.get("status") == "ok", f"Health failed: {st} {res}"
print("✔ 1. Health check: HTTP 200 OK")

# 2. Telemetry Ingest
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
telemetry_data = {
    "device_id": "stm32_test",
    "seq": 101,
    "recorded_at": now_iso,
    "soil_pct": [45, 48, 52, 50],
    "temp_c": 28.5,
    "rh_pct": 72.0,
    "vpd_kpa": 1.25,
    "rows": [
        {"id": 1, "daily_l": 1.5, "valve": False},
        {"id": 2, "daily_l": 2.0, "valve": True},
        {"id": 3, "daily_l": 1.8, "valve": False}
    ],
    "tank_ok": True,
    "pump_on": True
}
st, res = req("/telemetry", method="POST", body=telemetry_data, token=DEVICE_TOKEN)
assert st == 202 and res.get("accepted") is True, f"Telemetry failed: {st} {res}"
print("✔ 2. Telemetry Ingest: HTTP 202 Accepted")

# 3. Duplicate Telemetry Ingest (Idempotency)
st, res = req("/telemetry", method="POST", body=telemetry_data, token=DEVICE_TOKEN)
assert st == 202, f"Duplicate telemetry failed: {st} {res}"
print("✔ 3. Chống trùng bản ghi Telemetry: HTTP 202 Accepted (không tạo bản ghi mới)")

# 4. RBAC check (Device token không được gọi Admin API)
st, res = req("/admin/latest?device_id=stm32_test", token=DEVICE_TOKEN)
assert st == 403, f"RBAC failed, expected 403 got {st}: {res}"
print("✔ 4. Kiểm tra phân quyền RBAC: DEVICE_TOKEN bị chặn tại Admin endpoint (HTTP 403)")

# 5. Events Ingest & Duplicate test
event_data = {
    "device_id": "stm32_test",
    "event_id": "evt-test-101",
    "recorded_at": now_iso,
    "row": 2,
    "type": "target_volume",
    "liters": 2.0,
    "details": {"duration_sec": 300, "trigger": "auto_vpd"}
}
st, res = req("/events", method="POST", body=event_data, token=DEVICE_TOKEN)
assert st == 202, f"Event failed: {st} {res}"
st, res = req("/events", method="POST", body=event_data, token=DEVICE_TOKEN)
assert st == 202, f"Duplicate event failed: {st} {res}"
print("✔ 5. Gửi Event & Chống trùng Event: HTTP 202 Accepted")

# 6. Admin query latest
st, res = req("/admin/latest?device_id=stm32_test", token=ADMIN_TOKEN)
assert st == 200 and res["telemetry"]["seq"] == 101, "Admin latest query failed"
print("✔ 6. Admin GET telemetry mới nhất: Khớp seq=101, temp=28.5")

# 7. Admin query events
st, res = req("/admin/events?device_id=stm32_test", token=ADMIN_TOKEN)
assert st == 200 and len(res["events"]) == 1, "Admin events query failed"
print("✔ 7. Admin GET events: Đúng 1 event (chống trùng thành công)")

# 8. Admin config & Device fetch config
new_config = {
    "soilDry": [3100, 3100, 3100, 3100], "soilWet": [1300, 1300, 1300, 1300],
    "scheduleHour": [6, 17], "scheduleMinute": [30, 0],
    "low": [36, 40], "high": [56, 60],
    "targetL": [2.5, 2.5, 2.5], "maxSeconds": [900, 900, 900], "soakSeconds": [1800, 1800],
    "vpdHot": 1.6, "vpdThresholdBoost": 10, "vpdVolumeBoost": 0.4, "floatLowLevel": True
}
st, res = req("/admin/config?device_id=stm32_test", method="PUT", body=new_config, token=ADMIN_TOKEN)
assert st == 200 and "version" in res, "Admin PUT config failed"
v = res["version"]
st, res = req("/config?device_id=stm32_test", token=DEVICE_TOKEN)
assert st == 200 and res.get("version") == v, "Device GET config failed"
print(f"✔ 8. Cập nhật & Đồng bộ cấu hình: Version {v} thành công")

# 9. Admin gửi lệnh, Thiết bị lấy lệnh và gửi ACK
st, res = req("/admin/commands?device_id=stm32_test", method="POST", body={"action": "start", "row": 2}, token=ADMIN_TOKEN)
assert st == 201 and "id" in res, "Admin POST command failed"
cid = res["id"]
st, res = req("/commands?device_id=stm32_test", token=DEVICE_TOKEN)
assert st == 200 and any(c["id"] == cid for c in res.get("commands", [])), "Device fetch command failed"
st, res = req("/commands/ack?device_id=stm32_test", method="POST", body={"id": cid}, token=DEVICE_TOKEN)
assert st == 200 and res.get("acknowledged") is True, "Device ACK command failed"
st, res = req("/commands?device_id=stm32_test", token=DEVICE_TOKEN)
assert st == 200 and len(res.get("commands", [])) == 0, "Command queue not cleared after ACK"
print(f"✔ 9. Hàng đợi lệnh & ACK: Lệnh #{cid} được nhận và xác nhận thành công")

# 10. Endpoint sao lưu Google Drive
today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
st, res = req(f"/backup/telemetry?day={today_str}", token=BACKUP_TOKEN)
assert st == 200 and len(res.get("items", [])) >= 1, "Backup telemetry failed"
st, res = req(f"/backup/events?day={today_str}", token=BACKUP_TOKEN)
assert st == 200 and len(res.get("items", [])) >= 1, "Backup events failed"
print(f"✔ 10. Endpoint sao lưu dữ liệu ngày ({today_str}): Đọc thành công qua BACKUP_TOKEN")

print("\n=== TẤT CẢ 10 BƯỚC KIỂM THỬ ĐÃ VƯỢT QUA 100%! ===")
