import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { eq, and } from "drizzle-orm";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test("extractJson correctly parses various Gemini response formats", async () => {
  const { extractJson } = await vite.ssrLoadModule("/app/api/generate/route.ts");

  // Case 1: Plain JSON
  const rawJson = '{"questions":[{"prompt":"Câu 1","options":["A","B"],"correctOptionId":"A"}]}';
  assert.equal(extractJson(rawJson), rawJson);

  // Case 2: Markdown code fence with ```json
  const fencedJson = '```json\n{"questions":[{"prompt":"Câu 1"}]}\n```';
  assert.equal(extractJson(fencedJson), '{"questions":[{"prompt":"Câu 1"}]}');

  // Case 3: Leading and trailing text with markdown fence
  const wrappedText = 'Dưới đây là câu hỏi ôn tập:\n```json\n{"questions":[{"prompt":"Trái đất"}]}\n```\nChúc bạn hoàn thành tốt!';
  assert.equal(extractJson(wrappedText), '{"questions":[{"prompt":"Trái đất"}]}');

  // Case 4: Raw text with embedded JSON object
  const embedded = 'Phân tích tài liệu hoàn tất: {"questions":[{"prompt":"Toán học"}]}';
  assert.equal(extractJson(embedded), '{"questions":[{"prompt":"Toán học"}]}');
});

test("roster normalization handles Vietnamese accents and formatting", async () => {
  const { normalizeCode, parseStudents, fallbackClassCode } = await vite.ssrLoadModule("/lib/roster.ts");

  assert.equal(normalizeCode(" lớp 7A-1 "), "LOP7A-1");
  assert.equal(normalizeCode("HS_001"), "HS_001");
  assert.equal(fallbackClassCode("Lớp 8B"), "8B");

  const students = parseStudents([
    { id: "s1", code: " 7a01 ", name: " Nguyễn Văn An ", email: "an@test.vn" },
    "Trần Thị Bình",
  ]);
  assert.equal(students.length, 2);
  assert.equal(students[0].code, "7A01");
  assert.equal(students[0].name, "Nguyễn Văn An");
  assert.equal(students[0].email, "an@test.vn");
  assert.equal(students[1].code, "HS002");
  assert.equal(students[1].name, "Trần Thị Bình");
});

test("database auto-initializes local SQLite and performs CRUD operations", async () => {
  const { getDb } = await vite.ssrLoadModule("/db/index.ts");
  const { classrooms, quizzes, submissions } = await vite.ssrLoadModule("/db/schema.ts");

  const db = await getDb();
  assert.ok(db, "Database should be successfully instantiated");

  const testClassId = `test-class-${Date.now()}`;
  const testQuizId = `test-quiz-${Date.now()}`;

  // Insert a test classroom
  await db.insert(classrooms).values({
    id: testClassId,
    code: "TEST9A",
    name: "Lớp Test 9A",
    studentsJson: JSON.stringify([
      { id: "st-1", code: "TEST01", name: "Lê Văn Test", email: "test@edu.vn" }
    ]),
  });

  const [savedClass] = await db.select().from(classrooms).where(eq(classrooms.id, testClassId)).limit(1);
  assert.equal(savedClass.name, "Lớp Test 9A");
  assert.equal(savedClass.code, "TEST9A");

  // Insert a test quiz
  const sampleQuestions = [
    { id: "q1", prompt: "1 + 1 = ?", level: "Nhận biết", options: [{ id: "A", text: "2" }, { id: "B", text: "3" }], correctOptionId: "A" },
    { id: "q2", prompt: "2 x 2 = ?", level: "Thông hiểu", options: [{ id: "A", text: "3" }, { id: "B", text: "4" }], correctOptionId: "B" },
  ];

  await db.insert(quizzes).values({
    id: testQuizId,
    title: "Bài kiểm tra Toán học thử nghiệm",
    educationLevel: "THCS",
    grade: "Lớp 9",
    subject: "Toán",
    bloomJson: JSON.stringify(["Nhận biết", "Thông hiểu"]),
    questionsJson: JSON.stringify(sampleQuestions),
    assignedClassId: testClassId,
    teacherEmail: "giaovien@test.vn",
    status: "published",
    maxAttempts: 3,
  });

  const [savedQuiz] = await db.select().from(quizzes).where(eq(quizzes.id, testQuizId)).limit(1);
  assert.equal(savedQuiz.title, "Bài kiểm tra Toán học thử nghiệm");
  assert.equal(savedQuiz.maxAttempts, 3);

  // Test Attempt 1
  const sub1Id = `sub-1-${Date.now()}`;
  await db.insert(submissions).values({
    id: sub1Id,
    quizId: testQuizId,
    studentName: "Lê Văn Test",
    studentCode: "TEST01",
    className: "Lớp Test 9A",
    classId: testClassId,
    score: 10,
    correctCount: 2,
    totalQuestions: 2,
    durationSeconds: 45,
    attemptNumber: 1,
    answersJson: JSON.stringify({ q1: "A", q2: "B" }),
  });

  // Test Attempt 2
  const sub2Id = `sub-2-${Date.now()}`;
  await db.insert(submissions).values({
    id: sub2Id,
    quizId: testQuizId,
    studentName: "Lê Văn Test",
    studentCode: "TEST01",
    className: "Lớp Test 9A",
    classId: testClassId,
    score: 5,
    correctCount: 1,
    totalQuestions: 2,
    durationSeconds: 30,
    attemptNumber: 2,
    answersJson: JSON.stringify({ q1: "A", q2: "A" }),
  });

  // Query prior attempts
  const attempts = await db.select().from(submissions).where(and(
    eq(submissions.quizId, testQuizId),
    eq(submissions.studentCode, "TEST01"),
  ));
  assert.equal(attempts.length, 2);
  const remaining = savedQuiz.maxAttempts - attempts.length;
  assert.equal(remaining, 1, "Student should have exactly 1 attempt remaining");

  // Clean up test records
  await db.delete(submissions).where(eq(submissions.quizId, testQuizId));
  await db.delete(quizzes).where(eq(quizzes.id, testQuizId));
  await db.delete(classrooms).where(eq(classrooms.id, testClassId));
});
