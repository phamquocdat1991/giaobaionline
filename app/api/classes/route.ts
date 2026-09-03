import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms } from "@/db/schema";
import type { Student } from "@/components/eduquiz/types";
import { fallbackClassCode, mapClassroom, normalizeCode, parseStudents } from "@/lib/roster";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(classrooms).orderBy(asc(classrooms.name));
    return Response.json({ classes: rows.map(mapClassroom) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải danh sách lớp." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: string; code?: string; name?: string; students?: Student[] };
    const name = body.name?.trim();
    const code = normalizeCode(body.code || "");
    const students = parseStudents(body.students);
    if (!name || !code || !students.length) {
      return Response.json({ error: "Vui lòng nhập tên lớp, mã lớp và danh sách học sinh." }, { status: 400 });
    }
    if (new Set(students.map((student) => student.code)).size !== students.length) {
      return Response.json({ error: "Mã học sinh trong cùng lớp không được trùng nhau." }, { status: 400 });
    }

    const db = await getDb();
    const all = await db.select().from(classrooms);
    const existing = all.find((row: typeof classrooms.$inferSelect) => (row.code || fallbackClassCode(row.name)) === code);
    if (body.id && existing && existing.id !== body.id) {
      return Response.json({ error: `Mã lớp ${code} đã tồn tại ở lớp khác.` }, { status: 409 });
    }

    const id = body.id || (existing ? existing.id : crypto.randomUUID());
    const value = { id, code, name, studentsJson: JSON.stringify(students) };
    await db.insert(classrooms).values(value).onConflictDoUpdate({
      target: classrooms.id,
      set: { code, name, studentsJson: value.studentsJson },
    });
    return Response.json({ classroom: { id: value.id, code, name, students } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể lưu lớp." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Thiếu mã lớp." }, { status: 400 });
  const db = await getDb();
  await db.delete(classrooms).where(eq(classrooms.id, id));
  return Response.json({ ok: true });
}
