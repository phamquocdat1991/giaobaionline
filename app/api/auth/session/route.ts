import { NextResponse } from "next/server";
import {
  createTeacherSessionCookie,
  expiredTeacherSessionCookie,
  getTeacherSession,
  isTeacherAuthConfigured,
  verifyTeacherAccessCode,
} from "@/lib/auth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const session = await getTeacherSession(request);
  return Response.json({
    authenticated: Boolean(session),
    email: session?.email || null,
    authConfigured: isTeacherAuthConfigured() || session?.source === "platform",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; accessCode?: string };
  const email = body.email?.trim().toLowerCase() || "";
  if (!emailPattern.test(email)) {
    return Response.json({ error: "Vui lòng nhập email giáo viên hợp lệ." }, { status: 400 });
  }
  if (!isTeacherAuthConfigured()) {
    return Response.json({ error: "Chưa cấu hình TEACHER_ACCESS_CODE và SESSION_SECRET trên máy chủ." }, { status: 503 });
  }
  if (!(await verifyTeacherAccessCode(body.accessCode || ""))) {
    return Response.json({ error: "Mã truy cập giáo viên không đúng." }, { status: 401 });
  }

  const cookie = await createTeacherSessionCookie(email);
  const response = NextResponse.json({ authenticated: true, email });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return response;
}

export async function DELETE() {
  const cookie = expiredTeacherSessionCookie();
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return response;
}
