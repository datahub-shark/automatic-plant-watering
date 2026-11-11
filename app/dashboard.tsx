"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = { id: number; daily_l: number; valve: boolean };
type Sample = {
  recorded_at: string; received_at: string; soil_json: string;
  temperature_c: number | null; rh_pct: number | null; vpd_kpa: number | null;
  rows_json: string; tank_ok: number; pump_on: number;
};
type EventItem = { id: number; recorded_at: string; row: number; type: string; liters: number | null };
type Config = {
  soilDry: number[]; soilWet: number[]; scheduleHour: number[]; scheduleMinute: number[];
  low: number[]; high: number[]; targetL: number[]; maxSeconds: number[];
  soakSeconds: number[]; vpdHot: number; vpdThresholdBoost: number;
  vpdVolumeBoost: number; floatLowLevel: boolean;
};
type Device = { id: string; last_seen_at: string | null };
const defaultConfig: Config = {
  soilDry: [3000, 3000, 3000, 3000], soilWet: [1200, 1200, 1200, 1200],
  scheduleHour: [6, 17], scheduleMinute: [0, 0], low: [35, 38], high: [55, 58],
  targetL: [2, 2, 2], maxSeconds: [900, 900, 900], soakSeconds: [1800, 1800],
  vpdHot: 1.5, vpdThresholdBoost: 8, vpdVolumeBoost: 0.35, floatLowLevel: true,
};
const demoRows: Row[] = [
  { id: 1, daily_l: 4.8, valve: false },
  { id: 2, daily_l: 3.2, valve: false },
  { id: 3, daily_l: 5.7, valve: true },
];
const demoSeries = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  h2: 48 + Math.sin(i / 3) * 8 - (i > 13 ? 5 : 0),
  h3: 52 + Math.cos(i / 4) * 6 - (i > 14 ? 7 : 0),
}));
const demoEvents: EventItem[] = [
  { id: 3, recorded_at: "2026-11-11T15:10:00+07:00", row: 3, type: "auto_start", liters: 0 },
  { id: 2, recorded_at: "2026-11-11T11:32:00+07:00", row: 2, type: "target_volume", liters: 2 },
  { id: 1, recorded_at: "2026-11-11T06:00:00+07:00", row: 1, type: "target_volume", liters: 2 },
];
const fmt = (v: number | null | undefined, unit = "", digits = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}${unit}`;
const timeText = (v: string | null | undefined) => v ? new Date(v).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—";
const messageFor = (type: string) => ({ auto_start: "Bắt đầu tưới tự động", manual_start: "Bắt đầu tưới thủ công", target_volume: "Đạt thể tích", soil_high: "Đạt ngưỡng ẩm", max_time: "Hết thời gian tối đa", tank_empty: "Bồn cạn", ERROR_NO_FLOW: "Không có lưu lượng", ERROR_VALVE_LEAK: "Nghi rò van", manual_stop: "Dừng thủ công" } as Record<string, string>)[type] ?? type;

function parseSample(s: Sample | null) {
  if (!s) return null;
  try {
    const soil = JSON.parse(s.soil_json) as (number | null)[];
    const rows = JSON.parse(s.rows_json) as Row[];
    return { soil, rows, h2: soil[0] != null && soil[1] != null ? (soil[0] + soil[1]) / 2 : null,
      h3: soil[2] != null && soil[3] != null ? (soil[2] + soil[3]) / 2 : null };
  } catch { return null; }
}

function LineChart({ points }: { points: { time: string; h2: number | null; h3: number | null }[] }) {
  const width = 740, height = 220, left = 36, right = 16, top = 20, bottom = 30;
  const x = (i: number) => left + i * (width - left - right) / Math.max(points.length - 1, 1);
  const y = (v: number) => top + (100 - v) * (height - top - bottom) / 100;
  const path = (key: "h2" | "h3") => points.map((p, i) => p[key] == null ? null : `${i === 0 || points[i-1][key] == null ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key] as number).toFixed(1)}`).filter(Boolean).join(" ");
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ độ ẩm đất theo thời gian">
    {[25, 50, 75].map(v => <g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="#e6e9e4" strokeDasharray="4 5"/><text x="0" y={y(v)+4} fontSize="11" fill="#859087">{v}%</text></g>)}
    <path d={path("h2")} fill="none" stroke="#d38b46" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d={path("h3")} fill="none" stroke="#3d806b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {points.length > 0 && <><text x={left} y={height-4} fontSize="11" fill="#859087">{points[0].time}</text><text x={width-right} y={height-4} textAnchor="end" fontSize="11" fill="#859087">{points[points.length-1].time}</text></>}
  </svg></div>;
}

export default function Dashboard({ userName, signOutPath, staticMode = false }: { userName: string; signOutPath: string; staticMode?: boolean }) {
  const [tab, setTab] = useState<"overview" | "config" | "events">("overview");
  const [mode, setMode] = useState<"live" | "demo">(staticMode ? "demo" : "live");
  const [device, setDevice] = useState("stm32_01");
  const [devices, setDevices] = useState<Device[]>([]);
  const [latest, setLatest] = useState<Sample | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [version, setVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const query = encodeURIComponent(device);
  const request = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const res = await fetch(`/api/v1/${path}`, { cache: "no-store", ...options });
    const body = await res.json() as T & { error?: string };
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  }, []);
  const refresh = useCallback(async () => {
    if (staticMode || mode !== "live") return;
    try {
      const [a, b, c, d, e] = await Promise.all([
        request<{devices:Device[]}>("admin/devices"), request<{telemetry:Sample|null}>(`admin/latest?device_id=${query}`),
        request<{samples:Sample[]}>(`admin/history?device_id=${query}`), request<{events:EventItem[]}>(`admin/events?device_id=${query}`),
        request<{config:Config;version:number}>(`config?device_id=${query}`),
      ]);
      setDevices(a.devices); setLatest(b.telemetry); setHistory(c.samples); setEvents(d.events);
      setConfig(e.config); setVersion(e.version); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Không tải được dữ liệu"); }
  }, [mode, query, request, staticMode]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [refresh]);
  const parsed = useMemo(() => parseSample(latest), [latest]);
  const rows = mode === "demo" ? demoRows : parsed?.rows ?? [];
  const h2 = mode === "demo" ? 43.6 : parsed?.h2 ?? null;
  const h3 = mode === "demo" ? 49.2 : parsed?.h3 ?? null;
  const temp = mode === "demo" ? 31.2 : latest?.temperature_c ?? null;
  const rh = mode === "demo" ? 68 : latest?.rh_pct ?? null;
  const vpd = mode === "demo" ? 1.45 : latest?.vpd_kpa ?? null;
  const tankOk = mode === "demo" ? true : latest?.tank_ok === 1;
  const pumpOn = mode === "demo" ? true : latest?.pump_on === 1;
  const fresh = mode === "live" && !!latest && Date.now() - Date.parse(latest.received_at) < 120000;
  const chartPoints = mode === "demo" ? demoSeries : history.map(s => { const p = parseSample(s); return { time: new Date(s.recorded_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }), h2: p?.h2 ?? null, h3: p?.h3 ?? null }; });
  const shownEvents = mode === "demo" ? demoEvents : events;

  async function sendCommand(action: string, row: number) {
    if (!fresh || !tankOk) return;
    if (action === "start" && !window.confirm(`Gửi lệnh tưới thủ công hàng ${row}?`)) return;
    setBusy(true); setNotice("");
    try { await request<{id:number}>(`admin/commands?device_id=${query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, row }) }); setNotice(`Đã xếp lệnh ${action} cho hàng ${row}; chờ STM32 nhận và xác nhận.`); }
    catch (err) { setNotice(err instanceof Error ? err.message : "Gửi lệnh thất bại"); }
    finally { setBusy(false); }
  }
  function changeArray(key: keyof Config, index: number, value: number) {
    setConfig(c => ({ ...c, [key]: (c[key] as number[]).map((n, i) => i === index ? value : n) }));
  }
  async function saveConfig() {
    if (mode === "demo") return;
    setBusy(true); setNotice("");
    try { const r = await request<{version:number}>(`admin/config?device_id=${query}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) }); setVersion(r.version); setNotice(`Đã lưu cấu hình v${r.version}. Thiết bị sẽ tải ở lần kiểm tra tiếp theo.`); }
    catch (err) { setNotice(err instanceof Error ? err.message : "Lưu cấu hình thất bại"); }
    finally { setBusy(false); }
  }
  const numberField = (label: string, key: keyof Config, index: number, step = 1) => <label className="field" key={`${key}-${index}`}><span>{label}</span><input type="number" step={step} value={(config[key] as number[])[index]} onChange={e => changeArray(key, index, Number(e.target.value))}/></label>;
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✳</span><span><strong>Tomato Control</strong><small>Hệ thống tưới thông minh</small></span></div>
      <div className="nav-caption">ĐIỀU KHIỂN</div>
      <button className={`nav-item ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>◫ <span>Tổng quan</span></button>
      <button className={`nav-item ${tab === "events" ? "active" : ""}`} onClick={() => setTab("events")}>≡ <span>Nhật ký tưới</span></button>
      <button className={`nav-item ${tab === "config" ? "active" : ""}`} onClick={() => setTab("config")}>⚙ <span>Cấu hình</span></button>
      <div className="sidebar-bottom"><span className="side-dot"/> STM32 + A7670C <small>API phiên bản 1</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">TRANG ĐIỀU KHIỂN</span><h1>{tab === "overview" ? "Tổng quan hệ thống" : tab === "events" ? "Nhật ký tưới" : "Cấu hình tưới"}</h1></div><div className="account"><span>{userName}</span><a href={signOutPath} target="_top">{staticMode ? "Mở Sites" : "Đăng xuất"}</a></div></header>
      <div className="toolbar"><div className="toolbar-left"><label className="device-select">Thiết bị <select value={device} onChange={e => setDevice(e.target.value)}><option value={device}>{device}</option>{devices.filter(d => d.id !== device).map(d => <option key={d.id} value={d.id}>{d.id}</option>)}</select></label><span className={`status-pill ${mode === "demo" ? "demo" : fresh ? "online" : "offline"}`}><i/>{mode === "demo" ? "Dữ liệu mẫu" : fresh ? "Đang trực tuyến" : "Chưa có thiết bị"}</span></div><div className="mode-switch">{staticMode ? <a href="https://tuoi-ca-chua-3-hang.promisinghill1.chatgpt.site/">Mở dữ liệu thực</a> : <button className={mode === "live" ? "chosen" : ""} onClick={() => setMode("live")}>Dữ liệu thực</button>}<button className={mode === "demo" ? "chosen" : ""} onClick={() => setMode("demo")}>Xem mẫu</button></div></div>
      {mode === "demo" && <div className="notice demo-notice">Chế độ xem mẫu: các số liệu dưới đây được mô phỏng và không gửi lệnh đến thiết bị.</div>}
      {mode === "live" && !latest && <div className="notice">Chưa nhận telemetry từ STM32. Backend đã sẵn sàng; dùng “Xem mẫu” để xem bố cục trong lúc chưa lắp phần cứng.</div>}
      {error && <div className="notice error">Không tải được dữ liệu: {error}</div>}
      {notice && <div className="notice">{notice}</div>}
      {tab === "overview" && <>
        <section className="metrics"><div className="metric"><div className="metric-icon warm">◉</div><span>Ẩm đất hàng 2</span><strong>{fmt(h2, "%")}</strong><small>Trung bình chậu 1 và 3</small></div><div className="metric"><div className="metric-icon green">◉</div><span>Ẩm đất hàng 3</span><strong>{fmt(h3, "%")}</strong><small>Điều chỉnh theo VPD</small></div><div className="metric"><div className="metric-icon blue">◌</div><span>Nhiệt độ / Độ ẩm</span><strong>{fmt(temp, "°C")} <em>/</em> {fmt(rh, "%", 0)}</strong><small>Cảm biến SHT31</small></div><div className="metric"><div className="metric-icon violet">↗</div><span>VPD hiện tại</span><strong>{fmt(vpd, " kPa", 2)}</strong><small>Áp suất hơi thiếu hụt</small></div></section>
        <section className="grid-2"><div className="panel"><div className="section-head"><div><h2>Độ ẩm đất</h2><p>Diễn biến hai hàng có cảm biến</p></div><div className="legend"><span><i className="warm-dot"/> Hàng 2</span><span><i className="green-dot"/> Hàng 3</span></div></div>{chartPoints.length ? <LineChart points={chartPoints}/> : <div className="empty-chart">Chưa có dữ liệu để vẽ biểu đồ</div>}</div><div className="panel system-panel"><div className="section-head"><div><h2>Trạng thái hệ thống</h2><p>Cập nhật {mode === "demo" ? "từ dữ liệu mẫu" : timeText(latest?.received_at)}</p></div></div><div className="system-line"><span>Bơm tổng</span><b className={pumpOn ? "on" : ""}>{pumpOn ? "Đang chạy" : "Đã tắt"}</b></div><div className="system-line"><span>Mực nước bồn</span><b className={tankOk ? "on" : "warn"}>{tankOk ? "Đủ nước" : "Cần kiểm tra"}</b></div><div className="system-line"><span>Kết nối thiết bị</span><b className={fresh ? "on" : "warn"}>{mode === "demo" ? "Mô phỏng" : fresh ? "Mới nhận dữ liệu" : "Chưa xác nhận"}</b></div><div className="system-foot">{mode === "demo" ? "Giá trị minh họa, không phải kết quả đo." : "Dữ liệu từ bản tin STM32 gần nhất."}</div></div></section>
        <section className="rows-section"><div className="section-head"><div><h2>Ba hàng cà chua</h2><p>Theo dõi lượng nước và trạng thái van theo từng phương pháp</p></div></div><div className="row-cards">{[1,2,3].map((id) => { const r = rows.find(x => x.id === id); return <article className="row-card" key={id}><div className="row-top"><span className={`row-number r${id}`}>0{id}</span><span className={`valve-pill ${r?.valve ? "opened" : ""}`}>{r?.valve ? "Van đang mở" : "Van đóng"}</span></div><h3>Hàng {id}</h3><p>{["Tưới theo lịch hẹn", "Theo độ ẩm đất", "Đa cảm biến & VPD"][id-1]}</p><div className="water-line"><strong>{fmt(r?.daily_l, " L")}</strong><span>nước hôm nay</span></div><div className="row-actions"><button disabled={!fresh || !tankOk || busy} onClick={() => sendCommand("start", id)}>Bắt đầu tưới</button><button disabled={!fresh || busy} onClick={() => sendCommand("stop", id)}>Dừng</button></div></article>; })}</div></section>
      </>}
      {tab === "events" && <section className="panel events-panel"><div className="section-head"><div><h2>Sự kiện gần đây</h2><p>100 sự kiện mới nhất của thiết bị {device}</p></div></div>{shownEvents.length ? <div className="events-list">{shownEvents.map(e => <div className="event-row" key={e.id}><div className="event-icon">↗</div><div><strong>{messageFor(e.type)}</strong><span>Hàng {e.row} · {timeText(e.recorded_at)}</span></div><b>{e.liters == null ? "—" : fmt(e.liters, " L", 2)}</b></div>)}</div> : <div className="empty-chart">Chưa có sự kiện tưới</div>}</section>}
      {tab === "config" && <section className="config-layout"><div className="panel"><div className="section-head"><div><h2>Thông số điều khiển</h2><p>Phiên bản cấu hình v{version} · áp dụng khi STM32 tải lại</p></div></div><div className="config-group"><h3>Hàng 1 · Lịch tưới</h3><div className="form-grid">{[0,1].map(i => <label className="field" key={i}><span>Lần {i+1}</span><input type="time" value={`${String(config.scheduleHour[i]).padStart(2,"0")}:${String(config.scheduleMinute[i]).padStart(2,"0")}`} onChange={e => { const [h,m] = e.target.value.split(":").map(Number); changeArray("scheduleHour", i, h); setConfig(c => ({...c, scheduleMinute: c.scheduleMinute.map((v,j) => j === i ? m : v)})); }}/></label>)}{numberField("Mục tiêu (L)", "targetL", 0, 0.1)}{numberField("Tối đa (giây)", "maxSeconds", 0)}</div></div><div className="config-group"><h3>Hàng 2 · Độ ẩm</h3><div className="form-grid">{numberField("Ngưỡng mở (%)", "low", 0)}{numberField("Ngưỡng đóng (%)", "high", 0)}{numberField("Mục tiêu (L)", "targetL", 1, 0.1)}{numberField("Nghỉ thấm (giây)", "soakSeconds", 0)}{numberField("Tối đa (giây)", "maxSeconds", 1)}</div></div><div className="config-group"><h3>Hàng 3 · VPD</h3><div className="form-grid">{numberField("Ngưỡng mở (%)", "low", 1)}{numberField("Ngưỡng đóng (%)", "high", 1)}{numberField("Mục tiêu (L)", "targetL", 2, 0.1)}{numberField("Nghỉ thấm (giây)", "soakSeconds", 1)}{numberField("Tối đa (giây)", "maxSeconds", 2)}{([ ["VPD nóng (kPa)","vpdHot",0.1], ["Tăng ngưỡng ẩm (%)","vpdThresholdBoost",0.1], ["Tăng nước (tỉ lệ)","vpdVolumeBoost",0.05] ] as const).map(([label,key,step]) => <label className="field" key={key}><span>{label}</span><input type="number" step={step} value={config[key]} onChange={e => setConfig(c => ({...c,[key]:Number(e.target.value)}))}/></label>)}</div></div><details className="calibration"><summary>Hiệu chuẩn cảm biến và phao</summary><div className="form-grid">{[0,1,2,3].flatMap(i => [numberField(`Cảm biến ${i+1} khô (ADC)`,"soilDry",i),numberField(`Cảm biến ${i+1} ướt (ADC)`,"soilWet",i)])}<label className="field"><span>Mức LOW của phao báo</span><select value={config.floatLowLevel ? "low" : "high"} onChange={e => setConfig(c => ({...c,floatLowLevel:e.target.value === "low"}))}><option value="low">Bồn cạn</option><option value="high">Bồn còn nước</option></select></label></div></details><div className="save-bar"><span>Kiểm tra các giá trị bằng cảm biến thực trước khi vận hành.</span><button className="primary-btn" disabled={mode === "demo" || busy} onClick={saveConfig}>Lưu cấu hình</button></div></div><aside className="hint-panel"><span className="hint-icon">ⓘ</span><h3>Về cấu hình</h3><p>Giá trị đang hiển thị là mặc định nếu chưa có thiết bị. Backend lưu phiên bản mới; STM32 tự tải và kiểm tra trước khi áp dụng.</p><p>Chế độ mẫu không ghi dữ liệu hoặc gửi lệnh.</p></aside></section>}
    </main>
  </div>;
}
