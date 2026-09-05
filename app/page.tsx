"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { BellRing, BookOpen, BrainCircuit, CalendarClock, Check, CheckCircle2, ChevronRight, ClipboardCopy, Clock3, Cloud, Download, FileSpreadsheet, FileText, GraduationCap, History, KeyRound, LayoutDashboard, Link2, LoaderCircle, LogOut, Mail, Pencil, Printer, QrCode, RefreshCw, Send, Shield, Sparkles, Timer, Trash2, UploadCloud, Users, Wifi, WifiOff, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BloomLevel, Classroom, Question, Quiz, Student, Submission } from "@/components/eduquiz/types";
import { validateQuizPreflight } from "@/lib/quiz-validation";

const demoNames = ["Mai Bảo An", "Triệu Văn An", "Mai Văn Gia Bảo", "Ma Văn Công", "Ma Văn Cường", "Nguyễn Minh Duy", "Hoàng Gia Hân", "Lê Thu Hằng", "Trần Minh Hiếu", "Phạm Quang Huy", "Nguyễn Ngọc Lan", "Đỗ Hoàng Long", "Vũ Khánh Linh", "Trần Gia Minh", "Đặng Tuấn Nam", "Nguyễn Phương", "Hoàng Thị Quỳnh", "Lê Minh Sơn", "Trần Thanh Tâm", "Phạm Anh Thư", "Nguyễn Minh Trang", "Vũ Đức Trung", "Lê Hải Yến", "Đỗ Minh Anh", "Phạm Tuấn Anh", "Nguyễn Quốc Bảo", "Trần Ngọc Hà", "Lê Hoàng Nam", "Vũ Phương Thảo", "Đỗ Thanh Vân", "Nguyễn Bảo Vy"];
const demoStudents: Student[] = demoNames.map((name, index) => ({ id: `demo-${index + 1}`, code: `7A${String(index + 1).padStart(3, "0")}`, name }));
const bloomLevels: BloomLevel[] = ["Nhận biết", "Thông hiểu", "Vận dụng thấp", "Vận dụng cao"];
const grades: Record<string, string[]> = { "Tiểu học": ["Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5"], THCS: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9"], THPT: ["Lớp 10", "Lớp 11", "Lớp 12"] };
const subjects = [
  "Tiếng Việt", "Ngữ văn", "Toán", "Tiếng Anh", "Ngoại ngữ 1", "Ngoại ngữ 2",
  "Đạo đức", "Giáo dục công dân", "Giáo dục kinh tế và pháp luật",
  "Tự nhiên và Xã hội", "Khoa học", "Khoa học tự nhiên", "Vật lý", "Hóa học", "Sinh học",
  "Lịch sử và Địa lý", "Lịch sử", "Địa lý", "Tin học", "Công nghệ", "Tin học và Công nghệ",
  "Âm nhạc", "Mỹ thuật", "Nghệ thuật", "Giáo dục thể chất", "Giáo dục quốc phòng và an ninh",
  "Hoạt động trải nghiệm", "Hoạt động trải nghiệm, hướng nghiệp", "Giáo dục địa phương",
  "Tiếng Pháp", "Tiếng Trung", "Tiếng Nhật", "Tiếng Hàn", "Tiếng Nga", "Tiếng Đức", "Tiếng dân tộc",
];

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " "); }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }
function createClientId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `id-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
type UploadedSource = { name: string; mimeType: string; data: string };
type SourceItem = { name: string; mimeType: string; size: number; text?: string; data?: string };
type ServiceStatus = { database: "ready" | "error"; aiConfigured: boolean; emailConfigured: boolean; zaloConfigured: boolean };
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [section, setSection] = useState<"builder" | "manager">("builder");
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teacherEmail, setTeacherEmail] = useState("giaovien@eduquiz.vn");
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [syncState, setSyncState] = useState<"checking" | "ready" | "error">("checking");
  const [services, setServices] = useState<ServiceStatus | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      setIsLoggedIn(Boolean(data.authenticated));
      setGoogleConfigured(Boolean(data.googleConfigured));
      if (data.email) setTeacherEmail(data.email);
    }).catch(() => setIsLoggedIn(false));
  }, []);

  async function handleLogin(email: string, accessCode: string) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, accessCode }),
    });
    const data = await response.json();
    if (!response.ok) return data.error || "Không thể đăng nhập.";
    setTeacherEmail(data.email);
    setIsLoggedIn(true);
    return null;
  }

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    setIsLoggedIn(false);
    setTeacherEmail("giaovien@eduquiz.vn");
  }

  const loadData = useCallback(async (showToast = false) => {
    setSyncState("checking");
    try {
      const [classRes, quizRes, submissionRes, statusRes] = await Promise.all([fetch("/api/classes"), fetch("/api/quizzes"), fetch("/api/submissions"), fetch("/api/status")]);
      const responses = [classRes, quizRes, submissionRes, statusRes];
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) {
        if (responses[failedIndex].status === 401) setIsLoggedIn(false);
        throw new Error(payloads[failedIndex]?.error || "Không thể đồng bộ dữ liệu.");
      }
      setClasses(Array.isArray(payloads[0].classes) ? payloads[0].classes : []);
      setQuizzes(Array.isArray(payloads[1].quizzes) ? payloads[1].quizzes : []);
      setSubmissions(Array.isArray(payloads[2].submissions) ? payloads[2].submissions : []);
      setServices(payloads[3]);
      setSyncState("ready");
      if (showToast) toast.success("Dữ liệu đã được đồng bộ.");
    } catch (error) {
      setSyncState("error");
      if (showToast) toast.error(error instanceof Error ? error.message : "Chưa thể đồng bộ. Vui lòng thử lại.");
    }
  }, []);
  useEffect(() => {
    if (!isLoggedIn) return;
    const initial = window.setTimeout(() => void loadData(), 0);
    const timer = window.setInterval(() => void loadData(), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [isLoggedIn, loadData]);
  if (isLoggedIn === null) return <div className="student-loading"><span><BrainCircuit /></span><h1>EduQuiz AI</h1><p>Đang tải...</p></div>;
  if (!isLoggedIn) return <LoginPage googleConfigured={googleConfigured} onLogin={handleLogin} />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setSection("builder")} aria-label="Về trang tạo đề"><span className="brand-mark"><BrainCircuit size={22} /></span><span><strong>EduQuiz</strong><small>AI CLASSROOM</small></span></button>
      <span className="nav-label">Không gian giáo viên</span>
      <nav className="primary-nav" aria-label="Điều hướng chính"><button type="button" className={section === "builder" ? "active" : ""} onClick={() => setSection("builder")}><Sparkles size={17} /> Tạo đề AI</button><button type="button" className={section === "manager" ? "active" : ""} onClick={() => setSection("manager")}><LayoutDashboard size={17} /> Quản lý lớp học</button></nav>
      <div className="sidebar-support">
        <span className={`realtime ${syncState}`}>{syncState === "error" ? <WifiOff /> : <Wifi />} {syncState === "checking" ? "Đang đồng bộ" : syncState === "ready" ? "Dữ liệu đã kết nối" : "Mất kết nối dữ liệu"}</span>
        <div className="teacher-card"><span className="teacher-avatar"><GraduationCap size={18} /></span><span className="teacher-copy"><small>Tài khoản giáo viên</small><strong title={teacherEmail}>{teacherEmail}</strong></span><button className="logout-btn" onClick={() => void handleLogout()} title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={16} /></button></div>
      </div>
    </header>
    <div className="app-main">
      {section === "builder" ? <QuizBuilder classes={classes} quizzesCount={quizzes.length} submissionsCount={submissions.length} teacherEmail={teacherEmail} aiConfigured={services?.aiConfigured ?? false} onSaved={(quiz) => setQuizzes((current) => [quiz, ...current.filter((item) => item.id !== quiz.id)])} /> : <ClassManager classes={classes} setClasses={setClasses} quizzes={quizzes} submissions={submissions} onRefresh={() => loadData(true)} />}
      <Toaster position="top-right" richColors />
    </div>
  </div>;
}

function QuizBuilder({ classes, quizzesCount, submissionsCount, teacherEmail, aiConfigured, onSaved }: { classes: Classroom[]; quizzesCount: number; submissionsCount: number; teacherEmail: string; aiConfigured: boolean; onSaved: (quiz: Quiz) => void }) {
  const [educationLevel, setEducationLevel] = useState("THCS"); const [grade, setGrade] = useState("Lớp 7"); const [subject, setSubject] = useState("Ngữ văn");
  const [questionCount, setQuestionCount] = useState(10); const [answerCount, setAnswerCount] = useState(4);
  const [selectedBloom, setSelectedBloom] = useState<BloomLevel[]>(["Nhận biết", "Thông hiểu", "Vận dụng thấp"]);
  const [topic, setTopic] = useState("Bầy chim chìa vôi"); const [sourceMode, setSourceMode] = useState<"file" | "text">("file"); const [sourceText, setSourceText] = useState("");
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [isDragging, setIsDragging] = useState(false); const dropRef = useRef<HTMLLabelElement>(null);
  const [deadline, setDeadline] = useState(""); const [timeLimitMinutes, setTimeLimitMinutes] = useState(45);
  const [questions, setQuestions] = useState<Question[]>([]); const [generating, setGenerating] = useState(false); const [quizId, setQuizId] = useState("");
  const [assignedClassId, setAssignedClassId] = useState(classes[0]?.id || ""); const [shareOpen, setShareOpen] = useState(false); const [editIndex, setEditIndex] = useState<number | null>(null); const [qrData, setQrData] = useState("");
  const fileNames = sourceItems.map((item) => item.name);
  const sourceFiles: UploadedSource[] = sourceItems.filter((item) => item.data).map((item) => ({ name: item.name, mimeType: item.mimeType, data: item.data! }));
  const extractedSourceText = sourceItems.filter((item) => item.text).map((item) => `--- ${item.name} ---\n${item.text}`).join("\n\n");
  const shareUrl = typeof window !== "undefined" && quizId ? `${window.location.origin}/bai-lam/${quizId}` : "";
  const qrFileName = `QR-${(topic.trim() || "bai-tap").replace(/[\\/:*?"<>|]+/g, "-")}.png`;
  useEffect(() => { if (shareOpen && shareUrl) QRCode.toDataURL(shareUrl, { width: 260, margin: 1, color: { dark: "#1f285a", light: "#ffffff" } }).then(setQrData); }, [shareOpen, shareUrl]);
  function toggleBloom(level: BloomLevel) { setSelectedBloom((current) => current.includes(level) ? current.filter((item) => item !== level) : [...current, level]); }

  async function processOneFile(file: File): Promise<SourceItem> {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "txt") return { name: file.name, mimeType: file.type || "text/plain", size: file.size, text: await file.text() };
    if (extension === "docx") { const mammoth = await import("mammoth"); const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); return { name: file.name, mimeType: file.type, size: file.size, text: result.value }; }
    if (extension === "doc") { throw new Error(`Định dạng .doc cũ chưa được hỗ trợ: ${file.name}`); }
    if (file.type === "application/pdf" || file.type.startsWith("image/")) {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      return { name: file.name, mimeType: file.type, size: file.size, data: dataUrl.split(",")[1] || "" };
    }
    throw new Error(`Định dạng không hỗ trợ: ${file.name}`);
  }

  async function handleSourceFiles(fileList: FileList) {
    const existingNames = new Set(sourceItems.map((item) => item.name));
    const files = Array.from(fileList).filter((file) => !existingNames.has(file.name)).slice(0, Math.max(0, MAX_FILES - sourceItems.length));
    if (!files.length) return;
    const totalSize = sourceItems.reduce((sum, item) => sum + item.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_BYTES) return toast.error(`Tổng dung lượng vượt quá 20 MB. Vui lòng chọn ít file hơn.`);
    const oversized = files.find((f) => f.size > 8 * 1024 * 1024);
    if (oversized) return toast.error(`Tệp "${oversized.name}" quá lớn. Mỗi tệp tối đa 8 MB.`);
    const processed: SourceItem[] = [];
    let errored = 0;
    for (const file of files) {
      try {
        const result = await processOneFile(file);
        processed.push(result);
      } catch (e) { errored++; toast.error(e instanceof Error ? e.message : `Không đọc được ${file.name}.`); }
    }
    if (processed.length > 0) {
      setSourceItems((current) => [...current, ...processed]);
      toast.success(`Đã tải ${processed.length} tệp${errored ? ` (${errored} lỗi)` : ""}.`);
    }
  }

  function removeFile(index: number) {
    setSourceItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }
  async function generateQuiz() {
    const effectiveSourceText = sourceMode === "text" ? sourceText : extractedSourceText;
    if (!topic.trim() && !effectiveSourceText.trim() && !sourceFiles.length) return toast.error("Vui lòng nhập chủ đề hoặc chọn tài liệu nguồn.");
    if (!selectedBloom.length) return toast.error("Vui lòng chọn ít nhất một mức độ Bloom.");
    setGenerating(true); setQuestions([]);
    try { const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, subject, grade, sourceText: effectiveSourceText, sourceFiles, count: questionCount, answerCount, selectedBloom }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await new Promise((r) => setTimeout(r, 350)); setQuestions(data.questions); setQuizId(createClientId()); toast.success(data.engine === "gemini" ? `AI đã tạo ${data.questions.length} câu hỏi.` : `Đã tạo ${data.questions.length} câu hỏi bằng bộ sinh dự phòng.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Không thể tạo câu hỏi."); } finally { setGenerating(false); }
  }
  async function publishQuiz() {
    const errors = validateQuizPreflight({ title: topic || `${subject} ${grade}`, teacherEmail, deadline, questions });
    if (errors.length) return toast.error(errors[0]);
    const id = quizId || createClientId(); setQuizId(id);
    const payload = { id, title: topic || `${subject} ${grade}`, educationLevel, grade, subject, bloom: selectedBloom, questions, assignedClassId: assignedClassId || null, teacherEmail, status: "published", deadline: deadline ? new Date(deadline).toISOString() : null, timeLimitMinutes, maxAttempts: 3 };
    try { const response = await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onSaved(data.quiz); setShareOpen(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Không thể phát hành bài tập."); }
  }
  async function updateAssignment(nextClassId: string) {
    setAssignedClassId(nextClassId);
    if (!quizId || !questions.length) return;
    const payload = { id: quizId, title: topic || `${subject} ${grade}`, educationLevel, grade, subject, bloom: selectedBloom, questions, assignedClassId: nextClassId || null, teacherEmail, status: "published", deadline: deadline ? new Date(deadline).toISOString() : null, timeLimitMinutes, maxAttempts: 3 };
    try {
      const response = await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSaved(data.quiz);
      toast.success("Đã cập nhật lớp nhận bài.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật lớp nhận bài.");
    }
  }
  return <main className="builder-page">
    <section className="page-heading compact-heading"><div><span className="eyebrow"><Sparkles size={14} /> TẠO BÀI TẬP THÔNG MINH</span><h1>Tạo câu hỏi và giao bài trực tuyến</h1><p>Thiết lập cấu trúc đề, tải tài liệu và duyệt đáp án trước khi gửi cho học sinh.</p></div><span className={`api-status ${aiConfigured ? "" : "fallback"}`}>{aiConfigured ? <CheckCircle2 size={15} /> : <Cloud size={15} />} {aiConfigured ? "Gemini AI đã kết nối" : "Đang dùng bộ sinh dự phòng"}</span></section>
    <section className="overview-strip" aria-label="Tổng quan nhanh"><article><span className="overview-icon blue"><GraduationCap /></span><div><small>Lớp học</small><strong>{classes.length} <em>lớp</em></strong></div></article><article><span className="overview-icon violet"><FileText /></span><div><small>Đề đã lưu</small><strong>{quizzesCount} <em>đề</em></strong></div></article><article><span className="overview-icon mint"><Send /></span><div><small>Lượt nộp bài</small><strong>{submissionsCount} <em>lượt</em></strong></div></article></section>
    <div className="builder-grid">
      <aside className="config-card"><div className="section-title"><span><BookOpen size={18} /></span><div><h2>Cấu hình Quiz</h2><p>Thông tin bài học và cấu trúc đề</p></div></div>
        <div className="form-grid three"><Field label="Cấp học"><NativeSelect className="w-full" value={educationLevel} onChange={(e) => { const value = e.target.value; setEducationLevel(value); setGrade(grades[value][0]); }}><NativeSelectOption>Tiểu học</NativeSelectOption><NativeSelectOption>THCS</NativeSelectOption><NativeSelectOption>THPT</NativeSelectOption></NativeSelect></Field><Field label="Lớp"><NativeSelect className="w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>{grades[educationLevel].map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect></Field><Field label="Môn học"><NativeSelect className="w-full" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect></Field></div>
        <div className="form-grid two"><Field label="Số lượng câu hỏi"><NativeSelect className="w-full" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>{[5, 10, 15, 20].map((n) => <NativeSelectOption key={n} value={n}>{n} câu</NativeSelectOption>)}</NativeSelect></Field><Field label="Số đáp án"><NativeSelect className="w-full" value={answerCount} onChange={(e) => setAnswerCount(Number(e.target.value))}>{[2, 3, 4, 5, 6].map((n) => <NativeSelectOption key={n} value={n}>{n} đáp án</NativeSelectOption>)}</NativeSelect></Field></div>
        <div className="form-grid two"><Field label="Hạn nộp" optional><div className="icon-input"><CalendarClock /><Input type="datetime-local" value={deadline} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setDeadline(e.target.value)} /></div></Field><Field label="Thời gian làm bài"><div className="icon-input"><Timer /><NativeSelect className="w-full" value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60, 90, 120].map((minutes) => <NativeSelectOption key={minutes} value={minutes}>{minutes} phút</NativeSelectOption>)}</NativeSelect></div></Field></div>
        <div className="attempt-policy"><KeyRound /><span><strong>Giới hạn 3 lượt làm</strong><small>Hệ thống tự động khóa sau lần nộp thứ 3.</small></span></div>
        <div className="field-block"><label className="field-label">Mức độ nhận thức (Bloom)</label><div className="bloom-list">{bloomLevels.map((level) => <label key={level}><Checkbox checked={selectedBloom.includes(level)} onCheckedChange={() => toggleBloom(level)} /><span>{level}</span></label>)}</div></div>
        <Field label="Tên bài học / Chủ đề ôn tập" optional><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="VD: Bài 3 – Sống cùng thiên nhiên..." /></Field>
        <div className="field-block"><label className="field-label">Tài liệu nguồn</label><div className="segmented"><button className={sourceMode === "file" ? "active" : ""} onClick={() => setSourceMode("file")}>Tải file</button><button className={sourceMode === "text" ? "active" : ""} onClick={() => setSourceMode("text")}>Nhập văn bản</button></div>{sourceMode === "file" ? (<div className="dropzone-area">{fileNames.length > 0 && <div className="file-chips">{fileNames.map((name, idx) => <span key={name} className="file-chip"><span>{name}</span><button type="button" onClick={() => removeFile(idx)} aria-label={`Xóa ${name}`}><X size={12} /></button></span>)}</div>}<label ref={dropRef} className={`dropzone ${fileNames.length ? "has-file" : ""} ${isDragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) void handleSourceFiles(e.dataTransfer.files); }}><UploadCloud size={27} /><strong>{fileNames.length ? `${fileNames.length} tệp đã chọn · kéo thêm hoặc nhấn` : "Kéo thả file vào đây"}</strong><span>{fileNames.length ? `Tổng ${fileNames.length}/${MAX_FILES} tệp · nhấn để thêm` : "hoặc nhấn để chọn từ máy"}</span><small>PDF, DOCX, TXT, JPG, PNG · tối đa 5 tệp · mỗi tệp ≤ 8 MB</small><input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files) void handleSourceFiles(e.target.files); e.target.value = ""; }} /></label></div>) : <Textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} className="min-h-36" placeholder="Dán nội dung bài học hoặc tài liệu vào đây..." />}</div>
        <Button className="generate-button" onClick={generateQuiz} disabled={generating}><Sparkles /> {generating ? "Đang tạo câu hỏi..." : "Tạo Quiz Ngay"}</Button>
      </aside>
      <section className="workspace-card"><div className="workspace-header"><div><h2>Khu vực hiển thị</h2><p>{questions.length ? `Kết quả: ${questions.length} câu hỏi` : "Bản nháp sẽ xuất hiện tại đây"}</p></div>{questions.length > 0 && <div className="workspace-actions"><Button variant="outline" onClick={() => window.print()}><Printer /> In / Lưu PDF</Button><Button className="purple-button" onClick={publishQuiz}><Link2 /> Kiểm tra & phát hành</Button></div>}</div>
        {generating ? <div className="loading-state"><span className="ai-loader"><BrainCircuit /></span><LoaderCircle className="spin" /><h3>Đang phân tích tài liệu</h3><p>Trợ lý AI đang xây dựng câu hỏi theo cấu trúc Bloom đã chọn.</p></div> : questions.length === 0 ? <div className="empty-state"><span><BrainCircuit /></span><h3>Sẵn sàng tạo câu hỏi</h3><p>Tải tài liệu hoặc nhập chủ đề ở bảng bên trái, sau đó nhấn “Tạo Quiz Ngay”.</p><div className="empty-steps"><b>1</b><span>Chọn nội dung</span><ChevronRight /><b>2</b><span>Tạo đề</span><ChevronRight /><b>3</b><span>Duyệt & giao bài</span></div></div> : <div className="questions-list">{questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} onEdit={() => setEditIndex(index)} onDelete={() => setQuestions((current) => current.filter((_, i) => i !== index))} />)}</div>}
      </section>
    </div>
    <Dialog open={editIndex !== null} onOpenChange={(open) => !open && setEditIndex(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Chỉnh sửa câu hỏi</DialogTitle><DialogDescription>Kiểm tra nội dung và đáp án đúng trước khi phát hành.</DialogDescription></DialogHeader>{editIndex !== null && <QuestionEditor question={questions[editIndex]} onChange={(next) => setQuestions((current) => current.map((item, i) => i === editIndex ? next : item))} onDone={() => setEditIndex(null)} />}</DialogContent></Dialog>
    <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent className="share-dialog sm:max-w-4xl"><DialogHeader><DialogTitle className="text-2xl">Gửi Bài Tập Cho Học Sinh</DialogTitle><DialogDescription>Đường dẫn tương thích Zalo, Messenger, điện thoại và máy tính.</DialogDescription></DialogHeader><div className="share-summary"><div><span>{subject} · {grade}</span><strong>{topic}</strong><small>{deadline ? `Hạn ${new Date(deadline).toLocaleString("vi-VN")}` : "Không giới hạn hạn nộp"} · {timeLimitMinutes} phút · tối đa 3 lượt</small></div><span><CheckCircle2 /> Chuẩn Zalo & Web</span></div><div className="share-settings"><div><Mail /><span><small>Tài khoản nhận bài của giáo viên</small><strong>{teacherEmail}</strong></span></div><Field label="Giao cho lớp cụ thể" optional><NativeSelect className="w-full" value={assignedClassId} onChange={(e) => void updateAssignment(e.target.value)}><NativeSelectOption value="">Chung / xác minh bằng mã lớp</NativeSelectOption>{classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {item.code} ({item.students.length} HS)</NativeSelectOption>)}</NativeSelect></Field></div><div className="share-methods"><div className="share-method"><div className="method-title"><Link2 /><span><strong>Cách 1: Gửi đường link</strong><small>Link chuẩn cho trang web, Zalo và Facebook</small></span></div><div className="link-box">{shareUrl}</div><Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Đã sao chép link làm bài."); }}><ClipboardCopy /> Sao chép link gửi HS</Button></div><div className="share-method"><div className="method-title"><QrCode /><span><strong>Cách 2: Quét mã QR Code</strong><small>Học sinh dùng camera điện thoại để quét</small></span></div>{qrData ? <Image unoptimized className="qr-image" src={qrData} width={150} height={150} alt="Mã QR mở bài tập" /> : <div className="qr-placeholder" />}<Button variant="outline" asChild><a href={qrData || "#"} download={qrFileName} aria-disabled={!qrData} onClick={(event) => { if (!qrData) event.preventDefault(); }}><Download /> Tải ảnh QR</a></Button></div></div><a className="student-preview-link" href={shareUrl} target="_blank" rel="noreferrer"><GraduationCap /> Mở thử giao diện làm bài của học sinh <ChevronRight /></a></DialogContent></Dialog>
  </main>;
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) { return <div className="field-block"><label className="field-label">{label}{optional && <small>(Tùy chọn)</small>}</label>{children}</div>; }
function QuestionCard({ question, index, onEdit, onDelete }: { question: Question; index: number; onEdit: () => void; onDelete: () => void }) { return <article className="question-card"><div className="question-meta"><div><span className="question-number">Câu {index + 1}</span><span className="bloom-tag">{question.level}</span></div><div><button onClick={onEdit} aria-label={`Sửa câu ${index + 1}`}><Pencil /></button><button onClick={onDelete} aria-label={`Xóa câu ${index + 1}`}><Trash2 /></button></div></div><h3>{question.prompt}</h3><div className="options-grid">{question.options.map((option) => <div key={option.id} className={option.id === question.correctOptionId ? "correct" : ""}><b>{option.id}</b><span>{option.text}</span>{option.id === question.correctOptionId && <CheckCircle2 />}</div>)}</div></article>; }
function QuestionEditor({ question, onChange, onDone }: { question: Question; onChange: (question: Question) => void; onDone: () => void }) { return <div className="editor-form"><Field label="Nội dung câu hỏi"><Textarea value={question.prompt} onChange={(e) => onChange({ ...question, prompt: e.target.value })} /></Field><Field label="Mức độ Bloom"><NativeSelect className="w-full" value={question.level} onChange={(e) => onChange({ ...question, level: e.target.value as BloomLevel })}>{bloomLevels.map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect></Field><div className="editor-options">{question.options.map((option, index) => <div key={option.id}><button className={question.correctOptionId === option.id ? "selected" : ""} onClick={() => onChange({ ...question, correctOptionId: option.id })} aria-label={`Chọn ${option.id} là đáp án đúng`}>{question.correctOptionId === option.id ? <Check /> : option.id}</button><Input value={option.text} onChange={(e) => onChange({ ...question, options: question.options.map((item, i) => i === index ? { ...item, text: e.target.value } : item) })} /></div>)}</div><Button onClick={onDone}>Lưu thay đổi</Button></div>; }

function ClassManager({ classes, setClasses, quizzes, submissions, onRefresh }: { classes: Classroom[]; setClasses: React.Dispatch<React.SetStateAction<Classroom[]>>; quizzes: Quiz[]; submissions: Submission[]; onRefresh: () => void }) {
  const [tab, setTab] = useState("monitor");
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [selectedQuizId, setSelectedQuizId] = useState("all");
  const [listMode, setListMode] = useState("done");
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [roster, setRoster] = useState("");
  const [reminding, setReminding] = useState(false);
  const selectedClass = classes.find((item) => item.id === selectedClassId) || classes[0];
  const relevantQuizzes = quizzes.filter((quiz) => !selectedClass || !quiz.assignedClassId || quiz.assignedClassId === selectedClass.id);
  const relevantSubmissions = submissions.filter((submission) => (selectedQuizId === "all" || submission.quizId === selectedQuizId) && (!selectedClass || submission.classId === selectedClass.id || normalize(submission.className) === normalize(selectedClass.name)));
  const latestByStudent = new Map<string, Submission>();
  relevantSubmissions.forEach((item) => { const key = item.studentCode || normalize(item.studentName); if (!latestByStudent.has(key)) latestByStudent.set(key, item); });
  const doneStudents = selectedClass?.students.filter((student) => latestByStudent.has(student.code) || latestByStudent.has(normalize(student.name))) || [];
  const pendingStudents = selectedClass?.students.filter((student) => !latestByStudent.has(student.code) && !latestByStudent.has(normalize(student.name))) || [];
  const avg = relevantSubmissions.length ? relevantSubmissions.reduce((sum, item) => sum + item.score, 0) / relevantSubmissions.length : 0;
  const progress = selectedClass?.students.length ? Math.round(doneStudents.length / selectedClass.students.length * 100) : 0;

  async function saveClass() {
    const normalizedClassCode = classCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const students: Student[] = roster.split("\n").map((line, index) => {
      const clean = line.replace(/^\d+[.)]\s*/, "").trim();
      if (!clean) return null;
      const parts = clean.split(new RegExp("\\t|\\s*\\|\\s*")).map((part) => part.trim());
      if (parts.length === 1) return { id: createClientId(), code: `${normalizedClassCode}${String(index + 1).padStart(3, "0")}`, name: parts[0] };
      return { id: createClientId(), code: parts[0].toUpperCase(), name: parts[1], email: parts[2] || undefined, zaloUserId: parts[3] || undefined };
    }).filter((student): student is Student => !!student?.name);
    if (!className.trim() || !normalizedClassCode || !students.length) return toast.error("Vui lòng nhập tên lớp, mã lớp và danh sách học sinh.");
    try {
      const response = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: normalizedClassCode, name: className, students }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setClasses((current) => [...current.filter((item) => item.id !== data.classroom.id && item.code !== data.classroom.code), data.classroom]);
      setSelectedClassId(data.classroom.id); setClassName(""); setClassCode(""); setRoster("");
      toast.success(`Đã lưu ${students.length} học sinh vào ${data.classroom.name}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể lưu lớp."); }
  }

  function exportCsv() {
    if (!selectedClass) return;
    const rows = [["Mã lớp", "Mã học sinh", "Họ và tên", "Email", "Zalo UID", "Số lượt nộp", "Điểm trung bình"]];
    selectedClass.students.forEach((student) => {
      const studentSubs = relevantSubmissions.filter((item) => item.studentCode === student.code || normalize(item.studentName) === normalize(student.name));
      const studentAvg = studentSubs.length ? (studentSubs.reduce((sum, item) => sum + item.score, 0) / studentSubs.length).toFixed(1) : "";
      rows.push([selectedClass.code, student.code, student.name, student.email || "", student.zaloUserId || "", String(studentSubs.length), studentAvg]);
    });
    const blob = new Blob(["\ufeff" + rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = `Bang-diem-${selectedClass.name}.csv`; anchor.click(); URL.revokeObjectURL(anchor.href);
    toast.success("Đã xuất bảng điểm tương thích Excel.");
  }

  async function sendReminders() {
    if (!selectedClass || selectedQuizId === "all") return toast.error("Hãy chọn một bài tập cụ thể trước khi gửi nhắc.");
    setReminding(true);
    try {
      const response = await fetch("/api/notifications/remind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId: selectedClass.id, quizId: selectedQuizId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.emailSent + data.zaloSent > 0) toast.success(`Đã gửi ${data.emailSent} email và ${data.zaloSent} tin Zalo.`);
      else toast.info(`${data.pending} học sinh chưa nộp; chưa có kênh liên hệ hoặc dịch vụ gửi chưa được cấu hình.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể gửi nhắc nhở."); }
    finally { setReminding(false); }
  }

  return <main className="manager-page"><section className="page-heading manager-heading"><div><span className="eyebrow"><LayoutDashboard size={14} /> QUẢN LÝ LỚP HỌC</span><h1>Quản lý & Kiểm soát học sinh làm bài</h1><p>Theo dõi tiến độ, đối chiếu bằng mã học sinh và gửi nhắc chưa nộp.</p></div><Button variant="outline" onClick={onRefresh}><RefreshCw /> Đồng bộ dữ liệu</Button></section>
    <div className="guide-strip"><div><b>1</b><span><strong>Gửi bài qua Link</strong><small>Học sinh mở link và xác minh mã.</small></span></div><div><b>2</b><span><strong>Nhập danh sách có mã</strong><small>Mỗi học sinh có một mã định danh riêng.</small></span></div><div><b>3</b><span><strong>Nhắc qua Email / Zalo</strong><small>Gửi tự động đúng người chưa nộp.</small></span></div></div>
    <Tabs value={tab} onValueChange={setTab} className="manager-tabs"><TabsList variant="line" className="manager-tablist"><TabsTrigger value="history"><History /> Lịch sử bài làm <span>{submissions.length}</span></TabsTrigger><TabsTrigger value="monitor"><Users /> Kiểm soát làm / chưa làm <em>Mới</em></TabsTrigger><TabsTrigger value="classes"><GraduationCap /> Danh sách lớp học <span>{classes.length}</span></TabsTrigger></TabsList>
      <TabsContent value="history"><div className="stat-grid five"><Stat label="Lượt nộp bài" value={submissions.length} suffix="lượt" tone="purple" icon={<Send />} /><Stat label="Điểm trung bình" value={submissions.length ? (submissions.reduce((sum, item) => sum + item.score, 0) / submissions.length).toFixed(1) : "0"} suffix="/ 10" tone="green" icon={<FileSpreadsheet />} /><Stat label="Điểm cao nhất" value={submissions.length ? Math.max(...submissions.map((item) => item.score)) : 0} suffix="đ" tone="amber" icon={<CheckCircle2 />} /><Stat label="Điểm thấp nhất" value={submissions.length ? Math.min(...submissions.map((item) => item.score)) : 0} suffix="đ" tone="rose" icon={<XCircle />} /><Stat label="Tỷ lệ hoàn thành" value={progress} suffix="%" tone="blue" icon={<Users />} /></div><SubmissionTable rows={submissions} quizzes={quizzes} /></TabsContent>
      <TabsContent value="monitor"><div className="monitor-toolbar"><div className="toolbar-filters"><Field label="Lớp"><NativeSelect value={selectedClass?.id || ""} onChange={(event) => setSelectedClassId(event.target.value)}>{classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {item.code}</NativeSelectOption>)}</NativeSelect></Field><Field label="Chọn bài tập"><NativeSelect value={selectedQuizId} onChange={(event) => setSelectedQuizId(event.target.value)}><NativeSelectOption value="all">Tất cả bài tập</NativeSelectOption>{relevantQuizzes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.title}</NativeSelectOption>)}</NativeSelect></Field></div><div className="toolbar-actions"><Button variant="outline" onClick={sendReminders} disabled={reminding || selectedQuizId === "all"}><BellRing /> {reminding ? "Đang gửi..." : "Nhắc Email / Zalo"}</Button><Button className="excel-button" onClick={exportCsv}><FileSpreadsheet /> Xuất Bảng Điểm</Button></div></div>
        <div className="stat-grid four"><Stat label={selectedClass ? `${selectedClass.name} · ${selectedClass.code}` : "Lớp"} value={selectedClass?.students.length || 0} suffix="học sinh" tone="purple" icon={<GraduationCap />} /><Stat label="Đã hoàn thành bài" value={doneStudents.length} suffix="em" tone="green" icon={<CheckCircle2 />} badge={`${progress}%`} /><Stat label="Chưa làm bài" value={pendingStudents.length} suffix="em" tone="rose" icon={<Clock3 />} badge={`${100 - progress}%`} /><Stat label="Điểm trung bình lớp" value={avg.toFixed(1)} suffix="/ 10" tone="blue" icon={<FileSpreadsheet />} /></div>
        <div className="progress-row"><span>Tiến độ lớp</span><Progress value={progress} /><strong>{progress}%</strong></div>
        <div className="subtabs"><button className={listMode === "done" ? "active done" : ""} onClick={() => setListMode("done")}><CheckCircle2 /> Danh sách ĐÃ LÀM ({doneStudents.length})</button><button className={listMode === "pending" ? "active pending" : ""} onClick={() => setListMode("pending")}><Users /> Danh sách CHƯA LÀM ({pendingStudents.length})</button><button className={listMode === "summary" ? "active summary" : ""} onClick={() => setListMode("summary")}><FileText /> Bảng Điểm Tổng Hợp</button>{listMode === "pending" && <Button className="copy-pending" onClick={() => { navigator.clipboard.writeText(pendingStudents.map((student) => `${student.code} · ${student.name}`).join("\n")); toast.success("Đã sao chép danh sách chưa nộp."); }}><ClipboardCopy /> Sao chép DS</Button>}</div>
        <StudentStatusTable mode={listMode} classroom={selectedClass} submissions={relevantSubmissions} done={doneStudents} pending={pendingStudents} />
      </TabsContent>
      <TabsContent value="classes"><div className="class-info"><KeyRound /><div><strong>Mã lớp và mã học sinh giúp đối chiếu chính xác</strong><p>Định dạng mỗi dòng: Mã HS | Họ tên | Email | Zalo UID. Email và Zalo UID có thể để trống.</p></div></div><div className="class-form"><div><Field label="Tên lớp"><Input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Ví dụ: Lớp 7A" /></Field><Field label="Mã lớp"><Input value={classCode} onChange={(event) => setClassCode(event.target.value.toUpperCase())} placeholder="Ví dụ: 7A" /></Field></div><div><div className="roster-heading"><label className="field-label">Danh sách học sinh <small>Mỗi dòng một học sinh</small></label><Button variant="outline" size="sm" onClick={() => { setClassName("Lớp 7A"); setClassCode("7A"); setRoster(demoStudents.slice(0, 8).map((student) => `${student.code} | ${student.name}`).join("\n")); }}>Dán nhanh DS mẫu</Button></div><Textarea value={roster} onChange={(event) => setRoster(event.target.value)} className="min-h-56" placeholder={"7A001 | Nguyễn Văn A | an@email.com | 123456789\n7A002 | Trần Thị B | binh@email.com | 987654321"} /></div><Button className="save-class-button" onClick={saveClass}><Check /> Lưu danh sách lớp</Button></div><div className="saved-classes"><h2>Danh sách lớp đã lưu ({classes.length})</h2><div>{classes.map((item) => <article key={item.id}><span><GraduationCap /></span><div><strong>{item.name}</strong><small>Mã {item.code} · {item.students.length} học sinh</small></div></article>)}</div></div></TabsContent>
    </Tabs>
  </main>;
}

function Stat({ label, value, suffix, tone, icon, badge }: { label: string; value: string | number; suffix: string; tone: string; icon: React.ReactNode; badge?: string }) { return <article className={`stat-card ${tone}`}><div className="stat-label"><span>{icon}</span>{label}{badge && <b>{badge}</b>}</div><strong>{value} <small>{suffix}</small></strong></article>; }
function SubmissionTable({ rows, quizzes }: { rows: Submission[]; quizzes: Quiz[] }) { return rows.length ? <div className="data-table"><Table><TableHeader><TableRow><TableHead>Học sinh</TableHead><TableHead>Mã HS</TableHead><TableHead>Lớp</TableHead><TableHead>Bài tập</TableHead><TableHead>Điểm</TableHead><TableHead>Thời gian</TableHead><TableHead>Lượt</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-semibold">{row.studentName}</TableCell><TableCell>{row.studentCode || "—"}</TableCell><TableCell>{row.className}</TableCell><TableCell>{quizzes.find((quiz) => quiz.id === row.quizId)?.title || "Bài tập"}</TableCell><TableCell><span className="score-chip">{row.score}/10</span></TableCell><TableCell>{formatDuration(row.durationSeconds)}</TableCell><TableCell>Lần {row.attemptNumber}/3</TableCell></TableRow>)}</TableBody></Table></div> : <div className="table-empty"><span><History /></span><h3>Chưa có học sinh nào nộp bài</h3><p>Kết quả sẽ tự động xuất hiện tại đây sau khi học sinh nhấn “Nộp bài”.</p></div>; }
function StudentStatusTable({ mode, classroom, submissions, done, pending }: { mode: string; classroom?: Classroom; submissions: Submission[]; done: Student[]; pending: Student[] }) { if (!classroom) return <div className="table-empty"><h3>Chưa có danh sách lớp</h3></div>; const students = mode === "done" ? done : mode === "pending" ? pending : classroom.students; if (!students.length) return <div className="table-empty"><span>{mode === "done" ? <CheckCircle2 /> : <Users />}</span><h3>{mode === "done" ? "Chưa có học sinh hoàn thành bài" : "Tất cả học sinh đã hoàn thành"}</h3></div>; return <div className="data-table"><Table><TableHeader><TableRow><TableHead>Mã học sinh</TableHead><TableHead>Họ và tên</TableHead><TableHead>Lớp</TableHead>{mode === "pending" ? <TableHead>Liên hệ</TableHead> : <><TableHead>Số lượt nộp</TableHead><TableHead>Điểm trung bình</TableHead></>}</TableRow></TableHeader><TableBody>{students.map((student) => { const rows = submissions.filter((item) => item.studentCode === student.code || normalize(item.studentName) === normalize(student.name)); const average = rows.length ? rows.reduce((sum, item) => sum + item.score, 0) / rows.length : 0; return <TableRow key={student.id}><TableCell><b className="student-code">{student.code}</b></TableCell><TableCell className="font-semibold">{student.name}</TableCell><TableCell>{classroom.name}</TableCell>{mode === "pending" ? <TableCell><span className="pending-chip">{student.email || student.zaloUserId ? "Sẵn sàng nhắc" : "Thiếu liên hệ"}</span></TableCell> : <><TableCell><span className="done-chip">{rows.length}/3 lượt</span></TableCell><TableCell>{rows.length ? `${average.toFixed(1)}/10` : "—"}</TableCell></>}</TableRow>; })}</TableBody></Table></div>; }

function LoginPage({ googleConfigured, onLogin }: { googleConfigured: boolean; onLogin: (email: string, accessCode: string) => Promise<string | null> }) {
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("auth_error");
    if (!error) return;
    const message = error === "cancelled"
      ? "Bạn đã hủy đăng nhập Google."
      : error === "not_configured"
        ? "Đăng nhập Google chưa được cấu hình đầy đủ."
        : "Đăng nhập Google không thành công. Vui lòng thử lại.";
    const timer = window.setTimeout(() => toast.error(message), 0);
    window.history.replaceState({}, "", window.location.pathname);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return toast.error("Vui lòng nhập email hợp lệ.");
    if (!accessCode) return toast.error("Vui lòng nhập mã truy cập giáo viên.");
    setLoading(true);
    const error = await onLogin(trimmed, accessCode);
    setLoading(false);
    if (error) toast.error(error);
  }

  return (
    <div className="login-bg">
      <section className="login-showcase" aria-label="Giới thiệu EduQuiz AI">
        <div className="showcase-brand"><span><BrainCircuit /></span><strong>EduQuiz AI</strong></div>
        <span className="showcase-eyebrow"><Sparkles /> NỀN TẢNG DÀNH CHO GIÁO VIÊN</span>
        <h2>Tạo đề nhanh hơn.<br /><span>Quản lý lớp rõ hơn.</span></h2>
        <p>Một không gian thống nhất để biến nội dung bài học thành Quiz, giao bài tức thì và theo dõi tiến độ của từng học sinh.</p>
        <div className="showcase-steps">
          <article><b>01</b><span><strong>Tạo đề bằng AI</strong><small>Từ chủ đề, văn bản, PDF hoặc hình ảnh.</small></span><Sparkles /></article>
          <article><b>02</b><span><strong>Giao bài linh hoạt</strong><small>Chia sẻ bằng đường link hoặc mã QR.</small></span><Link2 /></article>
          <article><b>03</b><span><strong>Theo dõi kết quả</strong><small>Nắm tiến độ và xuất bảng điểm theo lớp.</small></span><FileSpreadsheet /></article>
        </div>
        <div className="showcase-trust"><Shield /><span><strong>Dữ liệu theo từng giáo viên</strong><small>Phiên đăng nhập bảo mật và dữ liệu được đồng bộ trên cloud.</small></span></div>
      </section>
      <div className="login-card">
        <div className="login-logo"><BrainCircuit size={36} /><div><strong>EduQuiz</strong><small>AI CLASSROOM</small></div></div>
        <div className="login-eyebrow"><Sparkles size={14} /> Dành cho Giáo viên &amp; Quản trị</div>
        <h1 className="login-title">Đăng nhập EduQuiz AI</h1>
        <p className="login-desc">Quản lý lớp học, tạo đề thi bằng AI và theo dõi kết quả học sinh theo thời gian thực.</p>

        {googleConfigured ? (
          <div className="login-google-section">
            <a className="google-signin-btn" href="/api/auth/google/start">
              <span className="g-icon-lg" aria-hidden="true">G</span>
              Đăng nhập bằng Google
            </a>
            <p className="login-google-note">EduQuiz chỉ dùng email đã được Google xác minh để nhận diện tài khoản và bảo vệ dữ liệu của bạn.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field-label" htmlFor="teacher-email"><Mail size={14} /> Email giáo viên</label>
            <Input id="teacher-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="giaovien@truong.edu.vn" autoComplete="email" autoFocus className="login-input" />
            <label className="login-field-label" htmlFor="teacher-code"><KeyRound size={14} /> Mã truy cập</label>
            <Input id="teacher-code" type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Mã do quản trị viên cấp" autoComplete="current-password" className="login-input" />
            <Button type="submit" className="login-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <Shield size={18} />}
              {loading ? "Đang xác thực..." : "Đăng nhập an toàn"}
            </Button>
          </form>
        )}

        <div className="login-features">
          <div><Cloud size={16} /><span>Đồng bộ đề thi tự động trên <strong>Database Cloud</strong></span></div>
          <div><FileText size={16} /><span>In đề / lưu PDF, tạo link và mã QR cho học sinh</span></div>
          <div><Shield size={16} /><span>Trợ lý <strong>AI Gemini</strong> hỗ trợ tạo đề tự động</span></div>
        </div>
        <p className="login-student-note">Học sinh tham gia làm bài trực tiếp qua Link hoặc Mã QR mà không cần đăng nhập tài khoản.</p>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
