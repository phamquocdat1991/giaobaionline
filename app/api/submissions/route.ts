import { desc, eq, inArray, sql } from "drizzle-orm";
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
      submissionId?: string;
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
    if (!quiz || quiz.status !== "published") return Response.json({ error: "Bài tập không tồn tại hoặc chưa được phát hành." }, { status: 404 });

    const classRows = quiz.assignedClassId
      ? await db.select().from(classrooms).where(eq(classrooms.id, quiz.assignedClassId))
      : await db.select().from(classrooms).where(eq(classrooms.ownerEmail, quiz.teacherEmail));
    const classroom = classRows.map(mapClassroom).find((item: ReturnType<typeof mapClassroom>) => item.code === classCode);
    if (!classroom || (quiz.assignedClassId && quiz.assignedClassId !== classroom.id)) {
      return Response.json({ error: "Mã lớp không hợp lệ với bài tập này." }, { status: 403 });
    }
    const student = classroom.students.find((item: Student) => item.code === studentCode);
    if (!student) return Response.json({ error: "Mã học sinh không thuộc lớp này." }, { status: 404 });

    const maxAttempts = quiz.maxAttempts || 3;
    const submissionId = body.submissionId || crypto.randomUUID();
    if (typeof submissionId !== "string" || submissionId.length > 100) {
      return Response.json({ error: "Mã bài nộp không hợp lệ." }, { status: 400 });
    }
    const [alreadySaved] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
    if (alreadySaved && (alreadySaved.quizId !== quiz.id || alreadySaved.classId !== classroom.id || alreadySaved.studentCode !== student.code)) {
      return Response.json({ error: "Mã bài nộp đã được sử dụng." }, { status: 409 });
    }
    const questions = JSON.parse(quiz.questionsJson) as Question[];
    const answerKey = Object.fromEntries(questions.map((question) => [question.id, question.correctOptionId]));
    if (alreadySaved) return Response.json({ submission: { ...mapSubmission(alreadySaved), answerKey } });

    // A retry may recover a previously saved result after the deadline, but
    // new submissions still must arrive before it.
    if (quiz.deadline && Date.now() > new Date(quiz.deadline).getTime()) {
      return Response.json({ error: "Bài tập đã quá hạn nộp." }, { status: 410 });
    }

    const durationSeconds = Math.max(0, Math.floor(Number(body.durationSeconds) || 0));
    if (!Number.isFinite(durationSeconds)) return Response.json({ error: "Thời gian làm bài không hợp lệ." }, { status: 400 });
    if (quiz.timeLimitMinutes && durationSeconds > quiz.timeLimitMinutes * 60 + 30) {
      return Response.json({ error: "Bài nộp vượt quá thời gian cho phép." }, { status: 408 });
    }

    if (body.answers && (typeof body.answers !== "object" || Array.isArray(body.answers))) {
      return Response.json({ error: "Đáp án bài nộp không hợp lệ." }, { status: 400 });
    }
    const answers = body.answers || {};
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = questions.find((item) => item.id === questionId);
      if (!question || !question.options.some((option) => option.id === answer)) {
        return Response.json({ error: "Bài nộp chứa câu hỏi hoặc phương án không hợp lệ." }, { status: 400 });
      }
    }
    const correctCount = questions.filter((question) => answers[question.id] === question.correctOptionId).length;
    const score = Math.round((correctCount / Math.max(questions.length, 1)) * 10);
    const value = {
      id: submissionId,
      quizId: body.quizId,
      studentName: student.name,
      studentCode: student.code,
      className: classroom.name,
      classId: classroom.id,
      score,
      correctCount,
      totalQuestions: questions.length,
      durationSeconds: quiz.timeLimitMinutes ? Math.min(durationSeconds, quiz.timeLimitMinutes * 60) : durationSeconds,
      attemptNumber: 0,
      answersJson: JSON.stringify(answers),
    };
    // The count, limit check and insert are ONE SQLite statement. Parallel
    // requests cannot all observe the same available attempt and exceed the cap.
    const priorCount = sql`(SELECT count(*) FROM submissions WHERE quiz_id = ${quiz.id}
      AND ((class_id = ${classroom.id} AND student_code = ${student.code})
        OR (student_code = '' AND student_name = ${student.name} AND class_name = ${classroom.name})))`;
    const inserted = await db.all(sql`INSERT INTO submissions
      (id, quiz_id, student_name, student_code, class_name, class_id, score,
       correct_count, total_questions, duration_seconds, attempt_number, answers_json)
      SELECT ${value.id}, ${quiz.id}, ${student.name}, ${student.code}, ${classroom.name}, ${classroom.id},
        ${score}, ${correctCount}, ${questions.length}, ${value.durationSeconds}, ${priorCount} + 1, ${value.answersJson}
      WHERE ${priorCount} < ${maxAttempts}
      ON CONFLICT(id) DO NOTHING RETURNING id`);
    const [saved] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
    if (!saved) return Response.json({ error: `Đã đủ ${maxAttempts} lượt làm. Không thể nộp thêm.` }, { status: 429 });
    if (saved.quizId !== quiz.id || saved.classId !== classroom.id || saved.studentCode !== student.code) {
      return Response.json({ error: "Mã bài nộp đã được sử dụng." }, { status: 409 });
    }
    if (!inserted.length) return Response.json({ submission: { ...mapSubmission(saved), answerKey } });
    const attemptNumber = saved.attemptNumber;

    const message = [
      `Kết quả bài “${quiz.title}” của ${student.name}: ${score}/10 điểm.`,
      `Số câu đúng: ${correctCount}/${questions.length}.`,
      `Lượt làm: ${attemptNumber}/${maxAttempts}.`,
    ].join("\n");
    const notifications = await notifyStudent(student, `Kết quả EduQuiz: ${quiz.title}`, message);
    return Response.json({ submission: { ...mapSubmission(saved), answerKey, notifications } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể nộp bài." }, { status: 500 });
  }
}
