import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTES_KEY = "echo_ai_notes";
const SETTINGS_KEY = "echo_ai_settings";

export interface Note {
  id: string;
  subject: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  aiLanguage: string;
  tone: "casual" | "formal";
  fontSize: number;
  ttsVolume: number;
  ttsPitch: number;
  ttsRate: number;
  darkMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiLanguage: "English",
  tone: "casual",
  fontSize: 16,
  ttsVolume: 1.0,
  ttsPitch: 1.0,
  ttsRate: 0.9,
  darkMode: false,
};

function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function getNotes(): Promise<Note[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
  const notes = await getNotes();
  const now = new Date().toISOString();
  const newNote: Note = { ...note, id: makeId(), createdAt: now, updatedAt: now };
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify([newNote, ...notes]));
  return newNote;
}

export async function updateNote(id: string, patch: Partial<Pick<Note, "content" | "subject">>): Promise<void> {
  const notes = await getNotes();
  const updated = notes.map((n) =>
    n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
  );
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updated));
}

export async function deleteNote(id: string): Promise<void> {
  const notes = await getNotes();
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes.filter((n) => n.id !== id)));
}

export async function clearAllNotes(): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify([]));
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function persistSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
