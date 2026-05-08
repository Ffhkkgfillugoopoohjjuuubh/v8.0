import type { Tone } from "./groq";

const KEY = "echo_ai_settings";

export interface AppSettings {
  aiResponseLanguage: string;
  tone: Tone;
  fontSize: number;
  volume: number;
  pitch: number;
  rate: number;
  darkMode: boolean;
}

const DEFAULTS: AppSettings = {
  aiResponseLanguage: "English",
  tone: "casual",
  fontSize: 16,
  volume: 1,
  pitch: 1,
  rate: 0.9,
  darkMode: false,
};

export function loadSettings(): AppSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
