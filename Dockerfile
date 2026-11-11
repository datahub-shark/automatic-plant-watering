# ==============================================================================
# Giai đoạn 1: Build Giao diện Web HMI (React + Vite) cho chế độ chạy trên VPS
# ==============================================================================
FROM node:22-alpine AS web-builder

WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY vps.vite.config.ts postcss.config.mjs tsconfig.json ./
COPY pages ./pages
COPY app ./app

RUN npm run build:vps

# ==============================================================================
# Giai đoạn 2: FastAPI + MQTT + WebSocket + Phục vụ luôn Web HMI tĩnh tại "/"
# ==============================================================================
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_HOST=0.0.0.0 \
    APP_PORT=10000 \
    DATABASE_URL=sqlite:////app/data/tomato_mqtt.db

COPY vps-mqtt-backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY vps-mqtt-backend ./
COPY --from=web-builder /web/vps-mqtt-backend/static ./static

RUN mkdir -p /app/data

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:10000/health', timeout=3)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
