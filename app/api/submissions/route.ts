import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, quizzes, submissions } from "@/db/schema";
import type { Question, Student } from "@/components/eduquiz/types";
import { mapClassroom, normalizeCode } from "@/lib/roster";
import { notifyStudent } from "@/lib/notifications";
import { requireTeacher, unauthorizedResponse } from "@/lib/auth";

const mapSubmission = (row: typeof submissions.$inferSelect) => ({ ...row, answers: JSON.parse(row.answersJson) });

export async function GET(request: Request) {
  const session = await requireTeacher(request);
  if (!session) return unauthorizedResponse();
  try {
    const quizId = new URL(request.url).searchParams.get("quizId");
    const db = await getDb();
    const ownedQuizzes = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.teacherEmail, session.email));
    const ownedQuizIds = ownedQuizzes.map((row: { id: string }) => row.id);
    if (quizId && !ownedQuizIds.includes(quizId)) {
      return Response.json({ error: "Bạn không có quyền xem bài nộp của bài tập này." }, { status: 403 });
    }
    const rows = quizId
      ? await db.select().from(submissions).where(eq(submissions.quizId, quizId)).orderBy(desc(submissions.createdAt))
      : ownedQuizIds.length
        ? await db.select().from(submissions).where(inArray(submissions.quizId, ownedQuizIds)).orderBy(desc(submissions.createdAt))
        : [];
    return Response.json({ submissions: rows.map(mapSubmission) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải bài nộp." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      quizId?: string;
      studentCode?: string;
      classCode?: string;
      durationSeconds?: number;
      answers?: Record<string, string>;
    };
    const studentCode = normalizeCode(body.studentCode || "");
    const classCode = normalizeCode(body.classCode || "");
    if (!body.quizId || !studentCode || !classCode) {
      return Response.json({ error: "Vui lòng xác minh mã lớp và mã học sinh." }, { status: 400 });
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
    if (!classroom || (quiz.assignedClassId && quiz.assignedClassId !== classroom.id)) {
      return Response.json({ error: "Mã lớp không hợp lệ với bài tập này." }, { status: 403 });
    }
    const student = classroom.students.find((item: Student) => item.code === studentCode);
    if (!student) return Response.json({ error: "Mã học sinh không thuộc lớp này." }, { status: 404 });

    const prior = await db.select({ id: submissions.id }).from(submissions).where(and(
      eq(submissions.quizId, body.quizId),
      or(
        and(eq(submissions.classId, classroom.id), eq(submissions.studentCode, student.code)),
        and(eq(submissions.studentName, student.name), eq(submissions.className, classroom.name)),
      ),
    ));
    const maxAttempts = quiz.maxAttempts || 3;
    if (prior.length >= maxAttempts) {
      return Response.json({ error: `Đã đủ ${maxAttempts} lượt làm. Không thể nộp thêm.` }, { status: 429 });
    }

    const durationSeconds = Math.max(0, Number(body.durationSeconds) || 0);
    if (quiz.timeLimitMinutes && durationSeconds > quiz.timeLimitMinutes * 60 + 30) {
      return Response.json({ error: "Bài nộp vượt quá thời gian cho phép." }, { status: 408 });
    }

    const questions = JSON.parse(quiz.questionsJson) as Question[];
    const answers = body.answers || {};
    const correctCount = questions.filter((question) => answers[question.id] === question.correctOptionId).length;
    const score = Math.round((correctCount / Math.max(questions.length, 1)) * 10);
    const attemptNumber = prior.length + 1;
    const value = {
      id: crypto.randomUUID(),
      quizId: body.quizId,
      studentName: student.name,
      studentCode: student.code,
      className: classroom.name,
      classId: classroom.id,
      score,
      correctCount,
      totalQuestions: questions.length,
      durationSeconds: quiz.timeLimitMinutes ? Math.min(durationSeconds, quiz.timeLimitMinutes * 60) : durationSeconds,
      attemptNumber,
      answersJson: JSON.stringify(answers),
    };
    await db.insert(submissions).values(value);

    const message = [
      `Kết quả bài “${quiz.title}” của ${student.name}: ${score}/10 điểm.`,
      `Số câu đúng: ${correctCount}/${questions.length}.`,
      `Lượt làm: ${attemptNumber}/${maxAttempts}.`,
    ].join("\n");
    const notifications = await notifyStudent(student, `Kết quả EduQuiz: ${quiz.title}`, message);
    const answerKey = Object.fromEntries(questions.map((question) => [question.id, question.correctOptionId]));
    return Response.json({ submission: { ...value, answers, answerKey, notifications } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể nộp bài." }, { status: 500 });
  }
}
