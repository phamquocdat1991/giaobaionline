import { buildQuestions } from "@/components/eduquiz/question-bank";
import type { BloomLevel, Question } from "@/components/eduquiz/types";
import { requireTeacher, unauthorizedResponse } from "@/lib/auth";
import { VALID_BLOOM_LEVELS, validateQuestions } from "@/lib/quiz-validation";

type SourceFile = { name: string; mimeType: string; data: string };
type GenerateBody = {
  topic?: string;
  subject?: string;
  grade?: string;
  sourceText?: string;
  sourceFile?: SourceFile | null;
  sourceFiles?: SourceFile[];
  count?: number;
  answerCount?: number;
  selectedBloom?: BloomLevel[];
};

const validBloom: BloomLevel[] = VALID_BLOOM_LEVELS;
const letters = ["A", "B", "C", "D", "E", "F"];

function normalizeQuestions(value: unknown, count: number, answerCount: number, bloom: BloomLevel[]): Question[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.slice(0, count).map((raw, index) => {
    const row = raw as { prompt?: unknown; level?: unknown; options?: unknown; correctOptionId?: unknown };
    const optionTexts = (Array.isArray(row.options) ? row.options : []).map((option) => {
      if (typeof option === "string") return option.trim();
      return String((option as { text?: unknown })?.text || "").trim();
    }).filter(Boolean).slice(0, answerCount);
    while (optionTexts.length < answerCount) optionTexts.push(`Phương án ${letters[optionTexts.length]}`);
    const level = validBloom.includes(row.level as BloomLevel) && bloom.includes(row.level as BloomLevel)
      ? row.level as BloomLevel
      : bloom[index % bloom.length];
    let correctOptionId = String(row.correctOptionId || "A").toUpperCase();
    if (!letters.slice(0, answerCount).includes(correctOptionId)) correctOptionId = "A";
    return {
      id: `q-${crypto.randomUUID()}`,
      prompt: String(row.prompt || `Câu hỏi ${index + 1}`).trim(),
      level,
      options: optionTexts.map((text, optionIndex) => ({ id: letters[optionIndex], text })),
      correctOptionId,
    };
  }).filter((question) => question.prompt.length > 3);
}

export function extractJson(text: string): string {
  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0].trim();
  return text.trim();
}

export function getGeminiModelCandidates(configuredModel = process.env.GEMINI_MODEL) {
  const configured = configuredModel?.trim();
  const supportedConfiguredModel = configured && /^gemini-3(?:\.|-)/.test(configured) ? configured : null;
  return [supportedConfiguredModel, "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]
    .filter((model): model is string => Boolean(model))
    .filter((model, index, models) => models.indexOf(model) === index);
}

export function extractInteractionText(value: unknown) {
  const interaction = value as { steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  return (interaction.steps || [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((content) => content.type === "text")
    .map((content) => content.text || "")
    .join("");
}

async function generateWithGemini(body: GenerateBody, count: number, answerCount: number, bloom: BloomLevel[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const allSourceFiles: SourceFile[] = [];
  if (body.sourceFiles?.length) allSourceFiles.push(...body.sourceFiles);
  else if (body.sourceFile?.data) allSourceFiles.push(body.sourceFile);

  const hasDocument = body.sourceText?.trim() || allSourceFiles.length > 0;

  const systemInstruction = hasDocument
    ? [
        "Bạn là giáo viên Việt Nam chuyên ra đề trắc nghiệm THCS và THPT.",
        "NHIỆM VỤ DUY NHẤT: Tạo câu hỏi trắc nghiệm DỰA TRÊN NỘI DUNG TÀI LIỆU NGUỒN được cung cấp.",
        "QUY TẮC BẮT BUỘC:",
        "1. CHỈ hỏi về thông tin CÓ trong tài liệu. KHÔNG bịa đặt, KHÔNG thêm kiến thức ngoài tài liệu.",
        "2. Mỗi câu hỏi phải trích dẫn hoặc diễn giải trực tiếp từ nội dung tài liệu.",
        "3. Các đáp án sai phải hợp lý nhưng SAI so với tài liệu (không dùng đáp án vô nghĩa).",
        "4. Nếu tài liệu không đủ nội dung cho số câu yêu cầu, hãy tạo số câu có thể từ nội dung hiện có.",
      ].join("\n")
    : [
        "Bạn là giáo viên Việt Nam chuyên ra đề trắc nghiệm THCS và THPT.",
        "Tạo câu hỏi trắc nghiệm xoay quanh chủ đề được yêu cầu.",
        "Các đáp án phải rõ ràng, đáp án sai phải hợp lý (distractors tốt).",
      ].join("\n");

  const userPrompt = [
    `Hãy tạo đúng ${count} câu hỏi trắc nghiệm cho môn ${body.subject || "học"}, ${body.grade || ""}.`,
    `Chủ đề: ${body.topic ? `“${body.topic}”` : "theo tài liệu đính kèm"}.`,
    `Mỗi câu có đúng ${answerCount} phương án A, B, C...; phân bổ theo Bloom: ${bloom.join(", ")}.`,
    body.sourceText?.trim() ? `=== TÀI LIỆU NGUỒN ===\n${body.sourceText.slice(0, 100000)}\n=== HẾT TÀI LIỆU ===` : "",
    allSourceFiles.length ? `Tệp đính kèm: ${allSourceFiles.map((file) => file.name).join(", ")}.` : "",
    'Chỉ trả về JSON: {"questions":[{"prompt":"...","level":"Nhận biết","options":["...","..."],"correctOptionId":"A"}]}',
  ].filter(Boolean).join("\n\n");
  const input: Array<Record<string, unknown>> = [{ type: "text", text: userPrompt }];

  for (const sf of allSourceFiles) {
    if (sf.data && sf.mimeType) {
      input.push({
        type: sf.mimeType === "application/pdf" ? "document" : "image",
        data: sf.data,
        mime_type: sf.mimeType,
      });
    }
  }

  const candidateModels = getGeminiModelCandidates();
  const responseSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      questions: {
        type: "array",
        minItems: Math.ceil(count * 0.6),
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            prompt: { type: "string" },
            level: { type: "string", enum: bloom },
            options: { type: "array", minItems: answerCount, maxItems: answerCount, items: { type: "string" } },
            correctOptionId: { type: "string", enum: letters.slice(0, answerCount) },
          },
          required: ["prompt", "level", "options", "correctOptionId"],
        },
      },
    },
    required: ["questions"],
  };

  let lastErrorMessage = "";

  for (const model of candidateModels) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          model,
          input,
          system_instruction: systemInstruction,
          response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
          generation_config: { temperature: 0.15, thinking_level: "low", max_output_tokens: 8192 },
          store: false,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await response.json() as {
        error?: { message?: string; code?: number };
        status?: string;
        steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
      };

      if (!response.ok) {
        lastErrorMessage = data.error?.message || `Lỗi từ model ${model}`;
        console.warn(`Model ${model} chưa sẵn sàng, đang chuyển sang model Gemini 3 dự phòng...`);
        continue;
      }

      if (data.status && data.status !== "completed") throw new Error(`Gemini kết thúc với trạng thái ${data.status}.`);
      const text = extractInteractionText(data);
      if (!text) throw new Error("Gemini không trả về nội dung câu hỏi.");
      const cleaned = extractJson(text);
      const parsed = JSON.parse(cleaned) as { questions?: unknown };
      const questions = normalizeQuestions(parsed.questions, count, answerCount, bloom);
      const validation = validateQuestions(questions);
      if (validation.errors.length) throw new Error(validation.errors[0]);
      if (questions.length < Math.ceil(count * 0.6)) {
        throw new Error(`AI chỉ tạo được ${questions.length}/${count} câu hỏi. Vui lòng kiểm tra lại tài liệu nguồn.`);
      }
      return questions;
    } catch (err) {
      if (err instanceof Error && /chỉ tạo được/.test(err.message)) throw err;
      lastErrorMessage = err instanceof Error ? err.message : String(err);
      continue;
    }
  }

  if (/quota|rate limit|exhausted/i.test(lastErrorMessage)) {
    throw new Error("Khóa Gemini miễn phí tạm thời chạm giới hạn số lượt/phút của Google. Vui lòng đợi 30-60 giây rồi nhấn Tạo lại.");
  }
  throw new Error(lastErrorMessage || "Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.");
}

export async function POST(request: Request) {
  if (!(await requireTeacher(request))) return unauthorizedResponse();
  try {
    const body = await request.json() as GenerateBody;
    const count = Math.max(3, Math.min(20, Number(body.count) || 10));
    const answerCount = Math.max(2, Math.min(6, Number(body.answerCount) || 4));
    const selectedBloom = (body.selectedBloom || []).filter((level): level is BloomLevel => validBloom.includes(level));
    const bloom = selectedBloom.length ? selectedBloom : ["Nhận biết", "Thông hiểu"] as BloomLevel[];
    const allFiles = body.sourceFiles || (body.sourceFile ? [body.sourceFile] : []);
    const totalBase64Length = allFiles.reduce((sum, file) => sum + (file.data?.length || 0), 0);
    if (allFiles.length > 5 || totalBase64Length > 28_000_000) {
      return Response.json({ error: "Tối đa 5 tệp, tổng dung lượng tối đa 20 MB." }, { status: 413 });
    }

    const geminiQuestions = await generateWithGemini(body, count, answerCount, bloom);
    if (geminiQuestions) {
      return Response.json({ questions: geminiQuestions, engine: "gemini" });
    }

    if (allFiles.some(f => f.mimeType?.startsWith("image/") || f.mimeType === "application/pdf")) {
      return Response.json({ error: "Không thể trích xuất nội dung từ Ảnh/PDF khi chưa cấu hình GEMINI_API_KEY. Vui lòng thêm API Key vào biến môi trường hoặc nhập văn bản thuần để dùng tạm." }, { status: 400 });
    }

    const questions = buildQuestions({
      topic: body.topic || "",
      sourceText: body.sourceText || allFiles.map((f) => f.name).join(", ") || "",
      count,
      answerCount,
      selectedBloom: bloom,
    });
    return Response.json({ questions, engine: "local", configurationRequired: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tạo câu hỏi bằng AI." }, { status: 500 });
  }
}
