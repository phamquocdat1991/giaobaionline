import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import * as schema from "./schema";

let portableDb: unknown;

async function initLocalTables(client: { execute: (sql: string) => Promise<unknown> }) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS classrooms (
      id text PRIMARY KEY NOT NULL,
      code text DEFAULT '' NOT NULL,
      name text NOT NULL,
      students_json text DEFAULT '[]' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_classrooms_code ON classrooms (code);`,
    `CREATE TABLE IF NOT EXISTS quizzes (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      education_level text NOT NULL,
      grade text NOT NULL,
      subject text NOT NULL,
      bloom_json text DEFAULT '[]' NOT NULL,
      questions_json text DEFAULT '[]' NOT NULL,
      assigned_class_id text,
      teacher_email text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      deadline text,
      time_limit_minutes integer,
      max_attempts integer DEFAULT 3 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_quizzes_assigned_class ON quizzes (assigned_class_id);`,
    `CREATE TABLE IF NOT EXISTS submissions (
      id text PRIMARY KEY NOT NULL,
      quiz_id text NOT NULL,
      student_name text NOT NULL,
      student_code text DEFAULT '' NOT NULL,
      class_name text NOT NULL,
      class_id text,
      score integer NOT NULL,
      correct_count integer NOT NULL,
      total_questions integer NOT NULL,
      duration_seconds integer NOT NULL,
      attempt_number integer DEFAULT 1 NOT NULL,
      answers_json text DEFAULT '{}' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON submissions (quiz_id);`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_student_class ON submissions (student_name, class_name);`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_quiz_student_code ON submissions (quiz_id, student_code, class_id);`,
  ];
  for (const sql of statements) {
    try {
      await client.execute(sql);
    } catch {
      // Ignore index already exists
    }
  }
}

// D1 and libSQL expose compatible Drizzle APIs but intentionally use different result types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDb(): Promise<any> {
  try {
    const workers = await import("cloudflare:workers");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (workers.env.DB) return drizzleD1(workers.env.DB as any, { schema });
  } catch {
    // Standard Node runtimes use the portable Turso adapter below.
  }

  if (portableDb) return portableDb;
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL) {
      throw new Error("Chưa cấu hình cơ sở dữ liệu. Trên Vercel, hãy đặt TURSO_DATABASE_URL và TURSO_AUTH_TOKEN.");
    }
    url = "file:local.db";
  }
  const [{ createClient }, { drizzle }] = await Promise.all([import("@libsql/client"), import("drizzle-orm/libsql")]);
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await initLocalTables(client);
  portableDb = drizzle(client, { schema });
  return portableDb;
}
