import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quizzes } from "@/db/schema";

const mapQuiz = (row: typeof quizzes.$inferSelect) => ({
  ...row,
  bloom: JSON.parse(row.bloomJson),
  questions: JSON.parse(row.questionsJson),
  maxAttempts: row.maxAttempts || 3,
});

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(quizzes).orderBy(desc(quizzes.createdAt));
    return Response.json({ quizzes: rows.map(mapQuiz) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải bài tập." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body.title || !Array.isArray(body.questions) || !body.questions.length) return Response.json({ error: "Bài tập chưa có câu hỏi." }, { status: 400 });
    const id = String(body.id || crypto.randomUUID());
    const value = {
      id,
      title: String(body.title),
      educationLevel: String(body.educationLevel || "THCS"),
      grade: String(body.grade || "Lớp 6"),
      subject: String(body.subject || "Ngữ văn"),
      bloomJson: JSON.stringify(body.bloom || []),
      questionsJson: JSON.stringify(body.questions),
      assignedClassId: body.assignedClassId ? String(body.assignedClassId) : null,
      teacherEmail: String(body.teacherEmail || "giaovien@example.com"),
      status: String(body.status || "draft"),
      deadline: body.deadline ? String(body.deadline) : null,
      timeLimitMinutes: body.timeLimitMinutes ? Math.max(1, Math.min(240, Number(body.timeLimitMinutes))) : null,
      maxAttempts: 3,
      updatedAt: new Date().toISOString(),
    };
    const db = await getDb();
    await db.insert(quizzes).values(value).onConflictDoUpdate({
      target: quizzes.id,
      set: {
        title: value.title,
        educationLevel: value.educationLevel,
        grade: value.grade,
        subject: value.subject,
        bloomJson: value.bloomJson,
        questionsJson: value.questionsJson,
        assignedClassId: value.assignedClassId,
        teacherEmail: value.teacherEmail,
        status: value.status,
        deadline: value.deadline,
        timeLimitMinutes: value.timeLimitMinutes,
        maxAttempts: value.maxAttempts,
        updatedAt: value.updatedAt,
      },
    });
    const [saved] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
    return Response.json({ quiz: mapQuiz(saved) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể lưu bài tập." }, { status: 500 });
  }
}
