"use client";

import React from "react";
import { Layers, Sparkles, Cpu, Eye, FlaskConical, CloudSun, PlusCircle } from "lucide-react";

export default function HmiFuture() {
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-sm flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold">Các Module Mở Rộng Tương Lai (Expansion Modules)</h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Kiến trúc phần mềm và phần cứng được thiết kế theo dạng module hóa mở (Open Architecture). Các chức năng dưới đây đã có sẵn giao tiếp dữ liệu dự phòng và sẽ được kích hoạt ở các giai đoạn phát triển tiếp theo của dự án.
          </p>
        </div>
        <span className="px-3 py-1 bg-amber-400/20 text-amber-300 text-xs font-bold rounded-full border border-amber-400/30">
          Sẵn sàng mở rộng
        </span>
      </div>

      {/* 2. Grid các Module mở rộng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Module 1: Châm phân bón tự động Fertigation */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Châm Phân Tự Động (Fertigation)</h3>
                <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wide">
                  Đo nồng độ EC & pH
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
              Giai đoạn 2
            </span>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Hệ thống 2 bơm định lượng châm dung dịch dinh dưỡng A và B trực tiếp vào ống PE16. Cảm biến EC (độ dẫn điện) và pH kiểm soát chính xác nồng độ phân bón cho từng thời kỳ nuôi trái cà chua.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Cổng kết nối dự phòng: <strong>I2C / RS485</strong></span>
            <span className="text-slate-400">Trạng thái: Đã thiết kế mạch</span>
          </div>
        </div>

        {/* Module 2: Camera AI Nhận diện Sức khỏe Lá & Trái */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Camera Thị giác Máy tính AI</h3>
                <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wide">
                  Phát hiện sâu bệnh sớm
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
              Giai đoạn 2
            </span>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Camera độ phân giải cao chụp tán lá định kỳ 30 phút/lần. Mô hình AI phân tích dấu hiệu héo rũ, đốm lá hoặc rệp sáp, tự động cảnh báo công nhân đến kiểm tra trước khi bệnh lây lan rộng.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Giao thức: <strong>RTSP Video Stream</strong></span>
            <span className="text-slate-400">Trạng thái: Khung AI sẵn sàng</span>
          </div>
        </div>

        {/* Module 3: Mở rộng Hàng 4 & Hàng 5 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Mở Rộng Thêm Hàng 4 & Hàng 5</h3>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">
                  Tăng diện tích khảo nghiệm
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
              Khả năng nâng cấp
            </span>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Module relay và mạch điều khiển hỗ trợ mở rộng thêm Van #4 và Van #5. Dự kiến dùng để khảo nghiệm phương pháp tưới phun sương làm mát nhà màng và tưới giá thể xơ dừa cao cấp.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Chân I/O điều khiển: <strong>GPIO Relay 5-8</strong></span>
            <span className="text-slate-400">Trạng thái: Dự phòng trên PCB</span>
          </div>
        </div>

        {/* Module 4: Trạm Thời tiết & Dự báo Mưa Tự động */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <CloudSun className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Dự Báo Thời Tiết & Cảm Biến Mưa</h3>
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">
                  Tự động hoãn tưới khi trời mưa
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
              Giai đoạn 3
            </span>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Tích hợp cảm biến lượng mưa ngoài trời và API dự báo thời tiết OpenWeather. Khi trời mưa to kéo dài, hệ thống tự động hoãn lịch tưới của Hàng 1 để tránh lãng phí nước và thừa ẩm.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Giao tiếp: <strong>Cloudflare Worker Webhook</strong></span>
            <span className="text-slate-400">Trạng thái: Lập trình API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
