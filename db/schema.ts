import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(), createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at"), lastSeq: integer("last_seq"),
});
export const telemetry = sqliteTable("telemetry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(), seq: integer("seq").notNull(),
  recordedAt: text("recorded_at").notNull(), receivedAt: text("received_at").notNull(),
  soilJson: text("soil_json").notNull(), temperatureC: real("temperature_c"),
  rhPct: real("rh_pct"), vpdKpa: real("vpd_kpa"),
  rowsJson: text("rows_json").notNull(), tankOk: integer("tank_ok").notNull(),
  pumpOn: integer("pump_on").notNull(),
}, (t) => [uniqueIndex("telemetry_device_seq_unique").on(t.deviceId, t.seq)]);
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(), eventId: text("event_id").notNull(),
  recordedAt: text("recorded_at").notNull(), receivedAt: text("received_at").notNull(),
  row: integer("row").notNull(), type: text("type").notNull(),
  liters: real("liters"), detailsJson: text("details_json").notNull(),
}, (t) => [uniqueIndex("events_device_event_unique").on(t.deviceId, t.eventId)]);
export const configs = sqliteTable("configs", {
  deviceId: text("device_id").primaryKey(), version: integer("version").notNull(),
  bodyJson: text("body_json").notNull(), updatedAt: text("updated_at").notNull(),
});
export const commands = sqliteTable("commands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(), action: text("action").notNull(),
  row: integer("row").notNull(), status: text("status").notNull(),
  createdAt: text("created_at").notNull(), ackedAt: text("acked_at"),
});
