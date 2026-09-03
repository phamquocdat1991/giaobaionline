import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

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

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the product theme and responsive layout", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--indigo:/);
  assert.match(css, /\.builder-grid/);
  assert.match(css, /@media\s*\((?:max-width:\s*800px|width<=800px)\)/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("renders button with variants and children", async () => {
  const { Button } = await vite.ssrLoadModule("/components/ui/button.tsx");
  const html = renderToStaticMarkup(React.createElement(Button, { variant: "outline" }, "Làm bài"));
  assert.match(html, /Làm bài/);
  assert.match(html, /border/);
});

test("renders input with accessibility attributes", async () => {
  const { Input } = await vite.ssrLoadModule("/components/ui/input.tsx");
  const html = renderToStaticMarkup(React.createElement(Input, { placeholder: "Mã học sinh", disabled: true }));
  assert.match(html, /placeholder="Mã học sinh"/);
  assert.match(html, /disabled/);
});

test("normalizes class and student identity codes", async () => {
  const { normalizeCode, parseStudents } = await vite.ssrLoadModule("/lib/roster.ts");
  assert.equal(normalizeCode(" lớp 7a "), "LOP7A");
  const students = parseStudents([
    { id: "1", code: " 7a-001 ", name: " Nguyễn Văn A ", email: "a@example.com" },
    "Trần Thị B",
  ]);
  assert.equal(students[0].code, "7A-001");
  assert.equal(students[0].name, "Nguyễn Văn A");
  assert.equal(students[1].code, "HS002");
});
