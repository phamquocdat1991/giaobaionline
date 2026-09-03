import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const classrooms = sqliteTable("classrooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().default(""),
  name: text("name").notNull(),
  studentsJson: text("students_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_classrooms_code").on(table.code)]);

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  educationLevel: text("education_level").notNull(),
  grade: text("grade").notNull(),
  subject: text("subject").notNull(),
  bloomJson: text("bloom_json").notNull().default("[]"),
  questionsJson: text("questions_json").notNull().default("[]"),
  assignedClassId: text("assigned_class_id"),
  teacherEmail: text("teacher_email").notNull(),
  status: text("status").notNull().default("draft"),
  deadline: text("deadline"),
  timeLimitMinutes: integer("time_limit_minutes"),
  maxAttempts: integer("max_attempts").notNull().default(3),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_quizzes_assigned_class").on(table.assignedClassId)]);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id").notNull(),
  studentName: text("student_name").notNull(),
  studentCode: text("student_code").notNull().default(""),
  className: text("class_name").notNull(),
  classId: text("class_id"),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  answersJson: text("answers_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_submissions_quiz_id").on(table.quizId),
  index("idx_submissions_student_class").on(table.studentName, table.className),
  index("idx_submissions_quiz_student_code").on(table.quizId, table.studentCode, table.classId),
]);
