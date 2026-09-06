import type { Student, Submission } from "@/components/eduquiz/types";

export function csvCell(value: string) {
  // Quoting alone does not prevent spreadsheet formula execution.
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function localDateTimeValue(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function matchesStudent(row: Pick<Submission, "studentCode" | "studentName">, student: Pick<Student, "code" | "name">) {
  if (row.studentCode) return row.studentCode === student.code;
  return row.studentName.normalize("NFC").trim().toLocaleLowerCase("vi-VN") === student.name.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
}
