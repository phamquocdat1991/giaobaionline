import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("defines the EduQuiz application shell and primary journeys", async () => {
  const [layout, page] = await Promise.all([
    readFile(`${root}/app/layout.tsx`, "utf8"),
    readFile(`${root}/app/page.tsx`, "utf8"),
  ]);

  assert.match(layout, /EduQuiz AI — Tạo đề và giao bài trực tuyến/);
  assert.match(page, /Không gian giáo viên/);
  assert.match(page, /Tạo Quiz Ngay/);
  assert.match(page, /overview-strip/);
  assert.match(page, /login-showcase/);
});
