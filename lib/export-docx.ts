import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";
import type { Quiz } from "@/components/eduquiz/types";

export async function exportQuizToDocx(quiz: Quiz) {
  const letters = ["A", "B", "C", "D", "E", "F"];

  const paragraphs: Paragraph[] = [
    // Header section
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "BỘ GIÁO DỤC VÀ ĐÀO TẠO — PHÒNG GIÁO DỤC & ĐÀO TẠO",
          bold: true,
          size: 20, // 10pt
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `ĐỀ KIỂM TRA TRẮC NGHIỆM: ${quiz.subject.toUpperCase()} — ${quiz.grade.toUpperCase()}`,
          bold: true,
          size: 26, // 13pt
          color: "1e3a8a",
        }),
      ],
      spacing: { before: 120, after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Chủ đề: ${quiz.title}`,
          bold: true,
          italics: true,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Thời gian làm bài: ${quiz.timeLimitMinutes || 15} phút (không kể thời gian phát đề) · Số câu: ${quiz.questions.length} câu`,
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 180 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Họ và tên học sinh: .......................................................................", size: 21 }),
        new TextRun({ text: "\t\tLớp: ...........................", size: 21 }),
      ],
      spacing: { after: 240 },
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: "I. NỘI DUNG CÂU HỎI",
          bold: true,
          size: 24,
          color: "1e40af",
        }),
      ],
      spacing: { before: 200, after: 150 },
    }),
  ];

  // Questions content
  quiz.questions.forEach((q, index) => {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Câu ${index + 1}: `,
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: q.prompt,
            size: 22,
          }),
          new TextRun({
            text: `  [${q.level}]`,
            italics: true,
            color: "6b7280",
            size: 18,
          }),
        ],
        spacing: { before: 180, after: 80 },
      }),
    );

    // Options
    q.options.forEach((opt, optIndex) => {
      const optLetter = letters[optIndex] || String.fromCharCode(65 + optIndex);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `    ${optLetter}. `,
              bold: true,
              size: 21,
            }),
            new TextRun({
              text: opt.text,
              size: 21,
            }),
          ],
          spacing: { after: 40 },
        }),
      );
    });
  });

  // Answer Key Section
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: "II. ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT",
          bold: true,
          size: 24,
          color: "1e40af",
        }),
      ],
      spacing: { before: 400, after: 150 },
      pageBreakBefore: true,
    }),
  );

  // Answer Table
  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Câu", bold: true, size: 20 })] })],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Đáp án", bold: true, size: 20 })] })],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mức độ", bold: true, size: 20 })] })],
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
      ],
    }),
  ];

  quiz.questions.forEach((q, index) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Câu ${index + 1}`, size: 20 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q.correctOptionId, bold: true, color: "047857", size: 20 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q.level, size: 19 })] })],
          }),
        ],
      }),
    );
  });

  const answerTable = new Table({
    rows: tableRows,
    width: { size: 80, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "e2e8f0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "e2e8f0" },
    },
  });

  // Explanations section
  const explanationParagraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: "Hướng Dẫn Giải Chi Tiết:",
          bold: true,
          size: 22,
          color: "374151",
        }),
      ],
      spacing: { before: 240, after: 120 },
    }),
  ];

  quiz.questions.forEach((q, index) => {
    if (q.explanation?.trim()) {
      explanationParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Câu ${index + 1} (${q.correctOptionId}): `,
              bold: true,
              size: 21,
            }),
            new TextRun({
              text: q.explanation.trim(),
              size: 21,
              italics: true,
            }),
          ],
          spacing: { after: 100 },
        }),
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...paragraphs, answerTable, ...explanationParagraphs],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = quiz.title.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, "_").slice(0, 40);
  const filename = `EduQuiz_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
