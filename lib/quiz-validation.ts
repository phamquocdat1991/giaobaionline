import type { BloomLevel, Question } from "@/components/eduquiz/types";

export const VALID_BLOOM_LEVELS: BloomLevel[] = ["Nhận biết", "Thông hiểu", "Vận dụng thấp", "Vận dụng cao"];

function comparable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateQuestions(value: unknown): { questions: Question[]; errors: string[] } {
  if (!Array.isArray(value) || value.length === 0) return { questions: [], errors: ["Bài tập chưa có câu hỏi."] };
  if (value.length > 50) return { questions: [], errors: ["Mỗi bài tập tối đa 50 câu hỏi."] };

  const errors: string[] = [];
  const questions = value as Question[];
  const questionIds = new Set<string>();
  const prompts = new Set<string>();

  questions.forEach((question, questionIndex) => {
    const label = `Câu ${questionIndex + 1}`;
    if (!question || typeof question !== "object") {
      errors.push(`${label} không hợp lệ.`);
      return;
    }
    if (!String(question.id || "").trim() || questionIds.has(question.id)) errors.push(`${label} có mã trống hoặc trùng.`);
    questionIds.add(question.id);
    const prompt = comparable(String(question.prompt || ""));
    if (prompt.length < 4) errors.push(`${label} chưa có nội dung rõ ràng.`);
    if (prompt && prompts.has(prompt)) errors.push(`${label} bị trùng nội dung với câu khác.`);
    prompts.add(prompt);
    if (!VALID_BLOOM_LEVELS.includes(question.level)) errors.push(`${label} có mức độ Bloom không hợp lệ.`);
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) {
      errors.push(`${label} phải có từ 2 đến 6 phương án.`);
      return;
    }
    const optionIds = question.options.map((option) => String(option?.id || "").trim().toUpperCase());
    const optionTexts = question.options.map((option) => comparable(String(option?.text || "")));
    if (optionIds.some((id) => !id) || new Set(optionIds).size !== optionIds.length) errors.push(`${label} có ký hiệu phương án trống hoặc trùng.`);
    if (optionTexts.some((text) => !text)) errors.push(`${label} có phương án để trống.`);
    if (new Set(optionTexts).size !== optionTexts.length) errors.push(`${label} có phương án trùng nội dung.`);
    if (!optionIds.includes(String(question.correctOptionId || "").trim().toUpperCase())) errors.push(`${label} chưa có đáp án đúng hợp lệ.`);
  });

  return { questions, errors };
}

export function validateQuizPreflight(input: {
  title: string;
  teacherEmail: string;
  deadline?: string;
  questions: unknown;
}) {
  const errors = validateQuestions(input.questions).errors;
  if (!input.title.trim()) errors.unshift("Vui lòng nhập tên bài học hoặc chủ đề.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.teacherEmail.trim())) errors.unshift("Email giáo viên không hợp lệ.");
  if (input.deadline && !Number.isFinite(new Date(input.deadline).getTime())) errors.unshift("Hạn nộp không hợp lệ.");
  if (input.deadline && new Date(input.deadline).getTime() <= Date.now()) errors.unshift("Hạn nộp phải ở tương lai.");
  return errors;
}
