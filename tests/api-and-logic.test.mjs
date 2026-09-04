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
  const { extractInteractionText, extractJson, getGeminiModelCandidates } = await vite.ssrLoadModule("/app/api/generate/route.ts");

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

  const interactionText = extractInteractionText({
    steps: [{ type: "model_output", content: [{ type: "text", text: rawJson }] }],
  });
  assert.equal(interactionText, rawJson);
  assert.deepEqual(getGeminiModelCandidates("gemini-2.5-flash"), [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
  ], "Obsolete Gemini 2.x configuration must never be retried");
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

test("quiz preflight rejects blank and duplicate answer options", async () => {
  const { validateQuestions } = await vite.ssrLoadModule("/lib/quiz-validation.ts");
  const result = validateQuestions([
    {
      id: "q1",
      prompt: "Câu hỏi hợp lệ?",
      level: "Nhận biết",
      options: [{ id: "A", text: "Giống nhau" }, { id: "B", text: " giống nhau " }],
      correctOptionId: "C",
    },
  ]);
  assert.ok(result.errors.some((message) => message.includes("trùng nội dung")));
  assert.ok(result.errors.some((message) => message.includes("đáp án đúng")));
});

test("fallback generator fulfills the requested count without repeating questions", async () => {
  const { buildQuestions } = await vite.ssrLoadModule("/components/eduquiz/question-bank.ts");
  const questions = buildQuestions({
    topic: "Chủ đề thử nghiệm",
    sourceText: "",
    count: 20,
    answerCount: 4,
    selectedBloom: ["Nhận biết", "Thông hiểu"],
  });
  assert.equal(new Set(questions.map((question) => question.prompt)).size, questions.length);
  assert.equal(questions.length, 20);
});

test("teacher APIs require a server-verified session", async () => {
  const { GET } = await vite.ssrLoadModule("/app/api/classes/route.ts");
  const unauthorized = await GET(new Request("http://localhost/api/classes"));
  assert.equal(unauthorized.status, 401);

  const authorized = await GET(new Request("http://localhost/api/classes", {
    headers: { "oai-authenticated-user-email": "teacher@example.com" },
  }));
  assert.equal(authorized.status, 200);

  process.env.VERCEL = "1";
  try {
    const spoofed = await GET(new Request("http://localhost/api/classes", {
      headers: { "oai-authenticated-user-email": "attacker@example.com" },
    }));
    assert.equal(spoofed.status, 401, "Vercel must not trust a client-supplied Sites identity header");
  } finally {
    delete process.env.VERCEL;
  }
});

test("Google OAuth uses state, PKCE and creates a signed teacher session", async () => {
  process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough-for-oauth";
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  const originalFetch = globalThis.fetch;
  try {
    const { GET: startGoogle } = await vite.ssrLoadModule("/app/api/auth/google/start/route.ts");
    const startResponse = await startGoogle(new Request("https://quiz.example.com/api/auth/google/start"));
    const authorizeUrl = new URL(startResponse.headers.get("location"));
    assert.equal(authorizeUrl.origin, "https://accounts.google.com");
    assert.equal(authorizeUrl.searchParams.get("response_type"), "code");
    assert.equal(authorizeUrl.searchParams.get("code_challenge_method"), "S256");
    assert.ok(authorizeUrl.searchParams.get("state"));
    assert.ok(authorizeUrl.searchParams.get("nonce"));
    assert.ok(authorizeUrl.searchParams.get("code_challenge"));

    const flowCookie = startResponse.headers.get("set-cookie").split(";")[0];
    const { getGoogleOAuthFlow } = await vite.ssrLoadModule("/lib/auth.ts");
    const flow = await getGoogleOAuthFlow(new Request("https://quiz.example.com", { headers: { cookie: flowCookie } }));
    assert.ok(flow);

    const encodedClaims = Buffer.from(JSON.stringify({
      aud: process.env.GOOGLE_CLIENT_ID,
      email: "verified.teacher@example.com",
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 300,
      iss: "https://accounts.google.com",
      nonce: flow.nonce,
      sub: "google-user-123",
    })).toString("base64url");
    globalThis.fetch = async (url) => String(url).includes("/token")
      ? Response.json({ access_token: "google-access-token", id_token: `header.${encodedClaims}.signature` })
      : Response.json({ email: "verified.teacher@example.com", email_verified: true, sub: "google-user-123" });

    const { GET: finishGoogle } = await vite.ssrLoadModule("/app/api/auth/google/callback/route.ts");
    const callbackResponse = await finishGoogle(new Request(
      `https://quiz.example.com/api/auth/google/callback?code=test-code&state=${encodeURIComponent(flow.state)}`,
      { headers: { cookie: flowCookie } },
    ));
    assert.equal(callbackResponse.status, 303);
    assert.equal(callbackResponse.headers.get("location"), "https://quiz.example.com/");
    assert.match(callbackResponse.headers.get("set-cookie"), /eduquiz_teacher_session=/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.SESSION_SECRET;
  }
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
    ownerEmail: "giaovien@test.vn",
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

  const { GET: getPublicQuiz } = await vite.ssrLoadModule("/app/api/quizzes/[id]/route.ts");
  const publicResponse = await getPublicQuiz(
    new Request(`http://localhost/api/quizzes/${testQuizId}`),
    { params: Promise.resolve({ id: testQuizId }) },
  );
  const publicQuiz = await publicResponse.json();
  assert.equal(publicResponse.status, 200);
  assert.equal("correctOptionId" in publicQuiz.quiz.questions[0], false, "Public quiz must not expose its answer key");

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

test("teacher data is isolated by verified email", async () => {
  const { getDb } = await vite.ssrLoadModule("/db/index.ts");
  const { classrooms } = await vite.ssrLoadModule("/db/schema.ts");
  const { GET } = await vite.ssrLoadModule("/app/api/classes/route.ts");
  const db = await getDb();
  const suffix = Date.now();
  const ownerClassId = `owner-class-${suffix}`;
  const otherClassId = `other-class-${suffix}`;

  await db.insert(classrooms).values([
    { id: ownerClassId, code: `OWN${suffix}`, ownerEmail: "owner@example.com", name: "Lớp của Owner", studentsJson: "[]" },
    { id: otherClassId, code: `OTHER${suffix}`, ownerEmail: "other@example.com", name: "Lớp của người khác", studentsJson: "[]" },
  ]);
  try {
    const response = await GET(new Request("http://localhost/api/classes", {
      headers: { "oai-authenticated-user-email": "owner@example.com" },
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.ok(data.classes.some((classroom) => classroom.id === ownerClassId));
    assert.ok(!data.classes.some((classroom) => classroom.id === otherClassId));
  } finally {
    await db.delete(classrooms).where(eq(classrooms.id, ownerClassId));
    await db.delete(classrooms).where(eq(classrooms.id, otherClassId));
  }
});
