const STORAGE_KEY = "echo_ai_notes";

export interface Note {
  id: string;
  content: string;
  subject: string;
  savedAt: string;
}

export function getNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveNote(note: Omit<Note, "id" | "savedAt">): Note {
  const notes = getNotes();
  const newNote: Note = {
    id: crypto.randomUUID(),
    ...note,
    savedAt: new Date().toISOString(),
  };
  notes.unshift(newNote);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  return newNote;
}

export function updateNote(id: string, updates: Partial<Pick<Note, "content" | "subject">>): void {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notes[idx] = { ...notes[idx], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }
}

export function deleteNote(id: string): void {
  const notes = getNotes().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function clearAllNotes(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function noteTitle(content: string): string {
  const stripped = content.replace(/[#*_`[\]()>]/g, "").trim();
  return stripped.length <= 50 ? stripped : stripped.slice(0, 50) + "…";
}
