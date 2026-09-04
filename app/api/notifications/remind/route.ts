import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, quizzes, submissions } from "@/db/schema";
import { mapClassroom } from "@/lib/roster";
import { notifyStudent } from "@/lib/notifications";
import { requireTeacher, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await requireTeacher(request))) return unauthorizedResponse();
  try {
    const body = await request.json() as { classId?: string; quizId?: string };
    if (!body.classId || !body.quizId) {
      return Response.json({ error: "Vui lòng chọn lớp và một bài tập cụ thể." }, { status: 400 });
    }
    const db = await getDb();
    const [[classRow], [quiz]] = await Promise.all([
      db.select().from(classrooms).where(eq(classrooms.id, body.classId)).limit(1),
      db.select().from(quizzes).where(eq(quizzes.id, body.quizId)).limit(1),
    ]);
    if (!classRow || !quiz) return Response.json({ error: "Không tìm thấy lớp hoặc bài tập." }, { status: 404 });
    if (quiz.assignedClassId && quiz.assignedClassId !== classRow.id) {
      return Response.json({ error: "Bài tập không được giao cho lớp này." }, { status: 400 });
    }
    const classroom = mapClassroom(classRow);
    const completed = await db.select({ studentCode: submissions.studentCode, studentName: submissions.studentName }).from(submissions).where(and(
      eq(submissions.quizId, quiz.id),
      or(eq(submissions.classId, classroom.id), eq(submissions.className, classroom.name)),
    ));
    const completedCodes = new Set(completed.map((row: { studentCode: string }) => row.studentCode));
    const completedNames = new Set(completed.map((row: { studentName: string }) => row.studentName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()));
    const pending = classroom.students.filter((student) => !completedCodes.has(student.code) && !completedNames.has(student.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()));
    const origin = new URL(request.url).origin;
    const deadlineText = quiz.deadline
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(quiz.deadline))
      : "không giới hạn";
    const results = await Promise.all(pending.map(async (student) => {
      const message = [
        `Nhắc bài EduQuiz: ${student.name} chưa nộp bài “${quiz.title}”.`,
        `Hạn nộp: ${deadlineText}.`,
        `Link làm bài: ${origin}/bai-lam/${quiz.id}`,
        `Mã lớp: ${classroom.code} · Mã học sinh: ${student.code}`,
      ].join("\n");
      return { student: student.name, ...(await notifyStudent(student, `Nhắc nộp bài: ${quiz.title}`, message)) };
    }));
    return Response.json({
      pending: pending.length,
      emailSent: results.filter((item) => item.email).length,
      zaloSent: results.filter((item) => item.zalo).length,
      skipped: results.filter((item) => !item.email && !item.zalo).length,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể gửi nhắc nhở." }, { status: 500 });
  }
}
