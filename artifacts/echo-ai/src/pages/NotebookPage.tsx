import { useState, useEffect } from "react";
import { Plus, Search, Trash2, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { Note, getNotes, deleteNote, noteTitle } from "@/lib/notes";
import { formatDistanceToNow } from "date-fns";

export default function NotebookPage() {
  const [, navigate] = useLocation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");

  function reload() { setNotes(getNotes()); }

  useEffect(() => { reload(); }, []);

  const filtered = notes.filter(
    (n) =>
      !search ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.subject.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm("Delete this note?")) { deleteNote(id); reload(); }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">Notebook</h1>
          <Button size="sm" onClick={() => navigate("/notebook/new")} className="h-8 gap-1">
            <Plus size={14} /> New
          </Button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <BookOpen size={56} className="text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-lg">
                {notes.length === 0 ? "Your Notebook is Empty" : "No notes found"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {notes.length === 0
                  ? "Save AI responses from the Scanner or create a new note."
                  : "Try a different search term."}
              </p>
            </div>
            {notes.length === 0 && (
              <Button onClick={() => navigate("/notebook/new")} variant="outline" className="gap-1">
                <Plus size={14} /> Create a Note
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((note) => (
              <li
                key={note.id}
                onClick={() => navigate(`/notebook/${note.id}`)}
                className="flex items-start gap-3 px-4 py-4 hover:bg-accent/40 cursor-pointer group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{noteTitle(note.content)}</p>
                    {note.subject && note.subject !== "General" && (
                      <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {note.subject}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {note.content.replace(/[#*_`[\]()>]/g, "").trim()}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                    {formatDistanceToNow(new Date(note.savedAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDelete(note.id, e)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
