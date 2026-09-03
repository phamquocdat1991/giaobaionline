import type { BloomLevel, Question } from "./types";

type Item = [string, string[], number, BloomLevel];
const letters = ["A", "B", "C", "D", "E", "F"];

const earth: Item[] = [
  ['Văn bản “Trái Đất – cái nôi của sự sống” thuộc thể loại nào?', ["Văn bản văn học", "Văn bản truyền thuyết", "Văn bản nghị luận", "Văn bản thông tin"], 3, "Nhận biết"],
  ['Bài thơ “Trái Đất” trong chương trình Ngữ văn 6 do tác giả nào sáng tác?', ["Hô-me-rơ", "Xuân Diệu", "Ra-bin-đra-nat Ta-go", "Rô-đa-ri"], 2, "Nhận biết"],
  ["Vì sao Trái Đất được gọi là ‘cái nôi của sự sống’?", ["Có điều kiện phù hợp để sự sống hình thành", "Là hành tinh lớn nhất", "Không có nước", "Gần Mặt Trời nhất"], 0, "Thông hiểu"],
  ["Thông điệp chính của chủ đề ‘Trái Đất – Ngôi nhà chung’ là gì?", ["Trân trọng và bảo vệ môi trường", "Khai thác tối đa tài nguyên", "Chỉ bảo vệ động vật", "Tìm hành tinh khác"], 0, "Thông hiểu"],
  ["Yếu tố nào giữ vai trò thiết yếu đối với sự sống?", ["Nước", "Kim loại", "Cát", "Đá quý"], 0, "Nhận biết"],
  ["Hành động nào góp phần bảo vệ môi trường?", ["Phân loại và giảm rác thải", "Đốt rác ngoài trời", "Lãng phí nước", "Chặt cây"], 0, "Vận dụng thấp"],
  ["Cách trình bày nào thường dùng trong văn bản thông tin?", ["Số liệu và bằng chứng", "Chỉ dùng đối thoại", "Không cần tiêu đề", "Chỉ dùng cảm xúc"], 0, "Thông hiểu"],
  ["Trong ngày vì môi trường, em nên ưu tiên việc nào?", ["Thu gom và phân loại rác", "Dùng thêm nhựa một lần", "Lãng phí giấy", "Bỏ qua"], 0, "Vận dụng thấp"],
  ["Biện pháp lâu dài nào giúp giảm tác động khí hậu?", ["Sử dụng năng lượng tiết kiệm", "Tăng đốt nhiên liệu", "Phá rừng", "Tăng rác thải"], 0, "Vận dụng cao"],
  ["Nhan đề ‘Trái Đất – cái nôi của sự sống’ nhấn mạnh điều gì?", ["Giá trị đặc biệt của hành tinh", "Kích thước hành tinh", "Màu sắc bề mặt", "Khoảng cách tới Mặt Trời"], 0, "Thông hiểu"],
];

const birds: Item[] = [
  ['Truyện ngắn “Bầy chim chìa vôi” của tác giả nào?', ["Nguyễn Quang Thiều", "Thạch Lam", "Nguyễn Ngọc Tư", "Tô Hoài"], 0, "Nhận biết"],
  ['Hai nhân vật chính trong truyện “Bầy chim chìa vôi” là ai?', ["Mên và Mon", "An và Cò", "Dế Mèn và Dế Trũi", "Sơn và Lan"], 0, "Nhận biết"],
  ["Mên và Mon lo lắng điều gì trong đêm mưa?", ["Bầy chim non có thể bị ngập", "Không tìm thấy sách", "Bị lạc đường", "Không kịp đến trường"], 0, "Thông hiểu"],
  ["Không gian chính của câu chuyện gắn với đâu?", ["Bãi cát giữa sông", "Sân trường", "Đỉnh núi", "Khu chợ"], 0, "Nhận biết"],
  ["Hành động của hai anh em thể hiện phẩm chất nào?", ["Yêu thương sự sống", "Ích kỷ", "Thờ ơ", "Nóng vội"], 0, "Thông hiểu"],
  ["Chi tiết bầy chim cất cánh mang ý nghĩa nào?", ["Sức sống kỳ diệu của tự nhiên", "Nỗi buồn chia xa", "Sự thất bại", "Sự tranh giành"], 0, "Thông hiểu"],
  ["Từ câu chuyện, em nên ứng xử thế nào với động vật nhỏ?", ["Quan tâm và bảo vệ", "Xua đuổi", "Làm tổn thương", "Không cần chú ý"], 0, "Vận dụng thấp"],
  ["Yếu tố nào làm tăng sự hồi hộp của câu chuyện?", ["Nước sông dâng trong đêm", "Buổi trưa yên tĩnh", "Tiếng trống trường", "Ngày hội làng"], 0, "Thông hiểu"],
  ["Nếu phát hiện tổ chim gặp nguy hiểm, em nên làm gì?", ["Báo người lớn và hỗ trợ an toàn", "Tự ý mang chim đi", "Bỏ mặc", "Đuổi chim khỏi tổ"], 0, "Vận dụng cao"],
  ["Chủ đề chính của truyện là gì?", ["Tình yêu thiên nhiên và sự sống", "Cuộc phiêu lưu", "Tình bạn học đường", "Truyền thuyết"], 0, "Thông hiểu"],
];

function generic(topic: string, text: string): Item[] {
  const t = topic.trim() || "nội dung tài liệu";
  const excerpt = text.split(/[.!?\n]+/).map((s) => s.trim()).find((s) => s.length > 18) || `Nội dung trọng tâm về ${t}`;
  const prompts = [
    [`Chủ đề chính của bài học “${t}” là gì?`, [t, "Một chủ đề khác", "Thông tin ngoài bài", "Không xác định"], "Nhận biết"],
    [`Nội dung nào phù hợp nhất với tài liệu về “${t}”?`, [excerpt, "Nhận định không có trong tài liệu", "Thông tin trái chủ đề", "Không có nội dung phù hợp"], "Thông hiểu"],
    [`Bước đầu tiên khi học “${t}” là gì?`, ["Xác định khái niệm và ý chính", "Bỏ qua dữ kiện", "Chỉ nhớ đáp án", "Không đọc tài liệu"], "Nhận biết"],
    [`Cách nào giúp hiểu sâu hơn về “${t}”?`, ["Liên hệ thông tin và ví dụ", "Đọc lướt", "Bỏ qua từ khóa", "Chỉ xem tiêu đề"], "Thông hiểu"],
    [`Nên kiểm chứng thông tin về “${t}” bằng cách nào?`, ["Đối chiếu tài liệu nguồn", "Đoán cảm tính", "Chọn câu dài nhất", "Không kiểm chứng"], "Vận dụng thấp"],
    [`Cách tóm tắt hiệu quả “${t}” là gì?`, ["Nêu ý chính ngắn gọn", "Sao chép toàn bộ", "Chỉ ghi ví dụ phụ", "Bỏ luận điểm chính"], "Thông hiểu"],
    [`Khi gặp thông tin mới về “${t}”, nên làm gì?`, ["So sánh với kiến thức đã biết", "Bỏ qua", "Học thuộc không hiểu", "Thay đổi nguồn"], "Vận dụng thấp"],
    [`Vận dụng kiến thức “${t}” đòi hỏi điều gì?`, ["Chọn giải pháp phù hợp", "Lặp lại nguyên văn", "Không phân tích", "Chỉ nhớ tiêu đề"], "Vận dụng cao"],
    [`Một câu trả lời tốt về “${t}” cần gì?`, ["Lập luận rõ, bám tài liệu", "Thông tin ngẫu nhiên", "Không dẫn chứng", "Không liên quan"], "Thông hiểu"],
    [`Sau bài học “${t}”, hoạt động nào phù hợp?`, ["Tự kiểm tra và sửa điểm chưa hiểu", "Bỏ ghi chú", "Không xem lại", "Chỉ nhớ một ví dụ"], "Vận dụng thấp"],
  ] as [string, string[], BloomLevel][];
  return prompts.map(([p, a, l]) => [p, a, 0, l]);
}

export function buildQuestions(input: { topic: string; sourceText: string; count: number; answerCount: number; selectedBloom: BloomLevel[] }): Question[] {
  const normalized = `${input.topic} ${input.sourceText}`.toLocaleLowerCase("vi");
  const bank = normalized.includes("bầy chim chìa vôi") ? birds : normalized.includes("trái đất") ? earth : generic(input.topic, input.sourceText);
  return Array.from({ length: input.count }, (_, index) => {
    const [prompt, baseAnswers, correct, defaultLevel] = bank[index % bank.length];
    const answers = [...baseAnswers];
    while (answers.length < input.answerCount) answers.push(`Phương án ${letters[answers.length]}`);
    const options = answers.slice(0, input.answerCount).map((text, i) => ({ id: letters[i], text }));
    return { id: `q-${crypto.randomUUID()}`, prompt, level: input.selectedBloom[index % input.selectedBloom.length] || defaultLevel, options, correctOptionId: options[Math.min(correct, options.length - 1)].id };
  });
}
