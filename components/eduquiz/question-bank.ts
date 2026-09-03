import type { BloomLevel, Question } from "./types";

type Item = [string, string[], number, BloomLevel];
const letters = ["A", "B", "C", "D", "E", "F"];

const earth: Item[] = [
  ['Văn bản "Trái Đất – cái nôi của sự sống" thuộc thể loại nào?', ["Văn bản văn học", "Văn bản truyền thuyết", "Văn bản nghị luận", "Văn bản thông tin"], 3, "Nhận biết"],
  ['Bài thơ "Trái Đất" trong chương trình Ngữ văn 6 do tác giả nào sáng tác?', ["Hô-me-rơ", "Xuân Diệu", "Ra-bin-đra-nat Ta-go", "Rô-đa-ri"], 2, "Nhận biết"],
  ["Vì sao Trái Đất được gọi là 'cái nôi của sự sống'?", ["Có điều kiện phù hợp để sự sống hình thành", "Là hành tinh lớn nhất", "Không có nước", "Gần Mặt Trời nhất"], 0, "Thông hiểu"],
  ["Thông điệp chính của chủ đề 'Trái Đất – Ngôi nhà chung' là gì?", ["Trân trọng và bảo vệ môi trường", "Khai thác tối đa tài nguyên", "Chỉ bảo vệ động vật", "Tìm hành tinh khác"], 0, "Thông hiểu"],
  ["Yếu tố nào giữ vai trò thiết yếu đối với sự sống?", ["Nước", "Kim loại", "Cát", "Đá quý"], 0, "Nhận biết"],
  ["Hành động nào góp phần bảo vệ môi trường?", ["Phân loại và giảm rác thải", "Đốt rác ngoài trời", "Lãng phí nước", "Chặt cây"], 0, "Vận dụng thấp"],
  ["Cách trình bày nào thường dùng trong văn bản thông tin?", ["Số liệu và bằng chứng", "Chỉ dùng đối thoại", "Không cần tiêu đề", "Chỉ dùng cảm xúc"], 0, "Thông hiểu"],
  ["Trong ngày vì môi trường, em nên ưu tiên việc nào?", ["Thu gom và phân loại rác", "Dùng thêm nhựa một lần", "Lãng phí giấy", "Bỏ qua"], 0, "Vận dụng thấp"],
  ["Biện pháp lâu dài nào giúp giảm tác động khí hậu?", ["Sử dụng năng lượng tiết kiệm", "Tăng đốt nhiên liệu", "Phá rừng", "Tăng rác thải"], 0, "Vận dụng cao"],
  ["Nhan đề 'Trái Đất – cái nôi của sự sống' nhấn mạnh điều gì?", ["Giá trị đặc biệt của hành tinh", "Kích thước hành tinh", "Màu sắc bề mặt", "Khoảng cách tới Mặt Trời"], 0, "Thông hiểu"],
];

const birds: Item[] = [
  ['Truyện ngắn "Bầy chim chìa vôi" của tác giả nào?', ["Nguyễn Quang Thiều", "Thạch Lam", "Nguyễn Ngọc Tư", "Tô Hoài"], 0, "Nhận biết"],
  ['Hai nhân vật chính trong truyện "Bầy chim chìa vôi" là ai?', ["Mên và Mon", "An và Cò", "Dế Mèn và Dế Trũi", "Sơn và Lan"], 0, "Nhận biết"],
  ["Mên và Mon lo lắng điều gì trong đêm mưa?", ["Bầy chim non có thể bị ngập", "Không tìm thấy sách", "Bị lạc đường", "Không kịp đến trường"], 0, "Thông hiểu"],
  ["Không gian chính của câu chuyện gắn với đâu?", ["Bãi cát giữa sông", "Sân trường", "Đỉnh núi", "Khu chợ"], 0, "Nhận biết"],
  ["Hành động của hai anh em thể hiện phẩm chất nào?", ["Yêu thương sự sống", "Ích kỷ", "Thờ ơ", "Nóng vội"], 0, "Thông hiểu"],
  ["Chi tiết bầy chim cất cánh mang ý nghĩa nào?", ["Sức sống kỳ diệu của tự nhiên", "Nỗi buồn chia xa", "Sự thất bại", "Sự tranh giành"], 0, "Thông hiểu"],
  ["Từ câu chuyện, em nên ứng xử thế nào với động vật nhỏ?", ["Quan tâm và bảo vệ", "Xua đuổi", "Làm tổn thương", "Không cần chú ý"], 0, "Vận dụng thấp"],
  ["Yếu tố nào làm tăng sự hồi hộp của câu chuyện?", ["Nước sông dâng trong đêm", "Buổi trưa yên tĩnh", "Tiếng trống trường", "Ngày hội làng"], 0, "Thông hiểu"],
  ["Nếu phát hiện tổ chim gặp nguy hiểm, em nên làm gì?", ["Báo người lớn và hỗ trợ an toàn", "Tự ý mang chim đi", "Bỏ mặc", "Đuổi chim khỏi tổ"], 0, "Vận dụng cao"],
  ["Chủ đề chính của truyện là gì?", ["Tình yêu thiên nhiên và sự sống", "Cuộc phiêu lưu", "Tình bạn học đường", "Truyền thuyết"], 0, "Thông hiểu"],
];

/**
 * Extracts meaningful sentences from source text to use as question prompts.
 * Returns an array of sentence strings, each at least 20 chars long.
 */
function extractSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 300)
    .slice(0, 30);
}

/**
 * Creates questions from actual source text content.
 * When an API key is not configured, generates questions that reference
 * real sentences from the uploaded document instead of generic templates.
 */
function fromSourceText(topic: string, text: string, bloom: BloomLevel[]): Item[] {
  const t = topic.trim() || "nội dung tài liệu";
  const sentences = extractSentences(text);

  if (sentences.length >= 2) {
    const items: Item[] = sentences.slice(0, 10).map((sentence, i) => {
      const level = bloom[i % bloom.length];
      // Pick a different sentence as a wrong option
      const wrongSentence1 = sentences[(i + 1) % sentences.length] || "Thông tin không có trong tài liệu";
      const wrongSentence2 = sentences[(i + 2) % sentences.length] || "Nhận định sai lệch";
      const wrongSentence3 = "Thông tin không thuộc phạm vi bài học";

      switch (level) {
        case "Nhận biết":
          return [
            `Nội dung nào sau đây có trong tài liệu về "${t}"?`,
            [sentence, wrongSentence1 !== sentence ? wrongSentence1 : "Nội dung không xuất hiện trong tài liệu", wrongSentence3, "Tất cả các ý trên đều sai"],
            0,
            "Nhận biết",
          ];
        case "Thông hiểu":
          return [
            `Đoạn sau nói về điều gì: "${sentence.slice(0, 80)}${sentence.length > 80 ? "..." : ""}"?`,
            [`Nội dung liên quan đến ${t}`, wrongSentence2 !== sentence ? wrongSentence2.slice(0, 60) : "Chủ đề ngoài bài học", "Thông tin trái ngược với tài liệu", "Không liên quan đến bài học"],
            0,
            "Thông hiểu",
          ];
        case "Vận dụng thấp":
          return [
            `Dựa vào tài liệu "${t}", thông tin nào phù hợp nhất?`,
            [sentence.slice(0, 100), "Thông tin không có trong tài liệu này", "Nhận định trái với nội dung bài", "Thông tin từ nguồn khác"],
            0,
            "Vận dụng thấp",
          ];
        default:
          return [
            `Sau khi đọc tài liệu "${t}", ý nào sau đây phản ánh đúng nội dung?`,
            [sentence.slice(0, 100), "Nhận xét không dựa trên tài liệu", "Kết luận sai so với bài đọc", "Thông tin bịa đặt"],
            0,
            "Vận dụng cao",
          ];
      }
    });
    return items;
  }

  // Minimal fallback if sourceText is too short
  const t2 = topic.trim() || "nội dung tài liệu";
  return [
    [`Chủ đề chính của tài liệu "${t2}" là gì?`, [t2, "Một chủ đề không liên quan", "Thông tin ngoài bài", "Không xác định được"], 0, "Nhận biết"],
    [`Để hiểu tốt tài liệu "${t2}", bước nào nên làm đầu tiên?`, ["Đọc toàn bộ và xác định ý chính", "Bỏ qua phần mở đầu", "Chỉ đọc tiêu đề", "Tìm câu trả lời trước"], 0, "Thông hiểu"],
    [`Thông tin trong tài liệu "${t2}" được dùng để làm gì?`, ["Hiểu và vận dụng kiến thức đã học", "Ghi nhớ máy móc", "Đoán mò câu trả lời", "Tìm thông tin không liên quan"], 0, "Vận dụng thấp"],
    [`Sau khi đọc tài liệu "${t2}", em cần làm gì để ghi nhớ tốt?`, ["Tóm tắt ý chính và liên hệ thực tế", "Đọc lại nhiều lần không hiểu", "Bỏ qua phần khó", "Chép lại toàn bộ"], 0, "Vận dụng cao"],
  ];
}

export function buildQuestions(input: { topic: string; sourceText: string; count: number; answerCount: number; selectedBloom: BloomLevel[] }): Question[] {
  const normalized = `${input.topic} ${input.sourceText}`.toLocaleLowerCase("vi");
  const bloom = input.selectedBloom.length ? input.selectedBloom : ["Nhận biết", "Thông hiểu"] as BloomLevel[];

  // Use specific pre-built question banks for known topics
  const bank: Item[] = normalized.includes("bầy chim chìa vôi")
    ? birds
    : normalized.includes("trái đất")
      ? earth
      : fromSourceText(input.topic, input.sourceText, bloom);

  return Array.from({ length: input.count }, (_, index) => {
    const [prompt, baseAnswers, correct, defaultLevel] = bank[index % bank.length];
    const answers = [...baseAnswers];
    while (answers.length < input.answerCount) answers.push(`Phương án ${letters[answers.length]}`);
    const options = answers.slice(0, input.answerCount).map((text, i) => ({ id: letters[i], text }));
    return {
      id: `q-${crypto.randomUUID()}`,
      prompt,
      level: bloom[index % bloom.length] || defaultLevel,
      options,
      correctOptionId: options[Math.min(correct, options.length - 1)].id,
    };
  });
}
