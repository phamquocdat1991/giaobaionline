import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quizzes } from "@/db/schema";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!row) return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
  return Response.json({ quiz: { ...row, bloom: JSON.parse(row.bloomJson), questions: JSON.parse(row.questionsJson), maxAttempts: row.maxAttempts || 3 } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  await db.delete(quizzes).where(eq(quizzes.id, id));
  return Response.json({ ok: true });
}
