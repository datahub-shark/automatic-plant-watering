"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Droplets,
  Gauge,
  Key,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Play,
  Power,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  Square,
  Thermometer,
  Unlock,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { Config, Device, EventItem, Row, Sample } from "./hmi-types";
import { ALARM_REGISTRY, defaultConfig } from "./hmi-types";
import HydraulicPID from "./hmi-hydraulic-pid";
import HmiAlarms from "./hmi-alarms";
import HmiGuide from "./hmi-guide";
import HmiFuture from "./hmi-future";

// URL Cloudflare Worker API chính thức
const CLOUDFLARE_WORKER_API = "https://automatic-plant-watering-api.datahub-shark.workers.dev/api/v1";

// Dữ liệu mẫu ban đầu cho chế độ Tập sự / Huấn luyện công nhân
const initialSimRows: Row[] = [
  { id: 1, daily_l: 4.8, valve: false },
  { id: 2, daily_l: 3.2, valve: false },
  { id: 3, daily_l: 5.7, valve: false },
];

const initialSimSeries = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  h2: Math.min(85, Math.max(25, 48 + Math.sin(i / 3) * 8 - (i > 13 ? 6 : 0))),
  h3: Math.min(85, Math.max(25, 52 + Math.cos(i / 4) * 6 - (i > 14 ? 8 : 0))),
}));

const initialSimEvents: EventItem[] = [
  { id: 4, recorded_at: new Date(Date.now() - 3600000).toISOString(), row: 3, type: "target_volume", liters: 2.0 },
  { id: 3, recorded_at: new Date(Date.now() - 7200000).toISOString(), row: 2, type: "target_volume", liters: 2.0 },
  { id: 2, recorded_at: new Date(Date.now() - 21600000).toISOString(), row: 1, type: "auto_start", liters: 0.0 },
  { id: 1, recorded_at: new Date(Date.now() - 21660000).toISOString(), row: 1, type: "target_volume", liters: 2.0 },
];

function parseSample(s: Sample | null) {
  if (!s) return null;
  try {
    const soil = JSON.parse(s.soil_json) as (number | null)[];
    const rows = JSON.parse(s.rows_json) as Row[];
    const h2 = soil[0] != null && soil[1] != null ? (soil[0] + soil[1]) / 2 : null;
    const h3 = soil[2] != null && soil[3] != null ? (soil[2] + soil[3]) / 2 : null;
    return { soil, rows, h2, h3 };
  } catch {
    return null;
  }
}

function LineChart({ points }: { points: { time: string; h2: number | null; h3: number | null }[] }) {
  const width = 740, height = 220, left = 40, right = 16, top = 20, bottom = 30;
  const x = (i: number) => left + (i * (width - left - right)) / Math.max(points.length - 1, 1);
  const y = (v: number) => top + ((100 - v) * (height - top - bottom)) / 100;
  const path = (key: "h2" | "h3") =>
    points
      .map((p, i) =>
        p[key] == null
          ? null
          : `${i === 0 || points[i - 1][key] == null ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key] as number).toFixed(1)}`
      )
      .filter(Boolean)
      .join(" ");

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Biểu đồ độ ẩm đất">
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="4 5" />
            <text x="6" y={y(v) + 4} fontSize="11" fill="#94a3b8" fontWeight="600">
              {v}%
            </text>
          </g>
        ))}
        {/* Đường ngưỡng cảnh báo Low/High */}
        <line x1={left} x2={width - right} y1={y(35)} y2={y(35)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={left} x2={width - right} y1={y(55)} y2={y(55)} stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />

        <path d={path("h2")} fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path("h3")} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.length > 0 && (
          <>
            <text x={left} y={height - 8} fontSize="11" fill="#64748b" fontWeight="600">
              {points[0].time}
            </text>
            <text x={width - right} y={height - 8} textAnchor="end" fontSize="11" fill="#64748b" fontWeight="600">
              {points[points.length - 1].time}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export default function Dashboard({
  userName = "Công nhân Vận hành",
  signOutPath,
  staticMode = false,
}: {
  userName?: string;
  signOutPath?: string;
  staticMode?: boolean;
}) {
  const [tab, setTab] = useState<"overview" | "pid" | "alarms" | "config" | "guide" | "future">("overview");
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [device, setDevice] = useState("stm32_01");
  const [devices, setDevices] = useState<Device[]>([]);
  const [latest, setLatest] = useState<Sample | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [events, setEvents] = useState<EventItem[]>(initialSimEvents);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [version, setVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Token xác thực lưu trong bộ nhớ sessionStorage (không lưu cứng vào code/git)
  const [adminToken, setAdminToken] = useState<string>("");
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  // Modal xác nhận thao tác cho công nhân
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: "start" | "stop" | "estop";
    rowId?: number;
    title: string;
    details: string;
  }>({
    open: false,
    action: "start",
    title: "",
    details: "",
  });

  // State mô phỏng cho chế độ Huấn luyện / Xem mẫu
  const [simRows, setSimRows] = useState<Row[]>(initialSimRows);
  const [simTankOk, setSimTankOk] = useState(true);
  const [simPumpOn, setSimPumpOn] = useState(false);
  const [simSoil, setSimSoil] = useState<number[]>([42, 45, 48, 51]);
  const [simTemp, setSimTemp] = useState(31.2);
  const [simRh, setSimRh] = useState(68);
  const [simVpd, setSimVpd] = useState(1.45);

  // Đọc token từ sessionStorage khi khởi tạo
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("TOMATO_ADMIN_TOKEN");
      if (saved) setAdminToken(saved);
    }
  }, []);

  const query = encodeURIComponent(device);

  // Gọi API Cloudflare Worker có kèm Bearer Token nếu có
  const request = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const headers = new Headers(options?.headers);
      headers.set("Cache-Control", "no-store");
      if (adminToken) {
        headers.set("Authorization", `Bearer ${adminToken}`);
      }

      // Xác định base URL: nếu đường dẫn tương đối không có host thì gọi thẳng Cloudflare Worker
      const url = `${CLOUDFLARE_WORKER_API}/${path}`;
      const res = await fetch(url, { ...options, headers });
      const body = (await res.json()) as T & { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    },
    [adminToken]
  );

  // Tải dữ liệu thực từ Cloudflare Worker
  const refresh = useCallback(async () => {
    if (mode !== "live") return;
    try {
      // Khi không có token, các endpoint admin sẽ trả 403. Ta bắt lỗi để hiển thị ở chế độ Read-only
      const [devRes, cfgRes] = await Promise.all([
        request<{ devices: Device[] }>("admin/devices").catch(() => ({ devices: [] })),
        request<{ config: Config; version: number }>(`config?device_id=${query}`).catch(() => null),
      ]);

      if (devRes?.devices?.length) {
        setDevices(devRes.devices);
      }

      if (cfgRes?.config) {
        setConfig(cfgRes.config);
        setVersion(cfgRes.version);
      }

      if (adminToken) {
        const [latRes, hisRes, evtRes] = await Promise.all([
          request<{ telemetry: Sample | null }>(`admin/latest?device_id=${query}`),
          request<{ samples: Sample[] }>(`admin/history?device_id=${query}`),
          request<{ events: EventItem[] }>(`admin/events?device_id=${query}`),
        ]);
        setLatest(latRes.telemetry);
        setHistory(hisRes.samples || []);
        setEvents(evtRes.events || []);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đồng bộ với Cloudflare Worker");
    }
  }, [adminToken, mode, query, request]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 12000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Bộ phân giải dữ liệu hiển thị (Thực hoặc Mô phỏng)
  const parsed = useMemo(() => parseSample(latest), [latest]);
  const rows = mode === "demo" ? simRows : parsed?.rows ?? [];
  const tankOk = mode === "demo" ? simTankOk : latest?.tank_ok === 1;
  const pumpOn = mode === "demo" ? simPumpOn : latest?.pump_on === 1;
  const temp = mode === "demo" ? simTemp : latest?.temperature_c ?? null;
  const rh = mode === "demo" ? simRh : latest?.rh_pct ?? null;
  const vpd = mode === "demo" ? simVpd : latest?.vpd_kpa ?? null;
  const soilMoisture = mode === "demo" ? simSoil : parsed?.soil ?? [null, null, null, null];
  const h2 = mode === "demo" ? (simSoil[0] + simSoil[1]) / 2 : parsed?.h2 ?? null;
  const h3 = mode === "demo" ? (simSoil[2] + simSoil[3]) / 2 : parsed?.h3 ?? null;
  const fresh = mode === "live" && !!latest && Date.now() - Date.parse(latest.received_at) < 180000;
  const totalDailyL = rows.reduce((acc, r) => acc + (r.daily_l || 0), 0);

  // Biểu đồ chuỗi thời gian
  const chartPoints =
    mode === "demo"
      ? initialSimSeries
      : history.map((s) => {
          const p = parseSample(s);
          return {
            time: new Date(s.recorded_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            h2: p?.h2 ?? null,
            h3: p?.h3 ?? null,
          };
        });

  // Xử lý gửi lệnh thật hoặc kích hoạt mô phỏng
  const handleExecuteConfirmedAction = async () => {
    const { action, rowId } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, open: false }));

    if (mode === "demo") {
      // Chế độ tập sự mô phỏng tại chỗ
      if (action === "start" && rowId) {
        setSimRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, valve: true, daily_l: r.daily_l + 0.5 } : r)));
        setSimPumpOn(true);
        setSimSoil((prev) => {
          const next = [...prev];
          if (rowId === 2) {
            next[0] = Math.min(80, next[0] + 8);
            next[1] = Math.min(80, next[1] + 8);
          } else if (rowId === 3) {
            next[2] = Math.min(80, next[2] + 8);
            next[3] = Math.min(80, next[3] + 8);
          }
          return next;
        });
        setEvents((prev) => [
          {
            id: Date.now(),
            recorded_at: new Date().toISOString(),
            row: rowId,
            type: "manual_start",
            liters: 0.5,
          },
          ...prev,
        ]);
        setNotice(`[Mô phỏng] Đã mở van Hàng ${rowId} và bật bơm. Nước đang chảy trên sơ đồ!`);
      } else if (action === "stop" && rowId) {
        setSimRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, valve: false } : r)));
        // Tắt bơm nếu tất cả van đóng
        const remaining = simRows.filter((r) => r.id !== rowId && r.valve);
        if (remaining.length === 0) setSimPumpOn(false);
        setEvents((prev) => [
          {
            id: Date.now(),
            recorded_at: new Date().toISOString(),
            row: rowId,
            type: "manual_stop",
            liters: null,
          },
          ...prev,
        ]);
        setNotice(`[Mô phỏng] Đã đóng van Hàng ${rowId}.`);
      } else if (action === "estop") {
        setSimRows((prev) => prev.map((r) => ({ ...r, valve: false })));
        setSimPumpOn(false);
        setNotice("[Mô phỏng] ĐÃ KÍCH HOẠT DỪNG KHẨN CẤP: Toàn bộ van và bơm đã ngắt!");
      }
      return;
    }

    // Chế độ Vận hành Thực tế (Live) qua Worker API
    if (!adminToken) {
      setLoginModalOpen(true);
      setNotice("Yêu cầu nhập Token Quản trị để gửi lệnh điều khiển xuống thiết bị.");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      if (action === "estop") {
        await Promise.all([1, 2, 3].map((r) => request(`admin/commands?device_id=${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop", row: r }),
        })));
        setNotice("ĐÃ PHÁT LỆNH DỪNG KHẨN CẤP CHO TOÀN BỘ 3 HÀNG!");
      } else if (rowId) {
        await request(`admin/commands?device_id=${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, row: rowId }),
        });
        setNotice(`Đã chuyển lệnh ${action === "start" ? "TƯỚI" : "DỪNG"} cho Hàng ${rowId}. Đang chờ STM32 ACK...`);
      }
      setTimeout(refresh, 1500);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  };

  // Mở hộp thoại xác nhận tưới hàng
  const promptStartRow = (rowId: number) => {
    if (!tankOk) {
      alert("CẢNH BÁO AN TOÀN: Bồn nước đang cạn! Không thể bật van hay máy bơm để bảo vệ thiết bị.");
      return;
    }
    setConfirmModal({
      open: true,
      action: "start",
      rowId,
      title: `Xác nhận Kích hoạt Tưới Hàng ${rowId}`,
      details: `Hệ thống sẽ mở van Hàng ${rowId} và kích hoạt bơm 12V. Nước sẽ cấp cho 4 chậu cà chua cho đến khi đủ 2.0 Lít hoặc đạt ngưỡng ẩm tối ưu.`,
    });
  };

  // Mở hộp thoại xác nhận dừng tưới hàng
  const promptStopRow = (rowId: number) => {
    setConfirmModal({
      open: true,
      action: "stop",
      rowId,
      title: `Xác nhận Đóng Van Hàng ${rowId}`,
      details: `Van điện từ Hàng ${rowId} sẽ lập tức đóng lại. Máy bơm sẽ tự động dừng nếu không còn hàng nào khác đang mở.`,
    });
  };

  // Mở hộp thoại Dừng Khẩn Cấp (E-STOP)
  const promptEstop = () => {
    setConfirmModal({
      open: true,
      action: "estop",
      title: "🚨 DỪNG KHẨN CẤP TOÀN BỘ HỆ THỐNG (E-STOP)",
      details: "TẤT CẢ van điện từ 1, 2, 3 và máy bơm chính sẽ bị ngắt điện ngay lập tức. Sử dụng khi có sự cố vỡ đường ống hoặc nguy hiểm điện.",
    });
  };

  // Xử lý lưu token quản trị
  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    setAdminToken(trimmed);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("TOMATO_ADMIN_TOKEN", trimmed);
    }
    setLoginModalOpen(false);
    setNotice("Đã lưu phiên làm việc Quản trị viên.");
    refresh();
  };

  // Đăng xuất
  const handleLogout = () => {
    setAdminToken("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("TOMATO_ADMIN_TOKEN");
    }
    setNotice("Đã đăng xuất phiên làm việc.");
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased selection:bg-emerald-500 selection:text-white flex flex-col">
      {/* 1. TOPBAR VẬN HÀNH CHUẨN HIGH-PERFORMANCE HMI */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Tên hệ thống */}
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center font-black text-xl shadow-inner">
              🍅
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                  HỆ THỐNG TƯỚI CÀ CHUA 3 HÀNG
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  HMI 2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block mt-0.5">
                Giao diện Vận hành & Giám sát Vi khí hậu • Dành cho Công nhân & Kỹ sư
              </p>
            </div>
          </div>

          {/* Thiết bị, Trạng thái & Nút Dừng Khẩn Cấp */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Bộ chọn Thiết bị */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-[11px]">Trạm:</span>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value={device} className="bg-slate-800 text-white">
                  {device}
                </option>
                {devices
                  .filter((d) => d.id !== device)
                  .map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-800 text-white">
                      {d.id}
                    </option>
                  ))}
              </select>
            </div>

            {/* Trạng thái kết nối */}
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border ${
                mode === "demo"
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                  : fresh
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  mode === "demo"
                    ? "bg-amber-400 animate-pulse"
                    : fresh
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-slate-500"
                }`}
              ></span>
              {mode === "demo" ? "Chế độ Tập sự" : fresh ? "Đang trực tuyến" : "Mất mạng 4G"}
            </span>

            {/* Nút DỪNG KHẨN CẤP (E-STOP) */}
            <button
              onClick={promptEstop}
              title="Dừng khẩn cấp toàn bộ hệ thống"
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 ring-2 ring-red-500/30"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DỪNG KHẨN CẤP</span>
            </button>

            {/* Nút Đăng nhập / Đăng xuất Token */}
            {adminToken ? (
              <button
                onClick={handleLogout}
                title="Đăng xuất phiên quản trị"
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Thoát</span>
              </button>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                title="Đăng nhập mã Token quản trị"
                className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/60 px-2.5 py-1.5 rounded-lg border border-emerald-800/80"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. CHUYỂN ĐỔI CHẾ ĐỘ & BẢNG THÔNG BÁO TẬP SỰ */}
      <div className="bg-slate-800 text-slate-200 border-b border-slate-700 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Chế độ vận hành:</span>
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
              <button
                onClick={() => setMode("demo")}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  mode === "demo" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tập sự & Xem mẫu (An toàn)
              </button>
              <button
                onClick={() => setMode("live")}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  mode === "live" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Vận hành Thực tế (Cloudflare D1)
              </button>
            </div>
          </div>

          <div className="text-slate-400 text-[11px] flex items-center gap-3">
            {mode === "demo" ? (
              <span className="text-amber-300 font-medium">
                ⚡ Bạn đang ở chế độ Tập sự: Các thao tác tưới là mô phỏng, không gửi lệnh ra van thật.
              </span>
            ) : (
              <span>
                📡 Dữ liệu đọc từ Cloudflare D1 cluster APAC qua HTTPS.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. ĐIỀU HƯỚNG TABS THEO CHUẨN HMI HIGH-PERFORMANCE */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none">
            <button
              onClick={() => setTab("overview")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "overview"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>Tổng quan & Điều khiển</span>
            </button>

            <button
              onClick={() => setTab("pid")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "pid"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Droplets className="w-4 h-4" />
              <span>Sơ đồ Thủy lực 12 Chậu</span>
            </button>

            <button
              onClick={() => setTab("alarms")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "alarms"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Nhật ký & Xử lý Sự cố</span>
            </button>

            <button
              onClick={() => setTab("guide")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "guide"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Sổ tay Công nhân (SOP)</span>
            </button>

            <button
              onClick={() => setTab("config")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "config"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Cài đặt & Hiệu chuẩn</span>
            </button>

            <button
              onClick={() => setTab("future")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "future"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Mở rộng (AI, Phân bón)</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 4. MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Banner thông báo trạng thái hoặc lỗi */}
        {notice && (
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="text-sky-600 hover:text-sky-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm">
            <span>Lỗi đồng bộ: {error}</span>
            <button onClick={() => setError("")} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: TỔNG QUAN & ĐIỀU KHIỂN ===================== */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* THANH TỔNG QUAN HỆ THỐNG CẤP NƯỚC (LEVEL 1 SITUATIONAL AWARENESS) */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. MỰC NƯỚC BỒN CHỨA */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  tankOk ? "bg-white border-slate-200/90 shadow-sm" : "bg-red-50 border-red-300 shadow-md ring-2 ring-red-400"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bồn Nước 100L</span>
                  <Droplets className={`w-4 h-4 ${tankOk ? "text-sky-500" : "text-red-600 animate-bounce"}`} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black tracking-tight ${tankOk ? "text-slate-800" : "text-red-700"}`}>
                    {tankOk ? "ĐỦ NƯỚC" : "BỒN CẠN!"}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${tankOk ? "bg-sky-500" : "bg-red-500"}`}></span>
                  Phao an toàn: {tankOk ? "Nổi (Bình thường)" : "Chìm (Khóa bơm)"}
                </div>
              </div>

              {/* 2. TRẠNG THÁI MÁY BƠM 12V */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bơm Tăng Áp 12V</span>
                  <Activity className={`w-4 h-4 ${pumpOn ? "text-emerald-500 animate-spin" : "text-slate-400"}`} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black tracking-tight ${pumpOn ? "text-emerald-600" : "text-slate-800"}`}>
                    {pumpOn ? "ĐANG CHẠY" : "ĐANG NGHỈ"}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${pumpOn ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></span>
                  {pumpOn ? "Đang cấp nước cho van mở" : "Tự ngắt khi các van đóng"}
                </div>
              </div>

              {/* 3. VI KHÍ HẬU SHT31 & CHỈ SỐ VPD */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vi Khí Hậu Nhà Màng</span>
                  <Wind className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-800">
                    {temp != null ? `${temp.toFixed(1)}°` : "—"}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    / {rh != null ? `${Math.round(rh)}%` : "—"}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-bold flex items-center justify-between">
                  <span className="text-slate-500">Chỉ số VPD:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      vpd != null && vpd > 1.5
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {vpd != null ? `${vpd.toFixed(2)} kPa` : "—"}
                  </span>
                </div>
              </div>

              {/* 4. TỔNG LƯỢNG NƯỚC ĐÃ TƯỚI HÔM NAY */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng Nước Hôm Nay</span>
                  <Gauge className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-800">{totalDailyL.toFixed(1)}</span>
                  <span className="text-xs font-bold text-slate-400">Lít (3 Hàng)</span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center justify-between">
                  <span>H1: {rows.find((r) => r.id === 1)?.daily_l.toFixed(1) || 0}L</span>
                  <span>H2: {rows.find((r) => r.id === 2)?.daily_l.toFixed(1) || 0}L</span>
                  <span>H3: {rows.find((r) => r.id === 3)?.daily_l.toFixed(1) || 0}L</span>
                </div>
              </div>
            </section>

            {/* 3 THẺ ĐIỀU KHIỂN CHI TIẾT 3 HÀNG CÀ CHUA (LEVEL 2 OPERATION) */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* ================= THẺ HÀNG 1: HẸN GIỜ ================= */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-lg bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center">
                      H1
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        rows.find((r) => r.id === 1)?.valve
                          ? "bg-emerald-100 text-emerald-800 animate-pulse"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rows.find((r) => r.id === 1)?.valve ? "VAN ĐANG MỞ" : "VAN ĐÓNG"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">Hàng 1 — Hẹn Giờ Cố Định</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tưới theo lịch hẹn mỗi ngày (06:00 và 17:00). Định lượng bằng cảm biến lưu lượng YF-S201.
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Lịch tưới cài đặt:</span>
                      <strong className="text-slate-800">
                        {String(config.scheduleHour[0]).padStart(2, "0")}:{String(config.scheduleMinute[0]).padStart(2, "0")} &amp;{" "}
                        {String(config.scheduleHour[1]).padStart(2, "0")}:{String(config.scheduleMinute[1]).padStart(2, "0")}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Mục tiêu thể tích:</span>
                      <strong className="text-slate-800">{config.targetL[0]} Lít / lần</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Nước đã cấp hôm nay:</span>
                      <strong className="text-amber-700 text-sm font-extrabold">
                        {rows.find((r) => r.id === 1)?.daily_l.toFixed(2) || "0.00"} L
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Nút thao tác to bản cho công nhân */}
                <div className="mt-5 grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                  <button
                    disabled={!tankOk || busy || rows.find((r) => r.id === 1)?.valve}
                    onClick={() => promptStartRow(1)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Tưới ngay
                  </button>
                  <button
                    disabled={busy || !rows.find((r) => r.id === 1)?.valve}
                    onClick={() => promptStopRow(1)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all disabled:opacity-40"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Dừng
                  </button>
                </div>
              </div>

              {/* ================= THẺ HÀNG 2: THEO ĐỘ ẨM ĐẤT ================= */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center">
                      H2
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        rows.find((r) => r.id === 2)?.valve
                          ? "bg-emerald-100 text-emerald-800 animate-pulse"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rows.find((r) => r.id === 2)?.valve ? "VAN ĐANG MỞ" : "VAN ĐÓNG"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">Hàng 2 — Theo Độ Ẩm Đất</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tưới tự động dựa trên độ ẩm trung bình chậu 1 và chậu 3. Ngắt khi đủ ẩm hoặc đủ 2L.
                  </p>

                  {/* Thanh đo trực quan mức ẩm đất */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600 font-medium">Độ ẩm đất trung bình:</span>
                      <strong className="text-base font-black text-slate-800">
                        {h2 != null ? `${h2.toFixed(1)}%` : "—"}
                      </strong>
                    </div>

                    {/* Gauge bar */}
                    <div className="w-full h-3 rounded-full bg-slate-200 relative overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          h2 != null && h2 < config.low[0]
                            ? "bg-amber-500"
                            : h2 != null && h2 > config.high[0]
                            ? "bg-sky-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, h2 ?? 0))}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>Ngưỡng bật: &lt;{config.low[0]}%</span>
                      <span>Ngưỡng tắt: &gt;{config.high[0]}%</span>
                    </div>

                    <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                      <span>Nước đã cấp hôm nay:</span>
                      <strong className="text-emerald-700 text-sm font-extrabold">
                        {rows.find((r) => r.id === 2)?.daily_l.toFixed(2) || "0.00"} L
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                  <button
                    disabled={!tankOk || busy || rows.find((r) => r.id === 2)?.valve}
                    onClick={() => promptStartRow(2)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Tưới ngay
                  </button>
                  <button
                    disabled={busy || !rows.find((r) => r.id === 2)?.valve}
                    onClick={() => promptStopRow(2)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all disabled:opacity-40"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Dừng
                  </button>
                </div>
              </div>

              {/* ================= THẺ HÀNG 3: ĐA CẢM BIẾN & VPD ================= */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-lg bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center">
                      H3
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        rows.find((r) => r.id === 3)?.valve
                          ? "bg-emerald-100 text-emerald-800 animate-pulse"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rows.find((r) => r.id === 3)?.valve ? "VAN ĐANG MỞ" : "VAN ĐÓNG"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">Hàng 3 — Đa Cảm Biến &amp; VPD</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phương pháp thông minh nhất: Kết hợp độ ẩm đất và chỉ số vi khí hậu VPD để tự bù nước khi trời nắng gắt.
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600 font-medium">Độ ẩm đất trung bình:</span>
                      <strong className="text-base font-black text-slate-800">
                        {h3 != null ? `${h3.toFixed(1)}%` : "—"}
                      </strong>
                    </div>

                    {/* Gauge bar */}
                    <div className="w-full h-3 rounded-full bg-slate-200 relative overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          h3 != null && h3 < config.low[1]
                            ? "bg-amber-500"
                            : h3 != null && h3 > config.high[1]
                            ? "bg-sky-500"
                            : "bg-teal-600"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, h3 ?? 0))}%` }}
                      ></div>
                    </div>

                    {/* Huy hiệu bù trừ thời tiết thông minh */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px]">
                      <span className="font-semibold text-indigo-900">
                        {vpd != null && vpd >= config.vpdHot ? "🔥 Nắng gắt (Bù ẩm)" : "🌤 Khí hậu thuận lợi"}
                      </span>
                      <span className="font-extrabold text-indigo-700">
                        {vpd != null && vpd >= config.vpdHot ? `+${config.vpdThresholdBoost}% ngưỡng ẩm` : "Chuẩn"}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                      <span>Nước đã cấp hôm nay:</span>
                      <strong className="text-teal-700 text-sm font-extrabold">
                        {rows.find((r) => r.id === 3)?.daily_l.toFixed(2) || "0.00"} L
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                  <button
                    disabled={!tankOk || busy || rows.find((r) => r.id === 3)?.valve}
                    onClick={() => promptStartRow(3)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Tưới ngay
                  </button>
                  <button
                    disabled={busy || !rows.find((r) => r.id === 3)?.valve}
                    onClick={() => promptStopRow(3)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all disabled:opacity-40"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Dừng
                  </button>
                </div>
              </div>
            </section>

            {/* BIỂU ĐỒ DIỄN BIẾN ĐỘ ẨM THEO THỜI GIAN */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Biểu đồ Diễn biến Độ ẩm Đất 24 Giờ</h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi trực quan sự thay đổi độ ẩm giữa Hàng 2 (Độ ẩm đất đơn thuần) và Hàng 3 (Tích hợp VPD)
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-600"></span> Hàng 2
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600"></span> Hàng 3
                  </span>
                </div>
              </div>

              {chartPoints.length > 0 ? (
                <LineChart points={chartPoints} />
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs">Chưa có đủ mẫu đo để vẽ biểu đồ</div>
              )}
            </section>
          </div>
        )}

        {/* ===================== TAB 2: SƠ ĐỒ THỦY LỰC P&ID ===================== */}
        {tab === "pid" && (
          <HydraulicPID
            rows={rows}
            tankOk={tankOk}
            pumpOn={pumpOn}
            soilMoisture={soilMoisture}
            tempC={temp}
            rhPct={rh}
            vpdKpa={vpd}
            onTriggerRow={(id) => {
              const isValveActive = rows.find((r) => r.id === id)?.valve;
              if (isValveActive) {
                promptStopRow(id);
              } else {
                promptStartRow(id);
              }
            }}
            canOperate={mode === "demo" || !!adminToken}
          />
        )}

        {/* ===================== TAB 3: NHẬT KÝ & CẢNH BÁO ===================== */}
        {tab === "alarms" && (
          <HmiAlarms
            events={events}
            tankOk={tankOk}
            onClearFault={() => {
              if (mode === "demo") {
                setSimTankOk(true);
                setNotice("[Mô phỏng] Đã xóa cảnh báo bồn cạn.");
              } else {
                setNotice("Lệnh xóa sự cố đã gửi tới bộ điều khiển.");
              }
            }}
            canOperate={mode === "demo" || !!adminToken}
          />
        )}

        {/* ===================== TAB 4: SỔ TAY CÔNG NHÂN (SOP) ===================== */}
        {tab === "guide" && <HmiGuide />}

        {/* ===================== TAB 5: CÀI ĐẶT & HIỆU CHUẨN ===================== */}
        {tab === "config" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Cài đặt Thông số &amp; Hiệu chuẩn</h3>
                <p className="text-xs text-slate-500">
                  Phiên bản cấu hình hiện tại: v{version}. STM32 tự động đồng bộ khi có phiên bản mới.
                </p>
              </div>

              <button
                disabled={mode === "demo" || !adminToken || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await request<{ version: number }>(`admin/config?device_id=${query}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(config),
                    });
                    setVersion(r.version);
                    setNotice(`Đã lưu cấu hình v${r.version} thành công! Thiết bị sẽ tải về.`);
                  } catch (e) {
                    setNotice(e instanceof Error ? e.message : "Lỗi lưu cấu hình");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40"
              >
                Lưu cấu hình lên Cloudflare
              </button>
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cột 1: Hàng 1 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-sm text-slate-800">Hàng 1 — Lịch Hẹn Giờ</h4>
                <div className="space-y-2 text-xs">
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Giờ tưới lần 1:</span>
                    <input
                      type="time"
                      value={`${String(config.scheduleHour[0]).padStart(2, "0")}:${String(config.scheduleMinute[0]).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        setConfig((c) => ({
                          ...c,
                          scheduleHour: [h, c.scheduleHour[1]],
                          scheduleMinute: [m, c.scheduleMinute[1]],
                        }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Giờ tưới lần 2:</span>
                    <input
                      type="time"
                      value={`${String(config.scheduleHour[1]).padStart(2, "0")}:${String(config.scheduleMinute[1]).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        setConfig((c) => ({
                          ...c,
                          scheduleHour: [c.scheduleHour[0], h],
                          scheduleMinute: [c.scheduleMinute[0], m],
                        }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Thể tích mục tiêu (Lít):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={config.targetL[0]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, targetL: [val, c.targetL[1], c.targetL[2]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                </div>
              </div>

              {/* Cột 2: Hàng 2 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-sm text-slate-800">Hàng 2 — Ngưỡng Độ Ẩm</h4>
                <div className="space-y-2 text-xs">
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Ngưỡng mở van Low (%):</span>
                    <input
                      type="number"
                      value={config.low[0]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, low: [val, c.low[1]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Ngưỡng đóng van High (%):</span>
                    <input
                      type="number"
                      value={config.high[0]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, high: [val, c.high[1]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Thể tích tối đa (Lít):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={config.targetL[1]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, targetL: [c.targetL[0], val, c.targetL[2]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                </div>
              </div>

              {/* Cột 3: Hàng 3 & VPD */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-sm text-slate-800">Hàng 3 — Bù Khí Hậu VPD</h4>
                <div className="space-y-2 text-xs">
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Ngưỡng VPD Nóng (kPa):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={config.vpdHot}
                      onChange={(e) => setConfig((c) => ({ ...c, vpdHot: Number(e.target.value) }))}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Tăng ngưỡng ẩm (%):</span>
                    <input
                      type="number"
                      value={config.vpdThresholdBoost}
                      onChange={(e) => setConfig((c) => ({ ...c, vpdThresholdBoost: Number(e.target.value) }))}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Tăng lượng nước (tỉ lệ):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={config.vpdVolumeBoost}
                      onChange={(e) => setConfig((c) => ({ ...c, vpdVolumeBoost: Number(e.target.value) }))}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 6: MỞ RỘNG TƯƠNG LAI ===================== */}
        {tab === "future" && <HmiFuture />}
      </main>

      {/* 5. MODAL XÁC NHẬN THAO TÁC CHO CÔNG NHÂN */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  confirmModal.action === "estop"
                    ? "bg-red-100 text-red-600"
                    : confirmModal.action === "start"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {confirmModal.action === "estop" ? (
                  <AlertOctagon className="w-6 h-6" />
                ) : confirmModal.action === "start" ? (
                  <Play className="w-5 h-5 fill-current" />
                ) : (
                  <Square className="w-5 h-5 fill-current" />
                )}
              </div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {confirmModal.title}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {confirmModal.details}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                  confirmModal.action === "estop"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {confirmModal.action === "estop" ? "Xác nhận Dừng Ngay" : "Xác nhận Thực hiện"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐĂNG NHẬP TOKEN BẢO MẬT */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Đăng Nhập Quản Trị Viên</h3>
              </div>
              <button onClick={() => setLoginModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Nhập mã <strong>ADMIN_TOKEN</strong> để kích hoạt quyền gửi lệnh tưới thủ công và lưu thông số cấu hình. Mã token chỉ lưu tạm thời trong phiên làm việc của tab trình duyệt này (sessionStorage).
            </p>

            <input
              type="password"
              placeholder="Dán mã ADMIN_TOKEN tại đây..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 mb-4 focus:outline-emerald-600 font-mono"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setLoginModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600"
              >
                Đóng
              </button>
              <button
                onClick={handleSaveToken}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
              >
                Lưu &amp; Kích hoạt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
      <footer className="bg-white border-t border-slate-200 text-slate-400 text-[11px] py-4 text-center">
        Dự án Nghiên cứu Hệ thống Tưới Tự Động 3 Hàng Cà Chua (12 Chậu) • Học viện Nông nghiệp Việt Nam (HVNN) • 2026
      </footer>
    </div>
  );
}
