export type BloomLevel = "Nhận biết" | "Thông hiểu" | "Vận dụng thấp" | "Vận dụng cao";

export type QuizOption = { id: string; text: string };

export type Question = {
  id: string;
  prompt: string;
  level: BloomLevel;
  options: QuizOption[];
  correctOptionId: string;
};

export type Student = {
  id: string;
  code: string;
  name: string;
  email?: string;
  zaloUserId?: string;
};

export type Quiz = {
  id: string;
  title: string;
  educationLevel: string;
  grade: string;
  subject: string;
  bloom: BloomLevel[];
  questions: Question[];
  assignedClassId?: string | null;
  teacherEmail: string;
  status: "draft" | "published";
  deadline?: string | null;
  timeLimitMinutes?: number | null;
  maxAttempts: number;
  createdAt: string;
};

export type Classroom = {
  id: string;
  code: string;
  name: string;
  students: Student[];
  createdAt?: string;
};

export type Submission = {
  id: string;
  quizId: string;
  studentName: string;
  studentCode: string;
  className: string;
  classId?: string | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  attemptNumber: number;
  answers: Record<string, string>;
  createdAt: string;
  notifications?: { email: boolean; zalo: boolean };
};
