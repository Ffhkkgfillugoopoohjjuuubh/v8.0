import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanLine, ImagePlus, Send, X, Loader2, BookmarkPlus, Copy, Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import MarkdownMessage from "@/components/MarkdownMessage";
import { groqChat, buildSystemPrompt, detectsMath, GroqError, AI_RESPONSE_LANGUAGES } from "@/lib/groq";
import { saveNote } from "@/lib/notes";

type Msg = { role: "user" | "assistant"; content: string };

const SESSION_KEY = "echo_scanner_session";

function loadSession(): { context: string; history: Msg[]; lang: string } {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "{}");
    return { context: s.context ?? "", history: s.history ?? [], lang: s.lang ?? "English" };
  } catch {
    return { context: "", history: [], lang: "English" };
  }
}

function persistSession(context: string, history: Msg[], lang: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ context, history: history.slice(-30), lang }));
}

export default function ScannerPage() {
  const { settings, speakText } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const session = loadSession();
  const [images, setImages] = useState<string[]>([]);
  const [pageContext, setPageContext] = useState(session.context);
  const [history, setHistory] = useState<Msg[]>(session.history);
  const [aiLang, setAiLang] = useState(session.lang ?? settings.aiResponseLanguage ?? "English");
  const [prompt, setPrompt] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizNum, setQuizNum] = useState(5);
  const [quizTime, setQuizTime] = useState(10);
  const [quizSubject, setQuizSubject] = useState("General");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, aiLoading]);

  useEffect(() => {
    persistSession(pageContext, history, aiLang);
  }, [pageContext, history, aiLang]);

  const runOcr = useCallback(async (allUrls: string[], newFiles: File[]) => {
    setOcrLoading(true);
    try {
      const Tesseract = await import("tesseract.js");
      let combined = pageContext;
      for (let i = 0; i < newFiles.length; i++) {
        const result = await Tesseract.recognize(newFiles[i], "eng");
        const text = result.data.text.trim();
        if (text) {
          combined += (combined ? `\n\n--- Image ${allUrls.length - newFiles.length + i + 1} ---\n\n` : "") + text;
        }
      }
      setPageContext(combined);
    } catch {
      toast({ title: "OCR failed", description: "Could not extract text from image", variant: "destructive" });
    } finally {
      setOcrLoading(false);
    }
  }, [pageContext, toast]);

  const addImages = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const canAdd = 10 - images.length;
    if (canAdd <= 0) { toast({ title: "Max 10 images allowed" }); return; }
    const toAdd = Array.from(files).slice(0, canAdd);
    const urls = toAdd.map((f) => URL.createObjectURL(f));
    const newImages = [...images, ...urls];
    setImages(newImages);
    await runOcr(newImages, toAdd);
  }, [images, runOcr, toast]);

  function removeImage(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    if (next.length === 0) setPageContext("");
  }

  async function sendPrompt() {
    const q = prompt.trim();
    if (!q) return;
    if (!pageContext && history.length === 0) {
      toast({ title: "Add images first", description: "Scan a page to give the AI something to work with" });
      return;
    }
    setPrompt("");
    const newHistory: Msg[] = [...history, { role: "user", content: q }];
    setHistory(newHistory);
    setAiLoading(true);

    try {
      const hasMath = detectsMath(pageContext + q);
      const systemPrompt = buildSystemPrompt(aiLang, hasMath);
      const messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...(pageContext
          ? [
              { role: "user", content: `Scanned page content:\n\n${pageContext}` },
              { role: "assistant", content: "I have read the page content. Ready to help!" },
            ]
          : []),
        ...newHistory,
      ];
      const reply = await groqChat(messages);
      setHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg =
        e instanceof GroqError
          ? e.isAuthError
            ? "⚠️ **API Key Error**: " + e.message
            : "⚠️ **Connection Error**: " + e.message
          : "⚠️ Something went wrong.";
      setHistory([...newHistory, { role: "assistant", content: msg }]);
    } finally {
      setAiLoading(false);
    }
  }

  async function generateQuiz() {
    setQuizOpen(false);
    if (!pageContext) { toast({ title: "Scan a page first" }); return; }
    setAiLoading(true);
    try {
      const quizPrompt = `Generate a multiple-choice quiz with exactly ${quizNum} questions from this content.
Subject: ${quizSubject}

Content:
${pageContext}

Return ONLY a JSON array:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]`;
      const res = await groqChat(
        [
          { role: "system", content: "You are a quiz generator. Return only valid JSON." },
          { role: "user", content: quizPrompt },
        ],
        { temperature: 0.4, maxTokens: 4096 }
      );
      const match = res.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON found");
      const questions = JSON.parse(match[0]);
      sessionStorage.setItem(
        "echo_quiz",
        JSON.stringify({ questions, timeLimitMinutes: quizTime, subject: quizSubject, aiLanguage: aiLang })
      );
      navigate("/quiz");
    } catch {
      toast({ title: "Quiz generation failed", description: "Please try again", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function addToNote(content: string) {
    saveNote({ content, subject: quizSubject || "General" });
    toast({ title: "✓ Saved to Notebook!" });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  }

  const isEmpty = history.length === 0 && !pageContext;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">E</span>
          </div>
          <span className="font-bold text-base truncate">Echo AI</span>
        </div>
        <Select value={aiLang} onValueChange={setAiLang}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {AI_RESPONSE_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(history.length > 0 || pageContext) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => {
              setImages([]);
              setPageContext("");
              setHistory([]);
              sessionStorage.removeItem(SESSION_KEY);
            }}
          >
            <X size={15} />
          </Button>
        )}
      </header>

      {/* Image strip */}
      {images.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-b border-border overflow-x-auto bg-muted/30 shrink-0">
          {images.map((url, i) => (
            <div key={i} className="relative shrink-0">
              <img src={url} className="w-16 h-16 object-cover rounded-lg border border-border" alt={`Page ${i + 1}`} />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {images.length < 10 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
            >
              <ImagePlus size={20} />
            </button>
          )}
        </div>
      )}

      {/* OCR progress */}
      {ocrLoading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border text-xs text-primary shrink-0">
          <Loader2 size={13} className="animate-spin" />
          Extracting text from image…
        </div>
      )}

      {/* Context bar */}
      {pageContext && !ocrLoading && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800 shrink-0">
          <span className="text-xs text-green-700 dark:text-green-400 flex-1">
            ✓ {pageContext.length.toLocaleString()} characters extracted
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-primary"
            onClick={() => setQuizOpen(true)}
            disabled={aiLoading}
          >
            Generate Quiz
          </Button>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
              <ScanLine size={48} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Scan to Learn</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Photograph any textbook page or document,
                <br />
                then ask Echo AI anything about it.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => fileRef.current?.click()} className="gap-2">
                <ImagePlus size={16} /> Add Images
              </Button>
            </div>
            <div className="bg-muted/60 rounded-xl p-4 text-left w-full max-w-sm space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Try asking:</p>
              {[
                '"Explain this in simple Hindi"',
                '"Solve all math problems step by step"',
                '"Generate a quiz from this chapter"',
                '"Summarize the key points"',
              ].map((s) => (
                <p key={s} className="text-xs text-muted-foreground">
                  → {s}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <>
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">E</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">Echo AI</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                      <MarkdownMessage content={msg.content} />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { icon: Volume2, label: "Read", action: () => speakText(msg.content) },
                        { icon: BookmarkPlus, label: "Save", action: () => addToNote(msg.content) },
                        { icon: Copy, label: "Copy", action: () => copyText(msg.content) },
                      ].map(({ icon: Icon, label, action }) => (
                        <button
                          key={label}
                          onClick={action}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                        >
                          <Icon size={11} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">E</span>
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          {images.length === 0 && (
            <Button
              size="icon"
              variant="outline"
              className="shrink-0 h-10 w-10"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={18} />
            </Button>
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={pageContext ? "Ask about this page…" : "Add images then ask a question…"}
            className="resize-none min-h-[40px] max-h-32 py-2.5"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendPrompt();
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0 h-10 w-10"
            onClick={sendPrompt}
            disabled={aiLoading || !prompt.trim()}
          >
            {aiLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addImages(e.target.files)}
      />

      {/* Quiz dialog */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Number of Questions: {quizNum}</Label>
              <Slider
                min={1}
                max={15}
                step={1}
                value={[quizNum]}
                onValueChange={([v]) => setQuizNum(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Time Limit: {quizTime} minutes</Label>
              <Slider
                min={5}
                max={60}
                step={5}
                value={[quizTime]}
                onValueChange={([v]) => setQuizTime(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject / Topic</Label>
              <Input
                value={quizSubject}
                onChange={(e) => setQuizSubject(e.target.value)}
                placeholder="e.g. Physics, Mathematics…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuizOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateQuiz} disabled={aiLoading}>
              {aiLoading && <Loader2 size={14} className="animate-spin mr-1" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
