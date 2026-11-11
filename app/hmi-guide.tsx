"use client";

import React from "react";
import { BookOpen, CheckCircle, ShieldAlert, PhoneCall, AlertCircle, HelpCircle } from "lucide-react";

export default function HmiGuide() {
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-emerald-300" />
          <h2 className="text-xl font-bold">Quy trình Vận hành Chuẩn (SOP) Dành Cho Công Nhân Mới</h2>
        </div>
        <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
          Tài liệu hướng dẫn trực quan theo từng bước thực tế tại vườn cà chua 3 hàng. Dành cho công nhân mới tiếp nhận ca trực, giúp vận hành an toàn, đúng kỹ thuật và tiết kiệm nước.
        </p>
      </div>

      {/* 2. Quy trình 3 bước Ca trực */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Bước 1: Đầu ca */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-xs">
              01
            </span>
            <h3 className="font-bold text-slate-800 text-sm">Đầu Ca Làm Việc</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Thực hiện trước 07:30 sáng</p>
          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Kiểm tra bồn nước 100L:</strong> Đảm bảo mực nước trên 80%. Nếu phao hạ thấp, mở van nguồn cấp bổ sung ngay.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Kiểm tra tủ điện IP65:</strong> Đèn nguồn 220V sáng, aptomat 12V đóng, đèn modem 4G nhấp nháy xanh ổn định.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Kiểm tra HMI:</strong> Mở trang web này, đảm bảo nhãn trạng thái báo <em>"Đang trực tuyến"</em>.
              </span>
            </li>
          </ul>
        </div>

        {/* Bước 2: Trong ca */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
              02
            </span>
            <h3 className="font-bold text-slate-800 text-sm">Trong Ca Vận Hành</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Giám sát tự động & Thao tác tay</p>
          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Hàng 1 (Hẹn giờ):</strong> Tự động tưới lúc 06:00 và 17:00 (đủ 2 Lít hoặc tối đa 15 phút là tự ngắt).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Hàng 2 & 3:</strong> Tự động tưới khi đất khô dưới 35%. Hàng 3 tự tăng thêm nước khi trời nắng gắt (VPD &gt; 1.5 kPa).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Tưới bổ sung thủ công:</strong> Bấm nút <em>"Tưới hàng này"</em> trên HMI, kiểm tra van mở và nước chảy tại các chậu.
              </span>
            </li>
          </ul>
        </div>

        {/* Bước 3: Cuối ca */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs">
              03
            </span>
            <h3 className="font-bold text-slate-800 text-sm">Cuối Ca Bàn Giao</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Thực hiện lúc 17:00 - 17:30</p>
          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Ghi chép số liệu nước:</strong> Ghi lại tổng Lít nước đã tưới của Hàng 1, Hàng 2, Hàng 3 vào sổ bàn giao.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Kiểm tra đường ống:</strong> Đi dọc 3 hàng kiểm tra đầu nhỏ giọt có bị tắc hoặc tuột đầu nối ống PE16 không.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Vệ sinh màng lọc:</strong> Xả van xả cặn đáy bồn nếu nước có nhiều cặn bẩn.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* 3. Lưu ý an toàn điện & Nút dừng khẩn cấp */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-red-700">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-base text-slate-800">Quy Định An Toàn Nghiêm Ngặt</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" /> An toàn điện trong môi trường nước
            </div>
            <p className="leading-relaxed text-slate-600">
              Nguồn cấp chính là 220V AC được hạ áp sang 12V DC cho bơm và van. 
              <strong> Tuyệt đối không chạm tay vào ngăn nguồn 220V khi tay còn ướt hoặc đang đi chân trần trên nền đất ẩm.</strong> Tủ điện có trang bị aptomat chống giật ELCB.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-600" /> Xử lý sự cố khẩn cấp (E-STOP)
            </div>
            <p className="leading-relaxed text-slate-600">
              Khi phát hiện vỡ ống nước, bơm kêu to bất thường, hoặc khói mùi khét:
              <strong> Nhấn ngay nút [DỪNG KHẨN CẤP] màu đỏ trên HMI</strong> hoặc gạt aptomat trong hộp điện IP65 xuống ngay lập tức, sau đó gọi hotline kỹ thuật.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Hotline Hỗ trợ kỹ thuật */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-800">Cần Hỗ trợ Kỹ thuật & Báo hỏng?</div>
            <div className="text-slate-500">Kỹ sư phụ trách hệ thống IoT & Nhà màng</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-700 font-semibold">
          <span>Kỹ thuật viên: <strong className="text-slate-900">098x.xxx.xxx</strong></span>
          <span>Phòng Thí nghiệm IoT: <strong className="text-slate-900">HVNN Việt Nam</strong></span>
        </div>
      </div>
    </div>
  );
}
