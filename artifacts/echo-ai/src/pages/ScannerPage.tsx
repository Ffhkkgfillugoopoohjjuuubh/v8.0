import { useState, useRef, useEffect } from "react";
import {
  ScanLine, ImagePlus, Send, X, Loader2, BookmarkPlus, Copy,
  Volume2, Pause, Play, Square, ChevronDown, ChevronUp, AlertCircle
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

type OcrStatus = "idle" | "running" | "done" | "error";

interface ImageItem {
  id: string;
  file: File;
  url: string;
  ocrStatus: OcrStatus;
  ocrText: string;
  ocrError: string;
}

type DisplayMsg = { id: string; role: "user" | "assistant"; content: string };

export default function ScannerPage() {
  const { settings, updateSettings } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Language & Tone
  const [aiLang, setAiLang] = useState(settings.aiResponseLanguage);
  const [tone, setTone] = useState<Tone>(settings.tone);

  // Images + per-image OCR
  const [images, setImages] = useState<ImageItem[]>([]);
  const [contextOpen, setContextOpen] = useState(false);

  // Chat
  const [history, setHistory] = useState<DisplayMsg[]>([]);
  const apiHistoryRef = useRef<ApiMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  // TTS per-message
  const [ttsActiveMsgId, setTtsActiveMsgId] = useState<string | null>(null);
  const [ttsState, setTtsState] = useState<TtsState>("stopped");

  // Quiz dialog
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizNum, setQuizNum] = useState(5);
  const [quizTime, setQuizTime] = useState(10);
  const [quizSubject, setQuizSubject] = useState("General");

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, aiLoading]);

  // Sync to global settings when local lang/tone changes
  useEffect(() => {
    updateSettings({ aiResponseLanguage: aiLang, tone });
  }, [aiLang, tone]);

  // Combined extracted text from all successfully OCR'd images
  const combinedPageContext = images
    .filter((img) => img.ocrStatus === "done" && img.ocrText.trim())
    .map((img, i) => (images.length > 1 ? `--- Image ${i + 1} ---\n${img.ocrText.trim()}` : img.ocrText.trim()))
    .join("\n\n");

  const anyOcrRunning = images.some((img) => img.ocrStatus === "running");
  const anyOcrDone = images.some((img) => img.ocrStatus === "done");

  // ── Run OCR immediately when an image is added ──────────────────────────
  async function runOcr(item: ImageItem) {
    setImages((prev) =>
      prev.map((img) => img.id === item.id ? { ...img, ocrStatus: "running" } : img)
    );

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js",
      });
      try {
        const { data: { text } } = await worker.recognize(item.file);
        const extracted = text.trim();
        setImages((prev) =>
          prev.map((img) =>
            img.id === item.id
              ? { ...img, ocrStatus: extracted ? "done" : "error", ocrText: extracted, ocrError: extracted ? "" : "No readable text found in this image." }
              : img
          )
        );
      } finally {
        await worker.terminate();
      }
    } catch {
      setImages((prev) =>
        prev.map((img) =>
          img.id === item.id
            ? { ...img, ocrStatus: "error", ocrText: "", ocrError: "Could not read text from this image. Please try a clearer photo." }
            : img
        )
      );
    }
  }

  // ── Handle file selection ────────────────────────────────────────────────
  function handleFileChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    const canAdd = 10 - images.length;
    if (canAdd <= 0) { toast({ title: "Maximum 10 images allowed" }); return; }
    const toAdd = Array.from(files).slice(0, canAdd);

    const newItems: ImageItem[] = toAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      ocrStatus: "idle",
      ocrText: "",
      ocrError: "",
    }));

    setImages((prev) => {
      const updated = [...prev, ...newItems];
      return updated;
    });

    // Start OCR for each new image immediately
    newItems.forEach((item) => {
      setTimeout(() => runOcr(item), 0);
    });
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const found = prev.find((img) => img.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((img) => img.id !== id);
    });
  }

  // ── Send message to Groq ─────────────────────────────────────────────────
  async function sendPrompt() {
    const q = prompt.trim();
    if (!q) return;
    if (anyOcrRunning) { toast({ title: "Please wait for text extraction to finish" }); return; }
    setPrompt("");

    const userMsgId = crypto.randomUUID();
    const newHistory: DisplayMsg[] = [...history, { id: userMsgId, role: "user", content: q }];
    setHistory(newHistory);
    setAiLoading(true);

    // Build user message: combine page context + prompt
    const userContent = combinedPageContext
      ? `Page content: ${combinedPageContext}\n\nUser question: ${q}`
      : q;

    const sysPrompt = buildSystemPrompt(aiLang, tone);
    const userMsg: ApiMessage = { role: "user", content: userContent };
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

  // ── TTS ──────────────────────────────────────────────────────────────────
  function handleReadAloud(msgId: string, content: string) {
    if (ttsActiveMsgId === msgId) {
      if (ttsState === "playing") { pauseSpeech(); setTtsState("paused"); return; }
      if (ttsState === "paused") { resumeSpeech(); setTtsState("playing"); return; }
    }
    setTtsActiveMsgId(msgId);
    const langCode = LANGUAGE_VOICE_MAP[aiLang] ?? "en-US";
    speak(
      content,
      { lang: langCode, volume: settings.volume, pitch: settings.pitch, rate: settings.rate },
      (s) => { setTtsState(s); if (s === "stopped") setTtsActiveMsgId(null); }
    );
  }

  function stopTts() { stopSpeech(); setTtsState("stopped"); setTtsActiveMsgId(null); }

  // ── Quiz ─────────────────────────────────────────────────────────────────
  async function generateQuiz() {
    setQuizOpen(false);
    if (!combinedPageContext) { toast({ title: "Add and scan a page first" }); return; }
    setAiLoading(true);
    try {
      const msgs: ApiMessage[] = [
        { role: "system", content: "You are a quiz generator. Return only valid JSON." },
        {
          role: "user",
          content: `Generate ${quizNum} multiple-choice questions from this content. Subject: ${quizSubject}\n\n${combinedPageContext}\n\nReturn ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]`,
        },
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
  function copyText(text: string) { navigator.clipboard.writeText(text).catch(() => {}); toast({ title: "Copied!" }); }
  function addToNote(content: string) { saveNote({ content, subject: quizSubject || "General" }); toast({ title: "✓ Saved to Notebook" }); }
  function clearAll() {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setHistory([]);
    apiHistoryRef.current = [];
    setPrompt("");
    stopTts();
  }

  const hasImages = images.length > 0;

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── TTS Status Bar ── */}
      {ttsActiveMsgId && ttsState !== "stopped" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
          <Volume2 size={13} className="text-primary shrink-0" />
          <span className="text-xs text-primary flex-1 font-medium">
            {ttsState === "playing" ? "Reading aloud…" : "Paused"}
          </span>
          {ttsState === "playing"
            ? <button onClick={() => { pauseSpeech(); setTtsState("paused"); }} className="flex items-center gap-1 text-xs text-primary hover:underline"><Pause size={11} /> Pause</button>
            : <button onClick={() => { resumeSpeech(); setTtsState("playing"); }} className="flex items-center gap-1 text-xs text-primary hover:underline"><Play size={11} /> Resume</button>}
          <button onClick={stopTts} className="flex items-center gap-1 text-xs text-destructive hover:underline ml-1"><Square size={11} /> Stop</button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card shrink-0">
        <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-xs">E</span>
        </div>

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

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs font-medium ${tone === "casual" ? "text-primary" : "text-muted-foreground"}`}>Casual</span>
          <Switch
            checked={tone === "formal"}
            onCheckedChange={(v) => setTone(v ? "formal" : "casual")}
            className="h-5 w-9"
          />
          <span className={`text-xs font-medium ${tone === "formal" ? "text-primary" : "text-muted-foreground"}`}>Formal</span>
        </div>

        <div className="flex-1" />
        {(hasImages || history.length > 0) && (
          <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={clearAll}><X size={14} /></Button>
        )}
      </header>

      {/* ── Image strip ── */}
      {hasImages && (
        <div className="border-b border-border bg-muted/20 shrink-0">
          {/* Thumbnails row */}
          <div className="flex gap-2 px-3 py-2 overflow-x-auto">
            {images.map((img) => (
              <div key={img.id} className="relative shrink-0">
                <img
                  src={img.url}
                  className="w-16 h-16 object-cover rounded-xl border border-border"
                  alt="uploaded"
                />
                {/* OCR status overlay */}
                {img.ocrStatus === "running" && (
                  <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                    <Loader2 size={16} className="text-white animate-spin" />
                  </div>
                )}
                {img.ocrStatus === "error" && (
                  <div className="absolute inset-0 rounded-xl bg-destructive/50 flex items-center justify-center">
                    <AlertCircle size={16} className="text-white" />
                  </div>
                )}
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-md"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
            {images.length < 10 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0 gap-0.5"
              >
                <ImagePlus size={15} />
                <span className="text-[9px] font-medium">Add</span>
              </button>
            )}
          </div>

          {/* OCR status messages */}
          {images.map((img) => (
            img.ocrStatus === "running" ? (
              <div key={img.id + "_msg"} className="flex items-center gap-2 px-3 pb-2">
                <Loader2 size={11} className="animate-spin text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">Reading text from image…</span>
              </div>
            ) : img.ocrStatus === "error" ? (
              <div key={img.id + "_msg"} className="flex items-center gap-2 px-3 pb-2">
                <AlertCircle size={11} className="text-destructive shrink-0" />
                <span className="text-xs text-destructive">{img.ocrError}</span>
              </div>
            ) : null
          ))}

          {/* Collapsible extracted text */}
          {anyOcrDone && combinedPageContext && (
            <div className="px-3 pb-2">
              <button
                onClick={() => setContextOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline mb-1"
              >
                {contextOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {contextOpen ? "Hide" : "Show"} extracted text
                <span className="text-muted-foreground font-normal">
                  ({combinedPageContext.length.toLocaleString()} chars)
                </span>
              </button>
              {contextOpen && (
                <textarea
                  readOnly
                  value={combinedPageContext}
                  rows={5}
                  className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2 resize-none text-foreground focus:outline-none"
                />
              )}
              {anyOcrDone && (
                <button
                  onClick={() => setQuizOpen(true)}
                  className="mt-1 text-xs text-primary hover:underline"
                >
                  Generate Quiz from this page →
                </button>
              )}
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
                Echo AI reads it instantly and explains in your language.
              </p>
            </div>
            <Button onClick={() => fileRef.current?.click()} className="gap-2 px-6">
              <ImagePlus size={16} /> Add Images
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
          /* Images added, waiting for question */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {anyOcrRunning
                ? <Loader2 size={32} className="text-primary animate-spin" />
                : <ScanLine size={32} className="text-primary" />}
            </div>
            <div>
              <p className="font-semibold">
                {anyOcrRunning ? "Reading your image…" : "Ready! Ask anything."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {anyOcrRunning
                  ? "Tesseract.js is extracting the text. Please wait."
                  : "Type your question below and tap Send."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {history.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 max-w-[82%] text-sm leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[95%] space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-xs">E</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">Echo AI</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{aiLang} · {tone}</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 min-w-0 shadow-sm">
                      <MarkdownMessage content={msg.content} />
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-wrap pl-1">
                      <button
                        onClick={() => handleReadAloud(msg.id, msg.content)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                          ttsActiveMsgId === msg.id && ttsState !== "stopped"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-primary hover:border-primary"
                        }`}
                      >
                        {ttsActiveMsgId === msg.id && ttsState === "playing"
                          ? <><Pause size={11} /> Pause</>
                          : ttsActiveMsgId === msg.id && ttsState === "paused"
                          ? <><Play size={11} /> Resume</>
                          : <><Volume2 size={11} /> Read Aloud</>}
                      </button>
                      {ttsActiveMsgId === msg.id && ttsState !== "stopped" && (
                        <button onClick={stopTts}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-destructive hover:border-destructive">
                          <Square size={11} /> Stop
                        </button>
                      )}
                      <button onClick={() => copyText(msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                        <Copy size={11} /> Copy
                      </button>
                      <button onClick={() => addToNote(msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                        <BookmarkPlus size={11} /> Save to Notebook
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {aiLoading && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">E</span>
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
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
          <Button size="icon" variant="outline" className="shrink-0 h-10 w-10"
            onClick={() => fileRef.current?.click()} title="Add images">
            <ImagePlus size={17} />
          </Button>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              anyOcrRunning ? "Extracting text, please wait…"
              : anyOcrDone ? "Ask anything about this page…"
              : hasImages ? "Type your question…"
              : "Add a photo and ask a question…"
            }
            className="resize-none min-h-[40px] max-h-32 py-2.5"
            style={{ fontSize: Math.max(settings.fontSize, 16) }}
            rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }}
          />
          <Button size="icon" className="shrink-0 h-10 w-10"
            onClick={sendPrompt}
            disabled={aiLoading || !prompt.trim() || anyOcrRunning}>
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { handleFileChange(e.target.files); e.target.value = ""; }} />

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
