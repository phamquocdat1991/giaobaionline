import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduQuiz AI — Tạo đề và giao bài trực tuyến",
  description: "Tạo câu hỏi, giao bài qua link hoặc QR, theo dõi tiến độ và tổng hợp điểm cho lớp học.",
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
