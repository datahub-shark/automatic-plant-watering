"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Play,
  Power,
  Radio,
  RefreshCw,
  Sliders,
  Square,
  Thermometer,
  Wifi,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { EventItem, Row } from "./hmi-types";

export interface HmiGardenMapProps {
  rows: Row[];
  tankOk: boolean | null;
  pumpOn: boolean;
  soilMoisture: (number | null)[]; // S1 (H2-C1), S2 (H2-C3), S3 (H3-C1), S4 (H3-C3)
  tempC: number | null;
  rhPct: number | null;
  vpdKpa: number | null;
  events: EventItem[];
  onTriggerRow: (rowId: number) => void;
  canOperate: boolean;
  compact?: boolean;
}

// =========================================================================
// THƯ VIỆN COMPONENT: MỐC VỊ TRÍ PHONG CÁCH THINGSBOARD CLOUD (MAP PIN)
// Có đĩa biểu tượng, thẻ tên Pill và huy hiệu lỗi (x) ở góc dưới bên phải
// =========================================================================
interface ThingsBoardPinProps {
  x: number;
  y: number;
  title: string;
  isFault?: boolean;
  isWarning?: boolean;
  iconType?: "tank" | "pump" | "valve" | "soil" | "weather" | "controller";
  visible?: boolean;
  onClick?: () => void;
}

function ThingsBoardPin({
  x,
  y,
  title,
  isFault = false,
  isWarning = false,
  iconType = "tank",
  visible = true,
  onClick,
}: ThingsBoardPinProps) {
  if (!visible) return null;

  const pillWidth = Math.max(78, title.length * 6.5 + 24);
  const pillHeight = 22;
  const pinColor = isFault ? "#dc2626" : isWarning ? "#d97706" : "#0284c7";
  const pillBg = isFault ? "#dc2626" : isWarning ? "#fffbeb" : "#ffffff";
  const pillBorder = isFault ? "#ffffff" : isWarning ? "#d97706" : "#0284c7";
  const pillText = isFault ? "#ffffff" : isWarning ? "#b45309" : "#0f172a";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`cursor-pointer select-none transition-transform hover:scale-110 ${
        isFault ? "anim-pin-fault" : ""
      }`}
    >
      {/* Vòng tiếp xúc mặt đất và vòng lan tỏa khi có sự cố */}
      <ellipse
        cx="0"
        cy="0"
        rx="10"
        ry="4"
        fill={isFault ? "#dc2626" : "#334155"}
        opacity={isFault ? "0.85" : "0.35"}
      />
      {isFault && (
        <ellipse
          cx="0"
          cy="0"
          rx="18"
          ry="6"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          className="anim-pin-ripple"
        />
      )}

      {/* Thẻ Tên Nổi (Floating Pill Badge như Silo A, Silo B, Silo C) */}
      <g transform="translate(0, -42)">
        <rect
          x={-pillWidth / 2}
          y={-pillHeight / 2}
          width={pillWidth}
          height={pillHeight}
          rx={pillHeight / 2}
          fill={pillBg}
          stroke={pillBorder}
          strokeWidth={isFault ? 2 : 1.5}
          filter="drop-shadow(0 3px 6px rgba(0,0,0,0.22))"
        />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fill={pillText}
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="0.2"
        >
          {title}
        </text>
      </g>

      {/* Mốc Vị Trí Hình Giọt Nước (Teardrop Pin) */}
      <g transform="translate(0, -6)">
        <path
          d="M 0 6 C -4 2 -13 -6 -13 -15 C -13 -23 -7 -28 0 -28 C 7 -28 13 -23 13 -15 C 13 -6 4 2 0 6 Z"
          fill={pinColor}
          stroke="#ffffff"
          strokeWidth="2"
          filter="drop-shadow(0 4px 6px rgba(0,0,0,0.35))"
        />
        {/* Vòng tròn trắng bên trong tâm ghim */}
        <circle cx="0" cy="-15" r="7" fill="#ffffff" />

        {/* Biểu tượng thiết bị bên trong tâm ghim */}
        {iconType === "tank" && (
          <rect x="-3" y="-18" width="6" height="6" rx="1.5" fill={pinColor} />
        )}
        {iconType === "pump" && (
          <circle cx="0" cy="-15" r="3.2" fill={pinColor} />
        )}
        {iconType === "valve" && (
          <polygon points="-3.5,-18 3.5,-18 0,-15 -3.5,-12 3.5,-12 0,-15" fill={pinColor} />
        )}
        {iconType === "soil" && (
          <path d="M 0 -19 L -3.5 -13 L 3.5 -13 Z" fill={pinColor} />
        )}
        {iconType === "weather" && (
          <circle cx="0" cy="-15" r="2.8" fill={pinColor} />
        )}
        {iconType === "controller" && (
          <rect x="-3.5" y="-18.5" width="7" height="7" rx="1" fill={pinColor} />
        )}

        {/* Huy hiệu nhỏ ở góc dưới bên phải ghim (Corner Badge giống ThingsBoard) */}
        {isFault ? (
          <g transform="translate(8.5, -9.5)">
            <circle cx="0" cy="0" r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
            <text x="0" y="2.5" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="black">✕</text>
          </g>
        ) : isWarning ? (
          <g transform="translate(8.5, -9.5)">
            <circle cx="0" cy="0" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
            <text x="0" y="2.8" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="black">!</text>
          </g>
        ) : (
          <g transform="translate(8.5, -9.5)">
            <circle cx="0" cy="0" r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
            <text x="0" y="2" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="bold">✓</text>
          </g>
        )}
      </g>
    </g>
  );
}

export default function HmiGardenMap({
  rows,
  tankOk,
  pumpOn,
  soilMoisture,
  tempC,
  rhPct,
  vpdKpa,
  events,
  onTriggerRow,
  canOperate,
  compact = false,
}: HmiGardenMapProps) {
  // Đối tượng đang được chọn để xem chi tiết / SOP
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Chế độ hiển thị ghim mốc vị trí
  const [showAllPins, setShowAllPins] = useState<boolean>(true);

  // Bộ điều khiển thử nghiệm lỗi mô phỏng (Demo Test Trực Quan)
  const [simTestFault, setSimTestFault] = useState<"none" | "tank" | "noflow_h1" | "drought_s1" | "leak_h2">("none");

  // Phân tích trạng thái có kèm chế độ thử nghiệm
  const isTankEmpty = simTestFault === "tank" ? true : tankOk === false;
  const isTankWaiting = simTestFault === "tank" ? false : tankOk === null;

  const row1 = rows.find((r) => r.id === 1);
  const row2 = rows.find((r) => r.id === 2);
  const row3 = rows.find((r) => r.id === 3);

  const row1Valve = row1?.valve ?? false;
  const row2Valve = row2?.valve ?? false;
  const row3Valve = row3?.valve ?? false;

  const row1DailyL = row1?.daily_l ?? 0;
  const row2DailyL = row2?.daily_l ?? 0;
  const row3DailyL = row3?.daily_l ?? 0;

  // Lỗi từ các sự kiện gần nhất hoặc từ nút thử nghiệm
  const recentEvents = events.slice(0, 15);
  const hasNoFlowH1 = simTestFault === "noflow_h1" || recentEvents.some((e) => e.row === 1 && e.type === "ERROR_NO_FLOW");
  const hasLeakH1 = recentEvents.some((e) => e.row === 1 && e.type === "ERROR_VALVE_LEAK");

  const hasNoFlowH2 = recentEvents.some((e) => e.row === 2 && e.type === "ERROR_NO_FLOW");
  const hasLeakH2 = simTestFault === "leak_h2" || recentEvents.some((e) => e.row === 2 && e.type === "ERROR_VALVE_LEAK");

  const hasNoFlowH3 = recentEvents.some((e) => e.row === 3 && e.type === "ERROR_NO_FLOW");
  const hasLeakH3 = recentEvents.some((e) => e.row === 3 && e.type === "ERROR_VALVE_LEAK");

  // Độ ẩm 4 cảm biến đất (có tính đến thử nghiệm khô hạn)
  const s1 = simTestFault === "drought_s1" ? 18.5 : soilMoisture[0];
  const s2 = soilMoisture[1];
  const s3 = soilMoisture[2];
  const s4 = soilMoisture[3];

  const h2Avg = s1 != null && s2 != null ? (s1 + s2) / 2 : s1 ?? s2 ?? null;
  const h3Avg = s3 != null && s4 != null ? (s3 + s4) / 2 : s3 ?? s4 ?? null;

  // Tổng hợp danh sách cảnh báo đang diễn ra trên bản đồ
  const activeFaults: {
    zoneId: string;
    zoneName: string;
    level: "critical" | "warning";
    message: string;
    solution: string;
  }[] = [];

  if (isTankEmpty) {
    activeFaults.push({
      zoneId: "tank",
      zoneName: "Bồn Nước Nguồn 100L",
      level: "critical",
      message: "Cảm biến phao báo cạn nước. Bơm đã bị khóa liên động an toàn.",
      solution: "Bơm thêm nước nguồn vào bồn và kiểm tra phao nổi lại.",
    });
  }

  if (hasNoFlowH1) {
    activeFaults.push({
      zoneId: "row1",
      zoneName: "Luống Cà Chua Hàng 1",
      level: "critical",
      message: "Van 1 mở nhưng cảm biến YF-S201 không ghi nhận dòng chảy.",
      solution: "Kiểm tra van cơ chặn hoặc lưới lọc đầu van có bị tắc cặn.",
    });
  }
  if (hasLeakH1) {
    activeFaults.push({
      zoneId: "row1",
      zoneName: "Van Điện Từ Hàng 1",
      level: "warning",
      message: "Ghi nhận xung lưu lượng khi van 1 đang ở trạng thái đóng.",
      solution: "Kiểm tra màng cao su van điện từ có bị kẹt cặn bẩn.",
    });
  }

  if (hasNoFlowH2) {
    activeFaults.push({
      zoneId: "row2",
      zoneName: "Luống Cà Chua Hàng 2",
      level: "critical",
      message: "Van 2 mở nhưng mất dòng chảy nước qua cảm biến YF-S201.",
      solution: "Kiểm tra ống nhánh PE16 trên luống có bị gập xoắn hoặc nghẹt.",
    });
  }
  if (hasLeakH2) {
    activeFaults.push({
      zoneId: "row2",
      zoneName: "Van Điện Từ Hàng 2",
      level: "warning",
      message: "Nghi ngờ rò rỉ nước tại van điện từ Hàng 2.",
      solution: "Tháo vệ sinh màng van hoặc siết lại rắc co nối ren.",
    });
  }

  if (hasNoFlowH3) {
    activeFaults.push({
      zoneId: "row3",
      zoneName: "Luống Cà Chua Hàng 3",
      level: "critical",
      message: "Mất dòng chảy khi tưới Hàng 3.",
      solution: "Kiểm tra áp lực bơm và đường ống chính.",
    });
  }
  if (hasLeakH3) {
    activeFaults.push({
      zoneId: "row3",
      zoneName: "Van Điện Từ Hàng 3",
      level: "warning",
      message: "Nghi ngờ rò rỉ nước tại van điện từ Hàng 3.",
      solution: "Kiểm tra đóng kín van và gioăng cao su.",
    });
  }

  if (h2Avg != null && h2Avg < 30) {
    activeFaults.push({
      zoneId: "sensor_s1",
      zoneName: "Đất Hàng 2 Khô Hạn",
      level: "warning",
      message: `Độ ẩm đất TB H2 chỉ đạt ${h2Avg.toFixed(1)}% (< 35%).`,
      solution: "Bật chế độ tưới tự động hoặc bấm 'Tưới ngay' để bù ẩm.",
    });
  }

  if (h3Avg != null && h3Avg < 30) {
    activeFaults.push({
      zoneId: "sensor_s3",
      zoneName: "Đất Hàng 3 Khô Hạn",
      level: "warning",
      message: `Độ ẩm đất TB H3 chỉ đạt ${h3Avg.toFixed(1)}% (< 38%).`,
      solution: "Kiểm tra thuật toán bù vi khí hậu VPD và tưới bổ sung.",
    });
  }

  return (
    <div className="space-y-4">
      {/* 1. THANH TỔNG HỢP CẢNH BÁO SỰ CỐ VƯỜN */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
          activeFaults.length > 0
            ? "bg-red-50/95 border-red-300 shadow-md ring-1 ring-red-400"
            : "bg-emerald-50/70 border-emerald-200/90 shadow-sm"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                activeFaults.length > 0 ? "bg-red-100 text-red-600 animate-pulse" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {activeFaults.length > 0 ? <AlertOctagon className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`text-sm sm:text-base font-black tracking-tight ${
                    activeFaults.length > 0 ? "text-red-950" : "text-emerald-950"
                  }`}
                >
                  {activeFaults.length > 0
                    ? `PHÁT HIỆN ${activeFaults.length} SỰ CỐ: MỐC VỊ TRÍ ĐỎ (PIN) ĐÃ NỔI BẬT TRÊN SƠ ĐỒ`
                    : "TOÀN BỘ 12 CHẬU CÀ CHUA & THIẾT BỊ ĐANG HOẠT ĐỘNG AN TOÀN"}
                </h3>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    activeFaults.length > 0 ? "bg-red-200 text-red-800" : "bg-emerald-200 text-emerald-800"
                  }`}
                >
                  {activeFaults.length > 0 ? "Báo động sự cố" : "Bình thường"}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  activeFaults.length > 0 ? "text-red-800 font-medium" : "text-emerald-800/90"
                }`}
              >
                {activeFaults.length > 0
                  ? "Quan sát các mốc vị trí màu đỏ nhấp nháy (kèm biểu tượng ✕) trên sơ đồ bên dưới và nhấp chuột để xem giải pháp."
                  : "Mực nước bồn, áp lực bơm, 3 van điện từ và 4 cảm biến đất đang hoạt động theo đúng chu trình tự động."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => setShowAllPins(!showAllPins)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
            >
              {showAllPins ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{showAllPins ? "Ẩn mốc bình thường" : "Hiện tất cả mốc (Pins)"}</span>
            </button>
          </div>
        </div>

        {/* BẢNG ĐIỀU KHIỂN THỬ NGHIỆM MÔ PHỎNG (TEST SIMULATION BUTTONS) */}
        <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-bold">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Thử mô phỏng sự cố (Test mốc vị trí đỏ):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSimTestFault(simTestFault === "tank" ? "none" : "tank")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                simTestFault === "tank"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-white border border-red-200 text-red-700 hover:bg-red-50"
              }`}
            >
              🚨 Thử Cạn Bồn
            </button>
            <button
              onClick={() => setSimTestFault(simTestFault === "noflow_h1" ? "none" : "noflow_h1")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                simTestFault === "noflow_h1"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-white border border-red-200 text-red-700 hover:bg-red-50"
              }`}
            >
              🚨 Thử Mất Dòng Van 1
            </button>
            <button
              onClick={() => setSimTestFault(simTestFault === "drought_s1" ? "none" : "drought_s1")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                simTestFault === "drought_s1"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-white border border-red-200 text-red-700 hover:bg-red-50"
              }`}
            >
              🚨 Thử Đất Khô S1
            </button>
            <button
              onClick={() => setSimTestFault(simTestFault === "leak_h2" ? "none" : "leak_h2")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                simTestFault === "leak_h2"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white border border-amber-200 text-amber-800 hover:bg-amber-50"
              }`}
            >
              ⚠️ Thử Rò Rỉ Van 2
            </button>
            {simTestFault !== "none" && (
              <button
                onClick={() => setSimTestFault("none")}
                className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                ✓ Xóa Thử Nghiệm
              </button>
            )}
          </div>
        </div>

        {/* Danh sách lỗi nhanh có thể bấm vào để focus */}
        {activeFaults.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-200/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {activeFaults.map((fault, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedZone(fault.zoneId)}
                className="p-2.5 rounded-xl bg-white/95 border border-red-200 hover:border-red-400 cursor-pointer transition-all flex items-start gap-2.5 shadow-2xs"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <strong className="text-red-950 font-bold truncate">{fault.zoneName}</strong>
                    <span className="text-[10px] text-red-600 font-bold underline shrink-0 ml-1">Xem vị trí</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-1">{fault.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. KHUNG ĐỒ HỌA 2D NHÀ MÀNG & HỆ THỐNG CẢM BIẾN - KÈM MỐC VỊ TRÍ THINGSBOARD CLOUD PIN */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                📍
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-800">
                Sơ Đồ 2D Vườn Cà Chua 12 Chậu &amp; Mốc Vị Trí Sự Cố Trực Quan
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Phong cách ThingsBoard: Khi có sự cố, mốc vị trí màu đỏ nhấp nháy nổi bật lên tại đúng vị trí thiết bị lỗi kèm biểu tượng ✕.
            </p>
          </div>

          {/* Chú giải trạng thái */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đang tưới
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Đang nghỉ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span> Mốc Sự cố (✕)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Cảnh báo (!)
            </span>
          </div>
        </div>

        {/* Khung bản đồ SVG Responsive */}
        <div className="w-full overflow-x-auto bg-slate-900/5 rounded-2xl border border-slate-200/90 p-2 sm:p-3">
          <svg
            viewBox="0 0 1020 570"
            className="w-full h-auto max-w-full drop-shadow-xs select-none"
            role="img"
            aria-label="Sơ đồ 2D trực quan hệ thống tưới và cảm biến nhà màng"
          >
            {/* CSS Animation Definitions Encapsulated in SVG */}
            <defs>
              <style>
                {`
                  @keyframes hmiFlowWater {
                    from { stroke-dashoffset: 48; }
                    to { stroke-dashoffset: 0; }
                  }
                  @keyframes hmiSpinRotor {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  @keyframes hmiDripFall {
                    0% { transform: translateY(0); opacity: 0; }
                    25% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translateY(18px); opacity: 0; }
                  }
                  @keyframes hmiRippleExpand {
                    0% { r: 1.5; opacity: 0.9; }
                    100% { r: 8; opacity: 0; }
                  }
                  @keyframes hmiWaveSway {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(-16px); }
                  }
                  @keyframes hmiRfRing {
                    0% { opacity: 0.8; transform: scale(0.6); }
                    100% { opacity: 0; transform: scale(1.6); }
                  }
                  @keyframes hmiCapacitivePulse {
                    0% { opacity: 0.3; transform: scale(0.9); }
                    50% { opacity: 0.8; }
                    100% { opacity: 0.1; transform: scale(1.2); }
                  }
                  @keyframes hmiFaultGlow {
                    0%, 100% { filter: drop-shadow(0 0 3px rgba(239, 68, 68, 0.5)); stroke: #ef4444; }
                    50% { filter: drop-shadow(0 0 9px rgba(239, 68, 68, 0.9)); stroke: #b91c1c; }
                  }
                  @keyframes hmiPinBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                  }
                  @keyframes hmiPinRipple {
                    0% { transform: scale(0.6); opacity: 0.9; }
                    100% { transform: scale(2.2); opacity: 0; }
                  }
                  .anim-flow-water {
                    stroke-dasharray: 8 6;
                    animation: hmiFlowWater 0.75s linear infinite;
                  }
                  .anim-spin-fast {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: hmiSpinRotor 0.75s linear infinite;
                  }
                  .anim-drip-water {
                    animation: hmiDripFall 1.1s ease-in infinite;
                  }
                  .anim-drip-ripple {
                    animation: hmiRippleExpand 1.1s ease-out infinite;
                  }
                  .anim-wave-liquid {
                    animation: hmiWaveSway 3.5s ease-in-out infinite;
                  }
                  .anim-rf-wave {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: hmiRfRing 2s ease-out infinite;
                  }
                  .anim-capacitive-field {
                    animation: hmiCapacitivePulse 1.8s ease-in-out infinite;
                  }
                  .anim-fault-glow {
                    animation: hmiFaultGlow 1.2s ease-in-out infinite;
                  }
                  .anim-pin-fault {
                    animation: hmiPinBounce 1.3s ease-in-out infinite;
                  }
                  .anim-pin-ripple {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: hmiPinRipple 1.3s ease-out infinite;
                  }
                `}
              </style>

              {/* Gradient cho nước trong bồn */}
              <linearGradient id="tankWaterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>

              {/* Clip path cho thân bồn nước */}
              <clipPath id="tankBodyClip">
                <rect x="0" y="0" width="180" height="96" rx="12" />
              </clipPath>

              {/* Gradient cho bầu đất chậu cây */}
              <linearGradient id="soilPotGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>

              {/* Gradient cho lá cây cà chua */}
              <radialGradient id="tomatoLeafGrad" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </radialGradient>
            </defs>

            {/* 1. NỀN NHÀ MÀNG & ĐƯỜNG GIẰNG KẾT CẤU */}
            <rect x="10" y="10" width="1000" height="550" rx="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
            <rect x="18" y="18" width="984" height="534" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />

            {/* Các vòm khung thép nhà màng */}
            {[260, 440, 620, 800].map((gx) => (
              <line key={gx} x1={gx} y1="20" x2={gx} y2="550" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6 6" />
            ))}

            {/* Vách phân chia khu kỹ thuật & luống cây */}
            <line x1="250" y1="20" x2="250" y2="550" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />

            {/* Tiêu đề hai khu vực */}
            <text x="32" y="42" fill="#64748b" fontSize="11" fontWeight="800" letterSpacing="1">
              KHU KỸ THUẬT &amp; ĐIỀU KHIỂN
            </text>
            <text x="270" y="42" fill="#64748b" fontSize="11" fontWeight="800" letterSpacing="1">
              KHU VỰC 3 HÀNG CÀ CHUA (12 CHẬU THỰC NGHIỆM)
            </text>

            {/* ========================================================================= */}
            {/* KHU KỸ THUẬT (BÊN TRÁI: x: 25 -> 235)                                     */}
            {/* ========================================================================= */}

            {/* 1. BỒN CHỨA NƯỚC 100L VỚI CẢM BIẾN PHAO ĐIỆN TỪ (FLOAT SWITCH) */}
            <g
              onClick={() => setSelectedZone("tank")}
              className={`cursor-pointer transition-transform hover:scale-101 ${
                isTankEmpty ? "anim-fault-glow" : ""
              }`}
              transform="translate(25, 60)"
            >
              <rect
                x="0"
                y="0"
                width="200"
                height="105"
                rx="14"
                fill={isTankEmpty ? "#fee2e2" : isTankWaiting ? "#f8fafc" : "#f0f9ff"}
                stroke={isTankEmpty ? "#dc2626" : isTankWaiting ? "#94a3b8" : "#0284c7"}
                strokeWidth={isTankEmpty ? 3 : 1.5}
              />
              <rect x="75" y="-8" width="50" height="8" rx="3" fill="#64748b" />

              {/* Vạch đo mức nước */}
              <g transform="translate(14, 25)">
                <line x1="0" y1="0" x2="8" y2="0" stroke="#94a3b8" strokeWidth="1" />
                <text x="12" y="3" fill="#94a3b8" fontSize="8" fontWeight="bold">100L</text>
                <line x1="0" y1="20" x2="6" y2="20" stroke="#94a3b8" strokeWidth="1" />
                <line x1="0" y1="40" x2="8" y2="40" stroke="#94a3b8" strokeWidth="1" />
                <text x="12" y="43" fill="#94a3b8" fontSize="8" fontWeight="bold">50L</text>
                <line x1="0" y1="60" x2="6" y2="60" stroke="#94a3b8" strokeWidth="1" />
              </g>

              {/* Bồn chứa có nước dạng sóng */}
              <g transform="translate(42, 22)">
                <rect x="0" y="0" width="70" height="72" rx="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                <g clipPath="url(#tankWaterGrad)">
                  <rect
                    x="1"
                    y={isTankEmpty ? 58 : isTankWaiting ? 35 : 12}
                    width="68"
                    height={isTankEmpty ? 14 : isTankWaiting ? 37 : 60}
                    fill={isTankEmpty ? "#ef4444" : isTankWaiting ? "#94a3b8" : "url(#tankWaterGrad)"}
                    opacity="0.85"
                  />
                  <path
                    d={
                      isTankEmpty
                        ? "M 1 58 Q 18 56 35 58 T 69 58 L 69 72 L 1 72 Z"
                        : "M 1 12 Q 18 9 35 12 T 69 12 L 69 72 L 1 72 Z"
                    }
                    fill={isTankEmpty ? "#fca5a5" : "#7dd3fc"}
                    className={pumpOn ? "anim-wave-liquid" : ""}
                  />
                </g>

                {/* Phao từ cơ học */}
                <line x1="52" y1="6" x2="52" y2="66" stroke="#475569" strokeWidth="2" strokeDasharray="1 2" />
                <rect
                  x="44"
                  y={isTankEmpty ? 54 : 10}
                  width="16"
                  height="8"
                  rx="3"
                  fill={isTankEmpty ? "#dc2626" : "#22c55e"}
                  stroke="#ffffff"
                  strokeWidth="1"
                  className={isTankEmpty ? "animate-bounce" : ""}
                />
              </g>

              <text x="120" y="32" fill="#1e293b" fontSize="11" fontWeight="bold">
                BỒN NƯỚC 100L
              </text>
              <text x="120" y="47" fill="#64748b" fontSize="9">
                Phao từ inox:
              </text>
              <rect
                x="120"
                y="52"
                width="72"
                height="18"
                rx="4"
                fill={isTankEmpty ? "#fee2e2" : isTankWaiting ? "#f1f5f9" : "#dcfce7"}
              />
              <text
                x="156"
                y="64"
                textAnchor="middle"
                fill={isTankEmpty ? "#dc2626" : isTankWaiting ? "#64748b" : "#15803d"}
                fontSize="9"
                fontWeight="bold"
              >
                {isTankEmpty ? "CHÌM (CẠN!)" : isTankWaiting ? "CHỜ ĐO" : "NỔI (ĐẦY)"}
              </text>
              <text x="120" y="85" fill={isTankEmpty ? "#dc2626" : "#0284c7"} fontSize="8" fontWeight="bold">
                {isTankEmpty ? "🚨 KHÓA BƠM AN TOÀN" : "Cấp nước tự do"}
              </text>
            </g>

            {/* 2. BƠM TĂNG ÁP 12V DC */}
            <g
              onClick={() => setSelectedZone("pump")}
              className="cursor-pointer transition-transform hover:scale-101"
              transform="translate(25, 180)"
            >
              <rect
                x="0"
                y="0"
                width="200"
                height="85"
                rx="14"
                fill={pumpOn ? "#ecfdf5" : "#f8fafc"}
                stroke={pumpOn ? "#10b981" : "#cbd5e1"}
                strokeWidth={pumpOn ? 2.5 : 1.5}
              />
              <g transform="translate(14, 16)">
                <rect x="0" y="4" width="34" height="42" rx="4" fill="#334155" stroke="#1e293b" strokeWidth="1" />
                <line x1="8" y1="4" x2="8" y2="46" stroke="#475569" strokeWidth="1" />
                <line x1="17" y1="4" x2="17" y2="46" stroke="#475569" strokeWidth="1" />
                <line x1="26" y1="4" x2="26" y2="46" stroke="#475569" strokeWidth="1" />
                <rect x="34" y="10" width="22" height="30" rx="3" fill="#64748b" stroke="#334155" strokeWidth="1" />
                <circle cx="17" cy="25" r="10" fill={pumpOn ? "#10b981" : "#475569"} opacity="0.9" />
                <g className={pumpOn ? "anim-spin-fast" : ""} transform="translate(17, 25)">
                  <line x1="-8" y1="0" x2="8" y2="0" stroke="#ffffff" strokeWidth="2" />
                  <line x1="0" y1="-8" x2="0" y2="8" stroke="#ffffff" strokeWidth="2" />
                  <line x1="-6" y1="-6" x2="6" y2="6" stroke="#ffffff" strokeWidth="1.5" />
                  <line x1="-6" y1="6" x2="6" y2="-6" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              </g>

              <text x="80" y="32" fill="#1e293b" fontSize="11" fontWeight="bold">
                BƠM TĂNG ÁP 12V
              </text>
              <text x="80" y="46" fill="#64748b" fontSize="9">
                Diaphragm • Áp lực 0.48MPa
              </text>
              <rect
                x="80"
                y="52"
                width="105"
                height="20"
                rx="5"
                fill={pumpOn ? "#dcfce7" : "#f1f5f9"}
                stroke={pumpOn ? "#16a34a" : "#cbd5e1"}
                strokeWidth="1"
              />
              <circle cx="92" cy="62" r="4" fill={pumpOn ? "#16a34a" : "#94a3b8"} className={pumpOn ? "animate-ping" : ""} />
              <text
                x="102"
                y="65"
                fill={pumpOn ? "#15803d" : "#64748b"}
                fontSize="9"
                fontWeight="bold"
              >
                {pumpOn ? "ĐANG CHẠY (ON)" : "ĐANG NGHỈ (OFF)"}
              </text>
            </g>

            {/* 3. TỦ ĐIỀU KHIỂN TRUNG TÂM IOT */}
            <g
              onClick={() => setSelectedZone("controller")}
              className="cursor-pointer transition-transform hover:scale-101"
              transform="translate(25, 280)"
            >
              <rect
                x="0"
                y="0"
                width="200"
                height="125"
                rx="14"
                fill="#f8fafc"
                stroke="#475569"
                strokeWidth="1.5"
              />
              <text x="14" y="24" fill="#1e293b" fontSize="11" fontWeight="bold">
                TỦ ĐIỀU KHIỂN IOT TRUNG TÂM
              </text>
              <text x="14" y="38" fill="#64748b" fontSize="8.5">
                ESP32-S3 Dual-Core • Nguồn 12V/5V
              </text>

              <g transform="translate(14, 46)">
                <rect x="0" y="0" width="45" height="34" rx="4" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1" />
                <text x="22" y="15" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold">ESP32-S3</text>
                <text x="22" y="26" textAnchor="middle" fill="#94a3b8" fontSize="6 font-mono">240MHz</text>
              </g>

              <g transform="translate(68, 46)">
                <rect x="0" y="0" width="48" height="34" rx="4" fill="#334155" stroke="#f59e0b" strokeWidth="1" />
                <text x="24" y="15" textAnchor="middle" fill="#fde047" fontSize="7" fontWeight="bold">A7672X</text>
                <text x="24" y="26" textAnchor="middle" fill="#cbd5e1" fontSize="6 font-mono">4G LTE CAT1</text>
              </g>

              <g transform="translate(130, 48)">
                <line x1="10" y1="30" x2="10" y2="2" stroke="#0f172a" strokeWidth="2.5" />
                <circle cx="10" cy="2" r="3" fill="#0284c7" />
                <path
                  d="M 4 -3 A 8 8 0 0 1 16 -3"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="1.5"
                  className="anim-rf-wave"
                />
                <path
                  d="M 1 -7 A 12 12 0 0 1 19 -7"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  className="anim-rf-wave"
                />
              </g>

              <g transform="translate(14, 92)">
                <circle cx="8" cy="8" r="4" fill="#22c55e" />
                <text x="16" y="11" fill="#475569" fontSize="7.5" fontWeight="bold">PWR</text>
                <circle cx="56" cy="8" r="4" fill="#0284c7" className="animate-ping" />
                <text x="64" y="11" fill="#475569" fontSize="7.5" fontWeight="bold">4G</text>
                <circle cx="104" cy="8" r="4" fill="#06b6d4" />
                <text x="112" y="11" fill="#475569" fontSize="7.5" fontWeight="bold">D1</text>
                <circle cx="150" cy="8" r="4" fill={activeFaults.length > 0 ? "#ef4444" : "#cbd5e1"} />
                <text x="158" y="11" fill={activeFaults.length > 0 ? "#dc2626" : "#94a3b8"} fontSize="7.5" fontWeight="bold">
                  ALM
                </text>
              </g>

              <text x="14" y="116" fill="#059669" fontSize="8" fontWeight="bold">
                ☁ Cloudflare Worker API: Đồng bộ trực tuyến
              </text>
            </g>

            {/* 4. TRẠM THỜI TIẾT VI KHÍ HẬU SHT31 */}
            <g
              onClick={() => setSelectedZone("weather")}
              className="cursor-pointer transition-transform hover:scale-101"
              transform="translate(25, 420)"
            >
              <rect
                x="0"
                y="0"
                width="200"
                height="115"
                rx="14"
                fill="#f0fdfa"
                stroke="#0d9488"
                strokeWidth="1.5"
              />
              <g transform="translate(14, 16)">
                <rect x="0" y="0" width="36" height="50" rx="3" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
                <line x1="4" y1="10" x2="32" y2="10" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="4" y1="20" x2="32" y2="20" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="4" y1="30" x2="32" y2="30" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="4" y1="40" x2="32" y2="40" stroke="#cbd5e1" strokeWidth="2" />
                <circle cx="18" cy="25" r="4" fill="#0d9488" />
              </g>

              <text x="60" y="28" fill="#115e59" fontSize="11" fontWeight="bold">
                TRẠM VI KHÍ HẬU SHT31
              </text>
              <text x="60" y="48" fill="#0f766e" fontSize="13" fontWeight="black">
                {tempC != null ? `${tempC.toFixed(1)}°C` : "—"} • {rhPct != null ? `${Math.round(rhPct)}%` : "—"}
              </text>
              <text x="60" y="68" fill="#134e4a" fontSize="10" fontWeight="bold">
                VPD: {vpdKpa != null ? `${vpdKpa.toFixed(2)} kPa` : "—"}
              </text>
              <rect
                x="14"
                y="80"
                width="172"
                height="22"
                rx="5"
                fill={vpdKpa != null && vpdKpa >= 1.5 ? "#fef3c7" : "#ccfbf1"}
              />
              <text
                x="100"
                y="94"
                textAnchor="middle"
                fill={vpdKpa != null && vpdKpa >= 1.5 ? "#b45309" : "#0f766e"}
                fontSize="9"
                fontWeight="bold"
              >
                {vpdKpa != null && vpdKpa >= 1.5 ? "🔥 Nắng gắt (Bù nước Hàng 3)" : "🌤 Khí hậu thuận lợi cho cà chua"}
              </text>
            </g>

            {/* ========================================================================= */}
            {/* ĐƯỜNG ỐNG NƯỚC CHÍNH PE16                                                 */}
            {/* ========================================================================= */}

            <line
              x1="125"
              y1="165"
              x2="125"
              y2="180"
              stroke={isTankEmpty ? "#fca5a5" : "#0284c7"}
              strokeWidth="6"
              strokeLinecap="round"
            />

            <path
              d="M 225 222 L 260 222 L 260 115 L 290 115 M 260 222 L 290 265 M 260 222 L 260 415 L 290 415"
              fill="none"
              stroke={pumpOn ? "#0284c7" : "#94a3b8"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={pumpOn ? "anim-flow-water" : ""}
            />

            {/* ========================================================================= */}
            {/* 3 HÀNG CÀ CHUA (BÊN PHẢI)                                                  */}
            {/* ========================================================================= */}

            {/* HÀNG 1 */}
            <g
              onClick={() => setSelectedZone("row1")}
              className="cursor-pointer"
              transform="translate(280, 55)"
            >
              <rect
                x="0"
                y="0"
                width="705"
                height="130"
                rx="14"
                fill={hasNoFlowH1 || hasLeakH1 ? "#fef2f2" : row1Valve ? "#f0fdf4" : "#ffffff"}
                stroke={hasNoFlowH1 || hasLeakH1 ? "#ef4444" : row1Valve ? "#10b981" : "#e2e8f0"}
                strokeWidth={hasNoFlowH1 || hasLeakH1 ? 2.5 : row1Valve ? 2 : 1}
              />
              <rect x="14" y="10" width="30" height="20" rx="6" fill="#d97706" />
              <text x="29" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">H1</text>
              <text x="52" y="24" fill="#1e293b" fontSize="11.5" fontWeight="bold">
                HÀNG 1 — Hẹn Giờ Cố Định (06:00 &amp; 17:00) • Hôm nay: {row1DailyL.toFixed(2)}L
              </text>
              <rect
                x="545"
                y="10"
                width="145"
                height="22"
                rx="6"
                fill={row1Valve ? "#dcfce7" : "#f1f5f9"}
                stroke={row1Valve ? "#16a34a" : "#cbd5e1"}
                strokeWidth="1"
              />
              <circle cx="557" cy="21" r="3.5" fill={row1Valve ? "#16a34a" : "#94a3b8"} className={row1Valve ? "animate-ping" : ""} />
              <text
                x="620"
                y="24"
                textAnchor="middle"
                fill={row1Valve ? "#15803d" : "#64748b"}
                fontSize="9.5"
                fontWeight="bold"
              >
                {row1Valve ? "VAN ĐANG MỞ (TƯỚI)" : "VAN ĐANG ĐÓNG"}
              </text>

              {/* Van 1 Solenoid */}
              <g transform="translate(14, 46)">
                <rect x="0" y="8" width="40" height="26" rx="4" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                <rect
                  x="8"
                  y="0"
                  width="24"
                  height="12"
                  rx="3"
                  fill={row1Valve ? "#10b981" : "#475569"}
                  stroke="#1e293b"
                  strokeWidth="1"
                  className={row1Valve ? "animate-pulse" : ""}
                />
                <text x="20" y="24" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">VAN 1</text>
                <text x="20" y="44" textAnchor="middle" fill="#64748b" fontSize="7">Solenoid</text>
              </g>

              {/* YF-S201 Hàng 1 */}
              <g transform="translate(68, 46)">
                <rect x="0" y="6" width="46" height="30" rx="6" fill="#1e293b" stroke="#0284c7" strokeWidth="1" />
                <circle cx="23" cy="21" r="10" fill="#0369a1" />
                <g className={row1Valve ? "anim-spin-fast" : ""} transform="translate(23, 21)">
                  <line x1="-7" y1="0" x2="7" y2="0" stroke="#ffffff" strokeWidth="2" />
                  <line x1="0" y1="-7" x2="0" y2="7" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="0" cy="0" r="2.5" fill="#eab308" />
                </g>
                <circle cx="39" cy="11" r="2.5" fill="#eab308" className={row1Valve ? "animate-ping" : ""} />
                <text x="23" y="44" textAnchor="middle" fill="#0284c7" fontSize="7 font-mono font-bold">YF-S201</text>
              </g>

              {/* Đường ống nhánh */}
              <line
                x1="120"
                y1="67"
                x2="685"
                y2="67"
                stroke={row1Valve ? "#0284c7" : "#cbd5e1"}
                strokeWidth="4"
                className={row1Valve ? "anim-flow-water" : ""}
              />

              {/* 4 Chậu cà chua hàng 1 */}
              {[1, 2, 3, 4].map((potNum, i) => {
                const px = 175 + i * 135;
                return (
                  <g key={potNum} transform={`translate(${px}, 42)`}>
                    <line x1="25" y1="25" x2="25" y2="38" stroke={row1Valve ? "#0284c7" : "#94a3b8"} strokeWidth="2" />
                    {row1Valve && (
                      <g>
                        <circle cx="25" cy="40" r="2.5" fill="#38bdf8" className="anim-drip-water" />
                        <circle cx="25" cy="56" r="3" fill="none" stroke="#38bdf8" strokeWidth="1.5" className="anim-drip-ripple" />
                      </g>
                    )}
                    <path
                      d="M 6 52 L 12 76 L 38 76 L 44 52 Z"
                      fill="url(#soilPotGrad)"
                      stroke="#78350f"
                      strokeWidth="1.5"
                    />
                    <circle cx="25" cy="38" r="16" fill="url(#tomatoLeafGrad)" opacity="0.95" />
                    <circle cx="18" cy="35" r="3.5" fill="#dc2626" />
                    <circle cx="31" cy="42" r="3.5" fill="#dc2626" />
                    <text x="25" y="68" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      C1-{potNum}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* HÀNG 2 */}
            <g
              onClick={() => setSelectedZone("row2")}
              className="cursor-pointer"
              transform="translate(280, 205)"
            >
              <rect
                x="0"
                y="0"
                width="705"
                height="145"
                rx="14"
                fill={hasNoFlowH2 || hasLeakH2 ? "#fef2f2" : row2Valve ? "#f0fdf4" : "#ffffff"}
                stroke={hasNoFlowH2 || hasLeakH2 ? "#ef4444" : row2Valve ? "#10b981" : "#e2e8f0"}
                strokeWidth={hasNoFlowH2 || hasLeakH2 ? 2.5 : row2Valve ? 2 : 1}
              />
              <rect x="14" y="10" width="30" height="20" rx="6" fill="#059669" />
              <text x="29" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">H2</text>
              <text x="52" y="24" fill="#1e293b" fontSize="11.5" fontWeight="bold">
                HÀNG 2 — Theo Độ Ẩm Đất Tự Động (S1, S2) • Hôm nay: {row2DailyL.toFixed(2)}L • TB: {h2Avg != null ? `${h2Avg.toFixed(1)}%` : "—"}
              </text>
              <rect
                x="545"
                y="10"
                width="145"
                height="22"
                rx="6"
                fill={row2Valve ? "#dcfce7" : "#f1f5f9"}
                stroke={row2Valve ? "#16a34a" : "#cbd5e1"}
                strokeWidth="1"
              />
              <circle cx="557" cy="21" r="3.5" fill={row2Valve ? "#16a34a" : "#94a3b8"} className={row2Valve ? "animate-ping" : ""} />
              <text
                x="620"
                y="24"
                textAnchor="middle"
                fill={row2Valve ? "#15803d" : "#64748b"}
                fontSize="9.5"
                fontWeight="bold"
              >
                {row2Valve ? "VAN ĐANG MỞ (TƯỚI)" : "VAN ĐANG ĐÓNG"}
              </text>

              {/* Van 2 */}
              <g transform="translate(14, 52)">
                <rect x="0" y="8" width="40" height="26" rx="4" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                <rect
                  x="8"
                  y="0"
                  width="24"
                  height="12"
                  rx="3"
                  fill={row2Valve ? "#10b981" : "#475569"}
                  stroke="#1e293b"
                  strokeWidth="1"
                  className={row2Valve ? "animate-pulse" : ""}
                />
                <text x="20" y="24" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">VAN 2</text>
                <text x="20" y="44" textAnchor="middle" fill="#64748b" fontSize="7">Solenoid</text>
              </g>

              {/* YF-S201 Hàng 2 */}
              <g transform="translate(68, 52)">
                <rect x="0" y="6" width="46" height="30" rx="6" fill="#1e293b" stroke="#0284c7" strokeWidth="1" />
                <circle cx="23" cy="21" r="10" fill="#0369a1" />
                <g className={row2Valve ? "anim-spin-fast" : ""} transform="translate(23, 21)">
                  <line x1="-7" y1="0" x2="7" y2="0" stroke="#ffffff" strokeWidth="2" />
                  <line x1="0" y1="-7" x2="0" y2="7" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="0" cy="0" r="2.5" fill="#eab308" />
                </g>
                <circle cx="39" cy="11" r="2.5" fill="#eab308" className={row2Valve ? "animate-ping" : ""} />
                <text x="23" y="44" textAnchor="middle" fill="#0284c7" fontSize="7 font-mono font-bold">YF-S201</text>
              </g>

              <line
                x1="120"
                y1="73"
                x2="685"
                y2="73"
                stroke={row2Valve ? "#0284c7" : "#cbd5e1"}
                strokeWidth="4"
                className={row2Valve ? "anim-flow-water" : ""}
              />

              {/* 4 Chậu hàng 2 */}
              {[1, 2, 3, 4].map((potNum, i) => {
                const px = 175 + i * 135;
                const hasSensor = potNum === 1 || potNum === 3;
                const sensorName = potNum === 1 ? "S1" : "S2";
                const sensorVal = potNum === 1 ? s1 : s2;
                const isDry = sensorVal != null && sensorVal < 35;

                return (
                  <g key={potNum} transform={`translate(${px}, 48)`}>
                    <line x1="25" y1="25" x2="25" y2="38" stroke={row2Valve ? "#0284c7" : "#94a3b8"} strokeWidth="2" />
                    {row2Valve && (
                      <g>
                        <circle cx="25" cy="40" r="2.5" fill="#38bdf8" className="anim-drip-water" />
                        <circle cx="25" cy="56" r="3" fill="none" stroke="#38bdf8" strokeWidth="1.5" className="anim-drip-ripple" />
                      </g>
                    )}
                    <path
                      d="M 6 52 L 12 76 L 38 76 L 44 52 Z"
                      fill={isDry ? "#b45309" : "url(#soilPotGrad)"}
                      stroke="#78350f"
                      strokeWidth="1.5"
                    />
                    <circle cx="25" cy="38" r="16" fill="url(#tomatoLeafGrad)" opacity="0.95" />
                    <circle cx="18" cy="35" r="3.5" fill="#dc2626" />
                    <circle cx="31" cy="42" r="3.5" fill="#dc2626" />
                    <text x="25" y="68" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      C2-{potNum}
                    </text>

                    {/* Bo mạch cảm biến đất điện dung */}
                    {hasSensor && (
                      <g
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedZone(potNum === 1 ? "sensor_s1" : "sensor_s2");
                        }}
                        className="cursor-pointer"
                        transform="translate(36, 32)"
                      >
                        <rect x="0" y="0" width="12" height="38" rx="2" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1" />
                        <line x1="3" y1="18" x2="3" y2="36" stroke="#f59e0b" strokeWidth="1.5" />
                        <line x1="9" y1="18" x2="9" y2="36" stroke="#f59e0b" strokeWidth="1.5" />
                        <circle cx="6" cy="28" r="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.7" className="anim-capacitive-field" />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* HÀNG 3 */}
            <g
              onClick={() => setSelectedZone("row3")}
              className="cursor-pointer"
              transform="translate(280, 365)"
            >
              <rect
                x="0"
                y="0"
                width="705"
                height="145"
                rx="14"
                fill={hasNoFlowH3 || hasLeakH3 ? "#fef2f2" : row3Valve ? "#f0fdf4" : "#ffffff"}
                stroke={hasNoFlowH3 || hasLeakH3 ? "#ef4444" : row3Valve ? "#10b981" : "#e2e8f0"}
                strokeWidth={hasNoFlowH3 || hasLeakH3 ? 2.5 : row3Valve ? 2 : 1}
              />
              <rect x="14" y="10" width="30" height="20" rx="6" fill="#0f766e" />
              <text x="29" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">H3</text>
              <text x="52" y="24" fill="#1e293b" fontSize="11.5" fontWeight="bold">
                HÀNG 3 — Đa Cảm Biến &amp; Bù Vi Khí Hậu VPD (S3, S4) • {row3DailyL.toFixed(2)}L • TB: {h3Avg != null ? `${h3Avg.toFixed(1)}%` : "—"}
              </text>
              <rect
                x="545"
                y="10"
                width="145"
                height="22"
                rx="6"
                fill={row3Valve ? "#dcfce7" : "#f1f5f9"}
                stroke={row3Valve ? "#16a34a" : "#cbd5e1"}
                strokeWidth="1"
              />
              <circle cx="557" cy="21" r="3.5" fill={row3Valve ? "#16a34a" : "#94a3b8"} className={row3Valve ? "animate-ping" : ""} />
              <text
                x="620"
                y="24"
                textAnchor="middle"
                fill={row3Valve ? "#15803d" : "#64748b"}
                fontSize="9.5"
                fontWeight="bold"
              >
                {row3Valve ? "VAN ĐANG MỞ (TƯỚI)" : "VAN ĐANG ĐÓNG"}
              </text>

              {/* Van 3 */}
              <g transform="translate(14, 52)">
                <rect x="0" y="8" width="40" height="26" rx="4" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                <rect
                  x="8"
                  y="0"
                  width="24"
                  height="12"
                  rx="3"
                  fill={row3Valve ? "#10b981" : "#475569"}
                  stroke="#1e293b"
                  strokeWidth="1"
                  className={row3Valve ? "animate-pulse" : ""}
                />
                <text x="20" y="24" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">VAN 3</text>
                <text x="20" y="44" textAnchor="middle" fill="#64748b" fontSize="7">Solenoid</text>
              </g>

              {/* YF-S201 Hàng 3 */}
              <g transform="translate(68, 52)">
                <rect x="0" y="6" width="46" height="30" rx="6" fill="#1e293b" stroke="#0284c7" strokeWidth="1" />
                <circle cx="23" cy="21" r="10" fill="#0369a1" />
                <g className={row3Valve ? "anim-spin-fast" : ""} transform="translate(23, 21)">
                  <line x1="-7" y1="0" x2="7" y2="0" stroke="#ffffff" strokeWidth="2" />
                  <line x1="0" y1="-7" x2="0" y2="7" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="0" cy="0" r="2.5" fill="#eab308" />
                </g>
                <circle cx="39" cy="11" r="2.5" fill="#eab308" className={row3Valve ? "animate-ping" : ""} />
                <text x="23" y="44" textAnchor="middle" fill="#0284c7" fontSize="7 font-mono font-bold">YF-S201</text>
              </g>

              <line
                x1="120"
                y1="73"
                x2="685"
                y2="73"
                stroke={row3Valve ? "#0284c7" : "#cbd5e1"}
                strokeWidth="4"
                className={row3Valve ? "anim-flow-water" : ""}
              />

              {/* 4 Chậu hàng 3 */}
              {[1, 2, 3, 4].map((potNum, i) => {
                const px = 175 + i * 135;
                const hasSensor = potNum === 1 || potNum === 3;
                const sensorName = potNum === 1 ? "S3" : "S4";
                const sensorVal = potNum === 1 ? s3 : s4;
                const isDry = sensorVal != null && sensorVal < 38;

                return (
                  <g key={potNum} transform={`translate(${px}, 48)`}>
                    <line x1="25" y1="25" x2="25" y2="38" stroke={row3Valve ? "#0284c7" : "#94a3b8"} strokeWidth="2" />
                    {row3Valve && (
                      <g>
                        <circle cx="25" cy="40" r="2.5" fill="#38bdf8" className="anim-drip-water" />
                        <circle cx="25" cy="56" r="3" fill="none" stroke="#38bdf8" strokeWidth="1.5" className="anim-drip-ripple" />
                      </g>
                    )}
                    <path
                      d="M 6 52 L 12 76 L 38 76 L 44 52 Z"
                      fill={isDry ? "#b45309" : "url(#soilPotGrad)"}
                      stroke="#78350f"
                      strokeWidth="1.5"
                    />
                    <circle cx="25" cy="38" r="16" fill="url(#tomatoLeafGrad)" opacity="0.95" />
                    <circle cx="18" cy="35" r="3.5" fill="#dc2626" />
                    <circle cx="31" cy="42" r="3.5" fill="#dc2626" />
                    <text x="25" y="68" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      C3-{potNum}
                    </text>

                    {hasSensor && (
                      <g
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedZone(potNum === 1 ? "sensor_s3" : "sensor_s4");
                        }}
                        className="cursor-pointer"
                        transform="translate(36, 32)"
                      >
                        <rect x="0" y="0" width="12" height="38" rx="2" fill="#0f172a" stroke="#0d9488" strokeWidth="1" />
                        <line x1="3" y1="18" x2="3" y2="36" stroke="#f59e0b" strokeWidth="1.5" />
                        <line x1="9" y1="18" x2="9" y2="36" stroke="#f59e0b" strokeWidth="1.5" />
                        <circle cx="6" cy="28" r="6" fill="none" stroke="#0d9488" strokeWidth="1" opacity="0.7" className="anim-capacitive-field" />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Đường liên kết thích ứng vi khí hậu VPD */}
            <path
              d="M 225 470 C 250 470, 260 450, 280 435"
              fill="none"
              stroke="#0d9488"
              strokeWidth="2"
              strokeDasharray="4 3"
              className="anim-flow-water"
            />
            <rect x="235" y="445" width="55" height="15" rx="3" fill="#ccfbf1" stroke="#0d9488" strokeWidth="0.8" />
            <text x="262" y="456" textAnchor="middle" fill="#0f766e" fontSize="7 font-bold">
              +VPD Boost
            </text>

            {/* ========================================================================= */}
            {/* LỚP TRÌNH DIỄN MỐC VỊ TRÍ THINGSBOARD CLOUD MAP PINS (HIỂN THỊ ĐÈ LÊN TRÊN) */}
            {/* ========================================================================= */}

            {/* 1. MỐC BỒN NƯỚC 100L */}
            <ThingsBoardPin
              x={125}
              y={75}
              title={isTankEmpty ? "🚨 BỒN CẠN NƯỚC!" : "Bồn Nước 100L"}
              isFault={isTankEmpty}
              iconType="tank"
              visible={showAllPins || isTankEmpty}
              onClick={() => setSelectedZone("tank")}
            />

            {/* 2. MỐC BƠM TĂNG ÁP 12V */}
            <ThingsBoardPin
              x={125}
              y={195}
              title={isTankEmpty && pumpOn ? "⚠️ BƠM: KHÓA AN TOÀN" : pumpOn ? "Bơm 12V (Đang chạy)" : "Bơm 12V (Nghỉ)"}
              isWarning={isTankEmpty && pumpOn}
              iconType="pump"
              visible={showAllPins || (isTankEmpty && pumpOn)}
              onClick={() => setSelectedZone("pump")}
            />

            {/* 3. MỐC TỦ ĐIỀU KHIỂN TRUNG TÂM IOT */}
            <ThingsBoardPin
              x={125}
              y={295}
              title="Tủ IoT ESP32-S3 (4G)"
              iconType="controller"
              visible={showAllPins}
              onClick={() => setSelectedZone("controller")}
            />

            {/* 4. MỐC TRẠM VI KHÍ HẬU SHT31 */}
            <ThingsBoardPin
              x={125}
              y={435}
              title={vpdKpa != null && vpdKpa >= 1.5 ? "⚠️ SHT31: Nắng Gắt (Bù VPD)" : "Trạm SHT31"}
              isWarning={vpdKpa != null && vpdKpa >= 1.5}
              iconType="weather"
              visible={showAllPins || (vpdKpa != null && vpdKpa >= 1.5)}
              onClick={() => setSelectedZone("weather")}
            />

            {/* 5. MỐC CỤM VAN 1 & YF-S201 */}
            <ThingsBoardPin
              x={345}
              y={85}
              title={
                hasNoFlowH1
                  ? "🚨 MẤT DÒNG CHẢY H1!"
                  : hasLeakH1
                  ? "⚠️ RÒ RỈ VAN 1!"
                  : row1Valve
                  ? "Van 1 (Đang tưới)"
                  : "Van 1 & YF-S201"
              }
              isFault={hasNoFlowH1}
              isWarning={hasLeakH1}
              iconType="valve"
              visible={showAllPins || hasNoFlowH1 || hasLeakH1}
              onClick={() => setSelectedZone("row1")}
            />

            {/* 6. MỐC CỤM VAN 2 & YF-S201 */}
            <ThingsBoardPin
              x={345}
              y={235}
              title={
                hasNoFlowH2
                  ? "🚨 MẤT DÒNG CHẢY H2!"
                  : hasLeakH2
                  ? "⚠️ RÒ RỈ VAN 2!"
                  : row2Valve
                  ? "Van 2 (Đang tưới)"
                  : "Van 2 & YF-S201"
              }
              isFault={hasNoFlowH2}
              isWarning={hasLeakH2}
              iconType="valve"
              visible={showAllPins || hasNoFlowH2 || hasLeakH2}
              onClick={() => setSelectedZone("row2")}
            />

            {/* 7. MỐC CỤM VAN 3 & YF-S201 */}
            <ThingsBoardPin
              x={345}
              y={395}
              title={
                hasNoFlowH3
                  ? "🚨 MẤT DÒNG CHẢY H3!"
                  : hasLeakH3
                  ? "⚠️ RÒ RỈ VAN 3!"
                  : row3Valve
                  ? "Van 3 (Đang tưới)"
                  : "Van 3 & YF-S201"
              }
              isFault={hasNoFlowH3}
              isWarning={hasLeakH3}
              iconType="valve"
              visible={showAllPins || hasNoFlowH3 || hasLeakH3}
              onClick={() => setSelectedZone("row3")}
            />

            {/* 8. MỐC CẢM BIẾN ĐỘ ẨM ĐẤT S1 (HÀNG 2 - CHẬU 1) */}
            <ThingsBoardPin
              x={485}
              y={235}
              title={s1 != null && s1 < 30 ? `🚨 S1: KHÔ HẠN (${s1.toFixed(1)}%)` : `Cảm Biến S1 (${s1?.toFixed(1) || "—"}%)`}
              isFault={s1 != null && s1 < 30}
              iconType="soil"
              visible={showAllPins || (s1 != null && s1 < 30)}
              onClick={() => setSelectedZone("sensor_s1")}
            />

            {/* 9. MỐC CẢM BIẾN ĐỘ ẨM ĐẤT S2 (HÀNG 2 - CHẬU 3) */}
            <ThingsBoardPin
              x={755}
              y={235}
              title={s2 != null && s2 < 30 ? `🚨 S2: KHÔ HẠN (${s2.toFixed(1)}%)` : `Cảm Biến S2 (${s2?.toFixed(1) || "—"}%)`}
              isFault={s2 != null && s2 < 30}
              iconType="soil"
              visible={showAllPins || (s2 != null && s2 < 30)}
              onClick={() => setSelectedZone("sensor_s2")}
            />

            {/* 10. MỐC CẢM BIẾN ĐỘ ẨM ĐẤT S3 (HÀNG 3 - CHẬU 1) */}
            <ThingsBoardPin
              x={485}
              y={395}
              title={s3 != null && s3 < 30 ? `🚨 S3: KHÔ HẠN (${s3.toFixed(1)}%)` : `Cảm Biến S3 (${s3?.toFixed(1) || "—"}%)`}
              isFault={s3 != null && s3 < 30}
              iconType="soil"
              visible={showAllPins || (s3 != null && s3 < 30)}
              onClick={() => setSelectedZone("sensor_s3")}
            />

            {/* 11. MỐC CẢM BIẾN ĐỘ ẨM ĐẤT S4 (HÀNG 3 - CHẬU 3) */}
            <ThingsBoardPin
              x={755}
              y={395}
              title={s4 != null && s4 < 30 ? `🚨 S4: KHÔ HẠN (${s4.toFixed(1)}%)` : `Cảm Biến S4 (${s4?.toFixed(1) || "—"}%)`}
              isFault={s4 != null && s4 < 30}
              iconType="soil"
              visible={showAllPins || (s4 != null && s4 < 30)}
              onClick={() => setSelectedZone("sensor_s4")}
            />

            {/* Dòng chú thích mặt bằng */}
            <text x="32" y="555" fill="#94a3b8" fontSize="10">
              📍 Mốc vị trí ThingsBoard Cloud • Nhấp vào ghim đỏ (✕) để xem chẩn đoán sự cố và hướng dẫn công nhân xử lý (SOP)
            </text>
          </svg>
        </div>
      </div>

      {/* 3. NGĂN THÔNG TIN CHI TIẾT THIẾT BỊ & HƯỚNG DẪN SOP CÔNG NHÂN KHI BẤM VÀO SƠ ĐỒ HOẶC GHIM PIN */}
      {selectedZone && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xl transition-all animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-sm">
                <MapPin className="w-4 h-4 text-sky-700" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  {selectedZone === "tank" && "Chi Tiết Vị Trí: Bồn Nước 100L & Cảm Biến Phao Điện Từ"}
                  {selectedZone === "pump" && "Chi Tiết Vị Trí: Bơm Tăng Áp 12V DC & Rơ-le Cấp Nước"}
                  {selectedZone === "controller" && "Chi Tiết Vị Trí: Tủ Điều Khiển Trung Tâm IoT (ESP32-S3 + 4G LTE)"}
                  {selectedZone === "weather" && "Chi Tiết Vị Trí: Trạm Đo Vi Khí Hậu Nhà Màng SHT31 & Chỉ Số VPD"}
                  {selectedZone === "row1" && "Chi Tiết Vị Trí: Hàng 1 — Hẹn Giờ Cố Định (Van 1 & YF-S201)"}
                  {selectedZone === "row2" && "Chi Tiết Vị Trí: Hàng 2 — Độ Ẩm Đất Tự Động (Van 2 & YF-S201)"}
                  {selectedZone === "row3" && "Chi Tiết Vị Trí: Hàng 3 — Đa Cảm Biến Bù VPD (Van 3 & YF-S201)"}
                  {selectedZone === "sensor_s1" && "Chi Tiết Vị Trí: Cảm Biến Độ Ẩm Đất S1 (Hàng 2 - Chậu 1)"}
                  {selectedZone === "sensor_s2" && "Chi Tiết Vị Trí: Cảm Biến Độ Ẩm Đất S2 (Hàng 2 - Chậu 3)"}
                  {selectedZone === "sensor_s3" && "Chi Tiết Vị Trí: Cảm Biến Độ Ẩm Đất S3 (Hàng 3 - Chậu 1)"}
                  {selectedZone === "sensor_s4" && "Chi Tiết Vị Trí: Cảm Biến Độ Ẩm Đất S4 (Hàng 3 - Chậu 3)"}
                </h4>
                <p className="text-[11px] text-slate-500">Thông số kỹ thuật phần cứng, tình trạng đo và quy trình vận hành chuẩn</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedZone(null)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 text-xs space-y-3">
            {/* THÔNG TIN BỒN NƯỚC */}
            {selectedZone === "tank" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Trạng thái phao</span>
                    <strong className={`text-sm ${isTankEmpty ? "text-red-600 font-black" : "text-sky-700"}`}>
                      {isTankWaiting ? "Chờ tín hiệu" : isTankEmpty ? "CHÌM (CẠN NƯỚC!)" : "NỔI (ĐỦ NƯỚC)"}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Loại cảm biến</span>
                    <strong className="text-sm text-slate-800">Phao từ Reed Switch Inox</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Dung tích thiết kế</span>
                    <strong className="text-sm text-slate-800">100 Lít</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Liên động an toàn</span>
                    <strong className="text-sm text-slate-800">Khóa van &amp; ngắt bơm</strong>
                  </div>
                </div>
                {isTankEmpty && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1">
                    <strong className="font-bold flex items-center gap-1.5 text-red-800">
                      <Wrench className="w-4 h-4" /> QUY TRÌNH XỬ LÝ NHANH CHO CÔNG NHÂN:
                    </strong>
                    <p>1. Đến bồn chứa nước 100L và kiểm tra thực tế van cấp nước nguồn.</p>
                    <p>2. Mở khóa vòi nước máy cấp bù vào bồn hoặc kiểm tra téc tổng.</p>
                    <p>3. Khi mực nước dâng trên vạch tối thiểu, phao sẽ tự nổi lên và hệ thống tự động mở khóa tưới lại.</p>
                  </div>
                )}
              </div>
            )}

            {/* THÔNG TIN BƠM TĂNG ÁP */}
            {selectedZone === "pump" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Trạng thái động cơ</span>
                    <strong className={`text-sm ${pumpOn ? "text-emerald-600 font-black" : "text-slate-700"}`}>
                      {pumpOn ? "ĐANG CHẠY 12V" : "ĐANG NGHỈ"}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Điện áp danh định</span>
                    <strong className="text-sm text-slate-800">12V DC • Relay Opto cách ly</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Lưu lượng định mức</span>
                    <strong className="text-sm text-slate-800">4.5 Lít/phút</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Trễ đóng cắt</span>
                    <strong className="text-sm text-slate-800">Mở van trước 700ms</strong>
                  </div>
                </div>
              </div>
            )}

            {/* THÔNG TIN CẢM BIẾN ĐỘ ẨM ĐẤT (S1, S2, S3, S4) */}
            {["sensor_s1", "sensor_s2", "sensor_s3", "sensor_s4"].includes(selectedZone) && (
              <div className="space-y-3">
                {(() => {
                  const sNum = selectedZone === "sensor_s1" ? 1 : selectedZone === "sensor_s2" ? 2 : selectedZone === "sensor_s3" ? 3 : 4;
                  const rowNum = sNum <= 2 ? 2 : 3;
                  const potNum = sNum === 1 || sNum === 3 ? 1 : 3;
                  const curVal = sNum === 1 ? s1 : soilMoisture[sNum - 1];
                  const isDrought = curVal != null && curVal < 30;
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Giá trị độ ẩm đo được</span>
                          <strong className={`text-base font-black ${isDrought ? "text-red-600" : "text-emerald-700"}`}>
                            {curVal != null ? `${curVal.toFixed(1)}%` : "Chờ bản tin"}
                          </strong>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Công nghệ cảm biến</span>
                          <strong className="text-sm text-slate-800">Điện dung (Capacitive v1.2)</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Vị trí cắm thực tế</span>
                          <strong className="text-sm text-slate-800">Hàng {rowNum} — Chậu C{rowNum}-{potNum}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Chống ăn mòn</span>
                          <strong className="text-sm text-emerald-700">Không bị điện phân mòn cực</strong>
                        </div>
                      </div>
                      {isDrought && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900">
                          <strong>🚨 CẢNH BÁO ĐẤT KHÔ HẠN:</strong> Độ ẩm bầu đất đang dưới ngưỡng 30%. Hãy nhấn nút <strong>"Tưới Hàng {rowNum} ngay"</strong> hoặc kiểm tra chế độ tưới tự động để bù ẩm kịp thời cho cây cà chua.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* THÔNG TIN HÀNG 1, 2, 3 VÀ THAO TÁC NHANH */}
            {["row1", "row2", "row3"].includes(selectedZone) && (
              <div className="space-y-3">
                {(() => {
                  const rId = selectedZone === "row1" ? 1 : selectedZone === "row2" ? 2 : 3;
                  const isV = rows.find((r) => r.id === rId)?.valve;
                  const daily = rows.find((r) => r.id === rId)?.daily_l ?? 0;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Trạng thái van điện từ Hàng {rId}:</span>
                        <strong className={`text-sm ${isV ? "text-emerald-700 font-black" : "text-slate-700"}`}>
                          {isV ? "● ĐANG MỞ TƯỚI (CÓ LƯU LƯỢNG)" : "○ ĐANG ĐÓNG"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Lượng nước tích lũy hôm nay:</span>
                        <strong className="text-sm font-extrabold text-slate-800">{daily.toFixed(2)} Lít</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={!canOperate || isTankEmpty || isV}
                          onClick={() => onTriggerRow(rId)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs disabled:opacity-40 transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Tưới Hàng {rId} ngay
                        </button>
                        <button
                          disabled={!canOperate || !isV}
                          onClick={() => onTriggerRow(rId)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs disabled:opacity-40 transition-all cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" /> Đóng van
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
