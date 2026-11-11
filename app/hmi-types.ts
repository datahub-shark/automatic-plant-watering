export type Row = {
  id: number;
  daily_l: number;
  valve: boolean;
};

export type Sample = {
  id?: number;
  device_id?: string;
  seq?: number;
  recorded_at: string;
  received_at: string;
  soil_json: string;
  temperature_c: number | null;
  rh_pct: number | null;
  vpd_kpa: number | null;
  rows_json: string;
  tank_ok: number;
  pump_on: number;
};

export type EventItem = {
  id: number;
  recorded_at: string;
  row: number;
  type: string;
  liters: number | null;
  details?: Record<string, unknown>;
};

export type Config = {
  soilDry: number[];
  soilWet: number[];
  scheduleHour: number[];
  scheduleMinute: number[];
  low: number[];
  high: number[];
  targetL: number[];
  maxSeconds: number[];
  soakSeconds: number[];
  vpdHot: number;
  vpdThresholdBoost: number;
  vpdVolumeBoost: number;
  floatLowLevel: boolean;
};

export type Device = {
  id: string;
  last_seen_at: string | null;
  last_seq?: number;
};

export type CommandItem = {
  id: number;
  action: string;
  row: number;
  status: "pending" | "acked" | "expired";
  created_at: string;
  acked_at: string | null;
};

export const defaultConfig: Config = {
  soilDry: [3000, 3000, 3000, 3000],
  soilWet: [1200, 1200, 1200, 1200],
  scheduleHour: [6, 17],
  scheduleMinute: [0, 0],
  low: [35, 38],
  high: [55, 58],
  targetL: [2.0, 2.0, 2.0],
  maxSeconds: [900, 900, 900],
  soakSeconds: [1800, 1800],
  vpdHot: 1.5,
  vpdThresholdBoost: 8,
  vpdVolumeBoost: 0.35,
  floatLowLevel: true,
};

export type AlarmInfo = {
  code: string;
  title: string;
  level: "critical" | "warning" | "info";
  description: string;
  workerGuide: string[];
};

export const ALARM_REGISTRY: Record<string, AlarmInfo> = {
  tank_empty: {
    code: "ALARM_TANK_EMPTY",
    title: "BỒN NƯỚC BỊ CẠN",
    level: "critical",
    description: "Cảm biến phao báo mực nước trong bồn chứa đã xuống dưới mức an toàn. Hệ thống đã tự động khóa van và tắt bơm để chống cháy bơm.",
    workerGuide: [
      "1. Đi đến bồn chứa nước và kiểm tra mực nước thực tế.",
      "2. Mở van cấp nước nguồn vào bồn hoặc kiểm tra đường nước máy.",
      "3. Khi bồn đầy, kiểm tra phao nổi lên và quay lại HMI kiểm tra trạng thái xanh.",
    ],
  },
  ERROR_NO_FLOW: {
    code: "ALARM_NO_FLOW",
    title: "MẤT DÒNG CHẢY KHI TƯỚI",
    level: "critical",
    description: "Van điện từ đang mở nhưng cảm biến lưu lượng YF-S201 không ghi nhận xung nước chảy qua.",
    workerGuide: [
      "1. Kiểm tra xem bơm tăng áp 12V có đang chạy (nghe tiếng rung) hay không.",
      "2. Kiểm tra van cơ chặn trước bồn hoặc trước cụm van điện có bị đóng nhầm không.",
      "3. Kiểm tra lưới lọc đầu hút bơm xem có bị nghẹt rác/rong rêu không.",
      "4. Kiểm tra xem ống PE16 có bị bẹp hoặc tuột mối nối không.",
    ],
  },
  ERROR_VALVE_LEAK: {
    code: "ALARM_VALVE_LEAK",
    title: "NGHI VẤN RÒ RỈ VAN",
    level: "warning",
    description: "Tất cả các van đang ở trạng thái đóng nhưng cảm biến lưu lượng vẫn phát hiện xung nước chảy.",
    workerGuide: [
      "1. Quan sát thực tế đầu nhỏ giọt tại các chậu xem hàng nào đang bị rỉ nước.",
      "2. Kiểm tra xem màng cao su của van điện từ có bị kẹt cặn cát không.",
      "3. Thử mở van xả mạnh trong 10 giây để tống cặn bẩn, sau đó đóng lại kiểm tra.",
    ],
  },
  max_time: {
    code: "ALARM_MAX_TIMEOUT",
    title: "HẾT THỜI GIAN TƯỚI TỐI ĐA",
    level: "warning",
    description: "Van đã mở quá thời gian tối đa đã cài đặt mà chưa đạt đủ thể tích nước yêu cầu. Hệ thống đã tự ngắt để bảo vệ cây khỏi ngập úng.",
    workerGuide: [
      "1. Kiểm tra áp lực nước có quá yếu không khiến lượng nước cấp chậm.",
      "2. Kiểm tra các đầu nhỏ giọt trên hàng có bị tắc vôi/khoáng không.",
      "3. Tăng thời gian tối đa trong mục Cấu hình nếu lưu lượng thực tế thấp bình thường.",
    ],
  },
  auto_start: {
    code: "EVENT_AUTO_START",
    title: "Bắt đầu tưới tự động",
    level: "info",
    description: "Kích hoạt tưới tự động theo lịch hẹn hoặc theo ngưỡng độ ẩm đất.",
    workerGuide: ["Hệ thống đang vận hành tự động theo thông số đã cài đặt."],
  },
  manual_start: {
    code: "EVENT_MANUAL_START",
    title: "Bắt đầu tưới thủ công",
    level: "info",
    description: "Người vận hành đã kích hoạt lệnh tưới thủ công từ HMI.",
    workerGuide: ["Quan sát đồng hồ lưu lượng trên HMI để theo dõi nước cấp."],
  },
  target_volume: {
    code: "EVENT_TARGET_REACHED",
    title: "Đạt đủ thể tích nước mục tiêu",
    level: "info",
    description: "Cảm biến lưu lượng đo đủ số lít nước cài đặt. Đã đóng van.",
    workerGuide: ["Đợt tưới kết thúc thành công."],
  },
  soil_high: {
    code: "EVENT_SOIL_OPTIMAL",
    title: "Đạt ngưỡng độ ẩm đất tối ưu",
    level: "info",
    description: "Độ ẩm đất trung bình đã vượt ngưỡng ngắt (High). Đã đóng van an toàn.",
    workerGuide: ["Đất đã đủ ẩm cho rễ cây hấp thụ."],
  },
  manual_stop: {
    code: "EVENT_MANUAL_STOP",
    title: "Dừng tưới thủ công",
    level: "info",
    description: "Người vận hành đã gửi lệnh dừng van.",
    workerGuide: ["Van đã đóng."],
  },
  fault_cleared: {
    code: "EVENT_FAULT_CLEARED",
    title: "Đã xóa lỗi",
    level: "info",
    description: "Bộ điều khiển đã xóa cờ lỗi theo lệnh của người vận hành.",
    workerGuide: ["Theo dõi lần tưới tiếp theo để chắc chắn lỗi không lặp lại."],
  },
  leak_shutdown: {
    code: "EVENT_LEAK_SHUTDOWN",
    title: "Dừng toàn bộ do nghi rò van",
    level: "warning",
    description: "Bộ điều khiển dừng tất cả các hàng sau khi phát hiện nước chảy khi van đóng.",
    workerGuide: ["Xem hướng dẫn mục \"Nghi vấn rò rỉ van\"."],
  },
};
