"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Award, BrainCircuit, CheckCircle2, Clock3, KeyRound, LoaderCircle, RefreshCw, Send, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import type { Quiz, Submission } from "@/components/eduquiz/types";

type Identity = {
  studentName: string;
  studentCode: string;
  className: string;
  classCode: string;
  classId: string;
};

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatDeadline(value?: string | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function StudentQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [classCode, setClassCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Submission | null>(null);
  const [expired, setExpired] = useState(false);
  const autoSubmittedRef = useRef(false);
  const submitRef = useRef<(auto?: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    fetch(`/api/quizzes/${id}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQuiz(data.quiz);
      setExpired(!!data.quiz.deadline && Date.now() > new Date(data.quiz.deadline).getTime());
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Không thể mở bài tập.")).finally(() => setLoading(false));
  }, [id]);

  const timeLimitSeconds = (quiz?.timeLimitMinutes || 0) * 60;

  useEffect(() => {
    if (!identity || result || submitting) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      const next = value + 1;
      if (timeLimitSeconds > 0 && next >= timeLimitSeconds && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        queueMicrotask(() => void submitRef.current(true));
      }
      return next;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [identity, result, submitting, timeLimitSeconds]);

  const remainingSeconds = timeLimitSeconds ? Math.max(0, timeLimitSeconds - seconds) : seconds;
  const answeredCount = Object.keys(answers).length;
  const progress = quiz ? Math.round(answeredCount / quiz.questions.length * 100) : 0;
  const levelText = useMemo(() => {
    if (!result) return "";
    if (result.score >= 9) return "Xuất sắc!";
    if (result.score >= 7) return "Làm tốt lắm!";
    if (result.score >= 5) return "Đã hoàn thành!";
    return "Cần cố gắng thêm!";
  }, [result]);

  async function verifyIdentity() {
    if (!classCode.trim() || !studentCode.trim()) return toast.error("Vui lòng nhập mã lớp và mã học sinh.");
    setVerifying(true);
    try {
      const response = await fetch("/api/roster/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: id, classCode, studentCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setIdentity(data.identity);
      setClassCode(data.identity.classCode);
      setStudentCode(data.identity.studentCode);
      setAttemptsRemaining(data.attemptsRemaining);
      setSeconds(0);
      autoSubmittedRef.current = false;
      toast.success(`Đã xác minh: ${data.identity.studentName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xác minh học sinh.");
    } finally {
      setVerifying(false);
    }
  }

  async function submit(auto = false) {
    if (!quiz || !identity || submitting) return;
    if (!auto && answeredCount < quiz.questions.length && !window.confirm(`Bạn còn ${quiz.questions.length - answeredCount} câu chưa trả lời. Vẫn nộp bài?`)) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, studentCode: identity.studentCode, classCode: identity.classCode, durationSeconds: seconds, answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data.submission);
      setAttemptsRemaining(Math.max(0, quiz.maxAttempts - data.submission.attemptNumber));
      if (auto) toast.info("Đã hết thời gian. Hệ thống tự động nộp bài.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể nộp bài.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { submitRef.current = submit; });

  function retry() {
    if (attemptsRemaining <= 0) return toast.error("Bạn đã sử dụng đủ 3 lượt làm bài.");
    setAnswers({});
    setSeconds(0);
    setResult(null);
    autoSubmittedRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <main className="student-loading"><span><LoaderCircle /></span><h1>Đang mở bài tập...</h1></main>;
  if (!quiz) return <main className="student-loading error"><span><XCircle /></span><h1>Không tìm thấy bài tập</h1><p>Đường dẫn có thể đã hết hiệu lực hoặc chưa được phát hành.</p></main>;

  return <div className="student-page">
    <header className="student-topbar"><Link href="/" className="student-brand"><span><BrainCircuit /></span><div><strong>EDUQUIZ · LÀM BÀI ÔN TẬP</strong><small>Xác minh bằng mã học sinh</small></div></Link><div className={`timer ${timeLimitSeconds && remainingSeconds < 60 ? "urgent" : ""}`}><Clock3 /> {formatDuration(remainingSeconds)}</div></header>
    <main className="student-container">
      <section className="quiz-banner"><div><span>{quiz.subject} · {quiz.grade}</span><b>{quiz.questions.length} câu hỏi</b><b>Tối đa {quiz.maxAttempts} lượt</b></div><h1>{quiz.title}</h1><p>Hạn nộp: {formatDeadline(quiz.deadline)} · Thời gian: {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} phút` : "Không giới hạn"}</p><BrainCircuit /></section>

      {!identity && <section className="identity-card"><div className="identity-title"><span><KeyRound /></span><div><h2>Xác minh học sinh</h2><p>Nhập đúng mã lớp và mã học sinh do giáo viên cung cấp.</p></div></div><div className="student-info"><label>Mã lớp <b>*</b><Input value={classCode} onChange={(event) => setClassCode(event.target.value.toUpperCase())} placeholder="Ví dụ: 7A" autoComplete="off" /></label><label>Mã học sinh <b>*</b><Input value={studentCode} onChange={(event) => setStudentCode(event.target.value.toUpperCase())} placeholder="Ví dụ: HS001" autoComplete="off" /></label></div><Button onClick={verifyIdentity} disabled={verifying || expired}><UserCheck /> {expired ? "Bài tập đã quá hạn" : verifying ? "Đang xác minh..." : "Xác minh và bắt đầu làm"}</Button></section>}

      {identity && !result && <section className="verified-student"><UserCheck /><span><small>Học sinh đã xác minh</small><strong>{identity.studentName} · {identity.className}</strong></span><b>Còn {attemptsRemaining}/{quiz.maxAttempts} lượt</b></section>}

      {result && <section className={`result-card ${result.score < 5 ? "needs-work" : "great"}`}><span className="result-label"><Award /> {levelText}</span><p>Học sinh: <strong>{result.studentName} ({result.className})</strong></p><div className="big-score"><strong>{result.score}</strong><span>/ 10 điểm</span></div><div className="result-details"><span>Số câu đúng: <b>{result.correctCount}/{result.totalQuestions}</b></span><span>Thời gian: <b>{formatDuration(result.durationSeconds)}</b></span></div><div className="recorded"><ShieldCheck /> Đã ghi nhận vào bảng điểm · Lần {result.attemptNumber}/{quiz.maxAttempts}</div>{(result.notifications?.email || result.notifications?.zalo) && <p className="notification-note">Kết quả đã gửi qua {result.notifications.email ? "email" : ""}{result.notifications.email && result.notifications.zalo ? " và " : ""}{result.notifications.zalo ? "Zalo" : ""}.</p>}<Button onClick={retry} disabled={attemptsRemaining <= 0 || expired}><RefreshCw /> {attemptsRemaining > 0 ? `Làm lại · còn ${attemptsRemaining} lượt` : "Đã đủ 3 lượt"}</Button></section>}

      {identity && !result && <div className="quiz-progress"><div><span>Tiến độ làm bài</span><strong>{answeredCount}/{quiz.questions.length} câu</strong></div><Progress value={progress} /></div>}

      {identity && <section className="student-questions">{quiz.questions.map((question, index) => {
        const selected = answers[question.id];
        const isCorrect = result && selected === question.correctOptionId;
        return <article key={question.id} className={`student-question ${result ? isCorrect ? "review-correct" : "review-wrong" : ""}`}>
          <div className="student-question-meta"><div><span>Câu {index + 1}</span><small>{question.level}</small></div>{result && (isCorrect ? <b className="correct-label"><CheckCircle2 /> Đúng</b> : <b className="wrong-label"><XCircle /> Chưa đúng</b>)}</div>
          <h2>{question.prompt}</h2>
          <div className="student-options">{question.options.map((option) => {
            const chosen = selected === option.id;
            const correct = result && option.id === question.correctOptionId;
            return <button key={option.id} disabled={!!result} className={`${chosen ? "chosen" : ""} ${correct ? "answer-correct" : ""} ${result && chosen && !correct ? "answer-wrong" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}><b>{option.id}</b><span>{option.text}</span>{correct && <CheckCircle2 />}</button>;
          })}</div>
        </article>;
      })}</section>}
      {identity && !result && <div className="submit-bar"><div><span>Bạn đã trả lời</span><strong>{answeredCount}/{quiz.questions.length} câu</strong></div><Button onClick={() => void submit(false)} disabled={submitting}><Send /> {submitting ? "Đang nộp bài..." : "Nộp bài"}</Button></div>}
    </main><Toaster position="top-right" richColors />
  </div>;
}
