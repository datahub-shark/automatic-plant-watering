"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Gauge,
  Info,
  Layers,
  MapPin,
  Play,
  Power,
  RefreshCw,
  Square,
  Thermometer,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { EventItem, Row } from "./hmi-types";

interface HmiGardenMapProps {
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
}: HmiGardenMapProps) {
  // Đối tượng đang được chọn để xem chi tiết
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Phân tích trạng thái lỗi của các khu vực trên vườn
  const isTankEmpty = tankOk === false;
  const isTankWaiting = tankOk === null;

  // Lỗi từ các sự kiện gần nhất hoặc cờ trạng thái
  const recentEvents = events.slice(0, 10);
  const row1Valve = rows.find((r) => r.id === 1)?.valve ?? false;
  const row2Valve = rows.find((r) => r.id === 2)?.valve ?? false;
  const row3Valve = rows.find((r) => r.id === 3)?.valve ?? false;

  const row1DailyL = rows.find((r) => r.id === 1)?.daily_l ?? 0;
  const row2DailyL = rows.find((r) => r.id === 2)?.daily_l ?? 0;
  const row3DailyL = rows.find((r) => r.id === 3)?.daily_l ?? 0;

  // Kiểm tra lỗi rò rỉ hoặc mất dòng trên từng hàng
  const hasNoFlowH1 = recentEvents.some((e) => e.row === 1 && e.type === "ERROR_NO_FLOW");
  const hasLeakH1 = recentEvents.some((e) => e.row === 1 && e.type === "ERROR_VALVE_LEAK");

  const hasNoFlowH2 = recentEvents.some((e) => e.row === 2 && e.type === "ERROR_NO_FLOW");
  const hasLeakH2 = recentEvents.some((e) => e.row === 2 && e.type === "ERROR_VALVE_LEAK");

  const hasNoFlowH3 = recentEvents.some((e) => e.row === 3 && e.type === "ERROR_NO_FLOW");
  const hasLeakH3 = recentEvents.some((e) => e.row === 3 && e.type === "ERROR_VALVE_LEAK");

  // Kiểm tra cảnh báo độ ẩm đất
  const s1 = soilMoisture[0];
  const s2 = soilMoisture[1];
  const s3 = soilMoisture[2];
  const s4 = soilMoisture[3];

  const h2Avg = s1 != null && s2 != null ? (s1 + s2) / 2 : s1 ?? s2 ?? null;
  const h3Avg = s3 != null && s4 != null ? (s3 + s4) / 2 : s3 ?? s4 ?? null;

  // Đếm tổng số sự cố đang kích hoạt trên bản đồ
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
      zoneName: "Khu Bồn Nước Nguồn 100L",
      level: "critical",
      message: "Cảm biến phao báo cạn nước. Bơm đã bị khóa an toàn.",
      solution: "Bơm thêm nước nguồn vào bồn và kiểm tra phao nổi lại.",
    });
  }

  if (hasNoFlowH1) {
    activeFaults.push({
      zoneId: "row1",
      zoneName: "Luống Cà Chua Hàng 1",
      level: "critical",
      message: "Van 1 mở nhưng không có dòng chảy nước qua cảm biến YF-S201.",
      solution: "Kiểm tra van cơ chặn hoặc lưới lọc đầu van có bị tắc nghẽn.",
    });
  }
  if (hasLeakH1) {
    activeFaults.push({
      zoneId: "row1",
      zoneName: "Cụm Van Điện Từ Hàng 1",
      level: "warning",
      message: "Phát hiện xung nước chảy khi Van 1 đang ở lệnh đóng.",
      solution: "Kiểm tra màng cao su van điện từ có bị kẹt cặn cát.",
    });
  }

  if (hasNoFlowH2) {
    activeFaults.push({
      zoneId: "row2",
      zoneName: "Luống Cà Chua Hàng 2",
      level: "critical",
      message: "Van 2 mở nhưng không ghi nhận lưu lượng nước cấp.",
      solution: "Kiểm tra ống nhỏ giọt PE16 trên luống có bị gập xoắn.",
    });
  }
  if (hasLeakH2) {
    activeFaults.push({
      zoneId: "row2",
      zoneName: "Cụm Van Điện Từ Hàng 2",
      level: "warning",
      message: "Nghi vấn rò rỉ nước tại van điện từ Hàng 2.",
      solution: "Tháo vệ sinh màng van hoặc thay thế màng cao su.",
    });
  }

  if (hasNoFlowH3) {
    activeFaults.push({
      zoneId: "row3",
      zoneName: "Luống Cà Chua Hàng 3",
      level: "critical",
      message: "Mất lưu lượng nước khi tưới Hàng 3.",
      solution: "Kiểm tra bơm tăng áp và áp lực đường ống chính.",
    });
  }
  if (hasLeakH3) {
    activeFaults.push({
      zoneId: "row3",
      zoneName: "Cụm Van Điện Từ Hàng 3",
      level: "warning",
      message: "Nghi vấn rò rỉ van điện từ Hàng 3.",
      solution: "Kiểm tra đóng kín van và đầu nối ren ống.",
    });
  }

  if (h2Avg != null && h2Avg < 30) {
    activeFaults.push({
      zoneId: "row2",
      zoneName: "Độ Ẩm Đất Hàng 2",
      level: "warning",
      message: `Đất đang khô hạn (${h2Avg.toFixed(1)}% < 35%).`,
      solution: "Hệ thống sẽ tự động tưới bù hoặc bấm 'Tưới ngay'.",
    });
  }

  if (h3Avg != null && h3Avg < 30) {
    activeFaults.push({
      zoneId: "row3",
      zoneName: "Độ Ẩm Đất Hàng 3",
      level: "warning",
      message: `Đất đang khô hạn (${h3Avg.toFixed(1)}% < 38%).`,
      solution: "Kiểm tra chế độ tưới tự động tích hợp bù vi khí hậu VPD.",
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. THANH TỔNG HỢP TRẠNG THÁI SỰ CỐ VƯỜN */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          activeFaults.length > 0
            ? "bg-red-50 border-red-300 shadow-md ring-1 ring-red-400"
            : "bg-emerald-50/60 border-emerald-200 shadow-sm"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                activeFaults.length > 0 ? "bg-red-100 text-red-600 animate-pulse" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {activeFaults.length > 0 ? <AlertOctagon className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`text-base font-black tracking-tight ${
                    activeFaults.length > 0 ? "text-red-900" : "text-emerald-950"
                  }`}
                >
                  {activeFaults.length > 0
                    ? `PHÁT HIỆN ${activeFaults.length} VỊ TRÍ CẦN XỬ LÝ TRÊN SƠ ĐỒ VƯỜN`
                    : "TOÀN BỘ 12 CHẬU CÀ CHUA & HỆ THỐNG ĐANG HOẠT ĐỘNG TỐT"}
                </h3>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    activeFaults.length > 0 ? "bg-red-200 text-red-800" : "bg-emerald-200 text-emerald-800"
                  }`}
                >
                  {activeFaults.length > 0 ? "Có cảnh báo" : "An toàn 100%"}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  activeFaults.length > 0 ? "text-red-800 font-medium" : "text-emerald-800"
                }`}
              >
                {activeFaults.length > 0
                  ? "Quan sát vị trí nhấp nháy đỏ trên bản đồ 2D bên dưới và nhấp chuột để xem giải pháp khắc phục."
                  : "Mực nước bồn, áp lực bơm, 3 van điện từ và 4 cảm biến độ ẩm đất đang ở trạng thái tối ưu."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              Trực quan thời gian thực
            </span>
          </div>
        </div>

        {/* Danh sách lỗi nhanh nếu có */}
        {activeFaults.length > 0 && (
          <div className="mt-4 pt-3 border-t border-red-200/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {activeFaults.map((fault, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedZone(fault.zoneId)}
                className="p-2.5 rounded-xl bg-white/90 border border-red-200 hover:border-red-400 cursor-pointer transition-all flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-red-950 font-bold">{fault.zoneName}</strong>
                    <span className="text-[10px] text-red-600 font-bold underline">Xem vị trí</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">{fault.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. BẢN ĐỒ 2D SƠ ĐỒ NHÀ MÀNG & KHU VỰC TRỒNG CÀ CHUA (SVG INTERACTIVE MAP) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                🌱
              </span>
              <h3 className="text-base font-bold text-slate-800">
                Sơ Đồ Mặt Bằng 2D Nhà Màng Cà Chua 3 Hàng (12 Chậu)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Mô phỏng không gian thực tế: Bấm vào từng thiết bị, van hoặc chậu cây để xem thông số và phát lệnh.
            </p>
          </div>

          {/* Chú giải ký hiệu */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đang tưới
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Đang nghỉ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span> Báo động lỗi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Cần tưới bù
            </span>
          </div>
        </div>

        {/* Khung bản đồ SVG Responsive */}
        <div className="w-full overflow-x-auto bg-slate-900/5 rounded-2xl border border-slate-200/90 p-2 sm:p-4">
          <svg
            viewBox="0 0 960 540"
            className="w-full h-auto max-w-full drop-shadow-xs select-none"
            role="img"
            aria-label="Bản đồ 2D nhà màng tưới cà chua 3 hàng"
          >
            {/* 1. NỀN NHÀ MÀNG CÔNG NGHỆ CAO */}
            <rect x="10" y="10" width="940" height="520" rx="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
            <rect x="18" y="18" width="924" height="504" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />

            {/* Các thanh giằng vòm nhà màng (Greenhouse Arches) */}
            {[180, 360, 540, 720].map((gx) => (
              <line key={gx} x1={gx} y1="20" x2={gx} y2="520" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6 6" />
            ))}

            {/* Vách ngăn khu kỹ thuật & luống cây */}
            <line x1="240" y1="20" x2="240" y2="520" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
            <text x="30" y="45" fill="#64748b" fontSize="12" fontWeight="800" letterSpacing="1">
              KHU KỸ THUẬT &amp; ĐIỀU KHIỂN
            </text>
            <text x="260" y="45" fill="#64748b" fontSize="12" fontWeight="800" letterSpacing="1">
              KHU VỰC 3 HÀNG CÀ CHUA (12 CHẬU THỰC NGHIỆM)
            </text>

            {/* ================= KHU KỸ THUẬT (BÊN TRÁI: x: 30 -> 220) ================= */}

            {/* 1. BỒN CHỨA NƯỚC 100L */}
            <g
              onClick={() => setSelectedZone("tank")}
              className="cursor-pointer transition-transform hover:scale-102"
              transform="translate(35, 70)"
            >
              <rect
                x="0"
                y="0"
                width="170"
                height="100"
                rx="12"
                fill={isTankEmpty ? "#fee2e2" : isTankWaiting ? "#f1f5f9" : "#f0f9ff"}
                stroke={isTankEmpty ? "#dc2626" : isTankWaiting ? "#94a3b8" : "#0284c7"}
                strokeWidth={isTankEmpty ? 3 : 1.5}
                className={isTankEmpty ? "animate-pulse" : ""}
              />
              {/* Nắp bồn */}
              <rect x="60" y="-8" width="50" height="8" rx="3" fill="#64748b" />
              {/* Icon & Tiêu đề */}
              <text x="16" y="28" fill="#1e293b" fontSize="12" fontWeight="bold">
                BỒN NƯỚC 100L
              </text>
              <text x="16" y="46" fill="#64748b" fontSize="10">
                Phao: {isTankWaiting ? "Chờ kết nối" : isTankEmpty ? "CHÌM (CẠN NƯỚC!)" : "NỔI (Đủ nước)"}
              </text>

              {/* Mức nước đồ họa */}
              <rect
                x="16"
                y="55"
                width="138"
                height="16"
                rx="4"
                fill="#e2e8f0"
              />
              <rect
                x="16"
                y="55"
                width={isTankEmpty ? "20" : isTankWaiting ? "65" : "138"}
                height="16"
                rx="4"
                fill={isTankEmpty ? "#ef4444" : isTankWaiting ? "#94a3b8" : "#0284c7"}
              />
              <text
                x="85"
                y="67"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
              >
                {isTankEmpty ? "10% — CẠN" : isTankWaiting ? "ĐANG ĐỒNG BỘ" : "100% — ĐỦ NƯỚC"}
              </text>

              {isTankEmpty && (
                <g transform="translate(135, 12)">
                  <circle cx="10" cy="10" r="12" fill="#ef4444" />
                  <text x="10" y="14" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">!</text>
                </g>
              )}
            </g>

            {/* 2. MÁY BƠM TĂNG ÁP 12V */}
            <g
              onClick={() => setSelectedZone("pump")}
              className="cursor-pointer transition-transform hover:scale-102"
              transform="translate(35, 195)"
            >
              <rect
                x="0"
                y="0"
                width="170"
                height="80"
                rx="12"
                fill={pumpOn ? "#ecfdf5" : "#f8fafc"}
                stroke={pumpOn ? "#10b981" : "#cbd5e1"}
                strokeWidth={pumpOn ? 2.5 : 1.5}
              />
              <circle
                cx="35"
                cy="40"
                r="22"
                fill={pumpOn ? "#10b981" : "#e2e8f0"}
                className={pumpOn ? "animate-pulse" : ""}
              />
              <text x="35" y="44" textAnchor="middle" fill={pumpOn ? "#ffffff" : "#64748b"} fontSize="13" fontWeight="black">
                {pumpOn ? "ON" : "OFF"}
              </text>
              <text x="68" y="34" fill="#1e293b" fontSize="12" fontWeight="bold">
                BƠM TĂNG ÁP 12V
              </text>
              <text x="68" y="52" fill={pumpOn ? "#059669" : "#64748b"} fontSize="10" fontWeight="bold">
                {pumpOn ? "● Đang chạy cấp nước" : "○ Đang nghỉ"}
              </text>
            </g>

            {/* 3. TỦ ĐIỀU KHIỂN TRUNG TÂM (ESP32-S3 + 4G LTE) */}
            <g
              onClick={() => setSelectedZone("controller")}
              className="cursor-pointer transition-transform hover:scale-102"
              transform="translate(35, 300)"
            >
              <rect
                x="0"
                y="0"
                width="170"
                height="95"
                rx="12"
                fill="#f8fafc"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <text x="16" y="24" fill="#1e293b" fontSize="11" fontWeight="bold">
                TỦ ĐIỀU KHIỂN IOT (4G)
              </text>
              <text x="16" y="40" fill="#64748b" fontSize="9">
                ESP32-S3 • A7672X • Nguồn 12V
              </text>
              <div className="flex gap-2">
                {/* 3 đèn LED trạng thái */}
                <circle cx="25" cy="62" r="5" fill="#10b981" />
                <text x="36" y="65" fill="#475569" fontSize="9">PWR</text>

                <circle cx="75" cy="62" r="5" fill="#0284c7" className="animate-ping" />
                <text x="86" y="65" fill="#475569" fontSize="9">4G LTE</text>

                <circle cx="125" cy="62" r="5" fill={activeFaults.length > 0 ? "#ef4444" : "#cbd5e1"} />
                <text x="136" y="65" fill="#475569" fontSize="9">ALARM</text>
              </div>
              <text x="16" y="84" fill="#059669" fontSize="9" fontWeight="bold">
                Cloudflare Worker D1: Đồng bộ 100%
              </text>
            </g>

            {/* 4. TRẠM VI KHÍ HẬU SHT31 (NHÀ MÀNG) */}
            <g
              onClick={() => setSelectedZone("weather")}
              className="cursor-pointer transition-transform hover:scale-102"
              transform="translate(35, 415)"
            >
              <rect
                x="0"
                y="0"
                width="170"
                height="90"
                rx="12"
                fill="#f0fdfa"
                stroke="#0d9488"
                strokeWidth="1.5"
              />
              <text x="16" y="24" fill="#115e59" fontSize="11" fontWeight="bold">
                TRẠM VI KHÍ HẬU SHT31
              </text>
              <text x="16" y="45" fill="#0f766e" fontSize="13" fontWeight="black">
                {tempC != null ? `${tempC.toFixed(1)}°C` : "—"} / {rhPct != null ? `${Math.round(rhPct)}%` : "—"}
              </text>
              <text x="16" y="66" fill="#134e4a" fontSize="11" fontWeight="bold">
                VPD: {vpdKpa != null ? `${vpdKpa.toFixed(2)} kPa` : "—"}
              </text>
              <text x="16" y="80" fill={vpdKpa != null && vpdKpa >= 1.5 ? "#b45309" : "#0d9488"} fontSize="9" fontWeight="bold">
                {vpdKpa != null && vpdKpa >= 1.5 ? "🔥 Nắng gắt (Bù nước H3)" : "🌤 Thuận lợi phát triển"}
              </text>
            </g>

            {/* ================= ĐƯỜNG ỐNG NƯỚC CHÍNH (PE16) TỪ BƠM SANG 3 HÀNG ================= */}
            {/* Ống từ bồn vào bơm */}
            <line x1="120" y1="170" x2="120" y2="195" stroke={isTankEmpty ? "#fca5a5" : "#0284c7"} strokeWidth="5" />
            {/* Ống từ bơm sang trục phân phối chính */}
            <path
              d="M 205 235 L 255 235 L 255 120 L 290 120 M 255 235 L 290 260 M 255 235 L 255 400 L 290 400"
              fill="none"
              stroke={pumpOn ? "#0284c7" : "#94a3b8"}
              strokeWidth="4"
              strokeDasharray={pumpOn ? "8 4" : "none"}
              className={pumpOn ? "animate-pulse" : ""}
            />

            {/* ================= 3 LUỐNG CÀ CHUA (BÊN PHẢI) ================= */}

            {/* ==================== HÀNG 1: HẸN GIỜ CỐ ĐỊNH ==================== */}
            <g
              onClick={() => setSelectedZone("row1")}
              className="cursor-pointer"
              transform="translate(280, 65)"
            >
              {/* Vùng luống đất */}
              <rect
                x="0"
                y="0"
                width="640"
                height="115"
                rx="14"
                fill={hasNoFlowH1 || hasLeakH1 ? "#fef2f2" : row1Valve ? "#f0fdf4" : "#ffffff"}
                stroke={hasNoFlowH1 || hasLeakH1 ? "#ef4444" : row1Valve ? "#10b981" : "#e2e8f0"}
                strokeWidth={hasNoFlowH1 || hasLeakH1 ? 2.5 : row1Valve ? 2 : 1}
              />
              {/* Tiêu đề Hàng 1 */}
              <rect x="12" y="10" width="30" height="20" rx="6" fill="#d97706" />
              <text x="27" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">H1</text>
              <text x="50" y="24" fill="#1e293b" fontSize="12" fontWeight="bold">
                HÀNG 1 — Hẹn Giờ Cố Định (06:00 &amp; 17:00) • {row1DailyL.toFixed(2)}L hôm nay
              </text>
              <rect
                x="480"
                y="10"
                width="145"
                height="20"
                rx="6"
                fill={row1Valve ? "#dcfce7" : "#f1f5f9"}
              />
              <text
                x="552"
                y="24"
                textAnchor="middle"
                fill={row1Valve ? "#15803d" : "#64748b"}
                fontSize="10"
                fontWeight="bold"
              >
                {row1Valve ? "● VAN ĐANG MỞ (TƯỚI)" : "○ VAN ĐÓNG"}
              </text>

              {/* Cụm van & Lưu lượng kế */}
              <g transform="translate(15, 45)">
                <rect x="0" y="5" width="45" height="30" rx="6" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
                <text x="22" y="20" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold">Van 1</text>
                <text x="22" y="30" textAnchor="middle" fill="#0284c7" fontSize="8 font-mono">YF-S201</text>
              </g>

              {/* Đường ống nhánh & 4 Chậu cà chua */}
              <line x1="60" y1="60" x2="610" y2="60" stroke={row1Valve ? "#0284c7" : "#cbd5e1"} strokeWidth="3" />

              {[1, 2, 3, 4].map((potNum, i) => {
                const px = 100 + i * 135;
                return (
                  <g key={potNum} transform={`translate(${px}, 35)`}>
                    {/* Béc tưới nhỏ giọt */}
                    <line x1="30" y1="25" x2="30" y2="35" stroke={row1Valve ? "#0284c7" : "#94a3b8"} strokeWidth="2" />
                    {row1Valve && (
                      <circle cx="30" cy="38" r="3" fill="#38bdf8" className="animate-ping" />
                    )}
                    {/* Chậu cây */}
                    <rect x="10" y="40" width="40" height="28" rx="4" fill="#a16207" stroke="#78350f" strokeWidth="1.5" />
                    {/* Cây cà chua */}
                    <circle cx="30" cy="28" r="16" fill="#15803d" opacity="0.9" />
                    <circle cx="23" cy="25" r="4" fill="#dc2626" />
                    <circle cx="35" cy="32" r="4" fill="#dc2626" />
                    <text x="30" y="58" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      C{potNum}
                    </text>
                  </g>
                );
              })}

              {/* Cảnh báo nếu có */}
              {(hasNoFlowH1 || hasLeakH1) && (
                <g transform="translate(450, 42)">
                  <rect x="0" y="0" width="170" height="24" rx="6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" />
                  <text x="10" y="16" fill="#b91c1c" fontSize="10" fontWeight="bold">
                    ⚠️ {hasNoFlowH1 ? "MẤT DÒNG CHẢY H1" : "NGHI RÒ RỈ VAN 1"}
                  </text>
                </g>
              )}
            </g>

            {/* ==================== HÀNG 2: THEO ĐỘ ẨM ĐẤT ==================== */}
            <g
              onClick={() => setSelectedZone("row2")}
              className="cursor-pointer"
              transform="translate(280, 205)"
            >
              <rect
                x="0"
                y="0"
                width="640"
                height="115"
                rx="14"
                fill={hasNoFlowH2 || hasLeakH2 ? "#fef2f2" : row2Valve ? "#f0fdf4" : "#ffffff"}
                stroke={hasNoFlowH2 || hasLeakH2 ? "#ef4444" : row2Valve ? "#10b981" : "#e2e8f0"}
                strokeWidth={hasNoFlowH2 || hasLeakH2 ? 2.5 : row2Valve ? 2 : 1}
              />
              <rect x="12" y="10" width="30" height="20" rx="6" fill="#059669" />
              <text x="27" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">H2</text>
              <text x="50" y="24" fill="#1e293b" fontSize="12" fontWeight="bold">
                HÀNG 2 — Theo Độ Ẩm Đất Tự Động (S1, S2) • {row2DailyL.toFixed(2)}L • TB: {h2Avg != null ? `${h2Avg.toFixed(1)}%` : "—"}
              </text>
              <rect
                x="480"
                y="10"
                width="145"
                height="20"
                rx="6"
                fill={row2Valve ? "#dcfce7" : "#f1f5f9"}
              />
              <text
                x="552"
                y="24"
                textAnchor="middle"
                fill={row2Valve ? "#15803d" : "#64748b"}
                fontSize="10"
                fontWeight="bold"
              >
                {row2Valve ? "● VAN ĐANG MỞ (TƯỚI)" : "○ VAN ĐÓNG"}
              </text>

              {/* Cụm van & Lưu lượng kế */}
              <g transform="translate(15, 45)">
                <rect x="0" y="5" width="45" height="30" rx="6" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
                <text x="22" y="20" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold">Van 2</text>
                <text x="22" y="30" textAnchor="middle" fill="#0284c7" fontSize="8 font-mono">YF-S201</text>
              </g>

              {/* Đường ống nhánh & 4 Chậu cà chua */}
              <line x1="60" y1="60" x2="610" y2="60" stroke={row2Valve ? "#0284c7" : "#cbd5e1"} strokeWidth="3" />

              {[1, 2, 3, 4].map((potNum, i) => {
                const px = 100 + i * 135;
                const hasSensor = potNum === 1 || potNum === 3;
                const sensorVal = potNum === 1 ? s1 : potNum === 3 ? s2 : null;
                const isDry = sensorVal != null && sensorVal < 35;
                const isWet = sensorVal != null && sensorVal > 55;

                return (
                  <g key={potNum} transform={`translate(${px}, 35)`}>
                    <line x1="30" y1="25" x2="30" y2="35" stroke={row2Valve ? "#0284c7" : "#94a3b8"} strokeWidth="2" />
                    {row2Valve && (
                      <circle cx="30" cy="38" r="3" fill="#38bdf8" className="animate-ping" />
                    )}
                    {/* Chậu cây */}
                    <rect
                      x="10"
                      y="40"
                      width="40"
                      height="28"
                      rx="4"
                      fill={isDry ? "#b45309" : isWet ? "#0284c7" : "#a16207"}
                      stroke="#78350f"
                      strokeWidth="1.5"
                    />
                    <circle cx="30" cy="28" r="16" fill="#15803d" opacity="0.9" />
                    <circle cx="23" cy="25" r="4" fill="#dc2626" />
                    <circle cx="35" cy="32" r="4" fill="#dc2626" />
                    <text x="30" y="58" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      C{potNum}
                    </text>

                    {/* Huy hiệu cảm biến độ ẩm cắm ở Chậu 1 và Chậu 3 */}
                    {hasSensor && (
                      <g transform="translate(-10, -8)">
                        <rect
                          x="0"
                          y="0"
                          width="80"
                          height="18"
                          rx="5"
                          fill={isDry ? "#fef3c7" : "#ecfdf5"}
                          stroke={isDry ? "#d97706" : "#059669"}
                          strokeWidth="1"
                        />
                        <text
                          x="40"
                          y="13"
                          textAnchor="middle"
                          fill={isDry ? "#b45309" : "#065f46"}
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {potNum === 1 ? "S1" : "S2"}: {sensorVal != null ? `${sensorVal.toFixed(1)}%` : "—"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {(hasNoFlowH2 || hasLeakH2) && (
                <g transform="translate(450, 42)">
                  <rect x="0" y="0" width="170" height="24" rx="6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" />
                  <text x="10" y="16" fill="#b91c1c" fontSize="10" fontWeight="bold">
                    ⚠️ {hasNoFlowH2 ? "MẤT DÒNG CHẢY H2" : "NGHI RÒ RỈ VAN 2"}
                  </text>
                </g>
              )}
            </g>

            {/* ==================== HÀNG 3: ĐA CẢM BIẾN & VPD KHÍ HẬU ==================== */}
            <g
              onClick={() => setSelectedZone("row3")}
              className="cursor-pointer"
              transform="translate(280, 345)"
            >
              <rect
                x="0"
                y="0"
                width="640"
                height="115"
                rx="14"
                fill={hasNoFlowH3 || hasLeakH3 ? "#fef2f2" : row3Valve ? "#f0fdf4" : "#ffffff"}
                stroke={hasNoFlowH3 || hasLeakH3 ? "#ef4444" : row3Valve ? "#10b981" : "#e2e8f0"}
                strokeWidth={hasNoFlowH3 || hasLeakH3 ? 2.5 : row3Valve ? 2 : 1}
              />
              <rect x="12" y="10" width="30" height="20" rx="6" fill="#0f766e" />
              <text x="27" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">H3</text>
              <text x="50" y="24" fill="#1e293b" fontSize="12" fontWeight="bold">
                HÀNG 3 — Đa Cảm Biến &amp; Bù Vi Khí Hậu VPD (S3, S4) • {row3DailyL.toFixed(2)}L • TB: {h3Avg != null ? `${h3Avg.toFixed(1)}%` : "—"}
              </text>
              <rect
                x="480"
                y="10"
                width="145"
                height="20"
                rx="6"
                fill={row3Valve ? "#dcfce7" : "#f1f5f9"}
              />
              <text
                x="552"
                y="24"
                textAnchor="middle"
                fill={row3Valve ? "#15803d" : "#64748b"}
                fontSize="10"
                fontWeight="bold"
              >
                {row3Valve ? "● VAN ĐANG MỞ (TƯỚI)" : "○ VAN ĐÓNG"}
              </text>

              {/* Cụm van & Lưu lượng kế */}
              <g transform="translate(15, 45)">
                <rect x="0" y="5" width="45" height="30" rx="6" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
                <text x="22" y="20" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold">Van 3</text>
                <text x="22" y="30" textAnchor="middle" fill="#0284c7" fontSize="8 font-mono">YF-S201</text>
              </g>

              {/* Đường ống nhánh & 4 Chậu cà chua */}
              <line x1="60" y1="60" x2="610" y2="60" stroke={row3Valve ? "#0284c7" : "#cbd5e1"} strokeWidth="3" />

              {[1, 2, 3, 4].map((potNum, i) => {
                const px = 100 + i * 135;
                const hasSensor = potNum === 1 || potNum === 3;
                const sensorVal = potNum === 1 ? s3 : potNum === 3 ? s4 : null;
                const isDry = sensorVal != null && sensorVal < 38;
                const isWet = sensorVal != null && sensorVal > 58;

                return (
                  <g key={potNum} transform={`translate(${px}, 35)`}>
                    <line x1="30" y1="25" x2="30" y2="35" stroke={row3Valve ? "#0284c7" : "#94a3b8"} strokeWidth="2" />
                    {row3Valve && (
                      <circle cx="30" cy="38" r="3" fill="#38bdf8" className="animate-ping" />
                    )}
                    <rect
                      x="10"
                      y="40"
                      width="40"
                      height="28"
                      rx="4"
                      fill={isDry ? "#b45309" : isWet ? "#0284c7" : "#a16207"}
                      stroke="#78350f"
                      strokeWidth="1.5"
                    />
                    <circle cx="30" cy="28" r="16" fill="#15803d" opacity="0.9" />
                    <circle cx="23" cy="25" r="4" fill="#dc2626" />
                    <circle cx="35" cy="32" r="4" fill="#dc2626" />
                    <text x="30" y="58" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      C{potNum}
                    </text>

                    {hasSensor && (
                      <g transform="translate(-10, -8)">
                        <rect
                          x="0"
                          y="0"
                          width="80"
                          height="18"
                          rx="5"
                          fill={isDry ? "#fef3c7" : "#f0fdfa"}
                          stroke={isDry ? "#d97706" : "#0f766e"}
                          strokeWidth="1"
                        />
                        <text
                          x="40"
                          y="13"
                          textAnchor="middle"
                          fill={isDry ? "#b45309" : "#115e59"}
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {potNum === 1 ? "S3" : "S4"}: {sensorVal != null ? `${sensorVal.toFixed(1)}%` : "—"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {(hasNoFlowH3 || hasLeakH3) && (
                <g transform="translate(450, 42)">
                  <rect x="0" y="0" width="170" height="24" rx="6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" />
                  <text x="10" y="16" fill="#b91c1c" fontSize="10" fontWeight="bold">
                    ⚠️ {hasNoFlowH3 ? "MẤT DÒNG CHẢY H3" : "NGHI RÒ RỈ VAN 3"}
                  </text>
                </g>
              )}
            </g>

            {/* Chú thích phía dưới bản đồ */}
            <text x="30" y="525" fill="#94a3b8" fontSize="11">
              📍 Bản đồ không gian 2D Nhà màng Học viện Nông nghiệp Việt Nam • Hệ thống tưới nhỏ giọt bù áp 12 chậu
            </text>
          </svg>
        </div>
      </div>

      {/* 3. POP-UP THÔNG TIN CHI TIẾT & HƯỚNG DẪN XỬ LÝ THEO KHU VỰC ĐƯỢC CHỌN */}
      {selectedZone && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-sm">
                <MapPin className="w-4 h-4 text-sky-700" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  {selectedZone === "tank" && "Chi Tiết Khu Vực: Bồn Chứa Nước 100L"}
                  {selectedZone === "pump" && "Chi Tiết Thiết Bị: Bơm Tăng Áp 12V DC"}
                  {selectedZone === "controller" && "Chi Tiết: Tủ Điều Khiển Trung Tâm IoT"}
                  {selectedZone === "weather" && "Chi Tiết: Trạm Đo Vi Khí Hậu Nhà Màng SHT31"}
                  {selectedZone === "row1" && "Chi Tiết Khu Vực: Hàng 1 — Hẹn Giờ Cố Định"}
                  {selectedZone === "row2" && "Chi Tiết Khu Vực: Hàng 2 — Theo Độ Ẩm Đất"}
                  {selectedZone === "row3" && "Chi Tiết Khu Vực: Hàng 3 — Đa Cảm Biến & VPD"}
                </h4>
                <p className="text-[11px] text-slate-500">Thông tin vận hành và hướng dẫn xử lý kỹ thuật</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedZone(null)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 text-xs space-y-3">
            {selectedZone === "tank" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Trạng thái phao</span>
                    <strong className={`text-sm ${isTankEmpty ? "text-red-600" : "text-sky-700"}`}>
                      {isTankWaiting ? "Chờ tín hiệu" : isTankEmpty ? "Chìm (Cạn nước!)" : "Nổi (Bình thường)"}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Dung tích thiết kế</span>
                    <strong className="text-sm text-slate-800">100 Lít</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Cơ chế an toàn</span>
                    <strong className="text-sm text-slate-800">Tự khóa van &amp; ngắt bơm</strong>
                  </div>
                </div>
                {isTankEmpty && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1">
                    <strong className="font-bold flex items-center gap-1.5">
                      <Wrench className="w-4 h-4" /> HƯỚNG DẪN CÔNG NHÂN XỬ LÝ:
                    </strong>
                    <p>1. Đến bồn nước 100L và kiểm tra mức nước thực tế.</p>
                    <p>2. Mở khóa vòi nước máy cấp vào bồn hoặc kiểm tra đường ống cấp nguồn.</p>
                    <p>3. Khi bồn đầy, phao sẽ nổi lên và hệ thống tự động mở khóa tưới lại.</p>
                  </div>
                )}
              </div>
            )}

            {selectedZone === "pump" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Trạng thái động cơ</span>
                    <strong className={`text-sm ${pumpOn ? "text-emerald-600" : "text-slate-700"}`}>
                      {pumpOn ? "Đang chạy 12V" : "Đang nghỉ"}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Điện áp hoạt động</span>
                    <strong className="text-sm text-slate-800">12V DC • Relay Kẹp</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Thứ tự khởi động</span>
                    <strong className="text-sm text-slate-800">Mở van trước 700ms</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedZone === "controller" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Vi điều khiển</span>
                    <strong className="text-sm text-slate-800">ESP32-S3 Dual-Core</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Modem truyền thông</span>
                    <strong className="text-sm text-sky-700">A7672X 4G LTE CAT1</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Bộ nhớ lưu trữ</span>
                    <strong className="text-sm text-slate-800">LittleFS JSONL Cache</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Đồng hồ thời gian</span>
                    <strong className="text-sm text-slate-800">RTC DS3231 Pin rời</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedZone === "weather" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Nhiệt độ không khí</span>
                    <strong className="text-sm text-slate-800">{tempC != null ? `${tempC.toFixed(1)}°C` : "—"}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Độ ẩm tương đối</span>
                    <strong className="text-sm text-slate-800">{rhPct != null ? `${Math.round(rhPct)}%` : "—"}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Chỉ số vi khí hậu VPD</span>
                    <strong className={`text-sm ${vpdKpa != null && vpdKpa >= 1.5 ? "text-amber-700" : "text-teal-700"}`}>
                      {vpdKpa != null ? `${vpdKpa.toFixed(2)} kPa` : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {["row1", "row2", "row3"].includes(selectedZone) && (
              <div className="space-y-3">
                {(() => {
                  const rId = selectedZone === "row1" ? 1 : selectedZone === "row2" ? 2 : 3;
                  const isV = rows.find((r) => r.id === rId)?.valve;
                  const daily = rows.find((r) => r.id === rId)?.daily_l ?? 0;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Trạng thái van hiện tại:</span>
                        <strong className={`text-sm ${isV ? "text-emerald-700" : "text-slate-700"}`}>
                          {isV ? "ĐANG MỞ TƯỚI NƯỚC" : "ĐANG ĐÓNG"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Lượng nước đã tưới hôm nay:</span>
                        <strong className="text-sm text-slate-800">{daily.toFixed(2)} Lít</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={!canOperate || isTankEmpty || isV}
                          onClick={() => onTriggerRow(rId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs disabled:opacity-40"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Tưới Hàng {rId} ngay
                        </button>
                        <button
                          disabled={!canOperate || !isV}
                          onClick={() => onTriggerRow(rId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs disabled:opacity-40"
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
