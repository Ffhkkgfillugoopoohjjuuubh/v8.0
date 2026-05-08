import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanLine, ImagePlus, Send, X, Loader2, BookmarkPlus, Copy, Volume2,
  MessageSquarePlus, ChevronDown
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
import {
  groqChat, buildSystemPrompt, autoExplainPrompt, GroqError,
  AI_RESPONSE_LANGUAGES, fileToBase64, ApiMessage, Tone,
} from "@/lib/groq";
import { saveNote } from "@/lib/notes";

type DisplayMsg = { id: string; role: "user" | "assistant"; content: string };

export default function ScannerPage() {
  const { settings, updateSettings, speakText } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Language & tone — start from settings but can be changed per-session
  const [aiLang, setAiLang] = useState(settings.aiResponseLanguage);
  const [tone, setTone] = useState<Tone>(settings.tone);

  // Images
  const [imageUrls, setImageUrls] = useState<string[]>([]);    // for display
  const imageBase64Ref = useRef<string[]>([]);                   // for API

  // Chat
  const [displayHistory, setDisplayHistory] = useState<DisplayMsg[]>([]);
  const apiMessagesRef = useRef<ApiMessage[]>([]);               // full API message log

  // State flags
  const [analyzing, setAnalyzing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Quiz dialog
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizNum, setQuizNum] = useState(5);
  const [quizTime, setQuizTime] = useState(10);
  const [quizSubject, setQuizSubject] = useState("General");

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayHistory, aiLoading, analyzing]);

  // Sync language changes to global settings
  useEffect(() => {
    updateSettings({ aiResponseLanguage: aiLang, tone });
  }, [aiLang, tone]);

  // ─── Upload & auto-explain ───────────────────────────────────────────────

  const addImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const canAdd = 10 - imageUrls.length;
    if (canAdd <= 0) { toast({ title: "Max 10 images allowed" }); return; }
    const toAdd = Array.from(files).slice(0, canAdd);

    const urls = toAdd.map((f) => URL.createObjectURL(f));
    setImageUrls((prev) => [...prev, ...urls]);

    setAnalyzing(true);
    try {
      const newB64 = await Promise.all(toAdd.map(fileToBase64));
      imageBase64Ref.current = [...imageBase64Ref.current, ...newB64];

      // Auto-explain if this is the first batch of images
      if (displayHistory.length === 0) {
        await explainImages(imageBase64Ref.current, newB64.length > 1 ? aiLang : aiLang);
      }
    } catch {
      toast({ title: "Failed to load image", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [imageUrls, displayHistory, aiLang, tone]);

  async function explainImages(allB64: string[], _lang: string) {
    const sysPrompt = buildSystemPrompt(aiLang, tone);
    const userText = autoExplainPrompt(aiLang, tone);

    // Build first user message with all images + explain prompt
    const firstUserMsg: ApiMessage = {
      role: "user",
      content: [
        ...allB64.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        { type: "text" as const, text: userText },
      ],
    };

    apiMessagesRef.current = [firstUserMsg];

    setDisplayHistory([{ id: "u0", role: "user", content: "📷 Explain this image" }]);

    await runAi([{ role: "system", content: sysPrompt }, firstUserMsg], "u0-reply");
  }

  function removeImage(idx: number) {
    const next = imageUrls.filter((_, i) => i !== idx);
    setImageUrls(next);
    imageBase64Ref.current = imageBase64Ref.current.filter((_, i) => i !== idx);
    if (next.length === 0) {
      setDisplayHistory([]);
      apiMessagesRef.current = [];
    }
  }

  // ─── Send follow-up ──────────────────────────────────────────────────────

  async function sendPrompt() {
    const q = prompt.trim();
    if (!q) return;
    if (imageUrls.length === 0 && displayHistory.length === 0) {
      toast({ title: "Add images first", description: "Upload a photo so Echo AI can help you." });
      return;
    }
    setPrompt("");

    const userMsgId = crypto.randomUUID();
    setDisplayHistory((prev) => [...prev, { id: userMsgId, role: "user", content: q }]);

    const followUp: ApiMessage = { role: "user", content: q };
    const sysPrompt = buildSystemPrompt(aiLang, tone);

    // Reconstruct messages: system + all previous + new user msg
    const msgs: ApiMessage[] = [
      { role: "system", content: sysPrompt },
      ...apiMessagesRef.current,
      followUp,
    ];

    apiMessagesRef.current.push(followUp);
    await runAi(msgs, userMsgId + "-reply");
  }

  async function runAi(msgs: ApiMessage[], replyId: string) {
    setAiLoading(true);
    try {
      const reply = await groqChat(msgs);
      const assistantMsg: ApiMessage = { role: "assistant", content: reply };
      apiMessagesRef.current.push(assistantMsg);
      setDisplayHistory((prev) => [...prev, { id: replyId, role: "assistant", content: reply }]);
    } catch (e) {
      const text =
        e instanceof GroqError
          ? e.isAuthError
            ? "⚠️ **API Key Error**: " + e.message
            : "⚠️ **Error**: " + e.message
          : "⚠️ Something went wrong. Please try again.";
      const assistantMsg: ApiMessage = { role: "assistant", content: text };
      apiMessagesRef.current.push(assistantMsg);
      setDisplayHistory((prev) => [...prev, { id: replyId, role: "assistant", content: text }]);
    } finally {
      setAiLoading(false);
    }
  }

  // ─── Quiz generation ─────────────────────────────────────────────────────

  async function generateQuiz() {
    setQuizOpen(false);
    if (imageBase64Ref.current.length === 0) { toast({ title: "Add images first" }); return; }
    setAiLoading(true);
    try {
      const quizPrompt = `Generate a multiple-choice quiz with exactly ${quizNum} questions about the content in these images.
Subject: ${quizSubject}
Return ONLY a valid JSON array, no other text:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]`;

      const msgs: ApiMessage[] = [
        { role: "system", content: "You are a quiz generator. Return only valid JSON array." },
        {
          role: "user",
          content: [
            ...imageBase64Ref.current.map((url) => ({ type: "image_url" as const, image_url: { url } })),
            { type: "text" as const, text: quizPrompt },
          ],
        },
      ];

      const res = await groqChat(msgs);
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function addToNote(content: string) {
    saveNote({ content, subject: quizSubject || "General" });
    toast({ title: "✓ Saved to Notebook!" });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "Copied to clipboard" });
  }

  function clearSession() {
    imageUrls.forEach((u) => URL.revokeObjectURL(u));
    setImageUrls([]);
    imageBase64Ref.current = [];
    setDisplayHistory([]);
    apiMessagesRef.current = [];
    setPrompt("");
  }

  const isEmpty = imageUrls.length === 0 && displayHistory.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">E</span>
          </div>
          <span className="font-bold text-sm hidden sm:block">Echo AI</span>
        </div>

        {/* Language */}
        <Select value={aiLang} onValueChange={setAiLang}>
          <SelectTrigger className="h-8 text-xs w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {AI_RESPONSE_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Casual / Formal toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button
            onClick={() => setTone("casual")}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tone === "casual"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Casual
          </button>
          <button
            onClick={() => setTone("formal")}
            className={`px-2.5 py-1.5 text-xs font-medium border-l border-border transition-colors ${
              tone === "formal"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Formal
          </button>
        </div>

        <div className="flex-1" />

        {(!isEmpty) && (
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={clearSession}>
            <X size={14} />
          </Button>
        )}
      </header>

      {/* ── Image Strip ── */}
      {imageUrls.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-b border-border overflow-x-auto bg-muted/30 shrink-0">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={url}
                className="w-16 h-16 object-cover rounded-lg border border-border"
                alt={`Image ${i + 1}`}
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {imageUrls.length < 10 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
            >
              <ImagePlus size={18} />
            </button>
          )}
        </div>
      )}

      {/* ── Analyzing bar ── */}
      {analyzing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border text-xs text-primary shrink-0">
          <Loader2 size={13} className="animate-spin" />
          Analyzing image with AI…
        </div>
      )}

      {/* ── Quiz bar ── */}
      {imageUrls.length > 0 && !analyzing && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-border shrink-0">
          <span className="text-xs text-primary flex-1">✓ {imageUrls.length} image{imageUrls.length > 1 ? "s" : ""} loaded</span>
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

      {/* ── Chat ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
              <ScanLine size={46} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Photo → Explanation</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upload any textbook page, diagram, or question.<br />
                Echo AI will explain it in your own language instantly.
              </p>
            </div>
            <Button onClick={() => fileRef.current?.click()} className="gap-2 px-6">
              <ImagePlus size={16} /> Add Photo
            </Button>
            <div className="bg-muted/60 rounded-xl p-4 text-left w-full max-w-sm space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground mb-2">After uploading, try:</p>
              {[
                '"Solve this step by step"',
                '"Explain in simple terms"',
                '"What are the key points?"',
                '"Generate a quiz from this"',
              ].map((s) => (
                <p key={s} className="text-xs text-muted-foreground">→ {s}</p>
              ))}
            </div>
          </div>
        ) : (
          <>
            {displayHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[82%] text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[94%] space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-xs">E</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">Echo AI</span>
                      <span className="text-[10px] text-muted-foreground ml-1 capitalize">
                        {aiLang} · {tone}
                      </span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 min-w-0">
                      <MarkdownMessage content={msg.content} />
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1 flex-wrap">
                      {[
                        {
                          icon: Volume2, label: "Read",
                          action: () => speakText(msg.content),
                        },
                        {
                          icon: BookmarkPlus, label: "Save",
                          action: () => addToNote(msg.content),
                        },
                        {
                          icon: Copy, label: "Copy",
                          action: () => copyText(msg.content),
                        },
                        {
                          icon: MessageSquarePlus, label: "Ask more",
                          action: () => setPrompt("Tell me more about "),
                        },
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

            {/* Thinking indicator */}
            {(aiLoading || analyzing) && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">E</span>
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.18}s` }}
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

      {/* ── Input bar ── */}
      <div className="border-t border-border bg-card px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            variant="outline"
            className="shrink-0 h-10 w-10"
            onClick={() => fileRef.current?.click()}
            disabled={analyzing}
          >
            <ImagePlus size={17} />
          </Button>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              imageUrls.length > 0
                ? "Ask a follow-up question…"
                : "Upload a photo first…"
            }
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
            disabled={aiLoading || analyzing || !prompt.trim()}
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
                min={1} max={15} step={1}
                value={[quizNum]}
                onValueChange={([v]) => setQuizNum(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Time Limit: {quizTime} minutes</Label>
              <Slider
                min={5} max={60} step={5}
                value={[quizTime]}
                onValueChange={([v]) => setQuizTime(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject / Topic</Label>
              <Input
                value={quizSubject}
                onChange={(e) => setQuizSubject(e.target.value)}
                placeholder="e.g. Physics, Maths, Biology…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuizOpen(false)}>Cancel</Button>
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
