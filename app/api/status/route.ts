import { getDb } from "@/db";
import { classrooms } from "@/db/schema";
import { requireTeacher, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) return unauthorizedResponse();
  try {
    const db = await getDb();
    await db.select({ id: classrooms.id }).from(classrooms).limit(1);
    return Response.json({
      database: "ready",
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      zaloConfigured: Boolean(process.env.ZALO_OA_ACCESS_TOKEN),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      database: "error",
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      zaloConfigured: Boolean(process.env.ZALO_OA_ACCESS_TOKEN),
      error: error instanceof Error ? error.message : "Không thể kết nối cơ sở dữ liệu.",
    }, { status: 503 });
  }
}
