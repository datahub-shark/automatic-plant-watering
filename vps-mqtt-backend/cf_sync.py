"""
Đồng bộ song song dữ liệu MQTT từ VPS sang Cloudflare Worker D1.
Giúp duy trì bản lưu trữ dài hạn trên Cloudflare D1 & Google Drive Backup ngay cả khi chạy qua MQTT.
"""

import logging
import os
import httpx

logger = logging.getLogger(__name__)


async def push_telemetry_to_cloudflare(payload: dict) -> bool:
    if os.getenv("CF_SYNC_ENABLED", "true").lower() != "true":
        return False
    base = os.getenv("CF_WORKER_API", "").strip().rstrip("/")
    token = os.getenv("CF_DEVICE_TOKEN", "").strip()
    if not base or not token or token.startswith("<PUT_"):
        return False

    url = f"{base}/telemetry"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
        if resp.status_code in (200, 202):
            logger.info("[CF Sync] Đã đồng bộ telemetry seq=%s sang Cloudflare D1", payload.get("seq"))
            return True
        logger.warning("[CF Sync] Cloudflare trả về %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("[CF Sync] Lỗi kết nối Cloudflare Worker: %s", exc)
    return False


async def push_event_to_cloudflare(payload: dict) -> bool:
    if os.getenv("CF_SYNC_ENABLED", "true").lower() != "true":
        return False
    base = os.getenv("CF_WORKER_API", "").strip().rstrip("/")
    token = os.getenv("CF_DEVICE_TOKEN", "").strip()
    if not base or not token or token.startswith("<PUT_"):
        return False

    url = f"{base}/events"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
        if resp.status_code in (200, 202):
            logger.info("[CF Sync] Đã đồng bộ event %s sang Cloudflare D1", payload.get("type"))
            return True
        logger.warning("[CF Sync] Cloudflare events trả về %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("[CF Sync] Lỗi đồng bộ event sang Cloudflare: %s", exc)
    return False
