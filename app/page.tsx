export default function Home() {
  return <main style={{ fontFamily: "system-ui", maxWidth: 700, margin: "5rem auto", padding: "1rem" }}>
    <h1>Backend hệ thống tưới cà chua</h1>
    <p>API đã sẵn sàng. Giao diện giám sát sẽ được triển khai sau khi thống nhất hợp đồng dữ liệu với firmware STM32.</p>
    <p><a href="/api/v1/health">Kiểm tra trạng thái API</a></p>
  </main>;
}
