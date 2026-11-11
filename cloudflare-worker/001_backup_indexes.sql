CREATE INDEX IF NOT EXISTS telemetry_received_id_idx ON telemetry(received_at, id);
CREATE INDEX IF NOT EXISTS events_received_id_idx ON events(received_at, id);
