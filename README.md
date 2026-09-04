# EduQuiz AI

Ứng dụng web giáo dục hỗ trợ giáo viên tạo đề trắc nghiệm, giao bài qua link/QR, quản lý danh sách lớp, theo dõi học sinh đã làm/chưa làm và xuất bảng điểm.

## Chức năng hiện có

- Cấu hình cấp học, lớp, môn, số câu và số phương án.
- Chọn 4 mức độ nhận thức Bloom.
- AI Gemini tạo câu hỏi từ chủ đề, văn bản, PDF và ảnh; DOCX/TXT được trích xuất nội dung trước khi gửi AI.
- Danh sách đầy đủ các môn học phổ thông và ngoại ngữ.
- Tạo, xem trước, sửa, xoá câu hỏi và chọn đáp án đúng.
- Phát hành bài, đặt hạn nộp, giới hạn thời gian, tạo link và mã QR.
- Học sinh xác minh bằng mã lớp + mã học sinh, làm bài theo đồng hồ đếm ngược và nộp bài.
- Chấm điểm phía máy chủ, giới hạn cứng 3 lượt làm và xem lại đúng/sai.
- Lưu danh sách lớp kèm mã, email, Zalo UID; đối chiếu đã làm/chưa làm và đồng bộ định kỳ.
- Gửi kết quả và nhắc chưa nộp qua email/Zalo khi đã cấu hình dịch vụ.
- Sao chép danh sách chưa nộp và xuất bảng điểm dạng CSV tương thích Excel.

## Chạy cục bộ

```bash
npm install
npm run dev
```

`npm run dev` chạy bản tương thích ChatGPT Sites. Dùng `npm run dev:next` khi cần kiểm tra trực tiếp bằng Next.js.

Sao chép `.env.example` thành `.env.local` và đặt tối thiểu hai biến sau để đăng nhập giáo viên:

```text
TEACHER_ACCESS_CODE=mot-ma-truy-cap-dai-va-kho-doan
SESSION_SECRET=mot-chuoi-bi-mat-doc-lap-dai-va-ngau-nhien
```

Phiên đăng nhập được ký ở máy chủ, lưu bằng cookie `HttpOnly` và hết hạn sau 8 giờ. Học sinh vẫn mở link làm bài mà không cần tài khoản.

## Deploy bằng Vercel

Mã nguồn dùng Next.js và đã được kiểm tra bằng `next build`. Để dữ liệu hoạt động trên Vercel:

1. Tạo một cơ sở dữ liệu Turso/libSQL.
2. Chạy toàn bộ tệp SQL trong thư mục `drizzle/` theo đúng thứ tự trên cơ sở dữ liệu đó.
3. Khai báo biến môi trường:

```text
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
RESEND_API_KEY=...
RESEND_FROM_EMAIL=EduQuiz <quiz@tenmiencuaban.vn>
ZALO_OA_ACCESS_TOKEN=...
TEACHER_ACCESS_CODE=...
SESSION_SECRET=...
```

4. Đẩy dự án lên GitHub, import repository vào Vercel và deploy bằng cấu hình Next.js mặc định.

Trước khi deploy, có thể chạy toàn bộ kiểm tra bằng:

```bash
npm test
npm run lint
npm run build:next
```

Trên ChatGPT Sites, ứng dụng sử dụng D1 được khai báo trong `.openai/hosting.json`; không cần cấu hình Turso.

## Cấu trúc dữ liệu

- `classrooms`: lớp, mã lớp và danh sách học sinh có mã/liên hệ.
- `quizzes`: cấu hình đề, hạn nộp, thời lượng và nội dung câu hỏi.
- `submissions`: lượt nộp, định danh học sinh, đáp án, điểm và thời gian làm bài.

Nếu chưa có `GEMINI_API_KEY`, ứng dụng vẫn dùng bộ sinh câu hỏi nội bộ để giáo viên tiếp tục thao tác. Email và Zalo chỉ gửi khi có khóa tương ứng; lỗi dịch vụ ngoài không làm mất bài nộp của học sinh.

API quản trị lớp, đề và bài nộp yêu cầu phiên giáo viên hợp lệ. API công khai cho học sinh không trả đáp án đúng trước khi nộp; đáp án chỉ được gửi kèm kết quả đã chấm.

Thông tin nhạy cảm không được ghi trực tiếp vào mã nguồn. Các token cơ sở dữ liệu phải được đặt trong biến môi trường của nền tảng triển khai.
