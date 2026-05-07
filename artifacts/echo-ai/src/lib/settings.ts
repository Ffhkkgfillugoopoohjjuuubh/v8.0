const KEY = "echo_ai_settings";

export interface AppSettings {
  aiResponseLanguage: string;
  voiceLanguage: string;
  fontSize: number;
  volume: number;
  pitch: number;
  rate: number;
  darkMode: boolean;
}

const DEFAULTS: AppSettings = {
  aiResponseLanguage: "English",
  voiceLanguage: "en-US",
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

export const VOICE_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-IN", name: "English (India)" },
  { code: "hi-IN", name: "Hindi" },
  { code: "bn-IN", name: "Bengali" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "kn-IN", name: "Kannada" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "mr-IN", name: "Marathi" },
  { code: "gu-IN", name: "Gujarati" },
  { code: "ur-PK", name: "Urdu" },
  { code: "ar-SA", name: "Arabic" },
  { code: "fr-FR", name: "French" },
  { code: "es-ES", name: "Spanish" },
  { code: "de-DE", name: "German" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "ru-RU", name: "Russian" },
  { code: "nl-NL", name: "Dutch" },
  { code: "tr-TR", name: "Turkish" },
  { code: "vi-VN", name: "Vietnamese" },
  { code: "th-TH", name: "Thai" },
  { code: "id-ID", name: "Indonesian" },
  { code: "pl-PL", name: "Polish" },
  { code: "sv-SE", name: "Swedish" },
];
