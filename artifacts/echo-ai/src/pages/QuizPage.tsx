import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, MinusCircle, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/context/AppContext";
import MarkdownMessage from "@/components/MarkdownMessage";
import { groqChat, GroqError } from "@/lib/groq";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  selectedIndex?: number;
}

export default function QuizPage() {
  const [, navigate] = useLocation();
  const { settings } = useApp();
  const { toast } = useToast();

  const raw = sessionStorage.getItem("echo_quiz");
  const data = raw ? JSON.parse(raw) : null;

  const [questions, setQuestions] = useState<Question[]>(data?.questions ?? []);
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState((data?.timeLimitMinutes ?? 10) * 60);
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!data) { navigate("/"); return; }
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(timerRef.current); handleSubmit(questions); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const timerDisplay = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const timerColor = secondsLeft < 60 ? "text-destructive" : secondsLeft < 180 ? "text-amber-500" : "text-green-600 dark:text-green-400";

  function selectOption(idx: number) {
    if (submitted) return;
    setQuestions((qs) => qs.map((q, i) => i === current ? { ...q, selectedIndex: idx } : q));
  }

  async function handleSubmit(qs = questions) {
    if (submitted) return;
    clearInterval(timerRef.current);
    setSubmitted(true);
    setGrading(true);
    sessionStorage.removeItem("echo_quiz");

    const score = qs.filter((q) => q.selectedIndex === q.correctIndex).length;
    const pct = Math.round((score / qs.length) * 100);
    const summary = qs.map((q, i) => {
      const userAns = q.selectedIndex !== undefined ? q.options[q.selectedIndex] : "Not answered";
      return `Q${i + 1}: ${q.question}\n  User: ${userAns}\n  Correct: ${q.options[q.correctIndex]}\n  ${q.selectedIndex === q.correctIndex ? "✓" : "✗"}`;
    }).join("\n\n");

    try {
      const res = await groqChat([
        { role: "system", content: "You are a supportive teacher giving quiz feedback." },
        {
          role: "user",
          content: `Student scored ${score}/${qs.length} (${pct}%) on "${data?.subject ?? "General"}". Results:\n\n${summary}\n\nGive a 2-3 sentence assessment, topics to review, and an encouraging message. Respond in ${data?.aiLanguage ?? "English"}.`,
        },
      ], { maxTokens: 400 });
      setFeedback(res);
    } catch {
      setFeedback(`You scored ${score}/${qs.length} (${pct}%). Keep practicing!`);
    } finally {
      setGrading(false);
    }
  }

  if (!data) return null;

  const score = questions.filter((q) => q.selectedIndex === q.correctIndex).length;
  const pct = Math.round((score / questions.length) * 100);

  if (submitted) {
    const color = pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-500" : "text-destructive";
    const label = pct >= 80 ? "Excellent!" : pct >= 60 ? "Good Job!" : "Keep Practicing!";
    return (
      <div className="flex flex-col h-dvh bg-background">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="font-bold">Quiz Results</h1>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {/* Score card */}
          <div className={`rounded-2xl border-2 p-6 text-center ${pct >= 80 ? "border-green-500 bg-green-50 dark:bg-green-950/30" : pct >= 60 ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-destructive bg-red-50 dark:bg-red-950/30"}`}>
            <p className={`text-2xl font-bold mb-1 ${color}`}>{label}</p>
            <p className={`text-5xl font-black my-2 ${color}`}>{score}/{questions.length}</p>
            <p className={`text-lg ${color}`}>{pct}%</p>
            <div className="w-full bg-border rounded-full h-2 mt-4">
              <div className={`h-2 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* AI feedback */}
          {(grading || feedback) && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold text-primary mb-2">✨ AI Feedback</p>
              {grading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" /> Getting feedback…
                </div>
              ) : (
                <MarkdownMessage content={feedback} />
              )}
            </div>
          )}

          {/* Per-question review */}
          <div>
            <p className="font-semibold mb-3">Review Answers</p>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const correct = q.selectedIndex === q.correctIndex;
                const unanswered = q.selectedIndex === undefined;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 ${unanswered ? "border-border" : correct ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-destructive bg-red-50 dark:bg-red-950/20"}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {unanswered ? <MinusCircle size={16} className="text-muted-foreground mt-0.5 shrink-0" /> : correct ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-destructive mt-0.5 shrink-0" />}
                      <p className="text-sm font-medium">{q.question}</p>
                    </div>
                    {!unanswered && !correct && (
                      <p className="text-xs text-destructive ml-6">Your answer: {q.options[q.selectedIndex!]}</p>
                    )}
                    <p className="text-xs text-green-700 dark:text-green-400 ml-6 font-medium">Correct: {q.options[q.correctIndex]}</p>
                    {q.explanation && <p className="text-xs text-muted-foreground ml-6 mt-1">{q.explanation}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border bg-card shrink-0">
          <Button className="w-full" onClick={() => navigate("/")}>Back to Scanner</Button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Quit quiz?")) navigate("/"); }}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <p className="text-sm font-semibold">{data.subject}</p>
          <p className="text-xs text-muted-foreground">Question {current + 1} of {questions.length}</p>
        </div>
        <div className={`flex items-center gap-1 font-mono font-bold text-sm ${timerColor}`}>
          <Timer size={14} /> {timerDisplay}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-muted shrink-0">
        <div className="h-1 bg-primary transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="font-semibold leading-relaxed" style={{ fontSize: settings.fontSize }}>
            {q.question}
          </p>
        </div>
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const isSelected = q.selectedIndex === i;
            return (
              <button
                key={i}
                onClick={() => selectOption(i)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
                }`}
              >
                <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-sm font-bold transition-all ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm leading-snug">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-card shrink-0">
        <Button variant="outline" size="sm" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0} className="gap-1">
          <ArrowLeft size={14} /> Prev
        </Button>
        <div className="flex-1 flex justify-center gap-1">
          {questions.map((q, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-primary w-4" : q.selectedIndex !== undefined ? "bg-primary/40" : "bg-border"}`}
            />
          ))}
        </div>
        {current < questions.length - 1 ? (
          <Button size="sm" onClick={() => setCurrent((c) => c + 1)} className="gap-1">
            Next <ArrowRight size={14} />
          </Button>
        ) : (
          <Button size="sm" onClick={() => handleSubmit()} className="gap-1">
            Submit <CheckCircle2 size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
