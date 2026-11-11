"use client";

import React, { useState } from "react";
import { Droplets, Activity, Gauge, Thermometer, Wind, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Row } from "./hmi-types";

interface HydraulicPIDProps {
  rows: Row[];
  tankOk: boolean | null;
  pumpOn: boolean;
  soilMoisture: (number | null)[]; // 4 cảm biến: Hàng 2 (chậu 1,3) và Hàng 3 (chậu 1,3)
  tempC: number | null;
  rhPct: number | null;
  vpdKpa: number | null;
  onTriggerRow: (rowId: number) => void;
  canOperate: boolean;
}

export default function HydraulicPID({
  rows,
  tankOk,
  pumpOn,
  soilMoisture,
  tempC,
  rhPct,
  vpdKpa,
  onTriggerRow,
  canOperate,
}: HydraulicPIDProps) {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // Helper tìm van của từng hàng
  const isValveOpen = (rowId: number) => rows.find((r) => r.id === rowId)?.valve ?? false;
  const getDailyL = (rowId: number) => rows.find((r) => r.id === rowId)?.daily_l ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 overflow-hidden">
      {/* Tiêu đề & Chú thích HMI */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
              P&ID
            </span>
            <h2 className="text-lg font-bold text-slate-800">
              Sơ đồ Công nghệ & Dòng chảy Thủy lực (12 Chậu Cà chua)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mô phỏng trực quan đường ống PE16, bơm 12V, 3 van điện từ và 12 chậu cây cà chua theo chuẩn HMI công nghiệp
          </p>
        </div>

        {/* Chú thích màu sắc */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/60">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Đang tưới (Nước chảy)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
            Van đóng / Nghỉ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            Cảm biến đất
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
            Cảm biến khí hậu
          </span>
        </div>
      </div>

      {/* Vùng sơ đồ chính SVG / Canvas Layout */}
      <div className="relative w-full overflow-x-auto py-2">
        <div className="min-w-[920px] select-none">
          {/* HÀNG CẤP NƯỚC CHUNG (BỒN ➔ BƠM ➔ MANIFOLD) */}
          <div className="grid grid-cols-12 gap-3 items-center mb-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200/60">
            {/* 1. BỒN CHỨA NƯỚC */}
            <div
              onClick={() => setSelectedElement("tank")}
              className={`col-span-3 cursor-pointer p-3.5 rounded-xl border transition-all ${
                tankOk === null
                  ? "bg-slate-50 border-slate-200 hover:border-slate-300"
                  : tankOk
                  ? "bg-sky-50/70 border-sky-200 hover:border-sky-400"
                  : "bg-red-50 border-red-300 hover:border-red-400 ring-2 ring-red-400/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Nguồn cấp nước
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tankOk === null
                      ? "bg-slate-200 text-slate-700"
                      : tankOk
                      ? "bg-sky-200 text-sky-800"
                      : "bg-red-200 text-red-800 animate-pulse"
                  }`}
                >
                  {tankOk === null ? "Chờ kết nối" : tankOk ? "Bồn Đầy" : "BỒN CẠN"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-14 rounded-lg border-2 flex flex-col justify-end p-1 overflow-hidden transition-all ${
                    tankOk === null
                      ? "border-slate-300 bg-slate-100"
                      : tankOk
                      ? "border-sky-400 bg-white"
                      : "border-red-400 bg-red-100"
                  }`}
                >
                  <div
                    className={`w-full rounded transition-all duration-700 ${
                      tankOk === null
                        ? "h-1/2 bg-slate-300/80"
                        : tankOk
                        ? "h-4/5 bg-sky-400/80"
                        : "h-1/5 bg-red-400/80"
                    }`}
                  ></div>
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">Bồn Chứa 100L</div>
                  <div className="text-xs text-slate-500">
                    Phao mực nước: {tankOk === null ? "Chờ dữ liệu" : tankOk ? "Đủ nước (Nổi)" : "Cảnh báo cạn (Chìm)"}
                  </div>
                  <div className={`text-[11px] font-semibold mt-0.5 ${
                    tankOk === null ? "text-slate-500" : tankOk ? "text-sky-700" : "text-red-700 font-bold"
                  }`}>
                    {tankOk === null ? "Đang đồng bộ..." : tankOk ? "Sẵn sàng cấp nước" : "Cần bơm nước ngay!"}
                  </div>
                </div>
              </div>
            </div>

            {/* Ống nối Bồn -> Bơm */}
            <div className="col-span-1 flex items-center justify-center">
              <div className={`h-2 w-full rounded ${pumpOn ? "bg-sky-400 animate-pulse" : "bg-slate-300"}`}></div>
            </div>

            {/* 2. BƠM CHÍNH 12V */}
            <div
              onClick={() => setSelectedElement("pump")}
              className={`col-span-3 cursor-pointer p-3.5 rounded-xl border transition-all ${
                pumpOn
                  ? "bg-emerald-50 border-emerald-300 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Động cơ tạo áp
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pumpOn ? "bg-emerald-200 text-emerald-800 animate-pulse" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {pumpOn ? "ĐANG CHẠY" : "ĐANG TẮT"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
                    pumpOn
                      ? "border-emerald-500 bg-emerald-100 text-emerald-700 animate-spin"
                      : "border-slate-300 bg-slate-100 text-slate-400"
                  }`}
                >
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">Bơm Màng 12V</div>
                  <div className="text-xs text-slate-500">Tự ngắt khi đủ áp</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {pumpOn ? "Đang đẩy nước vào đường ống" : "Nghỉ"}
                  </div>
                </div>
              </div>
            </div>

            {/* Ống nối Bơm -> Khí hậu */}
            <div className="col-span-1 flex items-center justify-center">
              <div className={`h-2 w-full rounded ${pumpOn ? "bg-sky-400 animate-pulse" : "bg-slate-300"}`}></div>
            </div>

            {/* 3. CẢM BIẾN VI KHÍ HẬU SHT31 & VPD */}
            <div
              onClick={() => setSelectedElement("sht31")}
              className="col-span-4 cursor-pointer p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:border-indigo-300 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Vi khí hậu nhà màng (SHT31)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Treo ngang tán lá
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-100">
                  <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Thermometer className="w-3 h-3 text-red-500" /> Nhiệt độ
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {tempC != null ? `${tempC.toFixed(1)}°C` : "—"}
                  </div>
                </div>
                <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-100">
                  <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Wind className="w-3 h-3 text-sky-500" /> Độ ẩm KK
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {rhPct != null ? `${Math.round(rhPct)}%` : "—"}
                  </div>
                </div>
                <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-100">
                  <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Gauge className="w-3 h-3 text-amber-500" /> Áp suất VPD
                  </div>
                  <div className="text-sm font-bold text-amber-700">
                    {vpdKpa != null ? `${vpdKpa.toFixed(2)} kPa` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SƠ ĐỒ 3 HÀNG CÀ CHUA (MỖI HÀNG 4 CHẬU) */}
          <div className="space-y-4">
            {/* HÀNG 1: TƯỚI HẸN GIỜ CỐ ĐỊNH */}
            <RowHydraulicStrip
              rowId={1}
              title="Hàng 1 — Hẹn giờ cố định"
              subtitle="Tưới theo lịch hẹn cố định (ví dụ 06:00 và 17:00), đóng khi đủ 2L hoặc hết 15 phút"
              isOpen={isValveOpen(1)}
              pumpOn={pumpOn}
              dailyL={getDailyL(1)}
              potsCount={4}
              hasMoistureSensors={false}
              hasVpd={false}
              canOperate={canOperate}
              onTrigger={() => onTriggerRow(1)}
              onSelect={() => setSelectedElement("row1")}
            />

            {/* HÀNG 2: TƯỚI THEO ĐỘ ẨM ĐẤT */}
            <RowHydraulicStrip
              rowId={2}
              title="Hàng 2 — Theo độ ẩm đất"
              subtitle="Tưới theo độ ẩm trung bình chậu 1 và chậu 3; tự ngắt khi đất đủ ẩm"
              isOpen={isValveOpen(2)}
              pumpOn={pumpOn}
              dailyL={getDailyL(2)}
              potsCount={4}
              hasMoistureSensors={true}
              soilValues={[soilMoisture[0], soilMoisture[1]]} // chậu 1, chậu 3
              hasVpd={false}
              canOperate={canOperate}
              onTrigger={() => onTriggerRow(2)}
              onSelect={() => setSelectedElement("row2")}
            />

            {/* HÀNG 3: ĐA CẢM BIẾN & VPD VI KHÍ HẬU */}
            <RowHydraulicStrip
              rowId={3}
              title="Hàng 3 — Đa cảm biến & VPD vi khí hậu"
              subtitle="Điều chỉnh tự động theo độ ẩm đất + nhiệt ẩm không khí; trời nóng khô tự động tăng lượng nước"
              isOpen={isValveOpen(3)}
              pumpOn={pumpOn}
              dailyL={getDailyL(3)}
              potsCount={4}
              hasMoistureSensors={true}
              soilValues={[soilMoisture[2], soilMoisture[3]]} // chậu 1, chậu 3
              hasVpd={true}
              vpdKpa={vpdKpa}
              canOperate={canOperate}
              onTrigger={() => onTriggerRow(3)}
              onSelect={() => setSelectedElement("row3")}
            />
          </div>
        </div>
      </div>

      {/* KHỐI HƯỚNG DẪN GIẢI THÍCH CHI TIẾT KHI CÔNG NHÂN BẤM VÀO PHẦN TỬ */}
      {selectedElement && (
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start justify-between gap-4">
          <div>
            <span className="font-bold text-slate-900 block mb-1">
              {selectedElement === "tank" && "💡 Thông tin Bồn Chứa Nước 100L"}
              {selectedElement === "pump" && "💡 Thông tin Bơm Màng 12V 60W"}
              {selectedElement === "sht31" && "💡 Thông tin Cảm biến Nhiệt độ / Độ ẩm SHT31 & VPD"}
              {selectedElement === "row1" && "💡 Thông tin Hàng 1 — Phương pháp Hẹn giờ"}
              {selectedElement === "row2" && "💡 Thông tin Hàng 2 — Phương pháp Độ ẩm đất"}
              {selectedElement === "row3" && "💡 Thông tin Hàng 3 — Phương pháp Đa cảm biến & VPD"}
            </span>
            <p className="leading-relaxed">
              {selectedElement === "tank" &&
                "Bồn nước là nguồn cấp chung cho cả 3 hàng. Phao điện từ đáy bồn tự động ngắt hệ thống khi mực nước dưới 10cm để bảo vệ máy bơm không bị cháy do chạy khô."}
              {selectedElement === "pump" &&
                "Bơm màng 12V DC công suất 60W tạo áp lực nước đẩy qua ống PE16. Bơm có rơ-le áp suất tự ngắt khi tất cả van đóng, và chỉ chạy khi có ít nhất một van điện mở."}
              {selectedElement === "sht31" &&
                "SHT31 đo nhiệt độ và độ ẩm không khí ngay tại tán lá. Hệ thống tính ra chỉ số VPD (áp suất hơi thiếu hụt): Khi trời nắng gắt (VPD > 1.5 kPa), cây thoát hơi nước nhiều nên Hàng 3 sẽ tự động được tưới thêm nước."}
              {selectedElement === "row1" &&
                "Hàng 1 dùng phương pháp truyền thống: mở van vào các khung giờ hẹn sẵn (06:00 sáng và 17:00 chiều) bất kể trời mưa hay nắng. Cảm biến YF-S201 đo chính xác thể tích nước đã cấp."}
              {selectedElement === "row2" &&
                "Hàng 2 cắm 2 que đo điện dung ở Chậu 1 và Chậu 3. Hệ thống tính trung bình: Nếu đất khô dưới 35% thì mới mở van tưới, đất ẩm trên 55% thì tự ngắt, giúp tiết kiệm nước khi trời râm mát."}
              {selectedElement === "row3" &&
                "Hàng 3 kết hợp độ ẩm đất và chỉ số thời tiết VPD. Đây là phương pháp thông minh nhất trong 3 hàng, giúp cây cà chua luôn có đủ nước sinh trưởng tối đa mà không gây ngập úng rễ."}
            </p>
          </div>
          <button
            onClick={() => setSelectedElement(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded bg-white border border-slate-200"
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-component hiển thị từng hàng thủy lực gồm Van, Cảm biến lưu lượng và 4 chậu cây
function RowHydraulicStrip({
  rowId,
  title,
  subtitle,
  isOpen,
  pumpOn,
  dailyL,
  potsCount,
  hasMoistureSensors,
  soilValues,
  hasVpd,
  vpdKpa,
  canOperate,
  onTrigger,
  onSelect,
}: {
  rowId: number;
  title: string;
  subtitle: string;
  isOpen: boolean;
  pumpOn: boolean;
  dailyL: number;
  potsCount: number;
  hasMoistureSensors: boolean;
  soilValues?: (number | null)[];
  hasVpd: boolean;
  vpdKpa?: number | null;
  canOperate: boolean;
  onTrigger: () => void;
  onSelect: () => void;
}) {
  const isFlowing = isOpen && pumpOn;

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        isFlowing
          ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400/20 shadow-sm"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 h-6 rounded-md flex items-center justify-center font-extrabold text-xs text-white ${
              rowId === 1 ? "bg-amber-600" : rowId === 2 ? "bg-emerald-600" : "bg-teal-700"
            }`}
          >
            {rowId}
          </span>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Lượng nước đã tưới */}
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Đã tưới hôm nay</span>
            <span className="text-sm font-extrabold text-slate-800">
              {dailyL.toFixed(1)} <span className="text-xs font-medium text-slate-500">Lít</span>
            </span>
          </div>

          {/* Nút thao tác nhanh cho công nhân */}
          <button
            type="button"
            disabled={!canOperate}
            onClick={(e) => {
              e.stopPropagation();
              onTrigger();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isOpen
                ? "bg-red-500 text-white hover:bg-red-600 shadow-sm"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
            }`}
          >
            {isOpen ? "Dừng tưới" : "Tưới hàng này"}
          </button>
        </div>
      </div>

      {/* Họa đồ Thủy lực: Cụm Van điện -> Lưu lượng kế -> 4 Chậu cà chua */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
        {/* 1. Van điện từ 12V */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
            isOpen
              ? "bg-emerald-100 border-emerald-300 text-emerald-900"
              : "bg-slate-100 border-slate-200 text-slate-600"
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
          ></span>
          Van #{rowId}: {isOpen ? "MỞ" : "ĐÓNG"}
        </div>

        {/* Ống nối giữa Van và Lưu lượng kế */}
        <div className={`h-1.5 w-6 rounded ${isFlowing ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></div>

        {/* 2. Cảm biến lưu lượng YF-S201 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-700">
          <Gauge className="w-3.5 h-3.5 text-slate-500" />
          <span>YF-S201 #{rowId}</span>
        </div>

        {/* Ống dẫn PE16 cấp tới 4 chậu */}
        <div className={`h-1.5 w-8 rounded ${isFlowing ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></div>

        {/* 3. 4 Chậu Cà Chua */}
        <div className="flex items-center gap-3 flex-1 justify-around bg-slate-50/70 p-2 rounded-xl border border-slate-100">
          {Array.from({ length: potsCount }, (_, idx) => {
            const potNum = idx + 1;
            const hasSensor = hasMoistureSensors && (potNum === 1 || potNum === 3);
            const sensorVal = hasSensor ? (potNum === 1 ? soilValues?.[0] : soilValues?.[1]) : null;

            return (
              <div
                key={potNum}
                className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                  isFlowing
                    ? "bg-white border-emerald-200 shadow-sm"
                    : "bg-white/80 border-slate-200/80"
                }`}
              >
                {/* Icon chậu cây cà chua */}
                <div className="relative mb-1">
                  <span className="text-2xl" role="img" aria-label="Cà chua">
                    🍅
                  </span>
                  {/* Hiệu ứng giọt nước nhỏ giọt khi đang tưới */}
                  {isFlowing && (
                    <span className="absolute -bottom-1 -right-1 text-xs animate-bounce text-sky-500">
                      💧
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-bold text-slate-700">
                  Chậu {potNum}
                </span>

                {/* Nếu chậu có cắm cảm biến độ ẩm đất */}
                {hasSensor ? (
                  <div className="mt-1 flex flex-col items-center">
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        sensorVal != null
                          ? sensorVal < 35
                            ? "bg-amber-100 text-amber-800"
                            : sensorVal > 60
                            ? "bg-sky-100 text-sky-800"
                            : "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {sensorVal != null ? `${sensorVal.toFixed(0)}%` : "—"}
                    </span>
                    <span className="text-[9px] text-slate-400">Ẩm đất</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-400 mt-1">Đầu nhỏ giọt</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
