import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, quizzes } from "@/db/schema";
import { requireTeacher, unauthorizedResponse } from "@/lib/auth";
import { validateQuestions } from "@/lib/quiz-validation";

const mapQuiz = (row: typeof quizzes.$inferSelect) => ({
  ...row,
  bloom: JSON.parse(row.bloomJson),
  questions: JSON.parse(row.questionsJson),
  maxAttempts: row.maxAttempts || 3,
});

export async function GET(request: Request) {
  const session = await requireTeacher(request);
  if (!session) return unauthorizedResponse();
  try {
    const db = await getDb();
    const rows = await db.select().from(quizzes).where(eq(quizzes.teacherEmail, session.email)).orderBy(desc(quizzes.createdAt));
    return Response.json({ quizzes: rows.map(mapQuiz) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải bài tập." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireTeacher(request);
  if (!session) return unauthorizedResponse();
  try {
    const body = await request.json() as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const validation = validateQuestions(body.questions);
    if (!title || validation.errors.length) {
      return Response.json({ error: !title ? "Vui lòng nhập tên bài học hoặc chủ đề." : validation.errors[0], errors: validation.errors }, { status: 400 });
    }
    const deadline = body.deadline ? new Date(String(body.deadline)) : null;
    if (deadline && (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now())) {
      return Response.json({ error: "Hạn nộp phải là thời điểm hợp lệ trong tương lai." }, { status: 400 });
    }
    const id = String(body.id || crypto.randomUUID());
    const value = {
      id,
      title,
      educationLevel: String(body.educationLevel || "THCS"),
      grade: String(body.grade || "Lớp 6"),
      subject: String(body.subject || "Ngữ văn"),
      bloomJson: JSON.stringify(body.bloom || []),
      questionsJson: JSON.stringify(validation.questions),
      assignedClassId: body.assignedClassId ? String(body.assignedClassId) : null,
      teacherEmail: session.email,
      status: String(body.status || "draft"),
      deadline: deadline ? deadline.toISOString() : null,
      timeLimitMinutes: body.timeLimitMinutes ? Math.max(1, Math.min(240, Number(body.timeLimitMinutes))) : null,
      maxAttempts: 3,
      updatedAt: new Date().toISOString(),
    };
    const db = await getDb();
    const [existing] = await db.select({ teacherEmail: quizzes.teacherEmail }).from(quizzes).where(eq(quizzes.id, id)).limit(1);
    if (existing && existing.teacherEmail !== session.email) {
      return Response.json({ error: "Bạn không có quyền sửa bài tập này." }, { status: 403 });
    }
    if (value.assignedClassId) {
      const [ownedClass] = await db.select({ id: classrooms.id }).from(classrooms).where(and(
        eq(classrooms.id, value.assignedClassId),
        eq(classrooms.ownerEmail, session.email),
      )).limit(1);
      if (!ownedClass) return Response.json({ error: "Lớp được chọn không thuộc tài khoản của bạn." }, { status: 403 });
    }
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
