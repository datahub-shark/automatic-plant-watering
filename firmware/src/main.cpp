#include <Arduino.h>
#include <ArduinoJson.h>
#include <Adafruit_SHT31.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <RTClib.h>
#include <TinyGsmClient.h>
#include <Wire.h>
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

// Pinout ESP32-S3-DevKitC-1; GPIO19/20 dành cho USB native.
#define MODEM_RX 16
#define MODEM_TX 17
#define MODEM_BAUD 115200
#define MODEM_PWRKEY_GPIO -1
#define I2C_SDA 1
#define I2C_SCL 2
#define SOIL_R2_C1 4
#define SOIL_R2_C3 5
#define SOIL_R3_C1 6
#define SOIL_R3_C3 7
#define FLOW_R1 8
#define FLOW_R2 9
#define FLOW_R3 10
#define FLOAT_SW 21
#define VALVE_R1 11
#define VALVE_R2 12
#define VALVE_R3 13
#define PUMP_MAIN 14

constexpr uint8_t RELAY_ON = LOW, RELAY_OFF = HIGH;
constexpr uint32_t CONTROL_MS = 200, TELEMETRY_MS = 60000;
constexpr uint32_t VALVE_SETTLE_MS = 700, PUMP_COAST_MS = 500;
constexpr uint32_t NO_FLOW_GRACE_MS = 12000, LEAK_GRACE_MS = 5000;
constexpr float PULSES_PER_LITER = 450.0f;
constexpr char OFFLINE_FILE[] = "/offline_logs.jsonl";

// MQTT Topics chuẩn IoT_Backend
constexpr char MQTT_TOPIC_DATA[] = "iot/devices/" DEVICE_ID "/data";
constexpr char MQTT_TOPIC_EVENTS[] = "iot/devices/" DEVICE_ID "/events";
constexpr char MQTT_TOPIC_STATUS[] = "iot/devices/" DEVICE_ID "/status";
constexpr char MQTT_TOPIC_CMD[] = "iot/devices/" DEVICE_ID "/command";
constexpr char MQTT_TOPIC_CFG[] = "iot/devices/" DEVICE_ID "/config";

struct Config {
  uint16_t soilDry[4] = {3000, 3000, 3000, 3000};
  uint16_t soilWet[4] = {1200, 1200, 1200, 1200};
  uint8_t scheduleHour[2] = {6, 17};
  uint8_t scheduleMinute[2] = {0, 0};
  float low[2] = {35, 38};
  float high[2] = {55, 58};
  float targetL[3] = {2.0f, 2.0f, 2.0f};
  uint32_t maxSeconds[3] = {900, 900, 900};
  uint32_t soakSeconds[2] = {1800, 1800};
  float vpdHot = 1.5f;
  float vpdThresholdBoost = 8.0f;
  float vpdVolumeBoost = 0.35f;
  bool floatLowLevel = true;
};

enum class MsgType : uint8_t { Telemetry, Event };
struct Message {
  MsgType type;
  char json[768];
};

enum class CmdType : uint8_t { Start, Stop, EStop, ClearFault, SetConfig };
struct Command {
  CmdType type;
  int8_t row;
  Config config;
};

struct RowState {
  bool requested = false, valveOpen = false, manual = false;
  bool noFlowFault = false, leakFault = false;
  uint32_t startMs = 0, lastStopMs = 0, lastFlowMs = 0;
  uint32_t valveOpenedMs = 0, closedMs = 0, lastPulses = 0;
  float startLiters = 0, targetLiters = 0, dailyLiters = 0;
};

volatile uint32_t flowPulses[3] = {0, 0, 0};
portMUX_TYPE flowMux = portMUX_INITIALIZER_UNLOCKED;
void IRAM_ATTR flow0() { portENTER_CRITICAL_ISR(&flowMux); ++flowPulses[0]; portEXIT_CRITICAL_ISR(&flowMux); }
void IRAM_ATTR flow1() { portENTER_CRITICAL_ISR(&flowMux); ++flowPulses[1]; portEXIT_CRITICAL_ISR(&flowMux); }
void IRAM_ATTR flow2() { portENTER_CRITICAL_ISR(&flowMux); ++flowPulses[2]; portEXIT_CRITICAL_ISR(&flowMux); }

QueueHandle_t messageQueue, commandQueue;
Preferences prefs;
RTC_DS3231 rtc;
Adafruit_SHT31 sht31;
HardwareSerial modemSerial(2);
TinyGsm modem(modemSerial);
TinyGsmClientSecure httpSocket(modem, 0);

#if MQTT_ENABLE && MQTT_USE_TLS
TinyGsmClientSecure mqttNetClient(modem, 0);
#elif MQTT_ENABLE
TinyGsmClient mqttNetClient(modem, 0);
#endif
#if MQTT_ENABLE
PubSubClient mqttClient(mqttNetClient);
#endif

Config cfg;
RowState row[3];
bool rtcOk = false, shtOk = false, pumpOn = false;
float soilPct[4] = {NAN, NAN, NAN, NAN}, temperature = NAN, humidity = NAN, vpd = NAN;
float adcAverage[4] = {NAN, NAN, NAN, NAN};
uint32_t lastDayKey = 0, lastDailySaveMs = 0, lastTelemetryMs = 0, pumpChangedMs = 0;
uint32_t scheduleDay[2] = {0, 0};
uint32_t seqCounter = 0;
uint32_t eventCounter = 0;
uint32_t configVersion = 1;

const uint8_t soilPins[4] = {SOIL_R2_C1, SOIL_R2_C3, SOIL_R3_C1, SOIL_R3_C3};
const uint8_t valvePins[3] = {VALVE_R1, VALVE_R2, VALVE_R3};

uint32_t dayKey(const DateTime &t) { return uint32_t(t.year()) * 10000 + t.month() * 100 + t.day(); }
String timestamp(const DateTime &t) {
  char b[30];
  snprintf(b, sizeof(b), "%04u-%02u-%02uT%02u:%02u:%02u+07:00", t.year(), t.month(), t.day(), t.hour(), t.minute(), t.second());
  return b;
}

void saveConfig() {
  prefs.putBytes("cfg", &cfg, sizeof(cfg));
  prefs.putUInt("cfg_ver", configVersion);
}

void loadConfig() {
  prefs.begin("tomato", false);
  if (prefs.getBytesLength("cfg") == sizeof(cfg)) prefs.getBytes("cfg", &cfg, sizeof(cfg));
  lastDayKey = prefs.getUInt("day", 0);
  seqCounter = prefs.getUInt("seq", 100);
  eventCounter = prefs.getUInt("evt_id", 100);
  configVersion = prefs.getUInt("cfg_ver", 1);
  for (int i = 0; i < 3; ++i) {
    char k[8]; snprintf(k, sizeof(k), "daily%d", i);
    row[i].dailyLiters = prefs.getFloat(k, 0);
  }
}

void saveDaily() {
  prefs.putUInt("day", lastDayKey);
  for (int i = 0; i < 3; ++i) {
    char k[8]; snprintf(k, sizeof(k), "daily%d", i);
    prefs.putFloat(k, row[i].dailyLiters);
  }
}

void enqueue(MsgType type, JsonDocument &doc) {
  Message m{}; m.type = type;
  if (serializeJson(doc, m.json, sizeof(m.json)) == 0) return;
  if (xQueueSend(messageQueue, &m, 0) != pdTRUE) {
    Serial.println("[FreeRTOS] Queue message day, bo qua ban tin");
  }
}

void event(int r, const char *name, const DateTime &now, float liters = 0) {
  uint32_t currentEvtId = ++eventCounter;
  prefs.putUInt("evt_id", currentEvtId);

  JsonDocument d;
  d["device_id"] = DEVICE_ID;
  char idBuf[40];
  snprintf(idBuf, sizeof(idBuf), "evt_%lu_%lu", (unsigned long)now.unixtime(), (unsigned long)currentEvtId);
  d["event_id"] = idBuf;
  d["recorded_at"] = timestamp(now);
  d["row"] = r + 1;
  d["type"] = name;
  if (liters > 0) d["liters"] = roundf(liters * 100.0f) / 100.0f;
  else d["liters"] = nullptr;

  enqueue(MsgType::Event, d);
}

float soilValue(int i) {
  const int raw = analogRead(soilPins[i]);
  if (raw < 30 || raw > 4060 || abs(int(cfg.soilDry[i]) - int(cfg.soilWet[i])) < 100) return NAN;
  if (isnan(adcAverage[i])) adcAverage[i] = raw;
  else adcAverage[i] += (raw - adcAverage[i]) / 16.0f;
  return constrain(100.0f * (cfg.soilDry[i] - adcAverage[i]) /
                   float(cfg.soilDry[i] - cfg.soilWet[i]), 0.0f, 100.0f);
}

bool waterAvailable() { return digitalRead(FLOAT_SW) != (cfg.floatLowLevel ? LOW : HIGH); }

void stopRow(int i, const char *reason, const DateTime &now, uint32_t ms) {
  RowState &s = row[i];
  if (!s.requested && !s.valveOpen) return;
  s.requested = false; s.manual = false; s.lastStopMs = ms;
  event(i, reason, now, s.dailyLiters - s.startLiters);
  saveDaily();
}

void startRow(int i, bool manual, const DateTime &now, uint32_t ms, float target) {
  RowState &s = row[i];
  if (s.requested || s.noFlowFault || s.leakFault || !waterAvailable()) return;
  s.requested = true; s.manual = manual; s.startMs = ms;
  s.startLiters = s.dailyLiters; s.targetLiters = target;
  s.lastFlowMs = ms;
  event(i, manual ? "manual_start" : "auto_start", now);
}

void applyCommands(const DateTime &now, uint32_t ms) {
  Command c;
  while (xQueueReceive(commandQueue, &c, 0) == pdTRUE) {
    if (c.type == CmdType::SetConfig) { cfg = c.config; saveConfig(); continue; }
    if (c.type == CmdType::EStop) {
      for (int i = 0; i < 3; ++i) stopRow(i, "estop", now, ms);
      continue;
    }
    if (c.row < 0 || c.row > 2) continue;
    if (c.type == CmdType::Start) startRow(c.row, true, now, ms, cfg.targetL[c.row]);
    if (c.type == CmdType::Stop) stopRow(c.row, "manual_stop", now, ms);
    if (c.type == CmdType::ClearFault && !row[c.row].requested) {
      row[c.row].noFlowFault = row[c.row].leakFault = false;
      event(c.row, "fault_cleared", now);
    }
  }
}

void TaskControlLoop(void *) {
  TickType_t wake = xTaskGetTickCount();
  uint32_t lastShtMs = 0;
  for (;;) {
    const uint32_t ms = millis();
    DateTime now = rtcOk ? rtc.now() : DateTime(2026, 1, 1, 0, 0, 0);
    const bool timeValid = rtcOk && !rtc.lostPower() && now.year() >= 2024;
    const uint32_t dk = timeValid ? dayKey(now) : 0;
    if (dk && dk != lastDayKey) {
      lastDayKey = dk;
      for (auto &s : row) { s.dailyLiters = 0; if (s.requested) s.startLiters = 0; }
      saveDaily();
    }
    applyCommands(now, ms);
    for (int i = 0; i < 4; ++i) soilPct[i] = soilValue(i);
    if (shtOk && ms - lastShtMs >= 2000) {
      lastShtMs = ms;
      temperature = sht31.readTemperature(); humidity = sht31.readHumidity();
      if (isfinite(temperature) && isfinite(humidity) && humidity >= 0 && humidity <= 100)
        vpd = 0.6108f * expf(17.27f * temperature / (temperature + 237.3f)) * (1.0f - humidity / 100.0f);
      else vpd = NAN;
    }
    uint32_t counts[3];
    portENTER_CRITICAL(&flowMux);
    for (int i = 0; i < 3; ++i) counts[i] = flowPulses[i];
    portEXIT_CRITICAL(&flowMux);
    const bool water = waterAvailable();
    const float h2 = (soilPct[0] + soilPct[1]) / 2.0f;
    const float h3 = (soilPct[2] + soilPct[3]) / 2.0f;
    const bool hot = isfinite(vpd) && vpd >= cfg.vpdHot;
    const float low3 = cfg.low[1] + (hot ? cfg.vpdThresholdBoost : 0);
    const float high3 = cfg.high[1] + (hot ? cfg.vpdThresholdBoost : 0);

    if (timeValid) for (int j = 0; j < 2; ++j) {
      if (now.hour() == cfg.scheduleHour[j] && now.minute() == cfg.scheduleMinute[j] &&
          scheduleDay[j] != dk) {
        scheduleDay[j] = dk;
        startRow(0, false, now, ms, cfg.targetL[0]);
      }
    }
    if (isfinite(h2) && h2 < cfg.low[0] && (!row[1].lastStopMs || ms - row[1].lastStopMs >= cfg.soakSeconds[0] * 1000UL))
      startRow(1, false, now, ms, cfg.targetL[1]);
    if (isfinite(h3) && isfinite(vpd) && h3 < low3 &&
        (!row[2].lastStopMs || ms - row[2].lastStopMs >= cfg.soakSeconds[1] * 1000UL))
      startRow(2, false, now, ms, cfg.targetL[2] * (hot ? 1.0f + cfg.vpdVolumeBoost : 1.0f));

    for (int i = 0; i < 3; ++i) {
      RowState &s = row[i];
      const uint32_t delta = counts[i] - s.lastPulses;
      s.lastPulses = counts[i];
      if (delta && s.valveOpen) { s.dailyLiters += delta / PULSES_PER_LITER; s.lastFlowMs = ms; }
      if (!water && s.requested) stopRow(i, "tank_empty", now, ms);
      if (s.requested && ms - s.startMs >= cfg.maxSeconds[i] * 1000UL) stopRow(i, "max_time", now, ms);
      if (s.requested && s.dailyLiters - s.startLiters >= s.targetLiters) stopRow(i, "target_volume", now, ms);
      if (s.requested && !s.manual && i == 1 && isfinite(h2) && h2 >= cfg.high[0]) stopRow(i, "soil_high", now, ms);
      if (s.requested && !s.manual && i == 2 && isfinite(h3) && h3 >= high3) stopRow(i, "soil_high", now, ms);
      if (s.valveOpen && pumpOn && ms - s.valveOpenedMs > NO_FLOW_GRACE_MS &&
          ms - s.lastFlowMs > NO_FLOW_GRACE_MS) {
        s.noFlowFault = true; stopRow(i, "ERROR_NO_FLOW", now, ms);
      }
      if (!s.valveOpen && delta && ms - s.closedMs > LEAK_GRACE_MS && pumpOn && !s.leakFault) {
        s.leakFault = true; event(i, "ERROR_VALVE_LEAK", now);
        for (int k = 0; k < 3; ++k) stopRow(k, "leak_shutdown", now, ms);
      }
    }

    bool anyRequested = false, settled = false;
    for (int i = 0; i < 3; ++i) {
      RowState &s = row[i];
      if (s.requested && !s.valveOpen) {
        digitalWrite(valvePins[i], RELAY_ON); s.valveOpen = true;
        s.valveOpenedMs = ms; s.lastFlowMs = ms;
      }
      anyRequested |= s.requested;
      settled |= s.requested && ms - s.valveOpenedMs >= VALVE_SETTLE_MS;
    }
    const bool desiredPump = water && anyRequested && settled;
    if (pumpOn != desiredPump) { pumpOn = desiredPump; pumpChangedMs = ms; digitalWrite(PUMP_MAIN, pumpOn ? RELAY_ON : RELAY_OFF); }
    if (pumpOn) for (int i = 0; i < 3; ++i) if (!row[i].requested && row[i].valveOpen) {
      digitalWrite(valvePins[i], RELAY_OFF); row[i].valveOpen = false; row[i].closedMs = ms;
    }
    if (!pumpOn && ms - pumpChangedMs >= PUMP_COAST_MS)
      for (int i = 0; i < 3; ++i) if (!row[i].requested && row[i].valveOpen) {
        digitalWrite(valvePins[i], RELAY_OFF); row[i].valveOpen = false; row[i].closedMs = ms;
      }

    // Đóng gói Telemetry chuẩn cho cả MQTT và Cloudflare Worker API
    if (ms - lastTelemetryMs >= TELEMETRY_MS) {
      lastTelemetryMs = ms;
      uint32_t currentSeq = ++seqCounter;
      prefs.putUInt("seq", currentSeq);

      JsonDocument d;
      d["device_id"] = DEVICE_ID;
      d["seq"] = currentSeq;
      d["recorded_at"] = timestamp(now);

      JsonArray soilArr = d["soil_pct"].to<JsonArray>();
      for (int i = 0; i < 4; ++i) {
        if (isnan(soilPct[i])) soilArr.add(nullptr);
        else soilArr.add(roundf(soilPct[i] * 10.0f) / 10.0f);
      }

      JsonArray rowsArr = d["rows"].to<JsonArray>();
      for (int i = 0; i < 3; ++i) {
        JsonObject r = rowsArr.add<JsonObject>();
        r["id"] = i + 1;
        r["valve"] = row[i].valveOpen;
        r["daily_l"] = roundf(row[i].dailyLiters * 100.0f) / 100.0f;
      }

      d["tank_ok"] = water ? true : false;
      d["pump_on"] = pumpOn ? true : false;
      if (isnan(temperature)) d["temp_c"] = nullptr;
      else d["temp_c"] = roundf(temperature * 10.0f) / 10.0f;

      if (isnan(humidity)) d["rh_pct"] = nullptr;
      else d["rh_pct"] = roundf(humidity * 10.0f) / 100.0f * 10.0f; // giữ 1 chữ số thập phân

      if (isnan(vpd)) d["vpd_kpa"] = nullptr;
      else d["vpd_kpa"] = roundf(vpd * 100.0f) / 100.0f;

      enqueue(MsgType::Telemetry, d);
    }

    if (ms - lastDailySaveMs >= 300000) { lastDailySaveMs = ms; saveDaily(); }
    vTaskDelayUntil(&wake, pdMS_TO_TICKS(CONTROL_MS));
  }
}

bool validateConfig(const Config &c) {
  for (int i = 0; i < 4; ++i) if (c.soilDry[i] > 4095 || c.soilWet[i] > 4095 ||
      abs(int(c.soilDry[i]) - int(c.soilWet[i])) < 100) return false;
  for (int i = 0; i < 2; ++i) if (c.scheduleHour[i] > 23 || c.scheduleMinute[i] > 59 ||
      c.low[i] < 0 || c.high[i] > 100 || c.low[i] >= c.high[i] || c.soakSeconds[i] > 86400) return false;
  for (int i = 0; i < 3; ++i) if (c.targetL[i] < 0.05f || c.targetL[i] > 100 ||
      c.maxSeconds[i] < 5 || c.maxSeconds[i] > 3600) return false;
  return c.vpdHot >= 0 && c.vpdHot <= 5 && c.vpdThresholdBoost >= 0 &&
         c.vpdThresholdBoost <= 30 && c.vpdVolumeBoost >= 0 && c.vpdVolumeBoost <= 2;
}

bool dispatchCommandJson(JsonObjectConst cmd) {
  const char *action = cmd["action"] | "";
  int r = (cmd["row"] | 0) - 1;
  Command c{};
  c.row = r;
  if (!strcmp(action, "start")) c.type = CmdType::Start;
  else if (!strcmp(action, "stop")) c.type = CmdType::Stop;
  else if (!strcmp(action, "estop")) c.type = CmdType::EStop;
  else if (!strcmp(action, "clear_fault")) c.type = CmdType::ClearFault;
  else return false;
  return xQueueSend(commandQueue, &c, 0) == pdTRUE;
}

bool applyConfigJson(JsonObjectConst cObj, uint32_t serverVer) {
  Config newCfg = cfg;
  for (int i = 0; i < 4; ++i) {
    newCfg.soilDry[i] = cObj["soilDry"][i] | newCfg.soilDry[i];
    newCfg.soilWet[i] = cObj["soilWet"][i] | newCfg.soilWet[i];
  }
  for (int i = 0; i < 2; ++i) {
    newCfg.scheduleHour[i] = cObj["scheduleHour"][i] | newCfg.scheduleHour[i];
    newCfg.scheduleMinute[i] = cObj["scheduleMinute"][i] | newCfg.scheduleMinute[i];
    newCfg.low[i] = cObj["low"][i] | newCfg.low[i];
    newCfg.high[i] = cObj["high"][i] | newCfg.high[i];
    newCfg.soakSeconds[i] = cObj["soakSeconds"][i] | newCfg.soakSeconds[i];
  }
  for (int i = 0; i < 3; ++i) {
    newCfg.targetL[i] = cObj["targetL"][i] | newCfg.targetL[i];
    newCfg.maxSeconds[i] = cObj["maxSeconds"][i] | newCfg.maxSeconds[i];
  }
  newCfg.vpdHot = cObj["vpdHot"] | newCfg.vpdHot;
  newCfg.vpdThresholdBoost = cObj["vpdThresholdBoost"] | newCfg.vpdThresholdBoost;
  newCfg.vpdVolumeBoost = cObj["vpdVolumeBoost"] | newCfg.vpdVolumeBoost;
  newCfg.floatLowLevel = cObj["floatLowLevel"] | newCfg.floatLowLevel;

  if (!validateConfig(newCfg)) return false;
  Command c{};
  c.type = CmdType::SetConfig;
  c.config = newCfg;
  if (xQueueSend(commandQueue, &c, 0) != pdTRUE) return false;
  if (serverVer > configVersion) {
    configVersion = serverVer;
    prefs.putUInt("cfg_ver", configVersion);
  }
  return true;
}

// =========================================================================
// LỚP MẠNG SONG SONG: MQTT (VPS) + HTTPS REST (CLOUDFLARE WORKER FAILOVER)
// =========================================================================

void releaseMuxForHttp() {
#if MQTT_ENABLE
  if (mqttClient.connected()) mqttClient.disconnect();
  mqttNetClient.stop();
#endif
}

bool sendHttpRequest(const char *method, const char *path, const char *body, String &respBody, int &statusCode, bool closeAfter = true) {
  respBody = "";
  statusCode = 0;

  if (!httpSocket.connected()) {
    if (!httpSocket.connect(API_HOST, API_PORT)) {
      return false;
    }
  }

  httpSocket.print(String(method) + " " + path + " HTTP/1.1\r\n");
  httpSocket.print(String("Host: ") + API_HOST + "\r\n");
  httpSocket.print("User-Agent: Mozilla/5.0 (ESP32-S3-Tomato-Dual)\r\n");
  httpSocket.print(String("Authorization: Bearer ") + DEVICE_TOKEN + "\r\n");
  httpSocket.print(closeAfter ? "Connection: close\r\n" : "Connection: keep-alive\r\n");

  if (body && strlen(body) > 0) {
    httpSocket.print("Content-Type: application/json\r\n");
    httpSocket.print(String("Content-Length: ") + strlen(body) + "\r\n\r\n");
    httpSocket.print(body);
  } else {
    httpSocket.print("\r\n");
  }

  uint32_t startMs = millis();
  while (!httpSocket.available() && millis() - startMs < 8000) {
    vTaskDelay(pdMS_TO_TICKS(50));
  }
  if (!httpSocket.available()) {
    httpSocket.stop();
    return false;
  }

  String statusLine = httpSocket.readStringUntil('\n');
  statusLine.trim();
  int sp1 = statusLine.indexOf(' ');
  if (sp1 > 0) statusCode = statusLine.substring(sp1 + 1, sp1 + 4).toInt();

  int contentLength = -1;
  bool isChunked = false;
  while (httpSocket.available()) {
    String headerLine = httpSocket.readStringUntil('\n');
    headerLine.trim();
    if (headerLine.length() == 0) break;
    if (headerLine.startsWith("Transfer-Encoding:") && headerLine.indexOf("chunked") >= 0) isChunked = true;
    if (headerLine.startsWith("Content-Length:")) contentLength = headerLine.substring(15).toInt();
  }

  if (contentLength > 0) {
    int readBytes = 0;
    while (readBytes < contentLength && millis() - startMs < 12000) {
      if (httpSocket.available()) {
        respBody += (char)httpSocket.read();
        readBytes++;
      } else {
        vTaskDelay(pdMS_TO_TICKS(10));
      }
    }
  } else if (isChunked) {
    while (millis() - startMs < 12000) {
      String chunkLenStr = httpSocket.readStringUntil('\n');
      chunkLenStr.trim();
      long chunkSize = strtol(chunkLenStr.c_str(), nullptr, 16);
      if (chunkSize <= 0) break;
      for (long i = 0; i < chunkSize; ++i) {
        while (!httpSocket.available() && millis() - startMs < 12000) vTaskDelay(pdMS_TO_TICKS(5));
        if (httpSocket.available()) respBody += (char)httpSocket.read();
      }
      httpSocket.readStringUntil('\n');
    }
  }

  if (closeAfter) httpSocket.stop();
  return statusCode >= 200 && statusCode < 300;
}

#if MQTT_ENABLE
void mqttCallback(char *topic, uint8_t *payload, unsigned int length) {
  if (!payload || length == 0 || length >= 1024) return;
  char buf[1024];
  memcpy(buf, payload, length);
  buf[length] = '\0';

  Serial.print("[MQTT RX] ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(buf);

  JsonDocument doc;
  if (deserializeJson(doc, buf)) return;

  if (strcmp(topic, MQTT_TOPIC_CMD) == 0) {
    dispatchCommandJson(doc.as<JsonObjectConst>());
  } else if (strcmp(topic, MQTT_TOPIC_CFG) == 0) {
    uint32_t ver = doc["version"] | (configVersion + 1);
    JsonObjectConst obj = doc["config"].is<JsonObject>() ? doc["config"].as<JsonObjectConst>() : doc.as<JsonObjectConst>();
    applyConfigJson(obj, ver);
  }
}

bool ensureMqttConnected() {
  if (mqttClient.connected()) return true;
  if (strlen(MQTT_HOST) == 0 || strstr(MQTT_HOST, "your-cluster") != nullptr) return false;

  // Đóng HTTP socket trước khi mở kết nối mux 0 cho MQTT (tránh đụng độ trên A7672X)
  httpSocket.stop();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(MQTT_KEEPALIVE_SEC);
  mqttClient.setSocketTimeout(10);
  mqttClient.setBufferSize(1024);

  String clientId = String(DEVICE_ID) + "_esp32_" + String(millis() & 0xFFFF, HEX);
  bool ok = false;
  if (strlen(MQTT_USER) > 0) {
    ok = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, MQTT_TOPIC_STATUS, 1, true, "offline");
  } else {
    ok = mqttClient.connect(clientId.c_str(), MQTT_TOPIC_STATUS, 1, true, "offline");
  }

  if (ok) {
    Serial.println("[MQTT] Da ket noi Broker thanh cong!");
    mqttClient.publish(MQTT_TOPIC_STATUS, "online", true);
    mqttClient.subscribe(MQTT_TOPIC_CMD, 1);
    mqttClient.subscribe(MQTT_TOPIC_CFG, 1);
  } else {
    Serial.print("[MQTT] Ket noi that bai rc=");
    Serial.println(mqttClient.state());
  }
  return ok;
}
#endif

bool appendOffline(const Message &m) {
  File f = LittleFS.open(OFFLINE_FILE, FILE_APPEND);
  if (!f) return false;
  JsonDocument d;
  d["kind"] = m.type == MsgType::Event ? "event" : "telemetry";
  d["data"] = m.json;
  String line;
  serializeJson(d, line);
  bool ok = f.println(line) == line.length() + 2;
  f.close();
  return ok;
}

bool sendViaHttpDirect(const Message &m) {
  String resp;
  int code = 0;
  const char *endpoint = m.type == MsgType::Event ? "/api/v1/events" : "/api/v1/telemetry";
  return sendHttpRequest("POST", endpoint, m.json, resp, code, true);
}

bool sendMessage(const Message &m) {
#if MQTT_ENABLE
  if (ensureMqttConnected()) {
    const char *topic = m.type == MsgType::Event ? MQTT_TOPIC_EVENTS : MQTT_TOPIC_DATA;
    if (mqttClient.publish(topic, m.json)) {
#if DIRECT_HTTP_MIRROR
      // Tùy chọn gửi trực tiếp thêm 1 bản song song tới Cloudflare từ ESP32 (nếu không dùng cf_sync trên VPS)
      releaseMuxForHttp();
      sendViaHttpDirect(m);
      ensureMqttConnected();
#endif
      return true;
    }
  }
  // Failover tự động sang Cloudflare HTTPS nếu VPS / MQTT Broker mất kết nối
  releaseMuxForHttp();
#endif
  return sendViaHttpDirect(m);
}

void replayOffline() {
  if (!LittleFS.exists(OFFLINE_FILE)) return;
  File src = LittleFS.open(OFFLINE_FILE, FILE_READ);
  File dst = LittleFS.open("/offline.tmp", FILE_WRITE);
  if (!src || !dst) return;
  bool failed = false;
  while (src.available()) {
    String line = src.readStringUntil('\n'); line.trim();
    if (!line.length()) continue;
    JsonDocument d; Message m{};
    if (deserializeJson(d, line) || !d["data"].is<const char *>()) { failed = true; dst.println(line); continue; }
    m.type = strcmp(d["kind"] | "", "event") == 0 ? MsgType::Event : MsgType::Telemetry;
    strlcpy(m.json, d["data"], sizeof(m.json));
    if (failed || !sendMessage(m)) { failed = true; dst.println(line); }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
  src.close(); dst.close();
  LittleFS.remove(OFFLINE_FILE);
  File tmp = LittleFS.open("/offline.tmp", FILE_READ);
  if (tmp && tmp.size()) { tmp.close(); LittleFS.rename("/offline.tmp", OFFLINE_FILE); }
  else { tmp.close(); LittleFS.remove("/offline.tmp"); }
}

void pollCommandsHttp() {
  releaseMuxForHttp();
  String resp;
  int code = 0;
  if (!sendHttpRequest("GET", "/api/v1/commands?device_id=" DEVICE_ID, nullptr, resp, code, true)) return;
  if (code != 200 || !resp.length()) return;

  JsonDocument d;
  if (deserializeJson(d, resp)) return;
  JsonArray arr = d["commands"].as<JsonArray>();
  for (JsonObject cmd : arr) {
    int cmdId = cmd["id"] | 0;
    if (dispatchCommandJson(cmd)) {
      char ackJson[32];
      snprintf(ackJson, sizeof(ackJson), "{\"id\":%d}", cmdId);
      String ackResp;
      int ackCode = 0;
      sendHttpRequest("POST", "/api/v1/commands/ack?device_id=" DEVICE_ID, ackJson, ackResp, ackCode, true);
    }
  }
}

void pollConfigHttp() {
  releaseMuxForHttp();
  String resp;
  int code = 0;
  if (!sendHttpRequest("GET", "/api/v1/config?device_id=" DEVICE_ID, nullptr, resp, code, true)) return;
  if (code != 200 || !resp.length()) return;

  JsonDocument d;
  if (deserializeJson(d, resp)) return;
  uint32_t serverVer = d["version"] | 0;
  if (serverVer > configVersion && d["config"].is<JsonObject>()) {
    applyConfigJson(d["config"].as<JsonObjectConst>(), serverVer);
  }
}

void TaskNetwork4G(void *) {
  modemSerial.begin(MODEM_BAUD, SERIAL_8N1, MODEM_RX, MODEM_TX);
#if MODEM_PWRKEY_GPIO >= 0
  pinMode(MODEM_PWRKEY_GPIO, OUTPUT);
  digitalWrite(MODEM_PWRKEY_GPIO, LOW);
  if (!modem.testAT(3000L)) {
    digitalWrite(MODEM_PWRKEY_GPIO, HIGH);
    vTaskDelay(pdMS_TO_TICKS(1200));
    digitalWrite(MODEM_PWRKEY_GPIO, LOW);
    vTaskDelay(pdMS_TO_TICKS(12000));
  }
#endif

  uint32_t retryGprsMs = 0;
  uint32_t lastMqttRetryMs = 0;
  uint32_t lastCmdPollMs = 0;
  uint32_t lastCfgPollMs = 0;

  for (;;) {
    const uint32_t ms = millis();

    if (!modem.isGprsConnected()) {
      if (ms - retryGprsMs >= 15000) {
        retryGprsMs = ms;
        if (modem.init() && modem.waitForNetwork(30000L)) {
          if (modem.gprsConnect(CELLULAR_APN, CELLULAR_USER, CELLULAR_PASS)) {
            Serial.println("[4G] Da ket noi mang 4G LTE thanh cong!");
#if MQTT_ENABLE
            ensureMqttConnected();
#endif
            replayOffline();
          }
        }
      }
    } else {
      bool mqttAlive = false;
#if MQTT_ENABLE
      if (mqttClient.connected()) {
        mqttClient.loop();
        mqttAlive = true;
      } else if (ms - lastMqttRetryMs >= 30000) {
        lastMqttRetryMs = ms;
        mqttAlive = ensureMqttConnected();
      }
#endif

      // Gửi hàng đợi Telemetry & Events
      Message m;
      while (xQueueReceive(messageQueue, &m, 0) == pdTRUE) {
        if (!sendMessage(m)) {
          appendOffline(m);
        }
      }

      // Nếu đang ở chế độ Cloudflare dự phòng (hoặc MQTT chưa nối), định kỳ poll lệnh từ Cloudflare
      if (!mqttAlive && ms - lastCmdPollMs >= 15000) {
        lastCmdPollMs = ms;
        pollCommandsHttp();
      }
      if (!mqttAlive && ms - lastCfgPollMs >= 60000) {
        lastCfgPollMs = ms;
        pollConfigHttp();
      }
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

void setup() {
  Serial.begin(115200);
  for (uint8_t p : {VALVE_R1, VALVE_R2, VALVE_R3, PUMP_MAIN}) {
    digitalWrite(p, RELAY_OFF); pinMode(p, OUTPUT);
  }
  pinMode(FLOAT_SW, INPUT_PULLUP);
  for (uint8_t p : {FLOW_R1, FLOW_R2, FLOW_R3}) pinMode(p, INPUT_PULLUP);
  for (uint8_t p : soilPins) { pinMode(p, INPUT); analogSetPinAttenuation(p, ADC_11db); }
  Wire.begin(I2C_SDA, I2C_SCL);
  rtcOk = rtc.begin(); shtOk = sht31.begin(0x44);
  loadConfig();
  messageQueue = xQueueCreate(32, sizeof(Message));
  commandQueue = xQueueCreate(16, sizeof(Command));
  if (!messageQueue || !commandQueue || !LittleFS.begin(true)) {
    Serial.println("Loi khoi tao bo nho/queue; dung chuong trinh"); while (true) delay(1000);
  }
  attachInterrupt(digitalPinToInterrupt(FLOW_R1), flow0, RISING);
  attachInterrupt(digitalPinToInterrupt(FLOW_R2), flow1, RISING);
  attachInterrupt(digitalPinToInterrupt(FLOW_R3), flow2, RISING);
  xTaskCreatePinnedToCore(TaskControlLoop, "Control", 8192, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(TaskNetwork4G, "Network", 12288, nullptr, 1, nullptr, 0);
}

void loop() { vTaskDelay(pdMS_TO_TICKS(1000)); }
