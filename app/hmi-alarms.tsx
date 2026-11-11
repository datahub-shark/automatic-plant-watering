"use client";

import React, { useState } from "react";
import { AlertTriangle, AlertOctagon, CheckCircle2, Info, Wrench, RefreshCw } from "lucide-react";
import { ALARM_REGISTRY, type EventItem } from "./hmi-types";

interface HmiAlarmsProps {
  events: EventItem[];
  tankOk: boolean | null;
  onClearFault?: () => void;
  canOperate: boolean;
}

export default function HmiAlarms({ events, tankOk, onClearFault, canOperate }: HmiAlarmsProps) {
  const [filter, setFilter] = useState<"all" | "alarms" | "history">("all");

  // Tìm các cảnh báo tích cực hiện tại: chỉ kích hoạt khi cảm biến phao thực sự báo cạn (false)
  const activeAlarms = [];
  if (tankOk === false) {
    activeAlarms.push(ALARM_REGISTRY.tank_empty);
  }

  // Lọc danh sách sự kiện
  const filteredEvents = events.filter((e) => {
    const isFault = e.type.startsWith("ERROR_") || e.type === "tank_empty" || e.type === "max_time";
    if (filter === "alarms") return isFault;
    if (filter === "history") return !isFault;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. KHỐI CẢNH BÁO KHẨN CẤP (NẾU CÓ) */}
      {activeAlarms.length > 0 && (
        <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-300 shadow-sm animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                  CẢNH BÁO HỆ THỐNG ĐANG BỊ DỪNG
                </span>
                {onClearFault && (
                  <button
                    disabled={!canOperate}
                    onClick={onClearFault}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Xóa cảnh báo & Thử lại
                  </button>
                )}
              </div>
              <h3 className="text-lg font-black text-red-900 mt-2">
                {activeAlarms[0].title}
              </h3>
              <p className="text-sm text-red-800 mt-1">
                {activeAlarms[0].description}
              </p>

              {/* Hướng dẫn công nhân xử lý ngay */}
              <div className="mt-4 p-3.5 bg-white/90 rounded-xl border border-red-200">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900 mb-2">
                  <Wrench className="w-4 h-4 text-red-600" /> HƯỚNG DẪN CÔNG NHÂN XỬ LÝ TẠI CHỖ:
                </div>
                <ul className="text-xs text-red-900 space-y-1.5 list-none">
                  {activeAlarms[0].workerGuide.map((step, idx) => (
                    <li key={idx} className="font-medium">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. BẢNG TRA CỨU HƯỚNG DẪN CÁC SỰ CỐ THƯỜNG GẶP (CHO CÔNG NHÂN MỚI) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
            SOP
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Cẩm nang Xử lý Sự cố Nhanh cho Công nhân Vận hành
            </h3>
            <p className="text-xs text-slate-500">
              Tra cứu nhanh hiện tượng lỗi và cách giải quyết không cần gọi kỹ sư
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ALARM_REGISTRY.tank_empty,
            ALARM_REGISTRY.ERROR_NO_FLOW,
            ALARM_REGISTRY.ERROR_VALVE_LEAK,
            ALARM_REGISTRY.max_time,
          ].map((alarm) => (
            <div
              key={alarm.code}
              className={`p-4 rounded-xl border transition-all ${
                alarm.level === "critical"
                  ? "bg-red-50/40 border-red-200"
                  : "bg-amber-50/40 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {alarm.level === "critical" ? (
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className="font-bold text-slate-800 text-sm">{alarm.title}</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">{alarm.description}</p>
              <div className="space-y-1 bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">
                  Cách khắc phục:
                </span>
                {alarm.workerGuide.map((step, sIdx) => (
                  <div key={sIdx} className="text-xs text-slate-700 font-medium">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. NHẬT KÝ SỰ KIỆN & LỊCH SỬ TƯỚI GẦN ĐÂY */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Nhật ký Hoạt động & Đợt tưới</h3>
            <p className="text-xs text-slate-500">
              Lưu trữ 100 sự kiện gần nhất được gửi từ bộ điều khiển
            </p>
          </div>

          {/* Bộ lọc sự kiện */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "all" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              Tất cả ({events.length})
            </button>
            <button
              onClick={() => setFilter("alarms")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "alarms" ? "bg-white text-red-700 shadow-sm" : "hover:text-red-700"
              }`}
            >
              Cảnh báo lỗi
            </button>
            <button
              onClick={() => setFilter("history")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "history" ? "bg-white text-emerald-700 shadow-sm" : "hover:text-emerald-700"
              }`}
            >
              Đợt tưới thành công
            </button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Chưa có sự kiện nào được ghi nhận
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.map((evt) => {
              const reg = ALARM_REGISTRY[evt.type];
              const isError = evt.type.startsWith("ERROR_") || evt.type === "tank_empty";
              const isWarning = evt.type === "max_time";
              const isSuccess = evt.type === "target_volume" || evt.type === "soil_high";

              return (
                <div key={evt.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isError
                          ? "bg-red-100 text-red-600"
                          : isWarning
                          ? "bg-amber-100 text-amber-700"
                          : isSuccess
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {isError ? (
                        <AlertOctagon className="w-5 h-5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Info className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        {reg?.title ?? evt.type}
                      </div>
                      <div className="text-xs text-slate-500">
                        Hàng {evt.row} •{" "}
                        {new Date(evt.recorded_at).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}{" "}
                        ngày {new Date(evt.recorded_at).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </div>

                  {evt.liters != null && (
                    <div className="text-right">
                      <span className="text-sm font-black text-slate-800">
                        {evt.liters.toFixed(2)} Lít
                      </span>
                      <span className="text-[10px] text-slate-400 block">Nước đã cấp</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
