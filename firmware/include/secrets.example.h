#pragma once
// ================= CẤU HÌNH MẠNG 4G LTE =================
// Đổi APN theo nhà mạng: Viettel: "v-internet", VinaPhone: "m3-world", MobiFone: "m-wap"
#define CELLULAR_APN "v-internet"
#define CELLULAR_USER ""
#define CELLULAR_PASS ""

// ================= KÊNH 1: CLOUDFLARE WORKER (HTTPS REST & FAILOVER) =================
#define API_HOST "automatic-plant-watering-api.datahub-shark.workers.dev"
#define API_PORT 443
#define DEVICE_ID "stm32_01"
#define DEVICE_TOKEN "<PUT_YOUR_CLOUDFLARE_DEVICE_TOKEN_HERE>"

// ================= KÊNH 2: MQTT BROKER CHẠY SONG SONG VỚI VPS =================
// Bật 1 để dùng MQTT song song (mặc định), 0 để chỉ chạy HTTPS Cloudflare thuần
#define MQTT_ENABLE 1
// 1 = TLS (port 8883 - HiveMQ Cloud / EMQX Cloud - khuyên dùng với VPS IP NAT)
// 0 = TCP thường (port 1883 hoặc port NAT do vps.info.vn cấp nếu chạy Mosquitto)
#define MQTT_USE_TLS 1
#define MQTT_HOST "your-cluster.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USER "tomato_esp32"
#define MQTT_PASS "<PUT_YOUR_MQTT_PASSWORD_HERE>"

// Chu kỳ giữ kết nối KeepAlive (giây). Để 35s để chống nhà mạng 4G ngắt NAT Timeout sau 60s!
#define MQTT_KEEPALIVE_SEC 35

// Đặt 1 nếu muốn ESP32 tự đóng/mở luân phiên để đẩy trực tiếp cả HTTP lẫn MQTT từ thiết bị;
// Đặt 0 (khuyên dùng) để giữ MQTT nối liên tục nhận lệnh <100ms, đồng thời Backend VPS tự đồng bộ song song lên Cloudflare D1
// và tự chuyển dự phòng (failover) sang Cloudflare HTTPS trực tiếp nếu MQTT mất kết nối.
#define DIRECT_HTTP_MIRROR 0
