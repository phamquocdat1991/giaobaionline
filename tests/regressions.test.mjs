import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { eq } from 'drizzle-orm';

// Never use a deployment database or send notifications during regression tests.
process.env.TURSO_DATABASE_URL = `file:${await mkdtemp(`${tmpdir()}/eduquiz-regression-`)}/qa.db`;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.RESEND_API_KEY;
delete process.env.ZALO_OA_ACCESS_TOKEN;
delete process.env.GEMINI_API_KEY;
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true } });
after(() => vite.close());
const { getDb } = await vite.ssrLoadModule('/db/index.ts');
const schema = await vite.ssrLoadModule('/db/schema.ts');
const db = await getDb();
const submit = (await vite.ssrLoadModule('/app/api/submissions/route.ts')).POST;
const verify = (await vite.ssrLoadModule('/app/api/roster/verify/route.ts')).POST;
const publicQuiz = (await vite.ssrLoadModule('/app/api/quizzes/[id]/route.ts')).GET;
const request = (body, teacher = false) => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(teacher ? { 'oai-authenticated-user-email': 'qa@example.test' } : {}) }, body: JSON.stringify(body),
});
const questions = [{ id: 'q1', prompt: 'Một cộng một bằng mấy?', level: 'Nhận biết', options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }], correctOptionId: 'A' }];
async function fixture(extra = {}) {
  const id = crypto.randomUUID();
  await db.insert(schema.classrooms).values({ id, code: id.toUpperCase(), ownerEmail: 'qa@example.test', name: `QA ${id}`, studentsJson: JSON.stringify([
    { id: 's1', code: 'HS01', name: 'Học sinh trùng tên' }, { id: 's2', code: 'HS02', name: 'Học sinh trùng tên' },
  ]) });
  await db.insert(schema.quizzes).values({ id, title: 'QA regression', educationLevel: 'THCS', grade: 'Lớp 6', subject: 'Toán', questionsJson: JSON.stringify(questions), teacherEmail: 'qa@example.test', assignedClassId: id, status: 'published', ...extra });
  return { id, body: { quizId: id, classCode: id, studentCode: 'HS01', answers: { q1: 'A' }, durationSeconds: 3 } };
}

test('public JSON never exposes answer keys, raw question JSON or teacher identity', async () => {
  const { id } = await fixture();
  const response = await publicQuiz(new Request(`http://localhost/api/quizzes/${id}`), { params: Promise.resolve({ id }) });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(body, /correctOptionId|questionsJson|teacherEmail|qa@example/);
  assert.equal(JSON.parse(body).quiz.questions[0].options.length, 2);
});

test('draft quizzes cannot verify students or accept submissions', async () => {
  const { body } = await fixture({ status: 'draft' });
  assert.equal((await verify(request(body))).status, 404);
  assert.equal((await submit(request(body))).status, 404);
});

test('parallel submissions never exceed three attempts', async () => {
  const { body, id } = await fixture();
  const responses = await Promise.all(Array.from({ length: 12 }, () => submit(request({ ...body, submissionId: crypto.randomUUID() }))));
  assert.equal(responses.filter((r) => r.status === 201).length, 3);
  assert.equal(responses.filter((r) => r.status === 429).length, 9);
  const rows = await db.select().from(schema.submissions).where(eq(schema.submissions.quizId, id));
  assert.deepEqual(rows.map((r) => r.attemptNumber).sort(), [1, 2, 3]);
  assert.ok(rows.every((r) => r.score === 10));
});

test('repeated submission ID records and grades exactly once', async () => {
  const { body, id } = await fixture();
  const submissionId = crypto.randomUUID();
  const responses = await Promise.all(Array.from({ length: 6 }, () => submit(request({ ...body, submissionId }))));
  assert.equal(responses.filter((r) => r.status === 201).length, 1);
  assert.equal(responses.filter((r) => r.status === 200).length, 5);
  const replay = await submit(request({ ...body, submissionId, answers: { q1: 'B' } }));
  assert.equal((await replay.json()).submission.score, 10);
  const rows = await db.select().from(schema.submissions).where(eq(schema.submissions.quizId, id));
  assert.equal(rows.length, 1);
});

test('students sharing a name have independent attempt limits', async () => {
  const { body } = await fixture();
  for (let i = 0; i < 3; i++) assert.equal((await submit(request(body))).status, 201);
  assert.equal((await verify(request(body))).status, 429);
  const second = { ...body, studentCode: 'HS02' };
  assert.equal((await verify(request(second))).status, 200);
  const response = await submit(request(second));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).submission.attemptNumber, 1);
});

test('unknown answers and expired quizzes are rejected', async () => {
  const { body } = await fixture();
  assert.equal((await submit(request({ ...body, answers: { q1: 'Z' } }))).status, 400);
  assert.equal((await submit(request({ ...body, answers: { unknown: 'A' } }))).status, 400);
  const expired = await fixture({ deadline: '2020-01-01T00:00:00Z' });
  assert.equal((await submit(request(expired.body))).status, 410);
});

test('new teacher sessions cannot claim unowned legacy classrooms', async () => {
  const id = crypto.randomUUID();
  await db.insert(schema.classrooms).values({ id, name: 'Legacy private roster', ownerEmail: '', code: id, studentsJson: '[]' });
  const { GET } = await vite.ssrLoadModule('/app/api/classes/route.ts');
  const response = await GET(new Request('http://localhost/api/classes', { headers: { 'oai-authenticated-user-email': 'stranger@example.test' } }));
  assert.equal(response.status, 200);
  assert.ok(!(await response.json()).classes.some((r) => r.id === id));
  const [row] = await db.select().from(schema.classrooms).where(eq(schema.classrooms.id, id));
  assert.equal(row.ownerEmail, '');
});

test('generation validates malformed and oversized input before contacting AI', async () => {
  const { POST } = await vite.ssrLoadModule('/app/api/generate/route.ts');
  assert.equal((await POST(request({ topic: 'Toán', selectedBloom: 'wrong' }, true))).status, 400);
  assert.equal((await POST(request({ topic: 'Toán', count: 3.5 }, true))).status, 400);
  assert.equal((await POST(request({ topic: 'a'.repeat(4_000_000) }, true))).status, 413);
  assert.equal((await POST(request({}, true))).status, 400);
  const response = await POST(request({ topic: 'Phép cộng', count: 5 }, true));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).questions.length, 5);
});

test('CSV escapes formulas and student matching uses codes before names', async () => {
  const { csvCell, matchesStudent, localDateTimeValue } = await vite.ssrLoadModule('/lib/client-utils.ts');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('Nguyễn "An"'), '"Nguyễn ""An"""');
  assert.equal(matchesStudent({ studentCode: 'HS02', studentName: 'An' }, { code: 'HS01', name: 'An' }), false);
  assert.equal(matchesStudent({ studentCode: '', studentName: 'An' }, { code: 'HS01', name: 'An' }), true);
  assert.match(localDateTimeValue(new Date('2030-01-01T12:30:00Z')), /^2030-01-01T\d\d:30$/);
});

test('Gemini selects a model supported by the key and reads generateContent JSON', async () => {
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes('?pageSize=')) return Response.json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    const payload = JSON.parse(options.body);
    assert.ok(payload.contents[0].parts[0].text.includes('Phép cộng'));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ questions: [1, 2, 3].map((n) => ({ prompt: `Câu hỏi phép cộng số ${n}?`, level: 'Nhận biết', options: ['Đúng', 'Sai'], correctOptionId: 'A' })) }) }] } }] });
  };
  try {
    const { POST } = await vite.ssrLoadModule('/app/api/generate/route.ts');
    const response = await POST(request({ topic: 'Phép cộng', count: 3, answerCount: 2 }, true));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.engine, 'gemini');
    assert.equal(body.questions.length, 3);
    assert.match(calls[1], /gemini-2\.5-flash:generateContent$/);
    assert.ok(!calls.some((url) => url.includes('interactions')));
  } finally { globalThis.fetch = originalFetch; delete process.env.GEMINI_API_KEY; }
});

test('question IDs and answer IDs are canonicalized before storage and grading', async () => {
  const { validateQuestions } = await vite.ssrLoadModule('/lib/quiz-validation.ts');
  const result = validateQuestions([{ ...questions[0], id: ' q1 ', options: [{ id: ' a ', text: ' 2 ' }, { id: 'b', text: '3' }], correctOptionId: ' a ' }]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions[0].correctOptionId, 'A');
  assert.equal(result.questions[0].options[0].id, 'A');
  assert.equal(result.questions[0].id, 'q1');
});

test('Vietnamese tones distinguish valid answer options', async () => {
  const { validateQuestions } = await vite.ssrLoadModule('/lib/quiz-validation.ts');
  const result = validateQuestions([{ ...questions[0], options: [{ id: 'A', text: 'ma' }, { id: 'B', text: 'má' }] }]);
  assert.deepEqual(result.errors, []);
});

test('saved submissions can be recovered after deadline without accepting a new attempt', async () => {
  const { id, body } = await fixture();
  const submissionId = crypto.randomUUID();
  assert.equal((await submit(request({ ...body, submissionId }))).status, 201);
  await db.update(schema.quizzes).set({ deadline: '2020-01-01T00:00:00Z' }).where(eq(schema.quizzes.id, id));
  const replay = await submit(request({ ...body, submissionId }));
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).submission.score, 10);
  assert.equal((await submit(request({ ...body, submissionId: crypto.randomUUID() }))).status, 410);
});
