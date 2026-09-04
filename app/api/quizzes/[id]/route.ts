import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quizzes } from "@/db/schema";
import { requireTeacher, unauthorizedResponse } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const [row] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
    if (!row || row.status !== "published") return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
    const questions = (JSON.parse(row.questionsJson) as Array<Record<string, unknown>>).map((question) =>
      Object.fromEntries(Object.entries(question).filter(([key]) => key !== "correctOptionId")),
    );
    return Response.json({ quiz: { ...row, bloom: JSON.parse(row.bloomJson), questions, maxAttempts: row.maxAttempts || 3 } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải bài tập." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireTeacher(request);
  if (!session) return unauthorizedResponse();
  const { id } = await params;
  const db = await getDb();
  await db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.teacherEmail, session.email)));
  return Response.json({ ok: true });
}
