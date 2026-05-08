import { useState, useRef, useEffect } from "react";
import {
  ScanLine, ImagePlus, Send, X, Loader2, BookmarkPlus, Copy,
  Volume2, Pause, Play, Square, FileText, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import MarkdownMessage from "@/components/MarkdownMessage";
import {
  groqChat, buildSystemPrompt, GroqError,
  AI_RESPONSE_LANGUAGES, LANGUAGE_VOICE_MAP, ApiMessage, Tone,
} from "@/lib/groq";
import { speak, pauseSpeech, resumeSpeech, stopSpeech, cleanForSpeech, TtsState } from "@/lib/tts";
import { saveNote } from "@/lib/notes";

type DisplayMsg = { id: string; role: "user" | "assistant"; content: string };

export default function ScannerPage() {
  const { settings, updateSettings } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // ── Language & Tone ────────────────────────────────────────────────────
  const [aiLang, setAiLang] = useState(settings.aiResponseLanguage);
  const [tone, setTone] = useState<Tone>(settings.tone);

  // ── Images ──────────────────────────────────────────────────────────────
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // ── OCR ─────────────────────────────────────────────────────────────────
  const [pageContext, setPageContext] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // ── Chat ────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<DisplayMsg[]>([]);
  const apiHistoryRef = useRef<ApiMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  // ── Per-message TTS ──────────────────────────────────────────────────────
  const [ttsActiveMsgId, setTtsActiveMsgId] = useState<string | null>(null);
  const [ttsState, setTtsState] = useState<TtsState>("stopped");

  // ── Quiz ────────────────────────────────────────────────────────────────
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizNum, setQuizNum] = useState(5);
  const [quizTime, setQuizTime] = useState(10);
  const [quizSubject, setQuizSubject] = useState("General");

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, aiLoading]);

  // Sync lang/tone changes to global settings
  useEffect(() => {
    updateSettings({ aiResponseLanguage: aiLang, tone });
  }, [aiLang, tone]);

  // ── Upload ──────────────────────────────────────────────────────────────
  function handleFileChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    const canAdd = 10 - imageFiles.length;
    if (canAdd <= 0) { toast({ title: "Max 10 images allowed" }); return; }
    const toAdd = Array.from(files).slice(0, canAdd);
    const newUrls = toAdd.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...toAdd]);
    setImageUrls((prev) => [...prev, ...newUrls]);
    // Reset OCR state when new images added
    setOcrDone(false);
    setOcrError(null);
    setPageContext("");
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(imageUrls[idx]);
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
    setOcrDone(false);
    setOcrError(null);
    setPageContext("");
  }

  // ── OCR ─────────────────────────────────────────────────────────────────
  async function extractText() {
    if (imageFiles.length === 0) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrDone(false);
    setPageContext("");

    try {
      const { createWorker } = await import("tesseract.js");
      let combined = "";
      for (let i = 0; i < imageFiles.length; i++) {
        const worker = await createWorker("eng", 1, {
          workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js",
          langPath: "https://tessdata.projectnaptha.com/4.0.0",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js",
        });
        try {
          const { data: { text } } = await worker.recognize(imageFiles[i]);
          if (text.trim()) {
            combined += (combined ? `\n\n--- Image ${i + 1} ---\n\n` : "") + text.trim();
          }
        } finally {
          await worker.terminate();
        }
      }
      if (combined) {
        setPageContext(combined);
        setOcrDone(true);
      } else {
        setOcrError("Could not read text from this image. The image may be too blurry or contain no readable text.");
      }
    } catch {
      setOcrError("Could not read text from this image. Please try a clearer photo.");
    } finally {
      setOcrLoading(false);
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  async function sendPrompt() {
    const q = prompt.trim();
    if (!q) return;
    setPrompt("");

    const userMsgId = crypto.randomUUID();
    const newHistory: DisplayMsg[] = [...history, { id: userMsgId, role: "user", content: q }];
    setHistory(newHistory);
    setAiLoading(true);

    const userMsg: ApiMessage = { role: "user", content: q };
    const sysPrompt = buildSystemPrompt(aiLang, tone, pageContext || undefined);
    const msgs: ApiMessage[] = [
      { role: "system", content: sysPrompt },
      ...apiHistoryRef.current,
      userMsg,
    ];
    apiHistoryRef.current = [...apiHistoryRef.current, userMsg];

    try {
      const reply = await groqChat(msgs);
      const replyId = crypto.randomUUID();
      setHistory([...newHistory, { id: replyId, role: "assistant", content: reply }]);
      apiHistoryRef.current.push({ role: "assistant", content: reply });
    } catch (e) {
      const text =
        e instanceof GroqError
          ? e.isAuthError
            ? "⚠️ **API Key Error**: " + e.message
            : "⚠️ **Error**: " + e.message
          : "⚠️ Something went wrong. Please try again.";
      const replyId = crypto.randomUUID();
      setHistory([...newHistory, { id: replyId, role: "assistant", content: text }]);
      apiHistoryRef.current.push({ role: "assistant", content: text });
    } finally {
      setAiLoading(false);
    }
  }

  // ── TTS (per-message) ─────────────────────────────────────────────────────
  function handleReadAloud(msgId: string, content: string) {
    if (ttsActiveMsgId === msgId && ttsState === "playing") {
      pauseSpeech();
      setTtsState("paused");
      return;
    }
    if (ttsActiveMsgId === msgId && ttsState === "paused") {
      resumeSpeech();
      setTtsState("playing");
      return;
    }
    // New message
    setTtsActiveMsgId(msgId);
    const voiceLang = LANGUAGE_VOICE_MAP[aiLang] ?? "en-US";
    speak(
      content,
      { lang: voiceLang, volume: settings.volume, pitch: settings.pitch, rate: settings.rate },
      (s) => {
        setTtsState(s);
        if (s === "stopped") setTtsActiveMsgId(null);
      }
    );
  }

  function stopActiveTts() {
    stopSpeech();
    setTtsState("stopped");
    setTtsActiveMsgId(null);
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────
  async function generateQuiz() {
    setQuizOpen(false);
    if (!pageContext) { toast({ title: "Extract text from a page first" }); return; }
    setAiLoading(true);
    try {
      const quizPrompt = `Generate a multiple-choice quiz with exactly ${quizNum} questions from this content.
Subject: ${quizSubject}
Content:
${pageContext}
Return ONLY a valid JSON array:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]`;
      const msgs: ApiMessage[] = [
        { role: "system", content: "You are a quiz generator. Return only valid JSON." },
        { role: "user", content: quizPrompt },
      ];
      const res = await groqChat(msgs);
      const match = res.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON");
      const questions = JSON.parse(match[0]);
      sessionStorage.setItem("echo_quiz", JSON.stringify({ questions, timeLimitMinutes: quizTime, subject: quizSubject, aiLanguage: aiLang }));
      navigate("/quiz");
    } catch {
      toast({ title: "Quiz generation failed", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "Copied!" });
  }

  function addToNote(content: string) {
    saveNote({ content, subject: quizSubject || "General" });
    toast({ title: "✓ Saved to Notebook" });
  }

  function clearSession() {
    imageUrls.forEach(URL.revokeObjectURL);
    setImageFiles([]);
    setImageUrls([]);
    setPageContext("");
    setOcrDone(false);
    setOcrError(null);
    setHistory([]);
    apiHistoryRef.current = [];
    setPrompt("");
    stopActiveTts();
  }

  const hasImages = imageFiles.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Global TTS Status Bar ── */}
      {ttsActiveMsgId && (ttsState === "playing" || ttsState === "paused") && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
          <Volume2 size={14} className="text-primary shrink-0" />
          <span className="text-xs text-primary flex-1 font-medium">
            {ttsState === "playing" ? "Reading aloud…" : "Paused"}
          </span>
          {ttsState === "playing" ? (
            <button onClick={() => { pauseSpeech(); setTtsState("paused"); }}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Pause size={12} /> Pause
            </button>
          ) : (
            <button onClick={() => { resumeSpeech(); setTtsState("playing"); }}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Play size={12} /> Resume
            </button>
          )}
          <button onClick={stopActiveTts}
            className="flex items-center gap-1 text-xs text-destructive hover:underline ml-1">
            <Square size={12} /> Stop
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card shrink-0">
        <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-xs">E</span>
        </div>

        {/* Language dropdown */}
        <Select value={aiLang} onValueChange={setAiLang}>
          <SelectTrigger className="h-8 text-xs w-[118px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {AI_RESPONSE_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Casual / Formal toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs font-medium ${tone === "casual" ? "text-primary" : "text-muted-foreground"}`}>
            Casual
          </span>
          <Switch
            checked={tone === "formal"}
            onCheckedChange={(v) => setTone(v ? "formal" : "casual")}
            className="h-5 w-9"
          />
          <span className={`text-xs font-medium ${tone === "formal" ? "text-primary" : "text-muted-foreground"}`}>
            Formal
          </span>
        </div>

        <div className="flex-1" />
        {(hasImages || history.length > 0) && (
          <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={clearSession}>
            <X size={14} />
          </Button>
        )}
      </header>

      {/* ── Image strip ── */}
      {hasImages && (
        <div className="flex gap-2 px-3 py-2 border-b border-border bg-muted/30 overflow-x-auto shrink-0">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative shrink-0">
              <img src={url} className="w-16 h-16 object-cover rounded-lg border border-border" alt={`Image ${i + 1}`} />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
              >
                <X size={9} />
              </button>
            </div>
          ))}
          {imageUrls.length < 10 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
            >
              <ImagePlus size={17} />
            </button>
          )}
        </div>
      )}

      {/* ── OCR Panel ── */}
      {hasImages && (
        <div className="border-b border-border bg-card shrink-0 px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={ocrDone ? "outline" : "default"}
              className="gap-1.5 h-8"
              onClick={extractText}
              disabled={ocrLoading}
            >
              {ocrLoading ? (
                <><Loader2 size={13} className="animate-spin" /> Extracting text… please wait</>
              ) : ocrDone ? (
                <><CheckCircle2 size={13} className="text-green-600" /> Re-extract Text</>
              ) : (
                <><FileText size={13} /> Extract Text</>
              )}
            </Button>
            {ocrDone && pageContext && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-primary" onClick={() => setQuizOpen(true)}>
                Generate Quiz
              </Button>
            )}
          </div>

          {/* OCR error */}
          {ocrError && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{ocrError}</p>
          )}

          {/* Extracted text preview */}
          {ocrDone && pageContext && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Extracted Text — {pageContext.length.toLocaleString()} characters
              </p>
              <textarea
                readOnly
                value={pageContext}
                className="w-full text-xs rounded-lg border border-border bg-muted/40 px-3 py-2 resize-none text-foreground focus:outline-none"
                rows={4}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {history.length === 0 && !hasImages ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
              <ScanLine size={46} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Scan Any Page</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upload a photo of any textbook, notes, or question.<br />
                Echo AI will explain it in your own language.
              </p>
            </div>
            <Button onClick={() => fileRef.current?.click()} className="gap-2 px-6">
              <ImagePlus size={16} /> Add Photo
            </Button>
            <div className="bg-muted/60 rounded-xl p-4 text-left w-full max-w-sm space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Try asking:</p>
              {[
                '"Explain this in simple terms"',
                '"Solve all problems step by step"',
                '"What are the key points here?"',
                '"Generate a quiz from this"',
              ].map((s) => (
                <p key={s} className="text-xs text-muted-foreground">→ {s}</p>
              ))}
            </div>
          </div>
        ) : history.length === 0 && hasImages ? (
          /* Images added, no chat yet */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText size={32} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">Image added!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click <strong>Extract Text</strong> to scan it, then ask any question below.
              </p>
            </div>
          </div>
        ) : (
          <>
            {history.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 max-w-[80%] text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[94%] space-y-2 min-w-0">
                    {/* AI label */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-xs">E</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">Echo AI</span>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {aiLang} · {tone}
                      </span>
                    </div>

                    {/* Message bubble */}
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 min-w-0">
                      <MarkdownMessage content={msg.content} />
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* Read Aloud button */}
                      <button
                        onClick={() => handleReadAloud(msg.id, msg.content)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                          ttsActiveMsgId === msg.id && ttsState !== "stopped"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-primary hover:border-primary"
                        }`}
                      >
                        {ttsActiveMsgId === msg.id && ttsState === "playing" ? (
                          <><Pause size={11} /> Pause</>
                        ) : ttsActiveMsgId === msg.id && ttsState === "paused" ? (
                          <><Play size={11} /> Resume</>
                        ) : (
                          <><Volume2 size={11} /> Read Aloud</>
                        )}
                      </button>
                      {ttsActiveMsgId === msg.id && ttsState !== "stopped" && (
                        <button
                          onClick={stopActiveTts}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-destructive hover:border-destructive transition-colors"
                        >
                          <Square size={11} /> Stop
                        </button>
                      )}
                      <button
                        onClick={() => addToNote(msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                      >
                        <BookmarkPlus size={11} /> Save
                      </button>
                      <button
                        onClick={() => copyText(msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                      >
                        <Copy size={11} /> Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Thinking dots */}
            {aiLoading && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">E</span>
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-border bg-card px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <Button
            size="icon" variant="outline" className="shrink-0 h-10 w-10"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={17} />
          </Button>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              ocrDone
                ? "Ask anything about this page…"
                : hasImages
                  ? "Extract text first, then ask a question…"
                  : "Upload a photo and ask a question…"
            }
            className="resize-none min-h-[40px] max-h-32 py-2.5 text-base"
            rows={1}
            style={{ fontSize: settings.fontSize < 16 ? 16 : settings.fontSize }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
            }}
          />
          <Button
            size="icon" className="shrink-0 h-10 w-10"
            onClick={sendPrompt}
            disabled={aiLoading || !prompt.trim()}
          >
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handleFileChange(e.target.files)}
      />

      {/* Quiz dialog */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Quiz</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Number of Questions: {quizNum}</Label>
              <Slider min={1} max={15} step={1} value={[quizNum]} onValueChange={([v]) => setQuizNum(v)} />
            </div>
            <div className="space-y-2">
              <Label>Time Limit: {quizTime} minutes</Label>
              <Slider min={5} max={60} step={5} value={[quizTime]} onValueChange={([v]) => setQuizTime(v)} />
            </div>
            <div className="space-y-2">
              <Label>Subject / Topic</Label>
              <Input value={quizSubject} onChange={(e) => setQuizSubject(e.target.value)} placeholder="e.g. Physics, Maths…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuizOpen(false)}>Cancel</Button>
            <Button onClick={generateQuiz} disabled={aiLoading}>
              {aiLoading && <Loader2 size={14} className="animate-spin mr-1" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
