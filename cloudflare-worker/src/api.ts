export type WorkerEnv = {
  DB: D1Database;
  DEVICE_TOKEN: string;
  ADMIN_TOKEN: string;
  BACKUP_TOKEN: string;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const bad = (message: string, status = 400) => json({ error: message }, status);
const deviceIdOk = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(v);
const isoOk = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) &&
  Number.isFinite(Date.parse(v));
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const bool = (v: unknown) => typeof v === "boolean" || v === 0 || v === 1;
const rowOk = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 3;
// Lệnh điều khiển chỉ có hiệu lực trong 10 phút kể từ khi tạo.
const COMMAND_TTL_MS = 10 * 60 * 1000;

async function bodyOf(req: Request): Promise<Record<string, unknown> | null> {
  if ((Number(req.headers.get("content-length")) || 0) > 8192) return null;
  const text = await req.text();
  if (text.length > 8192) return null;
  try {
    const x = JSON.parse(text);
    return x && typeof x === "object" && !Array.isArray(x) ? x : null;
  } catch {
    return null;
  }
}

function configOk(c: unknown): c is Record<string, unknown> {
  if (!c || typeof c !== "object" || Array.isArray(c)) return false;
  const x = c as Record<string, unknown>;
  const arr = (k: string, n: number, min: number, max: number) =>
    Array.isArray(x[k]) &&
    x[k].length === n &&
    x[k].every((v: unknown) => num(v, min, max));
  if (
    !arr("soilDry", 4, 0, 4095) ||
    !arr("soilWet", 4, 0, 4095) ||
    !arr("scheduleHour", 2, 0, 23) ||
    !arr("scheduleMinute", 2, 0, 59) ||
    !arr("low", 2, 0, 100) ||
    !arr("high", 2, 0, 100) ||
    !arr("targetL", 3, 0.05, 100) ||
    !arr("maxSeconds", 3, 5, 3600) ||
    !arr("soakSeconds", 2, 0, 86400)
  )
    return false;
  for (let i = 0; i < 4; i++)
    if (Math.abs(Number((x.soilDry as number[])[i]) - Number((x.soilWet as number[])[i])) < 100)
      return false;
  for (let i = 0; i < 2; i++)
    if (Number((x.low as number[])[i]) >= Number((x.high as number[])[i])) return false;
  return (
    num(x.vpdHot, 0, 5) &&
    num(x.vpdThresholdBoost, 0, 30) &&
    num(x.vpdVolumeBoost, 0, 2) &&
    bool(x.floatLowLevel)
  );
}

const defaultConfig = {
  soilDry: [3000, 3000, 3000, 3000],
  soilWet: [1200, 1200, 1200, 1200],
  scheduleHour: [6, 17],
  scheduleMinute: [0, 0],
  low: [35, 38],
  high: [55, 58],
  targetL: [2, 2, 2],
  maxSeconds: [900, 900, 900],
  soakSeconds: [1800, 1800],
  vpdHot: 1.5,
  vpdThresholdBoost: 8,
  vpdVolumeBoost: 0.35,
  floatLowLevel: true,
};

function tokenMatches(req: Request, token: string | undefined) {
  const header = req.headers.get("Authorization");
  return Boolean(token && header && header === `Bearer ${token}`);
}

// ================= CRYPTO & PASSWORD HASHING (PBKDF2) =================
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return {
    hashHex: bytesToHex(new Uint8Array(derivedBits)),
    saltHex: bytesToHex(salt),
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function getSessionUser(
  req: Request,
  db: D1Database
): Promise<{ user_id: number; username: string; role: string } | null> {
  const header = req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token || token.length < 16) return null;
  const now = new Date().toISOString();
  const session = await db
    .prepare("SELECT user_id, username, role FROM sessions WHERE token=? AND expires_at > ?")
    .bind(token, now)
    .first<{ user_id: number; username: string; role: string }>();
  return session ?? null;
}

// ================= MAIN ROUTER =================
export async function route(req: Request, env: WorkerEnv) {
  const db = () => {
    if (!env.DB) throw new Error("DB binding missing");
    return env.DB;
  };

  // Chỉ tra bảng sessions khi header không khớp token cố định (tránh thêm truy vấn cho thiết bị).
  const fixedToken =
    tokenMatches(req, env.ADMIN_TOKEN) ||
    tokenMatches(req, env.DEVICE_TOKEN) ||
    tokenMatches(req, env.BACKUP_TOKEN);
  const sessionUser = fixedToken ? null : await getSessionUser(req, db());
  const admin = () =>
    tokenMatches(req, env.ADMIN_TOKEN) || (sessionUser !== null && sessionUser.role === "admin");
  const device = () => tokenMatches(req, env.DEVICE_TOKEN);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, "");
  const method = req.method;

  if (path === "health" && method === "GET") {
    return json({ status: "ok", service: "tomato-irrigation-api", version: 1 });
  }

  // ================= AUTH ENDPOINTS =================
  if (path === "auth/login" && method === "POST") {
    const x = await bodyOf(req);
    const username = typeof x?.username === "string" ? x.username.trim() : "";
    const password = typeof x?.password === "string" ? x.password : "";
    if (!username || !password) return bad("Tên đăng nhập và mật khẩu là bắt buộc", 400);

    // Tài khoản chỉ được tạo bởi chủ hệ thống qua wrangler (không tự tạo qua API).
    const user = await db()
      .prepare("SELECT id, username, password_hash, salt, role FROM users WHERE username=?")
      .bind(username)
      .first<{ id: number; username: string; password_hash: string; salt: string; role: string }>();
    if (!user) return bad("Tên đăng nhập hoặc mật khẩu không chính xác", 401);
    const { hashHex } = await hashPassword(password, user.salt);
    if (!timingSafeEqual(hashHex, user.password_hash)) {
      return bad("Tên đăng nhập hoặc mật khẩu không chính xác", 401);
    }

    // Sinh Session Token ngẫu nhiên 256-bit
    const sessionToken = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 86400000).toISOString(); // 14 ngày

    await db().batch([
      db().prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()),
      db()
        .prepare("INSERT INTO sessions(token, user_id, username, role, expires_at, created_at) VALUES(?,?,?,?,?,?)")
        .bind(sessionToken, user.id, user.username, user.role, expiresAt, now.toISOString()),
      db().prepare("UPDATE users SET last_login_at=? WHERE id=?").bind(now.toISOString(), user.id),
    ]);

    return json({
      token: sessionToken,
      username: user.username,
      role: user.role,
      expires_at: expiresAt,
    });
  }

  if (path === "auth/logout" && method === "POST") {
    const header = req.headers.get("Authorization");
    if (header && header.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      await db().prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
    }
    return json({ logged_out: true });
  }

  if (path === "auth/me" && method === "GET") {
    if (!admin()) return bad("Unauthorized", 401);
    return json({
      authenticated: true,
      user: sessionUser ?? { username: "admin_token", role: "admin" },
    });
  }

  if (path === "auth/change-password" && method === "POST") {
    if (!sessionUser) return bad("Yêu cầu đăng nhập bằng tài khoản để đổi mật khẩu", 401);
    const x = await bodyOf(req);
    const oldPass = typeof x?.old_password === "string" ? x.old_password : "";
    const newPass = typeof x?.new_password === "string" ? x.new_password : "";
    if (!newPass || newPass.length < 8) return bad("Mật khẩu mới phải có ít nhất 8 ký tự", 400);

    const user = await db()
      .prepare("SELECT password_hash, salt FROM users WHERE id=?")
      .bind(sessionUser.user_id)
      .first<{ password_hash: string; salt: string }>();
    if (!user) return bad("Người dùng không tồn tại", 404);

    const { hashHex: verifyOld } = await hashPassword(oldPass, user.salt);
    if (!timingSafeEqual(verifyOld, user.password_hash)) {
      return bad("Mật khẩu hiện tại không đúng", 400);
    }

    const { hashHex: newHash, saltHex: newSalt } = await hashPassword(newPass);
    await db()
      .prepare("UPDATE users SET password_hash=?, salt=? WHERE id=?")
      .bind(newHash, newSalt, sessionUser.user_id)
      .run();
    return json({ success: true, message: "Đổi mật khẩu thành công" });
  }

  // ================= ADMIN & DEVICE ENDPOINTS =================
  const id = url.searchParams.get("device_id");

  if (path === "admin/devices" && method === "GET") {
    if (!admin()) return bad("admin token required", 403);
    const result = await db()
      .prepare("SELECT id,created_at,last_seen_at,last_seq FROM devices ORDER BY last_seen_at DESC LIMIT 100")
      .all();
    return json({ devices: result.results });
  }

  if (path === "telemetry" && method === "POST") {
    if (!device()) return bad("device token required", 401);
    const x = await bodyOf(req);
    if (
      !x ||
      !deviceIdOk(x.device_id) ||
      !Number.isSafeInteger(x.seq) ||
      Number(x.seq) < 0 ||
      !isoOk(x.recorded_at) ||
      !Array.isArray(x.soil_pct) ||
      x.soil_pct.length !== 4 ||
      !x.soil_pct.every((v: unknown) => v === null || num(v, 0, 100)) ||
      !Array.isArray(x.rows) ||
      x.rows.length !== 3 ||
      !x.rows.every((r: unknown, i: number) => {
        if (!r || typeof r !== "object") return false;
        const q = r as Record<string, unknown>;
        return q.id === i + 1 && num(q.daily_l, 0, 1000000) && bool(q.valve);
      }) ||
      !bool(x.tank_ok) ||
      !bool(x.pump_on) ||
      ![x.temp_c, x.rh_pct, x.vpd_kpa].every((v, i) =>
        v === null || num(v, i === 0 ? -40 : 0, i === 0 ? 85 : i === 1 ? 100 : 10)
      )
    )
      return bad("telemetry payload invalid");
    const now = new Date().toISOString();
    await db().batch([
      db()
        .prepare(
          "INSERT INTO devices(id,created_at,last_seen_at,last_seq) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,last_seq=MAX(COALESCE(devices.last_seq,0),excluded.last_seq)"
        )
        .bind(x.device_id, now, now, x.seq),
      db()
        .prepare(
          "INSERT INTO telemetry(device_id,seq,recorded_at,received_at,soil_json,temperature_c,rh_pct,vpd_kpa,rows_json,tank_ok,pump_on) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(device_id,seq) DO NOTHING"
        )
        .bind(
          x.device_id,
          x.seq,
          x.recorded_at,
          now,
          JSON.stringify(x.soil_pct),
          x.temp_c,
          x.rh_pct,
          x.vpd_kpa,
          JSON.stringify(x.rows),
          x.tank_ok ? 1 : 0,
          x.pump_on ? 1 : 0
        ),
    ]);
    return json({ accepted: true, seq: x.seq }, 202);
  }

  if (path === "events" && method === "POST") {
    if (!device()) return bad("device token required", 401);
    const x = await bodyOf(req);
    if (
      !x ||
      !deviceIdOk(x.device_id) ||
      typeof x.event_id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(x.event_id) ||
      !isoOk(x.recorded_at) ||
      !rowOk(x.row) ||
      typeof x.type !== "string" ||
      !/^[A-Z_a-z0-9]{1,40}$/.test(x.type) ||
      !(x.liters === null || num(x.liters, 0, 1000000)) ||
      (x.details !== undefined &&
        (typeof x.details !== "object" || x.details === null || Array.isArray(x.details)))
    )
      return bad("event payload invalid");
    const now = new Date().toISOString();
    await db().batch([
      db()
        .prepare("INSERT INTO devices(id,created_at,last_seen_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at")
        .bind(x.device_id, now, now),
      db()
        .prepare(
          "INSERT INTO events(device_id,event_id,recorded_at,received_at,row,type,liters,details_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(device_id,event_id) DO NOTHING"
        )
        .bind(x.device_id, x.event_id, x.recorded_at, now, x.row, x.type, x.liters, JSON.stringify(x.details ?? {})),
    ]);
    return json({ accepted: true, event_id: x.event_id }, 202);
  }

  // Xuất từng trang để Apps Script sao lưu
  if (["backup/telemetry", "backup/events"].includes(path) && method === "GET") {
    if (!tokenMatches(req, env.BACKUP_TOKEN)) return bad("backup token required", 401);
    const day = url.searchParams.get("day");
    if (
      !day ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) ||
      new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
    )
      return bad("day invalid");
    const after = Number(url.searchParams.get("after") ?? "0");
    if (!Number.isSafeInteger(after) || after < 0) return bad("after invalid");
    const start = `${day}T00:00:00Z`;
    const end = new Date(Date.parse(start) + 86400000).toISOString();
    const table = path === "backup/events" ? "events" : "telemetry";
    const result = await db()
      .prepare(`SELECT * FROM ${table} WHERE id>? AND received_at>=? AND received_at<? ORDER BY id LIMIT 500`)
      .bind(after, start, end)
      .all();
    const items = result.results as Record<string, unknown>[];
    return json({
      day,
      items,
      next_after: items.length ? items[items.length - 1].id : after,
      has_more: items.length === 500,
    });
  }

  if (!deviceIdOk(id)) return bad("device_id invalid");
  if (["config", "commands"].includes(path) && !device() && !admin())
    return bad("token required", 401);

  if (path === "config" && method === "GET") {
    const item = await db()
      .prepare("SELECT version,body_json,updated_at FROM configs WHERE device_id=?")
      .bind(id)
      .first<{ version: number; body_json: string; updated_at: string }>();
    return json({
      device_id: id,
      version: item?.version ?? 1,
      config: item ? JSON.parse(item.body_json) : defaultConfig,
      updated_at: item?.updated_at ?? null,
    });
  }
  if (path === "commands" && method === "GET") {
    // Lệnh quá hạn không được giao cho thiết bị: tránh tưới bất ngờ khi thiết bị online lại sau nhiều giờ.
    const cutoff = new Date(Date.now() - COMMAND_TTL_MS).toISOString();
    const result = await db()
      .prepare("SELECT id,action,row,created_at FROM commands WHERE device_id=? AND status='pending' AND created_at>? ORDER BY id LIMIT 16")
      .bind(id, cutoff)
      .all();
    return json({ device_id: id, commands: result.results });
  }
  if (path === "commands/ack" && method === "POST") {
    if (!device()) return bad("device token required", 401);
    const x = await bodyOf(req);
    if (!x || !Number.isSafeInteger(x.id) || Number(x.id) < 1) return bad("command id invalid");
    const result = await db()
      .prepare("UPDATE commands SET status='acked',acked_at=? WHERE id=? AND device_id=? AND status='pending'")
      .bind(new Date().toISOString(), x.id, id)
      .run();
    return json({ acknowledged: result.meta.changes > 0 });
  }

  if (!admin()) return bad("admin token required", 403);

  if (path === "admin/config" && method === "PUT") {
    const x = await bodyOf(req);
    if (!configOk(x)) return bad("config payload invalid");
    const now = new Date().toISOString();
    const item = await db()
      .prepare(
        "INSERT INTO configs(device_id,version,body_json,updated_at) VALUES(?,2,?,?) ON CONFLICT(device_id) DO UPDATE SET version=configs.version+1,body_json=excluded.body_json,updated_at=excluded.updated_at RETURNING version"
      )
      .bind(id, JSON.stringify(x), now)
      .first<{ version: number }>();
    return json({ device_id: id, version: item?.version, updated_at: now });
  }
  if (path === "admin/commands" && method === "POST") {
    const x = await bodyOf(req);
    if (!x || !["start", "stop", "clear_fault"].includes(String(x.action)) || !rowOk(x.row))
      return bad("command payload invalid");
    const item = await db()
      .prepare("INSERT INTO commands(device_id,action,row,status,created_at) VALUES(?,?,?,'pending',?) RETURNING id")
      .bind(id, x.action, x.row, new Date().toISOString())
      .first<{ id: number }>();
    return json({ id: item?.id, status: "pending" }, 201);
  }
  if (path === "admin/commands" && method === "GET") {
    const result = await db()
      .prepare("SELECT id,action,row,status,created_at,acked_at FROM commands WHERE device_id=? ORDER BY id DESC LIMIT 20")
      .bind(id)
      .all<{ id: number; action: string; row: number; status: string; created_at: string; acked_at: string | null }>();
    const cutoff = Date.now() - COMMAND_TTL_MS;
    const commands = result.results.map((c) => ({
      ...c,
      status: c.status === "pending" && Date.parse(c.created_at) <= cutoff ? "expired" : c.status,
    }));
    return json({ device_id: id, ttl_seconds: COMMAND_TTL_MS / 1000, commands });
  }
  if (path === "admin/latest" && method === "GET") {
    const item = await db()
      .prepare("SELECT * FROM telemetry WHERE device_id=? ORDER BY id DESC LIMIT 1")
      .bind(id)
      .first();
    return json({ device_id: id, telemetry: item });
  }
  if (path === "admin/events" && method === "GET") {
    const item = await db()
      .prepare("SELECT * FROM events WHERE device_id=? ORDER BY id DESC LIMIT 100")
      .bind(id)
      .all();
    return json({ device_id: id, events: item.results });
  }
  if (path === "admin/history" && method === "GET") {
    const item = await db()
      .prepare(
        "SELECT recorded_at,received_at,soil_json,temperature_c,rh_pct,vpd_kpa,rows_json,tank_ok,pump_on FROM telemetry WHERE device_id=? ORDER BY id DESC LIMIT 120"
      )
      .bind(id)
      .all();
    return json({ device_id: id, samples: item.results.reverse() });
  }

  return bad("route not found", 404);
}
