import { useState, useEffect } from "react";
import { ArrowLeft, Save, Edit3, Eye, Volume2, Copy, Loader2, Sparkles, Pause, Square, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import MarkdownMessage from "@/components/MarkdownMessage";
import { getNotes, saveNote, updateNote, Note } from "@/lib/notes";
import { groqChat, buildSystemPrompt, GroqError, ApiMessage } from "@/lib/groq";
import { speak, pauseSpeech, resumeSpeech, stopSpeech, TtsState } from "@/lib/tts";
import { LANGUAGE_VOICE_MAP } from "@/lib/groq";

export default function NoteDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { settings } = useApp();
  const { toast } = useToast();
  const isNew = id === "new";

  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("General");
  const [editing, setEditing] = useState(isNew);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [ttsState, setTtsState] = useState<TtsState>("stopped");

  useEffect(() => {
    if (!isNew) {
      const found = getNotes().find((n) => n.id === id);
      if (found) { setContent(found.content); setSubject(found.subject); }
    }
  }, [id, isNew]);

  async function handleSave() {
    if (!content.trim()) { toast({ title: "Note cannot be empty", variant: "destructive" }); return; }
    if (isNew) {
      saveNote({ content, subject: subject || "General" });
      toast({ title: "Note saved!" });
      navigate("/notebook");
    } else {
      updateNote(id, { content, subject });
      toast({ title: "Note updated!" });
      setEditing(false);
    }
  }

  async function runAiAssist() {
    if (!aiPrompt.trim() || !content.trim()) return;
    setAiLoading(true);
    try {
      const sysPrompt = buildSystemPrompt(settings.aiResponseLanguage, settings.tone);
      const msgs: ApiMessage[] = [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Note content:\n\n${content}\n\nInstruction: ${aiPrompt}` },
      ];
      const res = await groqChat(msgs);
      setContent(res);
      setEditing(true);
      setAiPrompt("");
    } catch (e) {
      toast({ title: "AI Error", description: e instanceof GroqError ? e.message : "Something went wrong", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function handleReadAloud() {
    if (ttsState === "playing") { pauseSpeech(); setTtsState("paused"); return; }
    if (ttsState === "paused") { resumeSpeech(); setTtsState("playing"); return; }
    const voiceLang = LANGUAGE_VOICE_MAP[settings.aiResponseLanguage] ?? "en-US";
    speak(content, { lang: voiceLang, volume: settings.volume, pitch: settings.pitch, rate: settings.rate }, setTtsState);
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* TTS bar */}
      {(ttsState === "playing" || ttsState === "paused") && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
          <Volume2 size={13} className="text-primary" />
          <span className="text-xs text-primary flex-1">{ttsState === "playing" ? "Reading aloud…" : "Paused"}</span>
          {ttsState === "playing"
            ? <button onClick={() => { pauseSpeech(); setTtsState("paused"); }} className="text-xs text-primary hover:underline flex items-center gap-1"><Pause size={11} /> Pause</button>
            : <button onClick={() => { resumeSpeech(); setTtsState("playing"); }} className="text-xs text-primary hover:underline flex items-center gap-1"><Play size={11} /> Resume</button>}
          <button onClick={() => { stopSpeech(); setTtsState("stopped"); }} className="text-xs text-destructive hover:underline flex items-center gap-1 ml-1"><Square size={11} /> Stop</button>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/notebook")}>
          <ArrowLeft size={18} />
        </Button>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject / Topic"
          className="flex-1 h-8 border-none shadow-none px-0 font-semibold text-base focus-visible:ring-0 min-w-0"
        />
        <div className="flex gap-1 shrink-0">
          {!editing && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleReadAloud} title="Read aloud">
                <Volume2 size={15} />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(content).catch(() => {}); toast({ title: "Copied!" }); }}>
                <Copy size={15} />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
                <Edit3 size={15} />
              </Button>
            </>
          )}
          {editing && !isNew && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}><Eye size={15} /></Button>
          )}
          {editing && (
            <Button size="sm" className="h-8 gap-1" onClick={handleSave}><Save size={14} /> Save</Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ fontSize: settings.fontSize }}>
        {editing ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here… (Markdown supported)"
            className="w-full h-full min-h-[300px] resize-none border-none shadow-none focus-visible:ring-0 p-0"
            autoFocus={isNew}
          />
        ) : (
          <MarkdownMessage content={content || "*Empty note. Tap edit to add content.*"} />
        )}
      </div>

      {/* AI Assistant */}
      <div className="border-t border-border bg-muted/30 px-3 py-3 shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Sparkles size={10} /> AI ASSISTANT · {settings.aiResponseLanguage} · {settings.tone}
        </p>
        <div className="flex gap-2">
          <Input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder='"Simplify", "Translate", "Add examples"…'
            className="text-xs h-9"
            onKeyDown={(e) => { if (e.key === "Enter") runAiAssist(); }}
          />
          <Button size="sm" className="h-9 shrink-0" onClick={runAiAssist} disabled={aiLoading || !aiPrompt.trim()}>
            {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
