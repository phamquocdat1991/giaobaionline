import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, quizzes, submissions } from "@/db/schema";
import { mapClassroom, normalizeCode } from "@/lib/roster";
import type { Student } from "@/components/eduquiz/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { quizId?: string; classCode?: string; studentCode?: string };
    const classCode = normalizeCode(body.classCode || "");
    const studentCode = normalizeCode(body.studentCode || "");
    if (!body.quizId || !classCode || !studentCode) {
      return Response.json({ error: "Vui lòng nhập đầy đủ mã lớp và mã học sinh." }, { status: 400 });
    }

    const db = await getDb();
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, body.quizId)).limit(1);
    if (!quiz) return Response.json({ error: "Bài tập không tồn tại." }, { status: 404 });
    if (quiz.deadline && Date.now() > new Date(quiz.deadline).getTime()) {
      return Response.json({ error: "Bài tập đã quá hạn nộp." }, { status: 410 });
    }

    const classRows = quiz.assignedClassId
      ? await db.select().from(classrooms).where(eq(classrooms.id, quiz.assignedClassId))
      : await db.select().from(classrooms).where(eq(classrooms.ownerEmail, quiz.teacherEmail));
    const classroom = classRows.map(mapClassroom).find((item: ReturnType<typeof mapClassroom>) => item.code === classCode);
    if (!classroom) return Response.json({ error: "Mã lớp không chính xác." }, { status: 404 });
    if (quiz.assignedClassId && quiz.assignedClassId !== classroom.id) {
      return Response.json({ error: "Bài tập này không được giao cho lớp của em." }, { status: 403 });
    }
    const student = classroom.students.find((item: Student) => item.code === studentCode);
    if (!student) return Response.json({ error: "Mã học sinh không thuộc lớp này." }, { status: 404 });

    const attempts = await db.select({ id: submissions.id }).from(submissions).where(and(
      eq(submissions.quizId, body.quizId),
      or(
        and(eq(submissions.classId, classroom.id), eq(submissions.studentCode, student.code)),
        and(eq(submissions.studentName, student.name), eq(submissions.className, classroom.name)),
      ),
    ));
    const maxAttempts = quiz.maxAttempts || 3;
    if (attempts.length >= maxAttempts) {
      return Response.json({ error: `Em đã sử dụng đủ ${maxAttempts} lượt làm bài.` }, { status: 429 });
    }

    return Response.json({
      identity: { studentName: student.name, studentCode: student.code, className: classroom.name, classCode: classroom.code, classId: classroom.id },
      attemptsUsed: attempts.length,
      attemptsRemaining: maxAttempts - attempts.length,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể xác minh học sinh." }, { status: 500 });
  }
}
