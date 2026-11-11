"""Cầu nối bất đồng bộ giữa luồng MQTT và WebSocket + Cloudflare D1 Sync."""

import asyncio
import logging
from cf_sync import push_event_to_cloudflare, push_telemetry_to_cloudflare
from db import EventLog, SessionLocal, TelemetryLog
from websocket_manager import manager

logger = logging.getLogger(__name__)
data_queue: asyncio.Queue = asyncio.Queue()


async def _sync_cf_and_mark(item: dict):
    cf_payload = item.get("cf_payload")
    kind = item.get("kind")
    record_id = item.get("record_id")
    if not cf_payload:
        return

    ok = False
    if kind == "telemetry":
        ok = await push_telemetry_to_cloudflare(cf_payload)
    elif kind == "event":
        ok = await push_event_to_cloudflare(cf_payload)

    if ok and record_id is not None:
        db = SessionLocal()
        try:
            if kind == "telemetry":
                row = db.get(TelemetryLog, record_id)
                if row:
                    row.cf_synced = True
            elif kind == "event":
                row = db.get(EventLog, record_id)
                if row:
                    row.cf_synced = True
            db.commit()
        except Exception as exc:
            logger.warning("Không cập nhật được cờ cf_synced: %s", exc)
            db.rollback()
        finally:
            db.close()


async def broadcast_worker():
    """Nhận gói tin từ data_queue, phát ngay qua WebSocket và đồng bộ song song Cloudflare."""
    while True:
        item = await data_queue.get()
        try:
            ws_message = {
                "kind": item.get("kind", "telemetry"),
                "device_id": item.get("device_id"),
                "data": item.get("data"),
                "timestamp": item.get("timestamp"),
            }
            await manager.broadcast(ws_message)
            asyncio.create_task(_sync_cf_and_mark(item))
        except Exception as exc:
            logger.error("Lỗi broadcast_worker: %s", exc)
        finally:
            data_queue.task_done()
