"""Kiểm tra API trên preview cục bộ; không dùng thông tin đăng nhập thật."""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8788/api/v1"


def call(path, method="GET", body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status, json.load(res)
    except urllib.error.HTTPError as exc:
        return exc.code, json.load(exc)


assert call("/health")[0] == 200
telemetry = {
    "device_id": "stm32_demo", "seq": 42,
    "recorded_at": "2026-11-11T08:00:00+07:00",
    "soil_pct": [35, 37, 40, 42], "temp_c": 31.2,
    "rh_pct": 68.0, "vpd_kpa": 1.45,
    "rows": [{"id": i, "daily_l": 1.2, "valve": False} for i in (1, 2, 3)],
    "tank_ok": True, "pump_on": False,
}
assert call("/telemetry", "POST", telemetry)[0] == 202
assert call("/telemetry", "POST", telemetry)[0] == 202
assert call("/telemetry", "POST", {**telemetry, "soil_pct": [999, 37, 40, 42]})[0] == 400
event = {"device_id": "stm32_demo", "event_id": "evt-42", "recorded_at": telemetry["recorded_at"],
         "row": 2, "type": "target_volume", "liters": 1.2, "details": {}}
assert call("/events", "POST", event)[0] == 202
assert call("/events", "POST", event)[0] == 202
assert call("/config?device_id=stm32_demo")[0] == 200
assert call("/commands?device_id=stm32_demo")[0] == 200
assert call("/admin/latest?device_id=stm32_demo")[0] == 403
print("API smoke test passed")
