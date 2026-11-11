"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Droplets,
  Eye,
  EyeOff,
  Gauge,
  Key,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Map,
  Play,
  Power,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  Square,
  Thermometer,
  TrendingDown,
  Unlock,
  User,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { CommandItem, Config, Device, EventItem, Row, Sample } from "./hmi-types";
import { ALARM_REGISTRY, defaultConfig } from "./hmi-types";
import HydraulicPID from "./hmi-hydraulic-pid";
import HmiGardenMap from "./hmi-garden-map";
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

// Đồ họa bồn nước SVG thích ứng theo phong cách ThingsBoard IoT
function SvgWaterTank({ tankOk }: { tankOk: boolean | null }) {
  const isOk = tankOk === true;
  const isEmpty = tankOk === false;
  const isWaiting = tankOk === null;

  const waterHeight = isWaiting ? 45 : isEmpty ? 12 : 75; // percentage
  const waterColor = isWaiting ? "#94a3b8" : isEmpty ? "#ef4444" : "#0284c7";
  const waterLight = isWaiting ? "#cbd5e1" : isEmpty ? "#fca5a5" : "#38bdf8";

  return (
    <svg width="42" height="50" viewBox="0 0 42 50" className="shrink-0 overflow-visible" role="img" aria-label="Mực nước bồn">
      <defs>
        <clipPath id="tank-body-clip">
          <rect x="5" y="7" width="32" height="38" rx="4" />
        </clipPath>
      </defs>
      {/* Nắp bồn */}
      <rect x="13" y="2" width="16" height="4" rx="2" fill="#64748b" />
      {/* Thân bồn chứa hình trụ */}
      <rect x="4" y="6" width="34" height="40" rx="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
      {/* Vạch đo dung tích bồn */}
      <line x1="8" y1="14" x2="12" y2="14" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="8" y1="23" x2="15" y2="23" stroke="#cbd5e1" strokeWidth="1.5" />
      <line x1="8" y1="32" x2="12" y2="32" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="8" y1="40" x2="15" y2="40" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* Mực nước dâng */}
      <g clipPath="url(#tank-body-clip)">
        <rect
          x="5"
          y={46 - (waterHeight * 38) / 100}
          width="32"
          height={(waterHeight * 38) / 100}
          fill={waterColor}
          opacity="0.85"
        />
        {/* Sóng nước */}
        <path
          d={`M 5 ${46 - (waterHeight * 38) / 100} Q 13 ${44 - (waterHeight * 38) / 100} 21 ${46 - (waterHeight * 38) / 100} T 37 ${46 - (waterHeight * 38) / 100} L 37 47 L 5 47 Z`}
          fill={waterLight}
          opacity="0.6"
        />
      </g>
      {/* Phao cảm biến chống cạn */}
      <circle
        cx="29"
        cy={isWaiting ? 25 : isEmpty ? 40 : 15}
        r="3.5"
        fill={isWaiting ? "#94a3b8" : isEmpty ? "#dc2626" : "#10b981"}
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <line
        x1="29"
        y1="6"
        x2="29"
        y2={isWaiting ? 25 : isEmpty ? 40 : 15}
        stroke="#64748b"
        strokeWidth="1"
        strokeDasharray="1.5 1.5"
      />
    </svg>
  );
}

function LineChart({
  points,
  lowThreshold = 35,
  highThreshold = 55,
}: {
  points: { time: string; h2: number | null; h3: number | null }[];
  lowThreshold?: number;
  highThreshold?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
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

  const hoverPoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : null;

  return (
    <div className="w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair"
        role="img"
        aria-label="Biểu đồ độ ẩm đất"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = ((e.clientX - rect.left) / rect.width) * width;
          if (mouseX >= left && mouseX <= width - right && points.length > 1) {
            const ratio = (mouseX - left) / (width - left - right);
            const idx = Math.round(ratio * (points.length - 1));
            setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
          }
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Vùng tối ưu (Optimal moisture zone) */}
        <rect
          x={left}
          y={y(highThreshold)}
          width={width - left - right}
          height={Math.max(0, y(lowThreshold) - y(highThreshold))}
          fill="#10b981"
          opacity="0.05"
        />

        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="4 5" />
            <text x="6" y={y(v) + 4} fontSize="11" fill="#94a3b8" fontWeight="600">
              {v}%
            </text>
          </g>
        ))}

        {/* Đường ngưỡng cảnh báo Low/High */}
        <line x1={left} x2={width - right} y1={y(lowThreshold)} y2={y(lowThreshold)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
        <text x={width - right} y={y(lowThreshold) - 3} textAnchor="end" fontSize="10" fill="#d97706" fontWeight="bold">
          Bật tưới (&lt;{lowThreshold}%)
        </text>

        <line x1={left} x2={width - right} y1={y(highThreshold)} y2={y(highThreshold)} stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
        <text x={width - right} y={y(highThreshold) - 3} textAnchor="end" fontSize="10" fill="#059669" fontWeight="bold">
          Đủ ẩm (&gt;{highThreshold}%)
        </text>

        <path d={path("h2")} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path("h3")} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Cột mốc hover tương tác */}
        {hoverIdx !== null && hoverPoint && (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={top}
              y2={height - bottom}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            {hoverPoint.h2 != null && (
              <circle cx={x(hoverIdx)} cy={y(hoverPoint.h2)} r="4.5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
            )}
            {hoverPoint.h3 != null && (
              <circle cx={x(hoverIdx)} cy={y(hoverPoint.h3)} r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
            )}
          </g>
        )}

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

      {/* Tooltip hiển thị số liệu khi di chuột */}
      {hoverPoint && hoverIdx !== null && (
        <div className="mt-2 py-1.5 px-3 bg-slate-900 text-white rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
          <span className="font-semibold text-slate-300">Thời điểm: <strong className="text-white">{hoverPoint.time}</strong></span>
          <div className="flex items-center gap-3">
            <span className="text-amber-400 font-bold">Hàng 2: {hoverPoint.h2 != null ? `${hoverPoint.h2.toFixed(1)}%` : "—"}</span>
            <span className="text-emerald-400 font-bold">Hàng 3: {hoverPoint.h3 != null ? `${hoverPoint.h3.toFixed(1)}%` : "—"}</span>
            {hoverPoint.h2 != null && hoverPoint.h3 != null && (
              <span className="text-sky-300 font-semibold text-[11px]">
                Chênh lệch Δ: {(hoverPoint.h3 - hoverPoint.h2).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
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
  const [tab, setTab] = useState<"overview" | "map2d" | "pid" | "alarms" | "config" | "guide" | "future">("overview");
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [device, setDevice] = useState("stm32_01");
  const [devices, setDevices] = useState<Device[]>([]);
  const [latest, setLatest] = useState<Sample | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [simEvents, setSimEvents] = useState<EventItem[]>(initialSimEvents);
  const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
  const events = mode === "demo" ? simEvents : liveEvents;
  const [commandQueue, setCommandQueue] = useState<CommandItem[]>([]);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [version, setVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Quản lý Tài khoản & Đăng nhập
  const [adminToken, setAdminToken] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"account" | "token">("account");
  const [usernameInput, setUsernameInput] = useState("admin");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState("");

  // Modal đổi mật khẩu
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [oldPassInput, setOldPassInput] = useState("");
  const [newPassInput, setNewPassInput] = useState("");
  const [confirmPassInput, setConfirmPassInput] = useState("");
  const [changePassError, setChangePassError] = useState("");

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

  // Đọc token từ storage khi khởi tạo
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("TOMATO_ADMIN_TOKEN") || localStorage.getItem("TOMATO_ADMIN_TOKEN");
      if (saved) {
        setAdminToken(saved);
        // Kiểm tra phiên đăng nhập với Worker API
        fetch(`${CLOUDFLARE_WORKER_API}/auth/me`, {
          headers: { Authorization: `Bearer ${saved}` },
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.authenticated && d.user) {
              setCurrentUser(d.user);
            }
          })
          .catch(() => {});
      }
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
        const [latRes, hisRes, evtRes, cmdRes] = await Promise.all([
          request<{ telemetry: Sample | null }>(`admin/latest?device_id=${query}`).catch(() => ({ telemetry: null })),
          request<{ samples: Sample[] }>(`admin/history?device_id=${query}`).catch(() => ({ samples: [] })),
          request<{ events: EventItem[] }>(`admin/events?device_id=${query}`).catch(() => ({ events: [] })),
          request<{ commands: CommandItem[] }>(`admin/commands?device_id=${query}`).catch(() => ({ commands: [] })),
        ]);
        setLatest(latRes.telemetry);
        setHistory(hisRes.samples || []);
        setLiveEvents(evtRes.events || []);
        setCommandQueue(cmdRes.commands || []);
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
  const tankOk = mode === "demo" ? simTankOk : (latest ? latest.tank_ok === 1 : null);
  const pumpOn = mode === "demo" ? simPumpOn : latest?.pump_on === 1;
  const temp = mode === "demo" ? simTemp : latest?.temperature_c ?? null;
  const rh = mode === "demo" ? simRh : latest?.rh_pct ?? null;
  const vpd = mode === "demo" ? simVpd : latest?.vpd_kpa ?? null;
  const soilMoisture = mode === "demo" ? simSoil : parsed?.soil ?? [null, null, null, null];
  const h2 = mode === "demo" ? (simSoil[0] + simSoil[1]) / 2 : parsed?.h2 ?? null;
  const h3 = mode === "demo" ? (simSoil[2] + simSoil[3]) / 2 : parsed?.h3 ?? null;
  const fresh = mode === "live" && !!latest && Date.now() - Date.parse(latest.received_at) < 180000;
  const totalDailyL = rows.reduce((acc, r) => acc + (r.daily_l || 0), 0);

  // Tính toán so sánh nước giữa 3 hàng
  const row1L = rows.find((r) => r.id === 1)?.daily_l ?? 0;
  const row2L = rows.find((r) => r.id === 2)?.daily_l ?? 0;
  const row3L = rows.find((r) => r.id === 3)?.daily_l ?? 0;

  const row2SavingsPct = row1L > 0 ? ((row1L - row2L) / row1L) * 100 : null;
  const row3SavingsPct = row1L > 0 ? ((row1L - row3L) / row1L) * 100 : null;

  // Xuất tập tin CSV dữ liệu đo đạc có kèm UTF-8 BOM
  const handleExportCsv = () => {
    const rowsData: (string | number)[][] = [
      ["Thời gian", "Thiết bị", "Nước Hàng 1 (L)", "Nước Hàng 2 (L)", "Nước Hàng 3 (L)", "Tổng Nước (L)", "Nhiệt độ (°C)", "Độ ẩm KK (%)", "VPD (kPa)", "Độ ẩm Đất S1 (%)", "Độ ẩm Đất S2 (%)", "Độ ẩm Đất S3 (%)", "Độ ẩm Đất S4 (%)", "Phao Bồn", "Bơm 12V"]
    ];

    if (mode === "live" && history.length > 0) {
      history.forEach((s) => {
        const p = parseSample(s);
        const soil = p?.soil ?? [null, null, null, null];
        const rws = p?.rows ?? [];
        const h1Val = rws.find((r) => r.id === 1)?.daily_l ?? 0;
        const h2Val = rws.find((r) => r.id === 2)?.daily_l ?? 0;
        const h3Val = rws.find((r) => r.id === 3)?.daily_l ?? 0;
        const tot = h1Val + h2Val + h3Val;
        rowsData.push([
          new Date(s.recorded_at).toLocaleString("vi-VN"),
          device,
          h1Val.toFixed(2),
          h2Val.toFixed(2),
          h3Val.toFixed(2),
          tot.toFixed(2),
          s.temperature_c != null ? s.temperature_c.toFixed(1) : "",
          s.rh_pct != null ? s.rh_pct.toFixed(0) : "",
          s.vpd_kpa != null ? s.vpd_kpa.toFixed(2) : "",
          soil[0] != null ? soil[0].toFixed(1) : "",
          soil[1] != null ? soil[1].toFixed(1) : "",
          soil[2] != null ? soil[2].toFixed(1) : "",
          soil[3] != null ? soil[3].toFixed(1) : "",
          s.tank_ok === 1 ? "ĐỦ NƯỚC" : "BỒN CẠN",
          s.pump_on === 1 ? "BẬT" : "TẮT"
        ]);
      });
    } else {
      chartPoints.forEach((pt) => {
        rowsData.push([
          pt.time,
          "stm32_01 (demo)",
          "4.80",
          "3.20",
          "5.70",
          "13.70",
          "31.2",
          "68",
          "1.45",
          pt.h2 != null ? pt.h2.toFixed(1) : "45.0",
          pt.h2 != null ? pt.h2.toFixed(1) : "45.0",
          pt.h3 != null ? pt.h3.toFixed(1) : "50.0",
          pt.h3 != null ? pt.h3.toFixed(1) : "50.0",
          "ĐỦ NƯỚC",
          "TẮT"
        ]);
      });
    }

    const csvContent = "\uFEFF" + rowsData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `du_lieu_tuoi_ca_chua_${device}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice("Đã xuất tập tin dữ liệu CSV thành công!");
  };

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
        setSimEvents((prev) => [
          {
            id: Date.now(),
            recorded_at: new Date().toISOString(),
            row: rowId,
            type: "manual_start",
            liters: 0.5,
          },
          ...prev,
        ]);
        setCommandQueue((prev) => [
          {
            id: Date.now(),
            action: "start",
            row: rowId,
            status: "acked",
            created_at: new Date().toISOString(),
            acked_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setNotice(`[Mô phỏng] Đã mở van Hàng ${rowId} và bật bơm. Nước đang chảy trên sơ đồ!`);
      } else if (action === "stop" && rowId) {
        setSimRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, valve: false } : r)));
        const remaining = simRows.filter((r) => r.id !== rowId && r.valve);
        if (remaining.length === 0) setSimPumpOn(false);
        setSimEvents((prev) => [
          {
            id: Date.now(),
            recorded_at: new Date().toISOString(),
            row: rowId,
            type: "manual_stop",
            liters: null,
          },
          ...prev,
        ]);
        setCommandQueue((prev) => [
          {
            id: Date.now(),
            action: "stop",
            row: rowId,
            status: "acked",
            created_at: new Date().toISOString(),
            acked_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setNotice(`[Mô phỏng] Đã đóng van Hàng ${rowId}.`);
      } else if (action === "estop") {
        setSimRows((prev) => prev.map((r) => ({ ...r, valve: false })));
        setSimPumpOn(false);
        setSimEvents((prev) => [
          {
            id: Date.now(),
            recorded_at: new Date().toISOString(),
            row: 0,
            type: "manual_stop",
            liters: null,
          },
          ...prev,
        ]);
        setCommandQueue((prev) => [
          { id: Date.now(), action: "stop", row: 1, status: "acked", created_at: new Date().toISOString(), acked_at: new Date().toISOString() },
          { id: Date.now() + 1, action: "stop", row: 2, status: "acked", created_at: new Date().toISOString(), acked_at: new Date().toISOString() },
          { id: Date.now() + 2, action: "stop", row: 3, status: "acked", created_at: new Date().toISOString(), acked_at: new Date().toISOString() },
          ...prev,
        ]);
        setNotice("[Mô phỏng] ĐÃ KÍCH HOẠT DỪNG KHẨN CẤP: Toàn bộ van và bơm đã ngắt!");
      }
      return;
    }

    // Chế độ Vận hành Thực tế (Live) qua Worker API
    if (!adminToken) {
      setLoginModalOpen(true);
      setNotice("Yêu cầu đăng nhập tài khoản để điều khiển thiết bị.");
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
        setNotice("ĐÃ PHÁT LỆNH DỪNG KHẨN CẤP QUA 4G CHO TOÀN BỘ 3 HÀNG! Kiểm tra hàng đợi lệnh bên dưới.");
      } else if (rowId) {
        const cmd = await request<{ id: number; status: string }>(`admin/commands?device_id=${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, row: rowId }),
        });
        setNotice(`Đã chuyển lệnh ${action === "start" ? "TƯỚI" : "DỪNG"} cho Hàng ${rowId} (Lệnh #${cmd.id}). Đang chờ STM32 ACK...`);
      }
      setTimeout(refresh, 1500);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  };

  const promptStartRow = (rowId: number) => {
    if (tankOk === false) {
      alert("CẢNH BÁO AN TOÀN: Bồn nước đang cạn (phao báo chìm)! Không thể bật van hay máy bơm để bảo vệ thiết bị.");
      return;
    }
    if (tankOk === null && mode === "live") {
      alert("THÔNG BÁO: Đang chờ bản tin đầu tiên từ bộ điều khiển STM32. Vui lòng chờ thiết bị gửi dữ liệu trước khi phát lệnh tưới.");
      return;
    }
    setConfirmModal({
      open: true,
      action: "start",
      rowId,
      title: `Xác nhận Kích hoạt Tưới Hàng ${rowId}`,
      details: `Hệ thống sẽ mở van Hàng ${rowId} và kích hoạt bơm 12V. Nước sẽ cấp cho 4 chậu cà chua cho đến khi đủ ${config.targetL[rowId - 1]} Lít hoặc đạt ngưỡng ẩm tối ưu.`,
    });
  };

  const promptStopRow = (rowId: number) => {
    setConfirmModal({
      open: true,
      action: "stop",
      rowId,
      title: `Xác nhận Đóng Van Hàng ${rowId}`,
      details: `Van điện từ Hàng ${rowId} sẽ lập tức đóng lại. Máy bơm sẽ tự động dừng nếu không còn hàng nào khác đang mở.`,
    });
  };

  const promptEstop = () => {
    setConfirmModal({
      open: true,
      action: "estop",
      title: "🚨 DỪNG KHẨN CẤP QUA MẠNG 4G (E-STOP)",
      details: "Hệ thống sẽ phát ngay lệnh ngắt đồng thời cả 3 van điện từ và ngắt máy bơm chính qua Cloudflare D1.\n\n⚠️ LƯU Ý AN TOÀN QUAN TRỌNG: Đây là lệnh dừng phần mềm từ xa qua 4G. Nếu phát hiện sự cố nguy hiểm đến tính mạng (rò điện 220V, chập cháy hoặc vỡ đường ống chính áp lực cao tại chỗ), công nhân PHẢI gạt ngay Aptomat nguồn điện tổng tại tủ điều khiển!",
    });
  };

  // Xử lý đăng nhập tài khoản
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError("");
    setBusy(true);

    if (loginMode === "token") {
      const trimmed = tokenInput.trim();
      if (!trimmed) {
        setAuthError("Vui lòng dán mã Token Quản trị");
        setBusy(false);
        return;
      }
      setAdminToken(trimmed);
      setCurrentUser({ username: "Kỹ sư (Token)", role: "admin" });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("TOMATO_ADMIN_TOKEN", trimmed);
      }
      setLoginModalOpen(false);
      setNotice("Đã kích hoạt quyền Quản trị bằng Token.");
      setBusy(false);
      refresh();
      return;
    }

    try {
      const res = await fetch(`${CLOUDFLARE_WORKER_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Tên đăng nhập hoặc mật khẩu không đúng");
      }
      setAdminToken(data.token);
      setCurrentUser({ username: data.username, role: data.role });
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("TOMATO_ADMIN_TOKEN", data.token);
        }
        sessionStorage.setItem("TOMATO_ADMIN_TOKEN", data.token);
      }
      setLoginModalOpen(false);
      setPasswordInput("");
      setNotice(`Xin chào ${data.username}! Bạn đã đăng nhập thành công.`);
      refresh();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  };

  // Xử lý đổi mật khẩu
  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setChangePassError("");
    if (newPassInput.length < 8) {
      setChangePassError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setChangePassError("Xác nhận mật khẩu mới không khớp.");
      return;
    }
    setBusy(true);
    try {
      await request<{ success: boolean; message?: string }>("auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldPassInput,
          new_password: newPassInput,
        }),
      });
      setChangePassOpen(false);
      setOldPassInput("");
      setNewPassInput("");
      setConfirmPassInput("");
      setNotice("Đã cập nhật mật khẩu mới trên Cloudflare thành công!");
    } catch (err) {
      setChangePassError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại");
    } finally {
      setBusy(false);
    }
  };

  // Đăng xuất
  const handleLogout = async () => {
    if (adminToken) {
      try {
        await fetch(`${CLOUDFLARE_WORKER_API}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {}
    }
    setAdminToken("");
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("TOMATO_ADMIN_TOKEN");
      localStorage.removeItem("TOMATO_ADMIN_TOKEN");
    }
    setNotice("Đã đăng xuất tài khoản an toàn.");
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
          <div className="flex items-center gap-2 sm:gap-3">
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
              <span className="hidden sm:inline">E-STOP</span>
            </button>

            {/* TÀI KHOẢN NGƯỜI DÙNG */}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-xs bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold">{currentUser.username}</span>
                </div>
                <button
                  onClick={() => setChangePassOpen(true)}
                  title="Đổi mật khẩu tài khoản"
                  className="hidden sm:inline-block text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg border border-slate-700 font-medium"
                >
                  Đổi MK
                </button>
                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200 bg-red-950/50 hover:bg-red-900/60 px-2.5 py-1.5 rounded-lg border border-red-800/60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Thoát</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                title="Đăng nhập tài khoản quản trị"
                className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
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
                📡 Dữ liệu đọc trực tiếp từ Cloudflare D1 cluster APAC qua HTTPS.
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
              <span>Tổng quan &amp; Sơ đồ 2D Vườn</span>
            </button>

            <button
              onClick={() => setTab("map2d")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tab === "map2d"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Bản đồ 2D Vườn & Sự cố</span>
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
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  tankOk === null
                    ? "bg-white border-slate-200/90 shadow-sm"
                    : tankOk
                    ? "bg-white border-slate-200/90 shadow-sm"
                    : "bg-red-50 border-red-300 shadow-md ring-2 ring-red-400"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bồn Nước 100L</span>
                  <Droplets
                    className={`w-4 h-4 ${
                      tankOk === null
                        ? "text-slate-400"
                        : tankOk
                        ? "text-sky-500"
                        : "text-red-600 animate-bounce"
                    }`}
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-black tracking-tight ${
                      tankOk === null ? "text-slate-500" : tankOk ? "text-slate-800" : "text-red-700"
                    }`}
                  >
                    {tankOk === null ? "CHỜ ĐO" : tankOk ? "ĐỦ NƯỚC" : "BỒN CẠN!"}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      tankOk === null ? "bg-slate-300" : tankOk ? "bg-sky-500" : "bg-red-500"
                    }`}
                  ></span>
                  {tankOk === null
                    ? "Chờ bản tin thiết bị"
                    : `Phao an toàn: ${tankOk ? "Nổi (Bình thường)" : "Chìm (Khóa bơm)"}`}
                </div>
              </div>

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

            {/* SƠ ĐỒ 2D MẶT BẰNG NHÀ MÀNG & TRỰC QUAN CẢM BIẾN CÔNG NGHỆ CAO */}
            <section>
              <HmiGardenMap
                rows={rows}
                tankOk={tankOk}
                pumpOn={pumpOn}
                soilMoisture={soilMoisture}
                tempC={temp}
                rhPct={rh}
                vpdKpa={vpd}
                events={events}
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
            </section>

            {/* 3 THẺ ĐIỀU KHIỂN CHI TIẾT 3 HÀNG CÀ CHUA */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* ================= THẺ HÀNG 1 ================= */}
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

                <div className="mt-5 grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
                  <button
                    disabled={tankOk === false || (tankOk === null && mode === "live") || busy || rows.find((r) => r.id === 1)?.valve}
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

              {/* ================= THẺ HÀNG 2 ================= */}
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

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600 font-medium">Độ ẩm đất trung bình:</span>
                      <strong className="text-base font-black text-slate-800">
                        {h2 != null ? `${h2.toFixed(1)}%` : "—"}
                      </strong>
                    </div>

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
                    disabled={tankOk === false || (tankOk === null && mode === "live") || busy || rows.find((r) => r.id === 2)?.valve}
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

              {/* ================= THẺ HÀNG 3 ================= */}
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
                    disabled={tankOk === false || (tankOk === null && mode === "live") || busy || rows.find((r) => r.id === 3)?.valve}
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

            {/* 4. SO SÁNH HIỆU QUẢ SỬ DỤNG NƯỚC GIỮA 3 PHƯƠNG PHÁP & XUẤT CSV */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      📊
                    </span>
                    <h3 className="text-base font-bold text-slate-800">
                      So Sánh Hiệu Quả Sử Dụng Nước Giữa 3 Phương Pháp Tưới
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Số liệu thực nghiệm đề tài nghiên cứu: Đánh giá thể tích nước cấp (Lít) và mức độ tiết kiệm nước so với Hàng 1 (Hẹn giờ cố định).
                  </p>
                </div>

                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="Xuất bảng số liệu đo đạc chi tiết dạng CSV có định dạng UTF-8"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Xuất Dữ Liệu Đo Đạc (CSV)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                {/* Hàng 1: Hẹn giờ cố định */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-slate-700">Hàng 1 — Hẹn Giờ Cố Định</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">Đối chứng</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800 mb-1">
                      {row1L.toFixed(2)} <span className="text-xs font-semibold text-slate-500">Lít/ngày</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Tưới theo khung giờ cố định 06:00 &amp; 17:00. Tiêu thụ làm mốc đối chứng (100%).
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] font-semibold text-slate-500">
                    Mức tiết kiệm: <span className="text-slate-700 font-bold">Mốc chuẩn (0%)</span>
                  </div>
                </div>

                {/* Hàng 2: Theo độ ẩm đất */}
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-emerald-900">Hàng 2 — Theo Độ Ẩm Đất</span>
                      {row2SavingsPct != null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${row2SavingsPct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {row2SavingsPct >= 0 ? `Tiết kiệm ${row2SavingsPct.toFixed(1)}%` : `Dùng thêm ${Math.abs(row2SavingsPct).toFixed(1)}%`}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-emerald-900 mb-1">
                      {row2L.toFixed(2)} <span className="text-xs font-semibold text-slate-500">Lít/ngày</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Chỉ tưới khi ẩm độ đất H &lt; {config.low[0]}%. Tự động ngắt khi đất đủ ẩm, tránh thất thoát nước do thừa ẩm.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/60 text-[11px] font-semibold text-emerald-800 flex items-center justify-between">
                    <span>So với Hàng 1:</span>
                    <strong className="text-emerald-700 font-bold">
                      {row2SavingsPct != null ? (row2SavingsPct >= 0 ? `Giảm ${(row1L - row2L).toFixed(2)} Lít (${row2SavingsPct.toFixed(1)}%)` : `Tăng ${(row2L - row1L).toFixed(2)} Lít`) : "Chưa đủ số liệu"}
                    </strong>
                  </div>
                </div>

                {/* Hàng 3: Đa cảm biến + VPD */}
                <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-teal-900">Hàng 3 — Thích Ứng Vi Khí Hậu VPD</span>
                      {row3SavingsPct != null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${row3SavingsPct >= 0 ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}`}>
                          {row3SavingsPct >= 0 ? `Tiết kiệm ${row3SavingsPct.toFixed(1)}%` : `Dùng thêm ${Math.abs(row3SavingsPct).toFixed(1)}%`}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-teal-900 mb-1">
                      {row3L.toFixed(2)} <span className="text-xs font-semibold text-slate-500">Lít/ngày</span>
                    </div>
                    <p className="text-[11px] text-teal-800 leading-relaxed">
                      Điều tiết lượng nước theo áp lực bốc thoát hơi VPD: ngày râm mát tiết kiệm nước, ngày nắng gắt tăng bù nước bảo vệ cây.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-teal-200/60 text-[11px] font-semibold text-teal-800 flex items-center justify-between">
                    <span>So với Hàng 1:</span>
                    <strong className="text-teal-700 font-bold">
                      {row3SavingsPct != null ? (row3SavingsPct >= 0 ? `Giảm ${(row1L - row3L).toFixed(2)} Lít (${row3SavingsPct.toFixed(1)}%)` : `Tăng ${(row3L - row1L).toFixed(2)} Lít`) : "Chưa đủ số liệu"}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. BIỂU ĐỒ DIỄN BIẾN ĐỘ ẨM THEO THỜI GIAN */}
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

            {/* 6. HÀNG ĐỢI LỆNH ĐIỀU KHIỂN & TRẠNG THÁI THIẾT BỊ (COMMAND QUEUE) */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                    <Clock className="w-4 h-4 text-sky-700" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Hàng Đợi Lệnh Điều Khiển (Command Queue)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Theo dõi quá trình thiết bị nhận &amp; phản hồi lệnh (TTL 10 phút tự hủy để chống kẹt lệnh)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    {mode === "demo" ? "Chế độ Huấn luyện mô phỏng" : "Đồng bộ từ Cloudflare D1"}
                  </span>
                  <button
                    onClick={refresh}
                    disabled={busy}
                    title="Làm mới hàng đợi"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {commandQueue.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  Hiện không có lệnh nào trong hàng đợi. Tất cả lệnh đã được bộ điều khiển STM32 thực thi xong.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-2.5 px-3">Mã lệnh</th>
                        <th className="py-2.5 px-3">Thao tác</th>
                        <th className="py-2.5 px-3">Hàng</th>
                        <th className="py-2.5 px-3">Thời gian gửi</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3">Xác nhận lúc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {commandQueue.slice(0, 8).map((cmd) => {
                        const isPending = cmd.status === "pending";
                        const isAcked = cmd.status === "acked";
                        const isExpired = cmd.status === "expired";
                        return (
                          <tr key={cmd.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">#{cmd.id}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {cmd.action === "start" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <Play className="w-3 h-3 fill-current" /> Mở tưới
                                </span>
                              ) : cmd.action === "stop" ? (
                                <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                                  <Square className="w-3 h-3 fill-current" /> Đóng van
                                </span>
                              ) : cmd.action === "clear_fault" ? (
                                <span className="inline-flex items-center gap-1 text-sky-700 font-bold">
                                  <RefreshCw className="w-3 h-3" /> Xóa lỗi
                                </span>
                              ) : (
                                cmd.action
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-700">
                              {cmd.row === 0 ? "Toàn bộ 3 hàng" : `Hàng ${cmd.row}`}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {new Date(cmd.created_at).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 px-3">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                  <Clock className="w-3 h-3" /> Chờ STM32 nhận
                                </span>
                              )}
                              {isAcked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" /> Đã thực thi (ACK)
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                  <AlertCircle className="w-3 h-3" /> Hết hạn (Quá 10 phút)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {cmd.acked_at
                                ? new Date(cmd.acked_at).toLocaleTimeString("vi-VN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================== TAB 2: BẢN ĐỒ 2D VƯỜN & SỰ CỐ ===================== */}
        {tab === "map2d" && (
          <HmiGardenMap
            rows={rows}
            tankOk={tankOk}
            pumpOn={pumpOn}
            soilMoisture={soilMoisture}
            tempC={temp}
            rhPct={rh}
            vpdKpa={vpd}
            events={events}
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

        {/* ===================== TAB 3: SƠ ĐỒ THỦY LỰC P&ID ===================== */}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cấu hình Hàng 1 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-800">Hàng 1 — Lịch Hẹn Giờ</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">H1</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Giờ tưới lần 1 (Sáng):</span>
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
                    <span className="text-slate-500 block mb-1">Giờ tưới lần 2 (Chiều):</span>
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
                    <span className="text-slate-500 block mb-1">Thể tích mục tiêu mỗi lần (Lít):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={config.targetL[0]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, targetL: [val, c.targetL[1], c.targetL[2]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Thời gian van mở tối đa (giây):</span>
                    <input
                      type="number"
                      value={config.maxSeconds[0]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, maxSeconds: [val, c.maxSeconds[1], c.maxSeconds[2]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ngắt van khẩn cấp nếu cảm biến xung hỏng</span>
                  </label>
                </div>
              </div>

              {/* Cấu hình Hàng 2 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-800">Hàng 2 — Theo Độ Ẩm Đất</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">H2</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Ngưỡng bật Low (%):</span>
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
                      <span className="text-slate-500 block mb-1">Ngưỡng ngắt High (%):</span>
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
                  </div>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Thể tích tưới tối đa (Lít):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={config.targetL[1]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, targetL: [c.targetL[0], val, c.targetL[2]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Thời gian van mở tối đa (giây):</span>
                    <input
                      type="number"
                      value={config.maxSeconds[1]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, maxSeconds: [c.maxSeconds[0], val, c.maxSeconds[2]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500 block mb-1">Thời gian chờ ngấm nước (giây):</span>
                    <input
                      type="number"
                      value={config.soakSeconds[0]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((c) => ({ ...c, soakSeconds: [val, c.soakSeconds[1]] }));
                      }}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Trì hoãn lần tưới tiếp để nước ngấm đều rễ</span>
                  </label>
                </div>
              </div>

              {/* Cấu hình Hàng 3 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-800">Hàng 3 — Thích Ứng Vi Khí Hậu VPD</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">H3</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Ngưỡng bật Low (%):</span>
                      <input
                        type="number"
                        value={config.low[1]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConfig((c) => ({ ...c, low: [c.low[0], val] }));
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Ngưỡng ngắt High (%):</span>
                      <input
                        type="number"
                        value={config.high[1]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConfig((c) => ({ ...c, high: [c.high[0], val] }));
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Thể tích max (Lít):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={config.targetL[2]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConfig((c) => ({ ...c, targetL: [c.targetL[0], c.targetL[1], val] }));
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Ngưỡng VPD Nóng:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={config.vpdHot}
                        onChange={(e) => setConfig((c) => ({ ...c, vpdHot: Number(e.target.value) }))}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                      <span className="text-slate-500 block mb-1">Tăng lượng nước (%):</span>
                      <input
                        type="number"
                        step="0.05"
                        value={config.vpdVolumeBoost}
                        onChange={(e) => setConfig((c) => ({ ...c, vpdVolumeBoost: Number(e.target.value) }))}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Max van mở (giây):</span>
                      <input
                        type="number"
                        value={config.maxSeconds[2]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConfig((c) => ({ ...c, maxSeconds: [c.maxSeconds[0], c.maxSeconds[1], val] }));
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-500 block mb-1">Chờ ngấm (giây):</span>
                      <input
                        type="number"
                        value={config.soakSeconds[1]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConfig((c) => ({ ...c, soakSeconds: [c.soakSeconds[0], val] }));
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* BẢNG HIỆU CHUẨN CẢM BIẾN ĐỘ ẨM ĐẤT VÀ PHAO BỒN NƯỚC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
              {/* Hiệu chuẩn 4 cảm biến độ ẩm đất */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">Hiệu Chuẩn Cảm Biến Độ Ẩm Đất (ADC 12-bit)</h4>
                    <p className="text-[11px] text-slate-500">
                      Điều chỉnh giá trị ADC đo khi cảm biến khô trong không khí và khi nhúng trong nước bão hòa
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">ADC 0 - 4095</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  {[
                    { label: "S1 (H2 - Chậu 1)", idx: 0 },
                    { label: "S2 (H2 - Chậu 3)", idx: 1 },
                    { label: "S3 (H3 - Chậu 1)", idx: 2 },
                    { label: "S4 (H3 - Chậu 3)", idx: 3 },
                  ].map(({ label, idx }) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-700 text-[11px] truncate">{label}</div>
                      <label className="block">
                        <span className="text-[10px] text-slate-500 block">Khô (Air ADC):</span>
                        <input
                          type="number"
                          value={config.soilDry[idx]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConfig((c) => {
                              const next = [...c.soilDry];
                              next[idx] = val;
                              return { ...c, soilDry: next };
                            });
                          }}
                          className="w-full p-1.5 rounded border border-slate-300 text-xs font-mono"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-500 block">Ướt (Water ADC):</span>
                        <input
                          type="number"
                          value={config.soilWet[idx]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConfig((c) => {
                              const next = [...c.soilWet];
                              next[idx] = val;
                              return { ...c, soilWet: next };
                            });
                          }}
                          className="w-full p-1.5 rounded border border-slate-300 text-xs font-mono"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cấu hình phao an toàn bồn nước */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Cấu Hình Phao Bồn Nước</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Thiết lập kiểu tiếp điểm của công tắc phao chống cạn gắn tại thành bồn chứa
                  </p>

                  <div className="mt-4 space-y-3 text-xs">
                    <label className="block">
                      <span className="text-slate-600 font-semibold block mb-1">Mức logic khi cạn nước:</span>
                      <select
                        value={config.floatLowLevel ? "low" : "high"}
                        onChange={(e) => setConfig((c) => ({ ...c, floatLowLevel: e.target.value === "low" }))}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="low">Tiếp điểm đóng về GND (Mức LOW khi cạn)</option>
                        <option value="high">Tiếp điểm ngắt hở mạch (Mức HIGH khi cạn)</option>
                      </select>
                    </label>

                    <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-100 text-[11px] text-sky-900 leading-relaxed">
                      💡 <strong>Khuyên dùng:</strong> Mức LOW khi cạn là chuẩn an toàn công nghiệp, giúp thiết bị phát hiện được cả khi dây phao bị đứt ngầm.
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-200/60">
                  Thông số bảo vệ trực tiếp máy bơm 12V DC.
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

      {/* 6. MODAL ĐĂNG NHẬP TÀI KHOẢN CLOUD AN TOÀN */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Đăng Nhập Hệ Thống</h3>
                  <p className="text-[11px] text-slate-500">Tài khoản lưu trữ an toàn trên Cloudflare D1</p>
                </div>
              </div>
              <button onClick={() => setLoginModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chuyển tab giữa Tài khoản và Token */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLoginMode("account")}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  loginMode === "account" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Tài khoản &amp; Mật khẩu
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("token")}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  loginMode === "token" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Mã Token Quản trị
              </button>
            </div>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {authError}
              </div>
            )}

            {loginMode === "account" ? (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên đăng nhập</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="admin"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Nhập mật khẩu..."
                      className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Ghi nhớ đăng nhập trên máy này</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm disabled:opacity-50"
                  >
                    {busy ? "Đang xác thực..." : "Đăng nhập ngay"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3.5">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nhập trực tiếp mã <strong>ADMIN_TOKEN</strong> 256-bit đã cấu hình trên Cloudflare Secrets.
                </p>
                <input
                  type="password"
                  placeholder="Dán mã ADMIN_TOKEN..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-emerald-600 font-mono"
                />
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogin()}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                  >
                    Lưu &amp; Kích hoạt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL ĐỔI MẬT KHẨU */}
      {changePassOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Đổi Mật Khẩu Quản Trị</h3>
                  <p className="text-[11px] text-slate-500">Cập nhật trực tiếp lên D1 Cloud</p>
                </div>
              </div>
              <button onClick={() => setChangePassOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {changePassError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {changePassError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  required
                  value={oldPassInput}
                  onChange={(e) => setOldPassInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới (tối thiểu 8 ký tự)</label>
                <input
                  type="password"
                  required
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangePassOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm disabled:opacity-50"
                >
                  {busy ? "Đang lưu..." : "Cập nhật mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. FOOTER */}
      <footer className="bg-white border-t border-slate-200 text-slate-400 text-[11px] py-4 text-center">
        Dự án Nghiên cứu Hệ thống Tưới Tự Động 3 Hàng Cà Chua (12 Chậu) • Học viện Nông nghiệp Việt Nam (HVNN) • 2026
      </footer>
    </div>
  );
}
