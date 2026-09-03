import type { Student } from "@/components/eduquiz/types";

export type NotificationResult = {
  email: boolean;
  zalo: boolean;
  emailSkipped?: string;
  zaloSkipped?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character] || character);
}

async function sendEmail(to: string | undefined, subject: string, message: string) {
  if (!to) return { sent: false, skipped: "Học sinh chưa có email" };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, skipped: "Chưa cấu hình dịch vụ email" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: message,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#27314b"><h2 style="color:#3f51cf">EduQuiz AI</h2><p>${escapeHtml(message).replaceAll("\n", "<br>")}</p></div>`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Email API: ${await response.text()}`);
  return { sent: true };
}

async function sendZalo(userId: string | undefined, message: string) {
  if (!userId) return { sent: false, skipped: "Học sinh chưa có Zalo UID" };
  const token = process.env.ZALO_OA_ACCESS_TOKEN;
  if (!token) return { sent: false, skipped: "Chưa cấu hình Zalo OA" };
  const response = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: { access_token: token, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text: message } }),
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json() as { error?: number; message?: string };
  if (!response.ok || data.error) throw new Error(`Zalo OA: ${data.message || "Không gửi được tin nhắn"}`);
  return { sent: true };
}

export async function notifyStudent(student: Student, subject: string, message: string): Promise<NotificationResult> {
  const [email, zalo] = await Promise.allSettled([
    sendEmail(student.email, subject, message),
    sendZalo(student.zaloUserId, message),
  ]);
  const emailValue = email.status === "fulfilled" ? email.value : { sent: false, skipped: email.reason instanceof Error ? email.reason.message : "Lỗi email" };
  const zaloValue = zalo.status === "fulfilled" ? zalo.value : { sent: false, skipped: zalo.reason instanceof Error ? zalo.reason.message : "Lỗi Zalo" };
  return {
    email: emailValue.sent,
    zalo: zaloValue.sent,
    emailSkipped: emailValue.skipped,
    zaloSkipped: zaloValue.skipped,
  };
}
