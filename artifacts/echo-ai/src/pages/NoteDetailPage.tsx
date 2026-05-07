import { useState, useEffect } from "react";
import { ArrowLeft, Save, Edit3, Eye, Volume2, Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import MarkdownMessage from "@/components/MarkdownMessage";
import { getNotes, saveNote, updateNote, Note } from "@/lib/notes";
import { groqChat, buildSystemPrompt, detectsMath, GroqError } from "@/lib/groq";

export default function NoteDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { settings, speakText } = useApp();
  const { toast } = useToast();
  const isNew = id === "new";

  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("General");
  const [editing, setEditing] = useState(isNew);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      const found = getNotes().find((n) => n.id === id);
      if (found) {
        setNote(found);
        setContent(found.content);
        setSubject(found.subject);
      }
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
      const sysPr = buildSystemPrompt(settings.aiResponseLanguage, detectsMath(content));
      const res = await groqChat([
        { role: "system", content: sysPr },
        { role: "user", content: `Note content:\n\n${content}\n\nInstruction: ${aiPrompt}` },
      ]);
      setContent(res);
      setEditing(true);
      setAiPrompt("");
    } catch (e) {
      toast({
        title: "AI Error",
        description: e instanceof GroqError ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/notebook")}>
          <ArrowLeft size={18} />
        </Button>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject / Topic"
          className="flex-1 h-8 border-none shadow-none px-0 font-semibold text-base focus-visible:ring-0"
        />
        <div className="flex gap-1">
          {!editing && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => speakText(content)}>
                <Volume2 size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => { navigator.clipboard.writeText(content); toast({ title: "Copied!" }); }}
              >
                <Copy size={15} />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
                <Edit3 size={15} />
              </Button>
            </>
          )}
          {editing && !isNew && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}>
              <Eye size={15} />
            </Button>
          )}
          {editing && (
            <Button size="sm" className="h-8" onClick={handleSave}>
              <Save size={14} className="mr-1" /> Save
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {editing ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here… (Markdown supported)"
            className="w-full h-full min-h-[300px] resize-none border-none shadow-none focus-visible:ring-0 p-0"
            style={{ fontSize: settings.fontSize }}
            autoFocus={isNew}
          />
        ) : (
          <MarkdownMessage content={content || "*Empty note. Tap edit to add content.*"} />
        )}
      </div>

      {/* AI Assistant */}
      <div className="border-t border-border bg-muted/30 px-3 py-3 shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Sparkles size={10} /> AI ASSISTANT
        </p>
        <div className="flex gap-2">
          <Input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder='e.g. "Simplify this" or "Translate to Bengali"'
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
