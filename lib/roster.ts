import { classrooms } from "@/db/schema";
import type { Student } from "@/components/eduquiz/types";

export function normalizeCode(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export function fallbackClassCode(name: string) {
  return normalizeCode(name.replace(/^Lớp\s*/i, ""));
}

export function parseStudents(value: unknown): Student[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") {
      return { id: `legacy-${index}`, code: `HS${String(index + 1).padStart(3, "0")}`, name: item.trim() };
    }
    const row = item as Partial<Student>;
    return {
      id: String(row.id || crypto.randomUUID()),
      code: normalizeCode(String(row.code || `HS${String(index + 1).padStart(3, "0")}`)),
      name: String(row.name || "").trim(),
      email: String(row.email || "").trim() || undefined,
      zaloUserId: String(row.zaloUserId || "").trim() || undefined,
    };
  }).filter((student) => student.name && student.code);
}

export function mapClassroom(row: typeof classrooms.$inferSelect) {
  return {
    ...row,
    code: row.code || fallbackClassCode(row.name),
    students: parseStudents(JSON.parse(row.studentsJson)),
  };
}
