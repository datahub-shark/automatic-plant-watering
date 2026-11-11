import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "API hệ thống tưới cà chua",
  description: "Backend lưu dữ liệu và điều khiển hệ thống tưới cà chua ba hàng.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
