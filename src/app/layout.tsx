import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ramer-Douglas-Peucker 轨迹抽稀可视化工具",
  description: "基于 Ramer-Douglas-Peucker 算法的 GPS 轨迹抽稀可视化工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
