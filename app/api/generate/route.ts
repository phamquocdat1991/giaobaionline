import { buildQuestions } from "@/components/eduquiz/question-bank";
import type { BloomLevel, Question } from "@/components/eduquiz/types";

type SourceFile = { name: string; mimeType: string; data: string };
type GenerateBody = {
  topic?: string;
  subject?: string;
  grade?: string;
  sourceText?: string;
  sourceFile?: SourceFile | null;
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

  const prompt = [
    "Bạn là chuyên gia biên soạn câu hỏi trắc nghiệm cho giáo dục Việt Nam.",
    `Hãy tạo đúng ${count} câu hỏi cho môn ${body.subject || "học"}, ${body.grade || ""}, chủ đề: ${body.topic || "theo tài liệu"}.`,
    `Mỗi câu có đúng ${answerCount} phương án. Chỉ dùng các mức Bloom: ${bloom.join(", ")}.`,
    "Câu hỏi phải bám sát tài liệu, rõ ràng, chỉ có một đáp án đúng, không bịa dữ kiện ngoài nguồn.",
    "Trả về JSON thuần có dạng {\"questions\":[{\"prompt\":\"...\",\"level\":\"Nhận biết\",\"options\":[\"...\"],\"correctOptionId\":\"A\"}]}.",
    body.sourceText ? `Nội dung nguồn:\n${body.sourceText.slice(0, 120000)}` : "",
  ].filter(Boolean).join("\n\n");

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (body.sourceFile?.data && body.sourceFile.mimeType) {
    parts.push({ inlineData: { mimeType: body.sourceFile.mimeType, data: body.sourceFile.data } });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.25 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) throw new Error(data.error?.message || "Dịch vụ AI chưa phản hồi.");
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const cleaned = extractJson(text);
  const parsed = JSON.parse(cleaned) as { questions?: unknown };
  const questions = normalizeQuestions(parsed.questions, count, answerCount, bloom);
  if (questions.length !== count) throw new Error("AI trả về thiếu câu hỏi. Vui lòng thử lại.");
  return questions;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as GenerateBody;
    const count = Math.max(3, Math.min(20, Number(body.count) || 10));
    const answerCount = Math.max(2, Math.min(6, Number(body.answerCount) || 4));
    const selectedBloom = (body.selectedBloom || []).filter((level): level is BloomLevel => validBloom.includes(level));
    const bloom = selectedBloom.length ? selectedBloom : ["Nhận biết", "Thông hiểu"] as BloomLevel[];
    if (body.sourceFile?.data && body.sourceFile.data.length > 12_000_000) {
      return Response.json({ error: "Tệp quá lớn. Vui lòng chọn tệp dưới 8 MB." }, { status: 413 });
    }

    const aiQuestions = await generateWithGemini(body, count, answerCount, bloom);
    if (aiQuestions) return Response.json({ questions: aiQuestions, engine: "gemini" });

    const questions = buildQuestions({
      topic: body.topic || "",
      sourceText: body.sourceText || body.sourceFile?.name || "",
      count,
      answerCount,
      selectedBloom: bloom,
    });
    return Response.json({ questions, engine: "local", configurationRequired: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tạo câu hỏi bằng AI." }, { status: 500 });
  }
}
