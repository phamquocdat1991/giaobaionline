import { buildQuestions } from "@/components/eduquiz/question-bank";
import type { BloomLevel, Question } from "@/components/eduquiz/types";

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

const validBloom: BloomLevel[] = ["Nhận biết", "Thông hiểu", "Vận dụng thấp", "Vận dụng cao"];
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

  const parts = [];
  if (body.sourceText?.trim()) {
    parts.push({ text: `=== NỘI DUNG TÀI LIỆU NGUỒN ===\n${body.sourceText}\n==========================\n` });
  }

  const filePrompts = allSourceFiles.map(sf => sf.name).filter(Boolean);
  if (filePrompts.length > 0) {
    parts.push({ text: `Tài liệu đính kèm: ${filePrompts.join(", ")}` });
  }

  for (const sf of allSourceFiles) {
    if (sf.data && sf.mimeType) {
      parts.push({ inlineData: { mimeType: sf.mimeType, data: sf.data } });
    }
  }

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const candidateModels = [primaryModel, "gemini-3.5-flash", "gemini-2.5-flash"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.15 },
  });

  let lastErrorMessage = "";

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: payload,
        signal: AbortSignal.timeout(60_000),
      });
      const data = await response.json() as {
        error?: { message?: string; code?: number };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      if (!response.ok) {
        lastErrorMessage = data.error?.message || `Lỗi từ model ${model}`;
        if (response.status === 429 || response.status === 503 || /quota|rate limit|exhausted|demand/i.test(lastErrorMessage)) {
          console.warn(`Model ${model} chạm giới hạn hoặc bận, đang chuyển sang model dự phòng...`);
          continue;
        }
        throw new Error(lastErrorMessage);
      }

      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      const cleaned = extractJson(text);
      const parsed = JSON.parse(cleaned) as { questions?: unknown };
      const questions = normalizeQuestions(parsed.questions, count, answerCount, bloom);
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
  try {
    const body = await request.json() as GenerateBody;
    const count = body.count && body.count > 0 && body.count <= 50 ? body.count : 10;
    const answerCount = body.answerCount && body.answerCount >= 2 && body.answerCount <= 6 ? body.answerCount : 4;
    const bloom = (body.selectedBloom && body.selectedBloom.length > 0 ? body.selectedBloom : validBloom) as BloomLevel[];

    const geminiQuestions = await generateWithGemini(body, count, answerCount, bloom);
    if (geminiQuestions) {
      return Response.json({ questions: geminiQuestions, engine: "gemini" });
    }

    const allFiles = [];
    if (body.sourceFiles) allFiles.push(...body.sourceFiles);
    else if (body.sourceFile) allFiles.push(body.sourceFile);

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
