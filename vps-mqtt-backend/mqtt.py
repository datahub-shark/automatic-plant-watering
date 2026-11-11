"""
Bộ xử lý MQTT cho hệ thống tưới cà chua 3 hàng (tham khảo tue-minh/IoT_Backend).
Hỗ trợ paho-mqtt 2.x/1.x, TLS 8883 (HiveMQ/EMQX) hoặc TCP 1883 (Mosquitto),
lưu DB cục bộ, phát WebSocket realtime và đồng bộ song song lên Cloudflare D1.
"""

import json
import logging
import os
import ssl
import uuid
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

from bridge import data_queue
from db import Alert, Device, EventLog, History, SensorData, SessionLocal, TelemetryLog

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Topics chuẩn IoT_Backend và Tomato System
TOPIC_IOT_DATA = "iot/devices/+/data"
TOPIC_IOT_EVENTS = "iot/devices/+/events"
TOPIC_IOT_STATUS = "iot/devices/+/status"
TOPIC_TOMATO_DATA = "tomato_sys/+/telemetry"
TOPIC_TOMATO_EVENTS = "tomato_sys/+/events"
TOPIC_TOMATO_STATUS = "tomato_sys/+/status"

TOPIC_COMMAND_FMT = "iot/devices/{}/command"
TOPIC_CONFIG_FMT = "iot/devices/{}/config"


def _make_client(client_id: str):
    if hasattr(mqtt, "CallbackAPIVersion"):
        return mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=client_id, clean_session=True)
    return mqtt.Client(client_id=client_id, clean_session=True)


class MQTTHandler:
    def __init__(self):
        self.loop = None
        self.connected = False
        self.broker = os.getenv("MQTT_BROKER", "").strip()
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.username = os.getenv("MQTT_USERNAME", "").strip()
        self.password = os.getenv("MQTT_PASSWORD", "").strip()
        tls_env = os.getenv("MQTT_USE_TLS", "").strip().lower()
        self.use_tls = (tls_env == "true") or (tls_env == "" and self.port == 8883)

        unique_id = uuid.uuid4().hex[:6]
        self.client_id = f"tomato_vps_backend_{unique_id}"
        self.client = _make_client(self.client_id)
        if self.username:
            self.client.username_pw_set(self.username, self.password or None)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

    def is_configured(self) -> bool:
        return bool(self.broker) and "your-cluster" not in self.broker

    def connect(self):
        if not self.is_configured():
            logger.warning(
                "MQTT_BROKER chưa được cấu hình thực tế trong .env (hiện là '%s'). FastAPI vẫn chạy nhưng MQTT tạm bỏ qua.",
                self.broker,
            )
            return
        try:
            if self.use_tls:
                self.client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
            self.client.connect_async(self.broker, self.port, keepalive=60)
            self.client.loop_start()
            logger.info("Đang khởi tạo kết nối MQTT tới %s:%s (TLS=%s)", self.broker, self.port, self.use_tls)
        except Exception as exc:
            logger.error("Không thể khởi tạo kết nối MQTT: %s", exc)

    def disconnect(self):
        try:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False
            logger.info("Đã ngắt kết nối MQTT Broker")
        except Exception as exc:
            logger.error("Lỗi khi ngắt kết nối MQTT: %s", exc)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connected = True
            logger.info("Kết nối MQTT thành công tới %s:%s!", self.broker, self.port)
            for topic in (
                TOPIC_IOT_DATA,
                TOPIC_IOT_EVENTS,
                TOPIC_IOT_STATUS,
                TOPIC_TOMATO_DATA,
                TOPIC_TOMATO_EVENTS,
                TOPIC_TOMATO_STATUS,
            ):
                client.subscribe(topic, qos=1)
                logger.info("Đã subscribe topic: %s", topic)
        else:
            self.connected = False
            logger.error("Kết nối MQTT thất bại, mã lỗi rc=%s", rc)

    def on_disconnect(self, client, userdata, rc):
        self.connected = False
        if rc != 0:
            logger.warning("Mất kết nối MQTT bất ngờ (rc=%s), paho-mqtt sẽ tự kết nối lại...", rc)
        else:
            logger.info("Đã ngắt kết nối MQTT an toàn.")

    def _extract_device_id(self, topic: str) -> Optional[str]:
        parts = topic.split("/")
        # iot/devices/<device_id>/<suffix> -> index 2
        if len(parts) >= 4 and parts[0] == "iot" and parts[1] == "devices":
            return parts[2]
        # tomato_sys/<device_id>/<suffix> -> index 1
        if len(parts) >= 3 and parts[0] == "tomato_sys":
            return parts[1]
        return None

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload_str = msg.payload.decode("utf-8").strip()
            device_id = self._extract_device_id(topic)
            if not device_id:
                return

            if topic.endswith("/status"):
                self.handle_status(device_id, payload_str)
                return

            data = json.loads(payload_str)
            if topic.endswith("/data") or topic.endswith("/telemetry"):
                self.handle_telemetry(device_id, data)
            elif topic.endswith("/events"):
                self.handle_event(device_id, data)
        except json.JSONDecodeError:
            logger.error("Payload không phải JSON hợp lệ trên topic %s", topic)
        except Exception as exc:
            logger.error("Lỗi xử lý tin nhắn MQTT: %s", exc, exc_info=True)

    def _ensure_device(self, db, device_id: str) -> Device:
        dev = db.get(Device, device_id)
        if not dev:
            dev = Device(
                id=device_id,
                name=f"Thiết bị {device_id}",
                type="tomato_irrigation_3row",
                status="online",
            )
            db.add(dev)
            db.flush()
        return dev

    def handle_status(self, device_id: str, raw_status: str):
        status_val = raw_status.lower()
        try:
            parsed = json.loads(raw_status)
            if isinstance(parsed, dict) and "status" in parsed:
                status_val = str(parsed["status"]).lower()
        except Exception:
            pass

        status_norm = "online" if status_val in ("online", "1", "true", "connected") else "offline"
        db = SessionLocal()
        try:
            dev = self._ensure_device(db, device_id)
            dev.status = status_norm
            dev.last_seen_at = datetime.now(timezone.utc)
            db.add(
                History(
                    device_id=device_id,
                    event_type="DEVICE_STATUS",
                    description=f"MQTT LWT trạng thái thiết bị {device_id}: {status_norm}",
                )
            )
            db.commit()
            if self.loop:
                self.loop.call_soon_threadsafe(
                    data_queue.put_nowait,
                    {
                        "kind": "status",
                        "device_id": device_id,
                        "data": {"status": status_norm},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
        except Exception as exc:
            db.rollback()
            logger.error("Lỗi cập nhật status thiết bị %s: %s", device_id, exc)
        finally:
            db.close()

    def _upsert_sensor(self, db, device_id: str, sensor_type: str, num_val: Optional[float], str_val: Optional[str], unit: Optional[str]):
        sensor = (
            db.query(SensorData)
            .filter(SensorData.device_id == device_id, SensorData.type == sensor_type)
            .first()
        )
        now = datetime.now(timezone.utc)
        if sensor:
            sensor.value_number = num_val
            sensor.value_string = str_val
            sensor.unit = unit
            sensor.timestamp = now
        else:
            db.add(
                SensorData(
                    device_id=device_id,
                    type=sensor_type,
                    value_number=num_val,
                    value_string=str_val,
                    unit=unit,
                    timestamp=now,
                )
            )

    def handle_telemetry(self, device_id: str, data: dict):
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        soil = data.get("soil_pct") if isinstance(data.get("soil_pct"), list) else [None, None, None, None]
        rows = data.get("rows") if isinstance(data.get("rows"), list) else [
            {"id": 1, "valve": False, "daily_l": 0.0},
            {"id": 2, "valve": False, "daily_l": 0.0},
            {"id": 3, "valve": False, "daily_l": 0.0},
        ]
        temp_c = data.get("temp_c", data.get("temperature"))
        rh_pct = data.get("rh_pct", data.get("humidity"))
        vpd_kpa = data.get("vpd_kpa")
        tank_ok = 1 if data.get("tank_ok", True) in (True, 1, "1", "true") else 0
        pump_on = 1 if data.get("pump_on", False) in (True, 1, "1", "true") else 0
        seq = int(data.get("seq", 0) or 0)
        recorded_at = str(data.get("recorded_at") or now_iso)

        db = SessionLocal()
        try:
            dev = self._ensure_device(db, device_id)
            dev.status = "online"
            dev.last_seen_at = now_dt
            if seq > (dev.last_seq or 0):
                dev.last_seq = seq

            log = TelemetryLog(
                device_id=device_id,
                seq=seq,
                recorded_at=recorded_at,
                received_at=now_dt,
                soil_json=json.dumps(soil),
                temperature_c=float(temp_c) if isinstance(temp_c, (int, float)) else None,
                rh_pct=float(rh_pct) if isinstance(rh_pct, (int, float)) else None,
                vpd_kpa=float(vpd_kpa) if isinstance(vpd_kpa, (int, float)) else None,
                rows_json=json.dumps(rows),
                tank_ok=tank_ok,
                pump_on=pump_on,
                source="mqtt",
            )
            db.add(log)

            # Cập nhật bảng SensorData tương thích IoT_Backend
            if isinstance(temp_c, (int, float)):
                self._upsert_sensor(db, device_id, "temperature", float(temp_c), None, "°C")
            if isinstance(rh_pct, (int, float)):
                self._upsert_sensor(db, device_id, "humidity", float(rh_pct), None, "%")
            if isinstance(vpd_kpa, (int, float)):
                self._upsert_sensor(db, device_id, "vpd", float(vpd_kpa), None, "kPa")
            self._upsert_sensor(db, device_id, "tank_ok", float(tank_ok), "OK" if tank_ok else "EMPTY", "bool")
            self._upsert_sensor(db, device_id, "pump_on", float(pump_on), "ON" if pump_on else "OFF", "bool")
            for idx, val in enumerate(soil[:4]):
                if isinstance(val, (int, float)):
                    self._upsert_sensor(db, device_id, f"soil_s{idx + 1}", float(val), None, "%")

            if tank_ok == 0:
                db.add(
                    Alert(
                        device_id=device_id,
                        type="TANK_EMPTY",
                        message="Phao báo bồn nước cạn qua MQTT - Bơm đã khóa an toàn.",
                    )
                )

            db.commit()
            db.refresh(log)

            cf_payload = {
                "device_id": device_id,
                "seq": seq,
                "recorded_at": recorded_at,
                "soil_pct": soil[:4],
                "rows": rows[:3],
                "tank_ok": bool(tank_ok),
                "pump_on": bool(pump_on),
                "temp_c": temp_c,
                "rh_pct": rh_pct,
                "vpd_kpa": vpd_kpa,
            }

            if self.loop:
                self.loop.call_soon_threadsafe(
                    data_queue.put_nowait,
                    {
                        "kind": "telemetry",
                        "record_id": log.id,
                        "device_id": device_id,
                        "data": {
                            "id": log.id,
                            "device_id": device_id,
                            "seq": seq,
                            "recorded_at": recorded_at,
                            "received_at": now_iso,
                            "soil_json": log.soil_json,
                            "temperature_c": log.temperature_c,
                            "rh_pct": log.rh_pct,
                            "vpd_kpa": log.vpd_kpa,
                            "rows_json": log.rows_json,
                            "tank_ok": tank_ok,
                            "pump_on": pump_on,
                        },
                        "cf_payload": cf_payload,
                        "timestamp": now_iso,
                    },
                )
        except Exception as exc:
            db.rollback()
            logger.error("Lỗi lưu telemetry MQTT từ %s: %s", device_id, exc, exc_info=True)
        finally:
            db.close()

    def handle_event(self, device_id: str, data: dict):
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        ev_type = str(data.get("type") or "unknown")
        row_id = data.get("row")
        liters = data.get("liters")
        recorded_at = str(data.get("recorded_at") or now_iso)
        detail = data.get("detail")

        db = SessionLocal()
        try:
            dev = self._ensure_device(db, device_id)
            dev.status = "online"
            dev.last_seen_at = now_dt

            ev = EventLog(
                device_id=device_id,
                row=int(row_id) if isinstance(row_id, int) else None,
                type=ev_type,
                liters=float(liters) if isinstance(liters, (int, float)) else None,
                detail_json=json.dumps(detail) if detail is not None else None,
                recorded_at=recorded_at,
                received_at=now_dt,
            )
            db.add(ev)

            if ev_type.startswith("ERROR_") or ev_type == "tank_empty":
                db.add(
                    Alert(
                        device_id=device_id,
                        type=ev_type,
                        message=f"Sự cố {ev_type} tại hàng {row_id or '-'}",
                    )
                )

            db.commit()
            db.refresh(ev)

            cf_payload = {
                "device_id": device_id,
                "recorded_at": recorded_at,
                "row": row_id,
                "type": ev_type,
                "liters": liters,
                "detail": detail,
            }

            if self.loop:
                self.loop.call_soon_threadsafe(
                    data_queue.put_nowait,
                    {
                        "kind": "event",
                        "record_id": ev.id,
                        "device_id": device_id,
                        "data": {
                            "id": ev.id,
                            "device_id": device_id,
                            "recorded_at": recorded_at,
                            "row": row_id,
                            "type": ev_type,
                            "liters": liters,
                        },
                        "cf_payload": cf_payload,
                        "timestamp": now_iso,
                    },
                )
        except Exception as exc:
            db.rollback()
            logger.error("Lỗi lưu event MQTT từ %s: %s", device_id, exc, exc_info=True)
        finally:
            db.close()

    def publish_command(self, device_id: str, payload: dict) -> bool:
        if not self.connected:
            logger.warning("MQTT chưa kết nối, không thể publish lệnh tức thì tới %s", device_id)
            return False
        topic = TOPIC_COMMAND_FMT.format(device_id)
        message = json.dumps(payload, ensure_ascii=False)
        res = self.client.publish(topic, message, qos=1)
        if res.rc == mqtt.MQTT_ERR_SUCCESS:
            logger.info("[MQTT CMD] Đã phát lệnh tức thì tới %s: %s", topic, message)
            return True
        logger.error("[MQTT CMD] Lỗi publish tới %s: rc=%s", topic, res.rc)
        return False

    def publish_config(self, device_id: str, config_payload: dict) -> bool:
        if not self.connected:
            return False
        topic = TOPIC_CONFIG_FMT.format(device_id)
        message = json.dumps(config_payload, ensure_ascii=False)
        res = self.client.publish(topic, message, qos=1, retain=True)
        return res.rc == mqtt.MQTT_ERR_SUCCESS


mqtt_handler = MQTTHandler()
